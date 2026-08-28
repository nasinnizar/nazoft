import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

// Do not crash the entire deployment if credentials have not been added to
// Vercel yet. The public shell can load while authenticated API routes remain
// unavailable until both settings are configured.
export const supabase = env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : null;

export function requireSupabase() {
  if (!supabase) {
    const error = new Error("Supabase authentication is not configured.");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  return supabase;
}

export function createSessionClient(accessToken) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return requireSupabase();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createAdminClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error("Team invitations require SUPABASE_SERVICE_ROLE_KEY on the server.");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
