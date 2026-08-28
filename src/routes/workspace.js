import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getWorkspace, saveWorkspace } from "../services/workspace.js";

export const workspaceRouter = Router();

workspaceRouter.get("/state", requireAuth, async (request, response, next) => {
  try { response.json(await getWorkspace(request.user.id)); } catch (error) { next(error); }
});

workspaceRouter.put("/state", requireAuth, async (request, response, next) => {
  const state = z.record(z.unknown()).safeParse(request.body);
  if (!state.success) return response.status(400).json({ error: "A valid CRM workspace object is required." });
  try { await saveWorkspace(request.user.id, state.data); response.status(204).end(); } catch (error) { next(error); }
});
