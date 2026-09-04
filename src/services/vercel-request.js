import { requireSupabase } from "./supabase.js";
import { getWorkspace } from "./workspace.js";
import { env } from "../config/env.js";
import { mutationIsSameOrigin } from "../middleware/request-security.js";
import { createHash } from "node:crypto";
import { pool } from "../db/pool.js";

const secure = env.COOKIE_SECURE;
const baseCookie = `Path=/; HttpOnly; SameSite=Lax; Priority=High${secure ? "; Secure" : ""}`;
const requestLimit = 2 * 1024 * 1024;
const attempts = new Map();
let durableRateLimitWarningShown = false;

function cookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map(item => item.trim().split(/=(.*)/s, 2)).filter(([key]) => key));
}

function appendCookie(response, value) {
  const existing = response.getHeader("Set-Cookie");
  response.setHeader("Set-Cookie", [...(existing ? (Array.isArray(existing) ? existing : [existing]) : []), value]);
}

export function setSessionCookies(response, session) {
  const accessSeconds = Math.max(1, session.expires_in || 3600);
  const refreshSeconds = 30 * 24 * 60 * 60;
  appendCookie(response, `nazoft_access_token=${encodeURIComponent(session.access_token)}; ${baseCookie}; Max-Age=${accessSeconds}; Expires=${new Date(Date.now() + accessSeconds * 1000).toUTCString()}`);
  appendCookie(response, `nazoft_refresh_token=${encodeURIComponent(session.refresh_token)}; ${baseCookie}; Max-Age=${refreshSeconds}; Expires=${new Date(Date.now() + refreshSeconds * 1000).toUTCString()}`);
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
    if (data.user) {
      request.nazoftAccessToken = decodeURIComponent(token);
      return data.user;
    }
  }
  if (bearer || !sessionCookies.nazoft_refresh_token) return null;
  const { data } = await supabase.auth.refreshSession({ refresh_token: decodeURIComponent(sessionCookies.nazoft_refresh_token) });
  if (!data.session || !data.user) { clearSessionCookies(response); return null; }
  setSessionCookies(response, data.session);
  request.nazoftAccessToken = data.session.access_token;
  return data.user;
}

export function getAccessToken(request) {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const sessionCookies = cookies(request);
  return request.nazoftAccessToken || bearer || (sessionCookies.nazoft_access_token ? decodeURIComponent(sessionCookies.nazoft_access_token) : null);
}

function invalidJson(error) {
  if (!(error instanceof SyntaxError)) throw error;
  throw Object.assign(new Error("Request body must contain valid JSON."), { statusCode: 400, expose: true });
}

export async function parseJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    if (Buffer.byteLength(request.body) > requestLimit) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    try { return JSON.parse(request.body); } catch (error) { invalidJson(error); }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > requestLimit) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (error) { invalidJson(error); }
}

function memoryRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 2_000) {
    for (const [entry, timestamps] of attempts) if (!timestamps.some(timestamp => now - timestamp < windowMs)) attempts.delete(entry);
  }
  return recent.length;
}

export async function rateLimit(request, response, scope = "auth", limit = 10, windowMs = 15 * 60_000) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || request.socket?.remoteAddress || "unknown";
  const keyHash = createHash("sha256").update(`${scope}:${ip}`).digest("hex");
  let count;
  let retryAfter = Math.ceil(windowMs / 1000);
  try {
    const { rows } = await pool.query(
      `insert into public.security_rate_limits (scope, key_hash, window_started_at, attempts)
       values ($1, $2, now(), 1)
       on conflict (scope, key_hash) do update
       set attempts = case
             when public.security_rate_limits.window_started_at <= now() - ($3::double precision * interval '1 millisecond') then 1
             else public.security_rate_limits.attempts + 1
           end,
           window_started_at = case
             when public.security_rate_limits.window_started_at <= now() - ($3::double precision * interval '1 millisecond') then now()
             else public.security_rate_limits.window_started_at
           end
       returning attempts,
         greatest(1, ceil(extract(epoch from (window_started_at + ($3::double precision * interval '1 millisecond') - now()))))::int retry_after`,
      [scope, keyHash, windowMs],
    );
    count = rows[0].attempts;
    retryAfter = rows[0].retry_after;
  } catch (error) {
    if (!durableRateLimitWarningShown) {
      console.warn("Durable rate limiting is unavailable; apply migration 003_security_rate_limits.sql.", error.message);
      durableRateLimitWarningShown = true;
    }
    count = memoryRateLimit(`${scope}:${keyHash}`, limit, windowMs);
  }
  response.setHeader("RateLimit-Limit", String(limit));
  response.setHeader("RateLimit-Remaining", String(Math.max(0, limit - count)));
  if (count <= limit) return true;
  response.setHeader("Retry-After", String(retryAfter));
  json(response, 429, { error: "Too many requests. Please wait and try again." });
  return false;
}

export function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.end(JSON.stringify(body));
}

export function method(request, response, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (allowed.includes(request.method)) {
    response.setHeader("Vary", "Origin, Sec-Fetch-Site, Cookie");
    if (mutationIsSameOrigin(request)) return true;
    json(response, 403, { error: "This request was blocked because it did not originate from the CRM." });
    return false;
  }
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
  response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Vary", "Origin, Sec-Fetch-Site, Cookie");
  response.end(script);
}
