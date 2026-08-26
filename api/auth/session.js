import { getUser, json, method } from "../../src/services/vercel-request.js";
export default async function handler(request, response) { if (!method(request, response, "GET")) return; const user = await getUser(request, response); if (!user) return json(response, 401, { error: "Authentication required" }); json(response, 200, { user: { id: user.id, email: user.email } }); }
