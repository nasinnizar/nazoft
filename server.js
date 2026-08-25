import "dotenv/config";
import express from "express";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const workspaceId = process.env.CRM_WORKSPACE_ID || "nazoft-main";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is missing. Copy .env.example to .env.");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
});

app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));

app.get("/health", async (_request, response) => {
  try {
    await pool.query("select 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    response.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.get("/bootstrap.js", async (_request, response) => {
  response.type("application/javascript");
  try {
    const result = await pool.query("select state from crm_workspaces where id = $1", [workspaceId]);
    const state = result.rows[0]?.state ?? null;
    response.send(`window.__NAZOFT_REMOTE_STATE__=${JSON.stringify(state).replaceAll("<", "\\u003c")};`);
  } catch (error) {
    console.error("Could not load CRM workspace:", error.message);
    response.send("window.__NAZOFT_REMOTE_STATE__=null;");
  }
});

app.get("/api/state", async (_request, response) => {
  try {
    const result = await pool.query("select state, updated_at from crm_workspaces where id = $1", [workspaceId]);
    response.json(result.rows[0] ?? { state: null, updated_at: null });
  } catch (error) {
    response.status(503).json({ error: "Database unavailable" });
  }
});

app.put("/api/state", async (request, response) => {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    return response.status(400).json({ error: "A CRM workspace object is required" });
  }
  try {
    await pool.query(
      `insert into crm_workspaces (id, state, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (id) do update set state = excluded.state, updated_at = now()`,
      [workspaceId, JSON.stringify(request.body)],
    );
    response.status(204).end();
  } catch (error) {
    console.error("Could not save CRM workspace:", error.message);
    response.status(503).json({ error: "Database unavailable" });
  }
});

app.use(express.static(root, { extensions: ["html"] }));
app.get("/{*path}", (_request, response) => response.sendFile(path.join(root, "index.html")));

const server = app.listen(port, () => console.log(`Nazoft CRM running at http://localhost:${port}`));

async function shutdown() {
  server.close();
  await pool.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

