import { pool } from "../db/pool.js";

const writableRoles = new Set(["admin", "manager", "sales"]);

const normalizeEmail = value => String(value || "").trim().toLowerCase();

async function getMemberIdentity(userId) {
  const { rows } = await pool.query(
    `select u.email, coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1)) name
       from auth.users u
       left join public.profiles p on p.user_id = u.id
      where u.id = $1`,
    [userId],
  );
  return rows[0] ?? { email: "", name: "" };
}

function leadBelongsTo(lead, email) {
  return normalizeEmail(lead?.ownerEmail) === normalizeEmail(email);
}

function filterWorkspaceForMember(state, email) {
  if (!state || typeof state !== "object") return state;
  const leads = Array.isArray(state.leads) ? state.leads.filter(lead => leadBelongsTo(lead, email)) : [];
  const deletedLeads = Array.isArray(state.deletedLeads) ? state.deletedLeads.filter(lead => leadBelongsTo(lead, email)) : [];
  const names = new Set([...leads, ...deletedLeads].map(lead => String(lead.name || "").toLowerCase()));
  const feed = Array.isArray(state.feed) ? state.feed.filter(item => names.has(String(item?.[1] || "").toLowerCase())) : [];
  return { ...state, leads, deletedLeads, feed };
}

function mergeUniqueFeed(current = [], incoming = []) {
  const seen = new Set(current.map(item => JSON.stringify(item)));
  return [...incoming.filter(item => !seen.has(JSON.stringify(item))), ...current];
}

function mergeRecordCounters(current = {}, incoming = {}) {
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    const previous = merged[key];
    if (!previous || Number(value?.year) > Number(previous?.year) || (Number(value?.year) === Number(previous?.year) && Number(value?.value) > Number(previous?.value))) merged[key] = value;
  }
  return merged;
}

function mergeWorkspaceForMember(currentState, incomingState, email) {
  const current = currentState && typeof currentState === "object" ? currentState : {};
  const incoming = incomingState && typeof incomingState === "object" ? incomingState : {};
  const otherLeads = (current.leads || []).filter(lead => !leadBelongsTo(lead, email));
  const memberLeads = (incoming.leads || []).filter(lead => leadBelongsTo(lead, email));
  const otherDeleted = (current.deletedLeads || []).filter(lead => !leadBelongsTo(lead, email));
  const memberDeleted = (incoming.deletedLeads || []).filter(lead => leadBelongsTo(lead, email));
  return {
    ...current,
    ...incoming,
    leads: [...memberLeads, ...otherLeads],
    deletedLeads: [...memberDeleted, ...otherDeleted],
    feed: mergeUniqueFeed(current.feed, incoming.feed),
    recordCounters: mergeRecordCounters(current.recordCounters, incoming.recordCounters),
  };
}

