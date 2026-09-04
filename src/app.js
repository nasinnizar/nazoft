import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { optionalAuth } from "./middleware/auth.js";
import { protectMutation } from "./middleware/request-security.js";
import { authRouter } from "./routes/auth.js";
import { workspaceRouter } from "./routes/workspace.js";
import { usersRouter } from "./routes/users.js";
import { getWorkspace } from "./services/workspace.js";
import { pool } from "./db/pool.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoSvg = readFileSync(fileURLToPath(new URL("../nazoft-logo.svg", import.meta.url)), "utf8");
export const app = express();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
app.use(cookieParser());
app.use("/api", (_request, response, next) => {
  response.set("Cache-Control", "private, no-store");
  response.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use("/api", protectMutation);
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_request, response) => {
  try { await pool.query("select 1"); response.json({ status: "ok", database: "connected" }); }
  catch { response.status(503).json({ status: "error", database: "unavailable" }); }
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.get("/nazoft-logo.svg", (_request, response) => {
  response.type("image/svg+xml").set("Cache-Control", "public, max-age=86400").send(logoSvg);
});
async function bootstrapHandler(request, response, next) {
  try {
    response.set("Cache-Control", "no-store");
    if (!request.user) {
      return response.type("application/javascript").send("window.__NAZOFT_AUTHENTICATED__=false;window.__NAZOFT_USER__=null;window.__NAZOFT_ORGANIZATION__=null;window.__NAZOFT_REMOTE_STATE__=null;");
    }
    const workspace = await getWorkspace(request.user.id);
    const user = JSON.stringify({ id: request.user.id, email: request.user.email }).replaceAll("<", "\\u003c");
    response.type("application/javascript").send(`window.__NAZOFT_AUTHENTICATED__=true;window.__NAZOFT_USER__=${user};window.__NAZOFT_ORGANIZATION__=${JSON.stringify(workspace.organization).replaceAll("<", "\\u003c")};window.__NAZOFT_REMOTE_STATE__=${JSON.stringify(workspace.state).replaceAll("<", "\\u003c")};`);
  } catch (error) { next(error); }
}

app.get(["/api/bootstrap.js", "/bootstrap.js"], optionalAuth, bootstrapHandler);
app.use("/api", workspaceRouter);

app.use("/styles", express.static(path.join(root, "styles"), { fallthrough: false, index: false, maxAge: "1h" }));
app.use("/assets", express.static(path.join(root, "assets"), { fallthrough: false, index: false, maxAge: "1h" }));
app.get("/scripts/crm-experience.js", (_request, response) => {
  response.type("application/javascript").set("Cache-Control", "no-cache").sendFile(path.join(root, "scripts", "crm-experience.js"));
});
app.get("/scripts/assignment-access.js", (_request, response) => {
  response.type("application/javascript").set("Cache-Control", "no-cache").sendFile(path.join(root, "scripts", "assignment-access.js"));
});
app.get("/scripts/mobile-sidebar.js", (_request, response) => {
  response.type("application/javascript").set("Cache-Control", "no-cache").sendFile(path.join(root, "scripts", "mobile-sidebar.js"));
});
app.get("/scripts/report-files.js", (_request, response) => {
  response.type("application/javascript").set("Cache-Control", "no-cache").sendFile(path.join(root, "scripts", "report-files.js"));
});
app.get("/scripts/import-export.js", (_request, response) => {
  response.type("application/javascript").set("Cache-Control", "no-cache").sendFile(path.join(root, "scripts", "import-export.js"));
});
app.get("/scripts/regional-settings.js", (_request, response) => {
  response.type("application/javascript").set("Cache-Control", "no-cache").sendFile(path.join(root, "scripts", "regional-settings.js"));
});
app.get("/nazoft-logo.svg", (_request, response) => response.sendFile(path.join(root, "nazoft-logo.svg")));
app.get("/nazoft-crm-wordmark.svg", (_request, response) => response.sendFile(path.join(root, "nazoft-crm-wordmark.svg")));
app.get("/", (_request, response) => response.sendFile(path.join(root, "index.html")));
app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found" }));
app.get("/{*path}", (_request, response) => response.sendFile(path.join(root, "index.html")));
app.use((error, _request, response, _next) => {
  if (error?.type === "entity.too.large") {
    return response.status(413).json({ error: "Request body exceeds the 2 MB limit." });
  }
  if (error instanceof SyntaxError && error?.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Request body must contain valid JSON." });
  }
  const status = Number(error?.statusCode) || 500;
  if (status >= 500) console.error(error);
  response.status(status).json({ error: status >= 500 && !error?.expose ? "Unexpected server error" : error.message });
});

// Vercel may detect this module as the production Node entrypoint. Export the
// Express app as the default handler while keeping the named export for the
// local launcher.
export default app;
