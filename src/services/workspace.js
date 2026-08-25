import { pool } from "../db/pool.js";

export async function getWorkspace(ownerId) {
  const { rows } = await pool.query(
    "select state, updated_at from crm_user_workspaces where owner_id = $1", [ownerId],
  );
  return rows[0] ?? { state: null, updated_at: null };
}

export async function saveWorkspace(ownerId, state) {
  await pool.query(
    `insert into crm_user_workspaces (owner_id, state, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (owner_id) do update set state = excluded.state, updated_at = now()`,
    [ownerId, JSON.stringify(state)],
  );
}
