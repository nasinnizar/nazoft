import { env } from "../config/env.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function firstHeader(value) {
  return String(value || "").split(",")[0].trim();
}

function configuredOrigins(request) {
  const origins = new Set();
  if (env.APP_URL) origins.add(new URL(env.APP_URL).origin);
  const host = firstHeader(request.headers?.["x-forwarded-host"] || request.headers?.host);
  const protocol = firstHeader(request.headers?.["x-forwarded-proto"])
    || (request.socket?.encrypted ? "https" : "http");
  if (host) origins.add(`${protocol}://${host}`);
  return origins;
}

function sourceOrigin(request) {
  const origin = firstHeader(request.headers?.origin);
  if (origin && origin !== "null") return origin;
  const referer = firstHeader(request.headers?.referer);
  if (!referer) return null;
  try { return new URL(referer).origin; } catch { return null; }
}

export function mutationIsSameOrigin(request) {
  if (safeMethods.has(request.method)) return true;
  // Bearer-token clients do not rely on ambient browser cookies and therefore
  // are not susceptible to classical CSRF.
  if (/^Bearer\s+\S+/i.test(String(request.headers?.authorization || ""))) return true;
  const fetchSite = firstHeader(request.headers?.["sec-fetch-site"]);
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;
  const source = sourceOrigin(request);
  if (!source) return false;
  return configuredOrigins(request).has(source);
}

export function protectMutation(request, response, next) {
  response.setHeader("Vary", "Origin, Sec-Fetch-Site");
  if (mutationIsSameOrigin(request)) return next();
  return response.status(403).json({ error: "This request was blocked because it did not originate from the CRM." });
}
