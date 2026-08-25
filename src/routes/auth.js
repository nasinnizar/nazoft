import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { clearSessionCookies, setSessionCookies } from "../services/session.js";
import { supabase } from "../services/supabase.js";

export const authRouter = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });
const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
authRouter.post("/sign-in", authLimit, async (request, response) => {
  const input = credentials.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid email and password of at least 8 characters." });
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error || !data.session) return response.status(401).json({ error: "Invalid email or password." });
  setSessionCookies(response, data.session);
  response.json({ user: { id: data.user.id, email: data.user.email } });
});

authRouter.post("/sign-up", authLimit, async (request, response) => {
  const input = credentials.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid email and password of at least 8 characters." });
  const { data, error } = await supabase.auth.signUp(input.data);
  if (error) return response.status(400).json({ error: error.message });
  if (data.session) setSessionCookies(response, data.session);
  response.status(201).json({ needsEmailConfirmation: !data.session, user: { id: data.user?.id, email: data.user?.email } });
});

authRouter.post("/sign-out", (_request, response) => {
  clearSessionCookies(response);
  response.status(204).end();
});

authRouter.get("/session", requireAuth, (request, response) => response.json({ user: { id: request.user.id, email: request.user.email } }));
