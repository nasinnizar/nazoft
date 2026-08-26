import { supabase } from "./supabase.js";
import { getWorkspace } from "./workspace.js";

const secure = process.env.COOKIE_SECURE === "true";
const baseCookie = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

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

export async function parseJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function method(request, response, expected) {
  if (request.method === expected) return true;
  response.setHeader("Allow", expected);
  json(response, 405, { error: "Method not allowed" });
  return false;
}

export async function bootstrap(request, response) {
  const user = await getUser(request, response);
  const state = user ? (await getWorkspace(user.id)).state : null;
  const script = `window.__NAZOFT_AUTHENTICATED__=${Boolean(user)};window.__NAZOFT_USER__=${JSON.stringify(user ? { id: user.id, email: user.email } : null).replaceAll("<", "\\u003c")};window.__NAZOFT_REMOTE_STATE__=${JSON.stringify(state).replaceAll("<", "\\u003c")};`;
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(script);
}
