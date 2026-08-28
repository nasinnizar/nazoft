import { z } from "zod";
import { env } from "../../src/config/env.js";
import { json, method, parseJson, rateLimit } from "../../src/services/vercel-request.js";
import { requireSupabase } from "../../src/services/supabase.js";

const inputSchema = z.object({ email: z.string().email(), purpose: z.enum(["signin", "recovery"]).default("signin") });

export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  if (!rateLimit(request, response, "otp-request", 6, 15 * 60_000)) return;
  try {
    const input = inputSchema.safeParse(await parseJson(request));
    if (!input.success) return json(response, 400, { error: "Enter a valid email address." });
    const options = { shouldCreateUser: false };
    if (env.APP_URL) {
      const redirect = new URL(env.APP_URL);
      redirect.searchParams.set("auth", input.data.purpose);
      options.emailRedirectTo = redirect.toString();
    }
    const { error } = await requireSupabase().auth.signInWithOtp({ email: input.data.email, options });
    if (error?.status === 429) return json(response, 429, { error: "Too many email requests. Please wait and try again." });
    if (error) console.warn("Supabase OTP request failed:", error.message);
    json(response, 202, { message: "If this email belongs to an active account, a verification code has been sent." });
  } catch (error) {
    console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to send a verification code." });
  }
}
