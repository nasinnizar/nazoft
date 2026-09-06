import { z } from "zod";
import { json, method, parseJson, rateLimit, setSessionCookies } from "../../src/services/vercel-request.js";
import { createSessionClient, requireSupabase } from "../../src/services/supabase.js";

const exchangeSchema = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20),
  expiresIn: z.coerce.number().int().positive().max(86_400).default(3600),
});
const otpSchema = z.object({ email: z.string().email(), token: z.string().regex(/^\d{6,8}$/) });

export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  const otpFlow = request.query?.flow === "otp";
  if (!(await rateLimit(request, response, otpFlow ? "otp-verify" : "auth-exchange"))) return;
  try {
    const input = (otpFlow ? otpSchema : exchangeSchema).safeParse(await parseJson(request));
    if (otpFlow) {
      if (!input.success) return json(response, 400, { error: "Enter the email address and verification code from your message." });
      const { data, error } = await requireSupabase().auth.verifyOtp({ ...input.data, type: "email" });
      if (error || !data.session) return json(response, 401, { error: "The verification code is invalid or expired." });
      setSessionCookies(response, data.session);
      return json(response, 200, { user: { id: data.user.id, email: data.user.email } });
    }
    if (!input.success) return json(response, 400, { error: "The email sign-in link is incomplete or invalid." });
    const { data: accessData, error: accessError } = await requireSupabase().auth.getUser(input.data.accessToken);
    if (accessError || !accessData.user) return json(response, 401, { error: "The email sign-in link is invalid or expired." });
    const { data: refreshed, error: refreshError } = await createSessionClient(input.data.accessToken).auth.refreshSession({
      refresh_token: input.data.refreshToken,
    });
    if (refreshError || !refreshed.session || !refreshed.user || refreshed.user.id !== accessData.user.id) {
      return json(response, 401, { error: "The email sign-in session is invalid or expired." });
    }
    setSessionCookies(response, refreshed.session);
    json(response, 200, { user: { id: refreshed.user.id, email: refreshed.user.email } });
  } catch (error) {
    console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to complete email sign-in." });
  }
}
