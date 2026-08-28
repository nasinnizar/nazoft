import { requireSupabase } from "./supabase.js";
import { getWorkspace } from "./workspace.js";
import { env } from "../config/env.js";

const secure = env.COOKIE_SECURE;
const baseCookie = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
const requestLimit = 2 * 1024 * 1024;
const attempts = new Map();

function cookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map(item => item.trim().split(/=(.*)/s, 2)).filter(([key]) => key));
}

function appendCookie(response, value) {
  const existing = response.getHeader("Set-Cookie");
  response.setHeader("Set-Cookie", [...(existing ? (Array.isArray(existing) ? existing : [existing]) : []), value]);
}

export function setSessionCookies(response, session) {
  appendCookie(response, `nazoft_access_token=${encodeURIComponent(session.access_token)}; ${baseCookie}; Max-Age=${Math.max(1, session.expires_in || 3600)}`);
  appendCookie(response, `nazoft_refresh_token=${encodeURIComponent(session.refresh_token)}; ${baseCookie}; Max-Age=${30 * 24 * 60 * 60}`);
}

export function clearSessionCookies(response) {
  appendCookie(response, `nazoft_access_token=; ${baseCookie}; Max-Age=0`);
  appendCookie(response, `nazoft_refresh_token=; ${baseCookie}; Max-Age=0`);
}

export async function getUser(request, response) {
  const supabase = requireSupabase();
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const sessionCookies = cookies(request);
  let token = bearer || sessionCookies.nazoft_access_token;
  if (token) {
    const { data } = await supabase.auth.getUser(decodeURIComponent(token));
    if (data.user) return data.user;
  }
  if (bearer || !sessionCookies.nazoft_refresh_token) return null;
  const { data } = await supabase.auth.refreshSession({ refresh_token: decodeURIComponent(sessionCookies.nazoft_refresh_token) });
  if (!data.session || !data.user) { clearSessionCookies(response); return null; }
  setSessionCookies(response, data.session);
  return data.user;
}

export function getAccessToken(request) {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const sessionCookies = cookies(request);
  return bearer || (sessionCookies.nazoft_access_token ? decodeURIComponent(sessionCookies.nazoft_access_token) : null);
}

export async function parseJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    if (Buffer.byteLength(request.body) > requestLimit) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    return JSON.parse(request.body);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > requestLimit) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function rateLimit(request, response, scope = "auth", limit = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || request.socket?.remoteAddress || "unknown";
  const key = `${scope}:${ip}`;
  const recent = (attempts.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 2_000) {
    for (const [entry, timestamps] of attempts) if (!timestamps.some(timestamp => now - timestamp < windowMs)) attempts.delete(entry);
  }
  response.setHeader("RateLimit-Limit", String(limit));
  response.setHeader("RateLimit-Remaining", String(Math.max(0, limit - recent.length)));
  if (recent.length <= limit) return true;
  response.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
  json(response, 429, { error: "Too many requests. Please wait and try again." });
  return false;
}

export function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function method(request, response, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (allowed.includes(request.method)) return true;
  response.setHeader("Allow", allowed.join(", "));
  json(response, 405, { error: "Method not allowed" });
  return false;
}

export async function bootstrap(request, response) {
  const user = await getUser(request, response);
  const workspace = user ? await getWorkspace(user.id) : null;
  const script = `window.__NAZOFT_AUTHENTICATED__=${Boolean(user)};window.__NAZOFT_USER__=${JSON.stringify(user ? { id: user.id, email: user.email } : null).replaceAll("<", "\\u003c")};window.__NAZOFT_ORGANIZATION__=${JSON.stringify(workspace?.organization ?? null).replaceAll("<", "\\u003c")};window.__NAZOFT_REMOTE_STATE__=${JSON.stringify(workspace?.state ?? null).replaceAll("<", "\\u003c")};`;
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(script);
}
