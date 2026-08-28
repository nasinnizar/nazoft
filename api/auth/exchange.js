import { z } from "zod";
import { json, method, parseJson, rateLimit, setSessionCookies } from "../../src/services/vercel-request.js";
import { requireSupabase } from "../../src/services/supabase.js";

const inputSchema = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20),
  expiresIn: z.coerce.number().int().positive().max(86_400).default(3600),
});

export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  if (!rateLimit(request, response, "auth-exchange")) return;
  try {
    const input = inputSchema.safeParse(await parseJson(request));
    if (!input.success) return json(response, 400, { error: "The email sign-in link is incomplete or invalid." });
    const { data, error } = await requireSupabase().auth.getUser(input.data.accessToken);
    if (error || !data.user) return json(response, 401, { error: "The email sign-in link is invalid or expired." });
    setSessionCookies(response, {
      access_token: input.data.accessToken,
      refresh_token: input.data.refreshToken,
      expires_in: input.data.expiresIn,
    });
    json(response, 200, { user: { id: data.user.id, email: data.user.email } });
  } catch (error) {
    console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to complete email sign-in." });
  }
}
