import { getUser, json, method } from "../../src/services/vercel-request.js";
export default async function handler(request, response) {
  if (!method(request, response, "GET")) return;
  try {
    const user = await getUser(request, response);
    if (!user) return json(response, 401, { error: "Authentication required" });
    json(response, 200, { user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to check the session" });
  }
}
