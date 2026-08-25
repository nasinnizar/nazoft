import { pool } from "../src/db/pool.js";

try {
  await pool.query(`
    create table if not exists crm_user_workspaces (
      owner_id uuid primary key references auth.users(id) on delete cascade,
      state jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists crm_user_workspaces_updated_at_idx on crm_user_workspaces(updated_at desc);
  `);
  console.log("Supabase CRM schema is ready.");
} finally {
  await pool.end();
}