async function findMembership(client, userId) {
  const { rows } = await client.query(
    `select m.organization_id, m.role, m.status, o.name
       from public.organization_members m
       join public.organizations o on o.id = m.organization_id
      where m.user_id = $1 and m.status = 'active'
      order by m.created_at
      limit 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function ensureMembership(userId) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);
    let membership = await findMembership(client, userId);
    if (!membership) {
      const legacy = await client.query("select state from public.crm_user_workspaces where owner_id = $1", [userId]);
      const organization = await client.query(
        `insert into public.organizations (name, created_by, personal_owner_id)
         values ('My organization', $1, $1)
         on conflict (personal_owner_id) do update set updated_at = now()
         returning id, name`,
        [userId],
      );
      const organizationId = organization.rows[0].id;
      await client.query(
        `insert into public.profiles (user_id) values ($1)
         on conflict (user_id) do nothing`,
        [userId],
      );
      await client.query(
        `insert into public.organization_members (organization_id, user_id, role, status)
         values ($1, $2, 'admin', 'active')
         on conflict (organization_id, user_id)
         do update set role = 'admin', status = 'active', updated_at = now()`,
        [organizationId, userId],
      );
      await client.query(
        `insert into public.organization_workspaces (organization_id, state)
         values ($1, $2::jsonb)
         on conflict (organization_id) do nothing`,
        [organizationId, JSON.stringify(legacy.rows[0]?.state ?? {})],
      );
      membership = { organization_id: organizationId, role: "admin", status: "active", name: organization.rows[0].name };
    }
    await client.query("commit");
    return membership;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWorkspace(userId) {
  const membership = await ensureMembership(userId);
  const { rows } = await pool.query(
    `select w.state, w.updated_at
       from public.organization_workspaces w
      where w.organization_id = $1`,
    [membership.organization_id],
  );
  const workspace = rows[0] ?? { state: null, updated_at: null };
  const identity = await getMemberIdentity(userId);
  return {
    ...workspace,
    state: membership.role === "admin" ? workspace.state : filterWorkspaceForMember(workspace.state, identity.email),
    organization: { id: membership.organization_id, name: membership.name, role: membership.role },
  };
}

export async function saveWorkspace(userId, state) {
  const membership = await ensureMembership(userId);
  if (!writableRoles.has(membership.role)) {
    const error = new Error("Your role has read-only access to this workspace.");
    error.statusCode = 403;
    throw error;
  }
  if (membership.role === "admin") {
    const result = await pool.query(
      `update public.organization_workspaces
          set state = $2::jsonb, updated_at = now()
        where organization_id = $1`,
      [membership.organization_id, JSON.stringify(state)],
    );
    if (!result.rowCount) throw new Error("Organization workspace is unavailable.");
    return;
  }
  const identity = await getMemberIdentity(userId);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const current = await client.query(
      `select state from public.organization_workspaces where organization_id = $1 for update`,
      [membership.organization_id],
    );
    if (!current.rowCount) throw new Error("Organization workspace is unavailable.");
    const merged = mergeWorkspaceForMember(current.rows[0].state, state, identity.email);
    await client.query(
      `update public.organization_workspaces set state = $2::jsonb, updated_at = now() where organization_id = $1`,
      [membership.organization_id, JSON.stringify(merged)],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function reassignOrganizationLeads(actorId, fromUserId, toUserId) {
  const membership = await ensureMembership(actorId);
  if (membership.role !== "admin") {
    const error = new Error("Administrator access is required to reassign leads.");
    error.statusCode = 403;
    throw error;
  }
  if (fromUserId === toUserId) {
    const error = new Error("Choose a different user to receive these leads.");
    error.statusCode = 400;
    throw error;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const members = await client.query(
      `select m.user_id id, u.email, coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1)) name
         from public.organization_members m
         join auth.users u on u.id = m.user_id
         left join public.profiles p on p.user_id = m.user_id
        where m.organization_id = $1 and m.user_id = any($2::uuid[]) and m.status = 'active'`,
      [membership.organization_id, [actorId, fromUserId, toUserId]],
    );
    const source = members.rows.find(user => user.id === fromUserId);
    const target = members.rows.find(user => user.id === toUserId);
    const actor = members.rows.find(user => user.id === actorId) ?? await getMemberIdentity(actorId);
    if (!source || !target) {
      const error = new Error("Both users must be active members of this organization.");
      error.statusCode = 400;
      throw error;
    }
    const workspace = await client.query(
      `select state from public.organization_workspaces where organization_id = $1 for update`,
      [membership.organization_id],
    );
    if (!workspace.rowCount) throw new Error("Organization workspace is unavailable.");
    const state = workspace.rows[0].state && typeof workspace.rows[0].state === "object" ? workspace.rows[0].state : {};
    const changed = [];
    state.leads = (state.leads || []).map(lead => {
      if (!leadBelongsTo(lead, source.email)) return lead;
      const updated = { ...lead, owner: target.name, ownerEmail: target.email, assignedBy: actor.name || actor.email };
      updated.timeline = [{ title: "Lead reassigned", detail: `${source.name} → ${target.name}`, when: "Just now", at: Date.now(), actor: actor.name || actor.email }, ...(updated.timeline || [])];
      changed.push(updated);
      return updated;
    });
    state.feed = Array.isArray(state.feed) ? state.feed : [];
    for (const lead of changed) state.feed.unshift(["Lead reassigned", lead.name, `${source.name} → ${target.name}`, "Just now", actor.email || actor.name]);
    await client.query(
      `update public.organization_workspaces set state = $2::jsonb, updated_at = now() where organization_id = $1`,
      [membership.organization_id, JSON.stringify(state)],
    );
    await client.query("commit");
    return changed.length;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listOrganizationMembers(userId) {
  const membership = await ensureMembership(userId);
  const { rows } = await pool.query(
    `select m.user_id id, coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1)) name,
            u.email, m.role,
            case when u.email_confirmed_at is null then 'invited' else m.status end status,
            m.created_at
       from public.organization_members m
       join auth.users u on u.id = m.user_id
       left join public.profiles p on p.user_id = m.user_id
      where m.organization_id = $1
      order by m.created_at`,
    [membership.organization_id],
  );
  return { organization: { id: membership.organization_id, name: membership.name, role: membership.role }, users: rows };
}

export async function addOrganizationMember(actorId, invitedUser, role, displayName) {
  const membership = await ensureMembership(actorId);
  if (membership.role !== "admin") {
    const error = new Error("Administrator access is required to invite users.");
    error.statusCode = 403;
    throw error;
  }
  await pool.query(
    `insert into public.profiles (user_id, display_name)
     values ($1, $2)
     on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()`,
    [invitedUser.id, displayName],
  );
  await pool.query(
    `insert into public.organization_members (organization_id, user_id, role, status)
     values ($1, $2, $3, 'active')
     on conflict (organization_id, user_id)
     do update set role = excluded.role, status = 'active', updated_at = now()`,
    [membership.organization_id, invitedUser.id, role],
  );
}

export async function updateOrganizationMember(actorId, targetUserId, role, status, displayName) {
  const membership = await ensureMembership(actorId);
  if (membership.role !== "admin") {
    const error = new Error("Administrator access is required to manage users.");
    error.statusCode = 403;
    throw error;
  }
  if (actorId === targetUserId && status !== "active") {
    const error = new Error("You cannot suspend your own administrator account.");
    error.statusCode = 400;
    throw error;
  }
  const current = await pool.query(
    `select role from public.organization_members
      where organization_id = $1 and user_id = $2`,
    [membership.organization_id, targetUserId],
  );
  if (!current.rowCount) {
    const error = new Error("This user is not a member of your organization.");
    error.statusCode = 404;
    throw error;
  }
  if (current.rows[0].role === "admin" && role !== "admin") {
    const admins = await pool.query(
      `select count(*)::int total from public.organization_members
        where organization_id = $1 and role = 'admin' and status = 'active'`,
      [membership.organization_id],
    );
    if (admins.rows[0].total <= 1) {
      const error = new Error("Keep at least one active organization administrator.");
      error.statusCode = 400;
      throw error;
    }
  }
  await pool.query(
    `update public.organization_members
        set role = $3, status = $4, updated_at = now()
      where organization_id = $1 and user_id = $2`,
    [membership.organization_id, targetUserId, role, status],
  );
  await pool.query(
    `insert into public.profiles (user_id, display_name)
     values ($1, $2)
     on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()`,
    [targetUserId, displayName],
  );
}

export async function removeOrganizationMember(actorId, targetUserId) {
  const membership = await ensureMembership(actorId);
  if (membership.role !== "admin") {
    const error = new Error("Administrator access is required to remove users.");
    error.statusCode = 403;
    throw error;
  }
  if (actorId === targetUserId) {
    const error = new Error("You cannot remove your own administrator account.");
    error.statusCode = 400;
    throw error;
  }
  const assigned = await pool.query(
    `select count(*)::int total
       from public.organization_workspaces w
       join auth.users u on u.id = $2
      cross join lateral jsonb_array_elements(coalesce(w.state->'leads', '[]'::jsonb)) lead
      where w.organization_id = $1
        and lower(coalesce(lead->>'ownerEmail', '')) = lower(coalesce(u.email, ''))`,
    [membership.organization_id, targetUserId],
  );
  if (assigned.rows[0]?.total > 0) {
    const error = new Error("Reassign this user’s leads before removing their account.");
    error.statusCode = 409;
    throw error;
  }
  const result = await pool.query(
    `delete from public.organization_members
      where organization_id = $1 and user_id = $2`,
    [membership.organization_id, targetUserId],
  );
  if (!result.rowCount) {
    const error = new Error("This user is not a member of your organization.");
    error.statusCode = 404;
    throw error;
  }
}
