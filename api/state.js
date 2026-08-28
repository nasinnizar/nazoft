import { getUser, json, method, parseJson } from "../src/services/vercel-request.js";
import { getWorkspace, saveWorkspace } from "../src/services/workspace.js";

export default async function handler(request, response) {
  if (!["GET", "PUT"].includes(request.method)) return method(request, response, "GET");
  try {
    const user = await getUser(request, response);
    if (!user) return json(response, 401, { error: "Authentication required" });
    if (request.method === "GET") return json(response, 200, await getWorkspace(user.id));
    const state = await parseJson(request);
    if (!state || typeof state !== "object" || Array.isArray(state)) return json(response, 400, { error: "A valid CRM workspace object is required." });
    await saveWorkspace(user.id, state);
    response.statusCode = 204; response.end();
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to save CRM workspace" });
  }
}
