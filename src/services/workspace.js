import { pool } from "../db/pool.js";
import { applyAssignmentRules } from "./assignment-rules.js";

const organizationPlanSeats = Object.freeze({ starter: 5, growth: 15, scale: 50 });
export const permissionCatalog = Object.freeze([
  "View dashboard", "View tasks", "View leads", "View pipeline", "View proposals", "View content", "View activities", "View reports", "View settings",
  "View all leads", "Create leads", "Edit leads", "Delete leads", "Assign leads", "Import leads", "Export leads", "Manage follow-ups", "Add private notes", "Share lead details",
  "Create tasks", "Edit tasks", "Complete tasks", "Delete tasks",
  "Move pipeline leads", "Manage pipelines",
  "Create proposals", "Edit proposals", "Download proposals", "Send proposals",
  "Create content", "Edit content", "Delete content", "Send content",
  "Log activities", "Edit activities", "Delete activities", "Export reports",
  "Manage fields", "Manage products", "Manage client groups", "Manage lead sources", "Manage automations", "Manage notifications", "Manage forms", "Manage integrations", "Manage regional settings", "Manage branding",
  "View team", "Invite users", "Edit users", "Suspend users", "Remove users", "Manage permissions", "Export data", "Edit CRM settings", "Manage users",
]);
const allPermissions = [...permissionCatalog];
const defaultRolePermissions = Object.freeze({
  admin: allPermissions,
  manager: ["View dashboard", "View tasks", "View leads", "View all leads", "Create leads", "Edit leads", "Delete leads", "Assign leads", "Import leads", "Export leads", "Manage follow-ups", "Add private notes", "Share lead details", "Create tasks", "Edit tasks", "Complete tasks", "Delete tasks", "View pipeline", "Move pipeline leads", "View proposals", "Create proposals", "Edit proposals", "Download proposals", "View content", "Create content", "Edit content", "Delete content", "Send content", "View activities", "Log activities", "View reports", "Export reports", "View team"],
  sales: ["View dashboard", "View tasks", "View leads", "Create leads", "Edit leads", "Manage follow-ups", "Add private notes", "Share lead details", "Create tasks", "Edit tasks", "Complete tasks", "View pipeline", "Move pipeline leads", "View proposals", "Create proposals", "Edit proposals", "Download proposals", "View content", "Send content", "View activities", "Log activities"],
  viewer: ["View dashboard", "View tasks", "View leads", "View pipeline", "View proposals", "View content", "View activities", "View reports"],
});

const memberPermissions = membership => new Set(membership.role === "admin"
  ? defaultRolePermissions.admin
  : membership.role_permissions?.[membership.role] || defaultRolePermissions[membership.role] || []);

function proposalRecords(state) {
  return Object.fromEntries((state?.leads || []).flatMap(lead => (lead.proposals || []).map(proposal => [`${lead.leadNumber}:${proposal.id}`, proposal])));
}

function assertProposalChangesAllowed(previous, incoming, permissions) {
  const before = proposalRecords(previous), after = proposalRecords(incoming);
  const touchedLeads = new Set((incoming?.leads || []).filter(lead => Object.hasOwn(lead, "proposals")).map(lead => lead.leadNumber));
  const keys = new Set([...Object.keys(after), ...Object.keys(before).filter(key => touchedLeads.has(key.split(":")[0]))]);
  const changed = [...keys].filter(key => JSON.stringify(before[key] || null) !== JSON.stringify(after[key] || null));
  const created = changed.some(key => !before[key] && after[key]);
  const edited = changed.some(key => before[key]);
  if (created && !permissions.has("Create proposals")) {
    const error = new Error("Your role cannot create proposals.");
    error.statusCode = 403;
    throw error;
  }
  if (edited && !permissions.has("Edit proposals") && !permissions.has("Create proposals")) {
    const error = new Error("Your role cannot edit proposals.");
    error.statusCode = 403;
    throw error;
  }
  const sent = changed.some(key => after[key]?.status === "sent" && before[key]?.status !== "sent");
  if (sent && !permissions.has("Send proposals")) {
    const error = new Error("Your role cannot confirm proposal delivery.");
    error.statusCode = 403;
    throw error;
  }
}

