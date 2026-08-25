import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be configured before starting the CRM server.");
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
