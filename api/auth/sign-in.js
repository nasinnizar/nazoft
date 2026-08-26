import { z } from "zod";
import { json, method, parseJson, setSessionCookies } from "../../src/services/vercel-request.js";
import { supabase } from "../../src/services/supabase.js";
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });
export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  try {
    const input = credentials.safeParse(await parseJson(request));
    if (!input.success) return json(response, 400, { error: "Enter a valid email and password of at least 8 characters." });
    const { data, error } = await supabase.auth.signInWithPassword(input.data);
    if (error || !data.session) return json(response, 401, { error: "Invalid email or password." });
    setSessionCookies(response, data.session);
    json(response, 200, { user: { id: data.user.id, email: data.user.email } });
  } catch (error) { console.error(error); json(response, 500, { error: "Unable to sign in" }); }
}
