import { getUser, json, method } from "../../src/services/vercel-request.js";
import { getWorkspace } from "../../src/services/workspace.js";
export default async function handler(request, response) {
  if (!method(request, response, "GET")) return;
  try {
    const user = await getUser(request, response);
    if (!user) return json(response, 401, { error: "Authentication required" });
    const workspace = await getWorkspace(user.id);
    json(response, 200, {
      user: { id: user.id, email: user.email },
      workspaceReady: true,
      organization: workspace.organization,
    });
  } catch (error) {
    console.error(error);
    const status = error.statusCode === 403 ? 403 : 503;
    json(response, status, { error: status === 403 ? error.message : "Sign-in verification is temporarily unavailable. Please try again." });
  }
}
