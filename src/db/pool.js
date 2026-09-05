import pg from "pg";
import { env } from "../config/env.js";

export function databaseConnectionString() {
  const connection = new URL(env.DATABASE_URL);
  const direct = connection.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct && env.SUPABASE_DB_POOLER_REGION) {
    connection.hostname = `aws-0-${env.SUPABASE_DB_POOLER_REGION}.pooler.supabase.com`;
    connection.port = "5432";
    connection.username = `postgres.${direct[1]}`;
  }
  return connection.toString();
}

export const pool = new pg.Pool({
  connectionString: databaseConnectionString(),
  ssl: { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED },
  max: 10,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
});

// Idle clients can be closed by a remote pooler during transient network changes.
// Handling the pool event keeps one dropped connection from terminating the server;
// the next request receives a fresh client from the pool.
pool.on("error", error => {
  console.error("Database connection was interrupted; the pool will reconnect.", error.message);
});
