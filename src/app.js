import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { optionalAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { workspaceRouter } from "./routes/workspace.js";
import { getWorkspace } from "./services/workspace.js";
import { pool } from "./db/pool.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const app = express();

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_request, response) => {
  try { await pool.query("select 1"); response.json({ status: "ok", database: "connected" }); }
  catch { response.status(503).json({ status: "error", database: "unavailable" }); }
});

app.use("/api/auth", authRouter);
app.use("/api", workspaceRouter);
app.get("/bootstrap.js", optionalAuth, async (request, response, next) => {
  try {
    response.set("Cache-Control", "no-store");
    if (!request.user) {
      return response.type("application/javascript").send("window.__NAZOFT_AUTHENTICATED__=false;window.__NAZOFT_USER__=null;window.__NAZOFT_REMOTE_STATE__=null;");
    }
    const workspace = await getWorkspace(request.user.id);
    const user = JSON.stringify({ id: request.user.id, email: request.user.email }).replaceAll("<", "\\u003c");
    response.type("application/javascript").send(`window.__NAZOFT_AUTHENTICATED__=true;window.__NAZOFT_USER__=${user};window.__NAZOFT_REMOTE_STATE__=${JSON.stringify(workspace.state).replaceAll("<", "\\u003c")};`);
  } catch (error) { next(error); }
});

app.use(express.static(root, { extensions: ["html"], index: "index.html" }));
app.get("/{*path}", (_request, response) => response.sendFile(path.join(root, "index.html")));
app.use((error, _request, response, _next) => {
  if (error?.type === "entity.too.large") {
    return response.status(413).json({ error: "Request body exceeds the 2 MB limit." });
  }
  if (error instanceof SyntaxError && error?.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Request body must contain valid JSON." });
  }
  console.error(error);
  response.status(500).json({ error: "Unexpected server error" });
});

// Vercel may detect this module as the production Node entrypoint. Export the
// Express app as the default handler while keeping the named export for the
// local launcher.
export default app;
