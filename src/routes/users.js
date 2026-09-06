import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { createAdminClient } from "../services/supabase.js";
import { addOrganizationMember, listOrganizationMembers, permissionCatalog, reassignOrganizationLeads, removeOrganizationMember, requireOrganizationSeat, updateOrganizationMember, updateOrganizationRolePermissions } from "../services/workspace.js";

export const usersRouter = Router();
const inviteLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const inviteInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  role: z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/),
});
const memberInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  role: z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/),
  status: z.enum(["active", "suspended"]),
});
const reassignInput = z.object({
  action: z.literal("reassign-leads"),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
});
const memberIdInput = z.object({ id: z.string().uuid() });
const permission = z.enum(permissionCatalog);
const accessInput = z.object({
  rolePermissions: z.record(z.string().regex(/^[a-z][a-z0-9_-]{1,31}$/), z.array(permission)),
});

usersRouter.use(requireAuth);

usersRouter.get("/", async (request, response, next) => {
  try {
    response.json(await listOrganizationMembers(request.user.id));
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/invite", inviteLimit, async (request, response, next) => {
  const input = inviteInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a name, valid email address, and supported role." });
  let invitedUser = null;
  let admin = null;
  try {
    await requireOrganizationSeat(request.user.id);
    const options = { data: { display_name: input.data.name } };
    if (env.APP_URL) options.redirectTo = env.APP_URL;
    admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.data.email, options);
    if (error || !data.user) {
      const message = error?.message?.toLowerCase().includes("already")
        ? "This email already has an account. Add existing-user support before assigning it to another organization."
        : "Unable to send the invitation. Check Supabase SMTP and redirect URL settings.";
      return response.status(400).json({ error: message });
    }
    invitedUser = data.user;
    await addOrganizationMember(request.user.id, invitedUser, input.data.role, input.data.name);
    response.status(201).json({ user: { id: data.user.id, email: data.user.email, name: input.data.name, role: input.data.role, status: "invited" } });
  } catch (error) {
    if (invitedUser && admin) await admin.auth.admin.deleteUser(invitedUser.id).catch(() => {});
    next(error);
  }
});

usersRouter.patch("/access", async (request, response, next) => {
  const input = accessInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Choose supported access options for each role." });
  try {
    const rolePermissions = await updateOrganizationRolePermissions(request.user.id, input.data.rolePermissions);
    response.json({ rolePermissions });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/", async (request, response, next) => {
  const access = accessInput.safeParse(request.body);
  if (access.success) {
    try {
      const rolePermissions = await updateOrganizationRolePermissions(request.user.id, access.data.rolePermissions);
      return response.json({ rolePermissions });
    } catch (error) {
      return next(error);
    }
  }
  const reassignment = reassignInput.safeParse(request.body);
  if (reassignment.success) {
    try {
      const count = await reassignOrganizationLeads(request.user.id, reassignment.data.fromUserId, reassignment.data.toUserId);
      return response.json({ count });
    } catch (error) {
      return next(error);
    }
  }
  const input = memberInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid user, name, role, and account status." });
  try {
    await updateOrganizationMember(request.user.id, input.data.id, input.data.role, input.data.status, input.data.name);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/", async (request, response, next) => {
  const input = memberIdInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "A valid organization user is required." });
  try {
    await removeOrganizationMember(request.user.id, input.data.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