const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const permits = (permissions, permission, legacy = "") => permissions.has(permission) || (legacy && permissions.has(legacy));

function assertTaskChangesAllowed(previous, incoming, permissions) {
  if (!Object.hasOwn(incoming || {}, "tasks")) return;
  const before = Object.fromEntries((previous.tasks || []).map(task => [task.id, task]));
  const after = Object.fromEntries((incoming.tasks || []).map(task => [task.id, task]));
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[id], after[id])) continue;
    if (!before[id] && !permits(permissions, "Create tasks", "Edit leads")) throw Object.assign(new Error("Your role cannot create tasks."), { statusCode: 403 });
    if (!after[id] && !permits(permissions, "Delete tasks", "Edit leads")) throw Object.assign(new Error("Your role cannot delete tasks."), { statusCode: 403 });
    if (before[id] && after[id]) {
      const beforeWithoutCompletion = { ...before[id], completedAt: null };
      const afterWithoutCompletion = { ...after[id], completedAt: null };
      if (same(beforeWithoutCompletion, afterWithoutCompletion)) {
        if (!permits(permissions, "Complete tasks", "Edit leads")) throw Object.assign(new Error("Your role cannot complete tasks."), { statusCode: 403 });
      } else if (!permits(permissions, "Edit tasks", "Edit leads")) throw Object.assign(new Error("Your role cannot edit tasks."), { statusCode: 403 });
    }
  }
}

function assertLeadChangesAllowed(previous, incoming, permissions) {
  if (!Object.hasOwn(incoming || {}, "leads")) return;
  const before = Object.fromEntries((previous.leads || []).map(lead => [lead.leadNumber, lead]));
  const after = Object.fromEntries((incoming.leads || []).map(lead => [lead.leadNumber, lead]));
  const deleted = new Set((incoming.deletedLeads || []).map(lead => lead.leadNumber));
  for (const [id, lead] of Object.entries(after)) {
    if (!before[id]) {
      if (!permits(permissions, "Create leads", "Edit leads")) throw Object.assign(new Error("Your role cannot create leads."), { statusCode: 403 });
      continue;
    }
    if (same(before[id], lead)) continue;
    const prior = before[id];
    if ((prior.ownerEmail !== lead.ownerEmail || prior.owner !== lead.owner) && !permits(permissions, "Assign leads", "Edit leads")) throw Object.assign(new Error("Your role cannot assign leads."), { statusCode: 403 });
    if (prior.stage !== lead.stage && !permits(permissions, "Move pipeline leads", "Edit leads")) throw Object.assign(new Error("Your role cannot move pipeline leads."), { statusCode: 403 });
    if (["followAt", "followUpDisabled", "due"].some(key => !same(prior[key], lead[key])) && !permits(permissions, "Manage follow-ups", "Edit leads")) throw Object.assign(new Error("Your role cannot change follow-ups."), { statusCode: 403 });
    const ignored = new Set(["proposals", "proposalNumber", "timeline", "owner", "ownerEmail", "stage", "followAt", "followUpDisabled", "notifiedFollowAt", "due"]);
    const compact = value => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !ignored.has(key)));
    if (!same(compact(prior), compact(lead)) && !permissions.has("Edit leads")) throw Object.assign(new Error("Your role cannot edit leads."), { statusCode: 403 });
  }
  if (Object.keys(before).some(id => !after[id] && deleted.has(id)) && !permissions.has("Delete leads")) throw Object.assign(new Error("Your role cannot delete leads."), { statusCode: 403 });
}

function assertConfigurationChangesAllowed(previous, incoming, permissions) {
  const controls = {
    stages: "Manage pipelines", pipelines: "Manage pipelines", fields: "Manage fields", products: "Manage products",
    groups: "Manage client groups", sources: "Manage lead sources", sequences: "Manage automations", checklists: "Manage automations",
    notifications: "Manage notifications", followupDefaults: "Manage follow-ups", metaConnected: "Manage integrations",
  };
  for (const [key, permission] of Object.entries(controls)) {
    if (Object.hasOwn(incoming || {}, key) && !same(previous[key], incoming[key]) && !permits(permissions, permission, "Edit CRM settings")) {
      throw Object.assign(new Error(`Your role cannot change ${key}.`), { statusCode: 403 });
    }
  }
}

