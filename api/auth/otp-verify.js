import { z } from "zod";
import { json, method, parseJson, rateLimit, setSessionCookies } from "../../src/services/vercel-request.js";
import { requireSupabase } from "../../src/services/supabase.js";

const inputSchema = z.object({ email: z.string().email(), token: z.string().regex(/^\d{6,8}$/) });

export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  if (!rateLimit(request, response, "otp-verify")) return;
  try {
    const input = inputSchema.safeParse(await parseJson(request));
    if (!input.success) return json(response, 400, { error: "Enter the email address and verification code from your message." });
    const { data, error } = await requireSupabase().auth.verifyOtp({ ...input.data, type: "email" });
    if (error || !data.session) return json(response, 401, { error: "The verification code is invalid or expired." });
    setSessionCookies(response, data.session);
    json(response, 200, { user: { id: data.user.id, email: data.user.email } });
  } catch (error) {
    console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to verify the code." });
  }
}
