import { z } from "zod";
import { json, method, parseJson, rateLimit, setSessionCookies } from "../../src/services/vercel-request.js";
import { requireSupabase } from "../../src/services/supabase.js";
import { env } from "../../src/config/env.js";
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });
export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  if (!env.ALLOW_PUBLIC_SIGNUP) return json(response, 403, { error: "Public registration is disabled. Ask an administrator for an invitation." });
  if (!(await rateLimit(request, response, "sign-up"))) return;
  try {
    const input = credentials.safeParse(await parseJson(request));
    if (!input.success) return json(response, 400, { error: "Enter a valid email and password of at least 8 characters." });
    const { data, error } = await requireSupabase().auth.signUp(input.data);
    if (error) return json(response, 400, { error: error.message });
    if (data.session) setSessionCookies(response, data.session);
    json(response, 201, { needsEmailConfirmation: !data.session, user: { id: data.user?.id, email: data.user?.email } });
  } catch (error) { console.error(error); json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to create account" }); }
}
