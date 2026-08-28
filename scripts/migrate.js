import { pool } from "../src/db/pool.js";
import { readdir, readFile } from "node:fs/promises";

try {
  await pool.query(`create table if not exists public.crm_schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  const directory = new URL("../migrations/", import.meta.url);
  const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  for (const file of files) {
    const exists = await pool.query("select 1 from public.crm_schema_migrations where name = $1", [file]);
    if (exists.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(await readFile(new URL(file, directory), "utf8"));
      await client.query("insert into public.crm_schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  console.log("Supabase CRM schema is ready.");
} finally {
  await pool.end();
}
