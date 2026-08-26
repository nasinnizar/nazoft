import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

// Do not crash the entire deployment if credentials have not been added to
// Vercel yet. The public shell can load while authenticated API routes remain
// unavailable until both settings are configured.
export const supabase = env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : null;
