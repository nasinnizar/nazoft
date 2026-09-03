import { z } from "zod";
import { env } from "../src/config/env.js";
import { createAdminClient } from "../src/services/supabase.js";
import { addOrganizationMember, listOrganizationMembers, reassignOrganizationLeads, removeOrganizationMember, requireOrganizationAdmin, updateOrganizationMember } from "../src/services/workspace.js";
import { getUser, json, method, parseJson, rateLimit } from "../src/services/vercel-request.js";

const inviteInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "sales", "viewer"]),
});
const memberInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "manager", "sales", "viewer"]),
  status: z.enum(["active", "suspended"]),
});
const reassignInput = z.object({
  action: z.literal("reassign-leads"),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
});
const memberIdInput = z.object({ id: z.string().uuid() });

export default async function handler(request, response) {
  if (!method(request, response, ["GET", "POST", "PATCH", "DELETE"])) return;
  try {
    const user = await getUser(request, response);
    if (!user) return json(response, 401, { error: "Authentication required" });
    if (request.method === "GET") return json(response, 200, await listOrganizationMembers(user.id));
    if (request.method === "PATCH") {
      const body = await parseJson(request);
      const reassignment = reassignInput.safeParse(body);
      if (reassignment.success) {
        const count = await reassignOrganizationLeads(user.id, reassignment.data.fromUserId, reassignment.data.toUserId);
        return json(response, 200, { count });
      }
      const input = memberInput.safeParse(body);
      if (!input.success) return json(response, 400, { error: "Enter a valid user, name, role, and account status." });
      await updateOrganizationMember(user.id, input.data.id, input.data.role, input.data.status, input.data.name);
      response.statusCode = 204; response.end(); return;
    }
    if (request.method === "DELETE") {
      const input = memberIdInput.safeParse(await parseJson(request));
      if (!input.success) return json(response, 400, { error: "A valid organization user is required." });
      await removeOrganizationMember(user.id, input.data.id);
      response.statusCode = 204; response.end(); return;
    }
    if (!(await rateLimit(request, response, "user-invite"))) return;
    const input = inviteInput.safeParse(await parseJson(request));
    if (!input.success) return json(response, 400, { error: "Enter a name, valid email address, and supported role." });
    await requireOrganizationAdmin(user.id);
    const options = { data: { display_name: input.data.name } };
    if (env.APP_URL) options.redirectTo = env.APP_URL;
    const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(input.data.email, options);
    if (error || !data.user) {
      const message = error?.message?.toLowerCase().includes("already")
        ? "This email already has an account. Contact support to add it to another organization."
        : "Unable to send the invitation. Check Supabase SMTP and redirect URL settings.";
      return json(response, 400, { error: message });
    }
    await addOrganizationMember(user.id, data.user, input.data.role, input.data.name);
    json(response, 201, { user: { id: data.user.id, email: data.user.email, name: input.data.name, role: input.data.role, status: "invited" } });
  } catch (error) {
    console.error(error);
    json(response, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to manage organization users." });
  }
}
