import { requireSupabase } from "../services/supabase.js";
import { clearSessionCookies, setSessionCookies } from "../services/session.js";

async function resolveUser(request, response) {
  const supabase = requireSupabase();
  const bearer = request.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || request.cookies.nazoft_access_token;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) return data.user;
  }

  // Bearer-token callers own their refresh lifecycle. Browser sessions can be
  // renewed transparently with the HttpOnly refresh token.
  const refreshToken = !bearer && request.cookies.nazoft_refresh_token;
  if (!refreshToken) return null;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) {
    clearSessionCookies(response);
    return null;
  }
  setSessionCookies(response, data.session);
  return data.user;
}

export function getRequestAccessToken(request) {
  const bearer = request.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer || request.cookies.nazoft_access_token || null;
}

export async function optionalAuth(request, response, next) {
  try {
    request.user = await resolveUser(request, response);
    next();
  } catch (error) {
    if (error.statusCode === 503) {
      request.user = null;
      return next();
    }
    next(error);
  }
}

export async function requireAuth(request, response, next) {
  try {
    request.user = await resolveUser(request, response);
    if (!request.user) return response.status(401).json({ error: "Authentication required or session expired." });
    next();
  } catch (error) {
    if (error.statusCode === 503) return response.status(503).json({ error: "Authentication is temporarily unavailable." });
    next(error);
  }
}