const normalizeEmail = value => String(value || "").trim().toLowerCase();

function assertOrganizationRole(membership, role) {
  if (role === "admin" || Object.hasOwn(membership.role_permissions || defaultRolePermissions, role)) return;
  const error = new Error("Choose a role that exists in this organization.");
  error.statusCode = 400;
  throw error;
}

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

function filterWorkspaceForMember(state, identity) {
  if (!state || typeof state !== "object") return state;
  const leads = Array.isArray(state.leads) ? state.leads.filter(lead => leadBelongsTo(lead, identity.email)) : [];
  const deletedLeads = Array.isArray(state.deletedLeads) ? state.deletedLeads.filter(lead => leadBelongsTo(lead, identity.email)) : [];
  const feed = leads.flatMap(lead => (lead.timeline || []).map(item => [
    item.title || "Activity",
    lead.name || "Lead",
    item.detail || "",
    item.when || "Recorded",
    item.actor || identity.name || identity.email,
  ]));
  const { account: _account, users: _users, reportData: _reportData, ...shared } = state;
  return {
    ...shared,
    leads,
    deletedLeads,
    tasks: (Array.isArray(state.tasks) ? state.tasks : []).filter(task => leadBelongsTo(task, identity.email)),
    feed,
    account: { name: identity.name, email: identity.email, photo: "" },
    users: [],
    currentUserEmail: identity.email,
  };
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

const managerEditableKeys = new Set([
  "library", "stages", "fields", "pipelines", "products", "groups", "checklists",
  "sequences", "sources", "notifications", "followupDefaults", "metaConnected",
]);

function mergeWorkspaceForMember(currentState, incomingState, identity, role) {
  const current = currentState && typeof currentState === "object" ? currentState : {};
  const incoming = incomingState && typeof incomingState === "object" ? incomingState : {};
  const merged = { ...current };
  if (role === "manager") {
    for (const key of managerEditableKeys) if (Object.hasOwn(incoming, key)) merged[key] = incoming[key];
  }
  const otherLeads = (current.leads || []).filter(lead => !leadBelongsTo(lead, identity.email));
  const memberLeads = (incoming.leads || []).filter(lead => leadBelongsTo(lead, identity.email));
  const otherDeleted = (current.deletedLeads || []).filter(lead => !leadBelongsTo(lead, identity.email));
  const memberDeleted = (incoming.deletedLeads || []).filter(lead => leadBelongsTo(lead, identity.email));
  const memberNames = new Set([...memberLeads, ...memberDeleted].map(lead => String(lead.name || "").toLowerCase()));
  const memberFeed = (incoming.feed || []).filter(item => memberNames.has(String(item?.[1] || "").toLowerCase()));
  return {
    ...merged,
    leads: [...memberLeads, ...otherLeads],
    deletedLeads: [...memberDeleted, ...otherDeleted],
    feed: mergeUniqueFeed(current.feed, memberFeed),
    recordCounters: mergeRecordCounters(current.recordCounters, incoming.recordCounters),
    tasks: [
      ...(Array.isArray(current.tasks) ? current.tasks : []).filter(task => !leadBelongsTo(task, identity.email)),
      ...(Array.isArray(incoming.tasks) ? incoming.tasks : (current.tasks || [])).filter(task => leadBelongsTo(task, identity.email)),
    ],
  };
}

async function findMembership(client, userId) {
  const { rows } = await client.query(
    `select m.organization_id, m.role, m.status, o.name, o.plan, o.role_permissions
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
      const existing = await client.query(
        `select status from public.organization_members where user_id = $1 order by created_at limit 1`,
        [userId],
      );
      if (existing.rowCount) {
        const error = new Error("Your organization access has been suspended. Contact an administrator.");
        error.statusCode = 403;
        throw error;
      }
      const legacy = await client.query("select state from public.crm_user_workspaces where owner_id = $1", [userId]);
      const organization = await client.query(
        `insert into public.organizations (name, created_by, personal_owner_id, role_permissions)
         values ('My organization', $1, $1, $2::jsonb)
         on conflict (personal_owner_id) do update set updated_at = now()
         returning id, name`,
        [userId, JSON.stringify(defaultRolePermissions)],
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
      membership = { organization_id: organizationId, role: "admin", status: "active", name: organization.rows[0].name, plan: "starter", role_permissions: defaultRolePermissions };
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

export async function requireOrganizationAdmin(userId) {
  const membership = await ensureMembership(userId);
  if (membership.role !== "admin") {
    const error = new Error("Administrator access is required to manage users.");
    error.statusCode = 403;
    throw error;
  }
  return membership;
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
  let state = membership.role === "admin" ? workspace.state : filterWorkspaceForMember(workspace.state, identity);
  if (!memberPermissions(membership).has("View proposals") && state?.leads) {
    state = { ...state, leads: state.leads.map(({ proposals: _proposals, proposalNumber: _proposalNumber, ...lead }) => lead) };
  }
  return {
    ...workspace,
    state,
    organization: { id: membership.organization_id, name: membership.name, role: membership.role, plan: membership.plan || "starter", rolePermissions: membership.role_permissions || defaultRolePermissions },
  };
}

export async function saveWorkspace(userId, state) {
  const membership = await ensureMembership(userId);
  const permissions = memberPermissions(membership);
  const mayWrite = membership.role === "admin" || [...permissions].some(permission => /^(Create|Edit|Delete|Assign|Import|Manage|Move|Add|Share|Log|Complete|Send)/.test(permission));
  if (!mayWrite) {
    const error = new Error("Your role has read-only access to this workspace.");
    error.statusCode = 403;
    throw error;
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
    const previous = current.rows[0].state || {};
    assertProposalChangesAllowed(previous, state, permissions);
    if (membership.role !== "admin") {
      assertTaskChangesAllowed(previous, state, permissions);
      assertLeadChangesAllowed(previous, state, permissions);
      assertConfigurationChangesAllowed(previous, state, permissions);
    }
    const merged = membership.role === 'admin'
      ? {...state, tasks:state.tasks ?? previous.tasks ?? [], assignmentRules:state.assignmentRules ?? previous.assignmentRules ?? []}
      : mergeWorkspaceForMember(previous, state, identity, membership.role);
    // Browser autosaves must not erase leads received since that tab loaded.
    const knownNumbers = new Set([...(merged.leads || []), ...(merged.deletedLeads || [])].map(lead=>lead.leadNumber));
    merged.leads = [...(merged.leads || []), ...(previous.leads || []).filter(lead=>(lead.metaLeadId || lead.integrationLeadId) && !knownNumbers.has(lead.leadNumber))];
    merged.recordCounters = mergeRecordCounters(previous.recordCounters, merged.recordCounters);
    // An older browser tab must not erase proposal drafts it never loaded.
    for (const lead of merged.leads || []) {
      if (!Object.hasOwn(lead, 'proposals')) {
        const prior = (previous.leads || []).find(item => item.leadNumber === lead.leadNumber);
        if (prior?.proposals) lead.proposals = prior.proposals;
      }
    }
    if (Array.isArray(merged.assignmentRules) && merged.assignmentRules.length) {
      const members = await client.query(
        `select u.email, coalesce(nullif(p.display_name, ''), u.email) name
         from public.organization_members m join auth.users u on u.id=m.user_id
         left join public.profiles p on p.user_id=u.id
         where m.organization_id=$1 and m.status='active' and m.role in ('admin','manager','sales')`,
        [membership.organization_id],
      );
      applyAssignmentRules(merged, previous, members.rows);
    }
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
  const plan = organizationPlanSeats[membership.plan] ? membership.plan : "starter";
  const rolePermissions = { ...(membership.role_permissions || defaultRolePermissions), admin: [...defaultRolePermissions.admin] };
  return {
    organization: { id: membership.organization_id, name: membership.name, role: membership.role, plan, seatLimit: organizationPlanSeats[plan], seatUsage: rows.length, rolePermissions },
    users: rows.map(user => ({ ...user, permissions: rolePermissions[user.role] || defaultRolePermissions[user.role] || [] })),
  };
}

export async function requireOrganizationSeat(userId) {
  const membership = await requireOrganizationAdmin(userId);
  const plan = organizationPlanSeats[membership.plan] ? membership.plan : "starter";
  const { rows } = await pool.query(
    `select count(*)::int total from public.organization_members where organization_id = $1`,
    [membership.organization_id],
  );
  const limit = organizationPlanSeats[plan];
  if ((rows[0]?.total || 0) >= limit) {
    const error = new Error(`Your ${plan} plan includes ${limit} team members. Upgrade the plan before inviting another user.`);
    error.statusCode = 409;
    throw error;
  }
  return membership;
}

export async function updateOrganizationRolePermissions(userId, rolePermissions) {
  const membership = await requireOrganizationAdmin(userId);
  const normalized = { admin: [...defaultRolePermissions.admin] };
  for (const [role, permissions] of Object.entries(rolePermissions)) {
    if (role === "admin") continue;
    if (!/^[a-z][a-z0-9_-]{1,31}$/.test(role)) {
      const error = new Error("Role names must start with a letter and use only letters, numbers, spaces, dashes, or underscores.");
      error.statusCode = 400;
      throw error;
    }
    normalized[role] = [...new Set(permissions || [])].filter(permission => permissionCatalog.includes(permission));
  }
  for (const role of ["manager", "sales", "viewer"]) normalized[role] ||= [];
  const assigned = await pool.query(
    `select distinct role from public.organization_members where organization_id = $1 and role <> 'admin'`,
    [membership.organization_id],
  );
  const missing = assigned.rows.find(({ role }) => !Object.hasOwn(normalized, role));
  if (missing) {
    const error = new Error(`Reassign users from ${missing.role} before deleting that role.`);
    error.statusCode = 409;
    throw error;
  }
  await pool.query(
    `update public.organizations set role_permissions = $2::jsonb, updated_at = now() where id = $1`,
    [membership.organization_id, JSON.stringify(normalized)],
  );
  return normalized;
}

export async function addOrganizationMember(actorId, invitedUser, role, displayName) {
  const membership = await ensureMembership(actorId);
  if (membership.role !== "admin") {
    const error = new Error("Administrator access is required to invite users.");
    error.statusCode = 403;
    throw error;
  }
  assertOrganizationRole(membership, role);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const organization = await client.query(
      `select plan from public.organizations where id = $1 for update`,
      [membership.organization_id],
    );
    const plan = organizationPlanSeats[organization.rows[0]?.plan] ? organization.rows[0].plan : "starter";
    const seats = await client.query(
      `select count(*)::int total from public.organization_members where organization_id = $1`,
      [membership.organization_id],
    );
    if ((seats.rows[0]?.total || 0) >= organizationPlanSeats[plan]) {
      const error = new Error(`Your ${plan} plan includes ${organizationPlanSeats[plan]} team members. Upgrade the plan before inviting another user.`);
      error.statusCode = 409;
      throw error;
    }
    await client.query(
      `insert into public.profiles (user_id, display_name)
       values ($1, $2)
       on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()`,
      [invitedUser.id, displayName],
    );
    await client.query(
      `insert into public.organization_members (organization_id, user_id, role, status)
       values ($1, $2, $3, 'active')
       on conflict (organization_id, user_id)
       do update set role = excluded.role, status = 'active', updated_at = now()`,
      [membership.organization_id, invitedUser.id, role],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrganizationMember(actorId, targetUserId, role, status, displayName) {
  const membership = await ensureMembership(actorId);
  if (membership.role !== "admin") {
    const error = new Error("Administrator access is required to manage users.");
    error.statusCode = 403;
    throw error;
  }
  assertOrganizationRole(membership, role);
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
