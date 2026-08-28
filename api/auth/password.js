import { z } from "zod";
import { createSessionClient } from "../../src/services/supabase.js";
import { getAccessToken, getUser, json, method, parseJson, rateLimit } from "../../src/services/vercel-request.js";

const inputSchema = z.object({ password: z.string().min(8).max(128) });

export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  if (!rateLimit(request, response, "password-update", 6, 15 * 60_000)) return;
  try {
    const user = await getUser(request, response);
    if (!user) return json(response, 401, { error: "Your session has expired. Verify your email again." });
    const input = inputSchema.safeParse(await parseJson(request));
    if (!input.success) return json(response, 400, { error: "Use a password between 8 and 128 characters." });
    const accessToken = getAccessToken(request);
    const { error } = await createSessionClient(accessToken).auth.updateUser({ password: input.data.password });
    if (error) return json(response, 400, { error: "Unable to update the password. Request a new verification code and try again." });
    response.statusCode = 204;
    response.end();
  } catch (error) {
    console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to update the password." });
  }
}
