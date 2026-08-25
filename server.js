import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./src/config/env.js";
import { requireAuth } from "./src/middleware/auth.js";
import { authRouter } from "./src/routes/auth.js";
import { workspaceRouter } from "./src/routes/workspace.js";
import { getWorkspace } from "./src/services/workspace.js";
import { pool } from "./src/db/pool.js";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_request, response) => {
  try {
    await pool.query("select 1");
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api", workspaceRouter);

app.get("/bootstrap.js", requireAuth, async (request, response, next) => {
  try {
    const workspace = await getWorkspace(request.user.id);
    const user = JSON.stringify({ id: request.user.id, email: request.user.email }).replaceAll("<", "\\u003c");
    response.type("application/javascript").send(`window.__NAZOFT_AUTHENTICATED__=true;window.__NAZOFT_USER__=${user};window.__NAZOFT_REMOTE_STATE__=${JSON.stringify(workspace.state).replaceAll("<", "\\u003c")};`);
  } catch (error) { next(error); }
});
app.get("/bootstrap.js", (_request, response) => {
  response.type("application/javascript").send("window.__NAZOFT_AUTHENTICATED__=false;window.__NAZOFT_USER__=null;window.__NAZOFT_REMOTE_STATE__=null;");
});

app.use(express.static(root, { extensions: ["html"], index: "index.html" }));
app.get("/{*path}", (_request, response) => response.sendFile(path.join(root, "index.html")));
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Unexpected server error" });
});

const server = app.listen(env.PORT, () => console.log(`Nazoft CRM running at http://localhost:${env.PORT}`));
async function shutdown() {
  server.close();
  await pool.end();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
