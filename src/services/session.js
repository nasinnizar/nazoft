import { env } from "../config/env.js";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.COOKIE_SECURE,
  path: "/",
};

export function setSessionCookies(response, session) {
  response.cookie("nazoft_access_token", session.access_token, {
    ...cookieOptions,
    maxAge: Math.max(1, session.expires_in ?? 60 * 60) * 1000,
  });
  response.cookie("nazoft_refresh_token", session.refresh_token, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(response) {
  response.clearCookie("nazoft_access_token", cookieOptions);
  response.clearCookie("nazoft_refresh_token", cookieOptions);
}
