import { createSessionClient } from "../../src/services/supabase.js";
import { clearSessionCookies, getAccessToken, method } from "../../src/services/vercel-request.js";

export default async function handler(request, response) {
  if (!method(request, response, "POST")) return;
  try {
    const accessToken = getAccessToken(request);
    if (accessToken) await createSessionClient(accessToken).auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn("Unable to revoke the remote session during sign-out:", error.message);
  } finally {
    clearSessionCookies(response);
    response.statusCode = 204;
    response.end();
  }
}
