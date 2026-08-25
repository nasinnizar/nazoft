import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

export const authRouter = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });
const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const cookieOptions = { httpOnly: true, sameSite: "lax", secure: env.COOKIE_SECURE, path: "/", maxAge: 60 * 60 * 1000 };

function setSession(response, session) {
  response.cookie("nazoft_access_token", session.access_token, cookieOptions);
  response.cookie("nazoft_refresh_token", session.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

authRouter.post("/sign-in", authLimit, async (request, response) => {
  const input = credentials.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid email and password of at least 8 characters." });
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error || !data.session) return response.status(401).json({ error: "Invalid email or password." });
  setSession(response, data.session);
  response.json({ user: { id: data.user.id, email: data.user.email } });
});

authRouter.post("/sign-up", authLimit, async (request, response) => {
  const input = credentials.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid email and password of at least 8 characters." });
  const { data, error } = await supabase.auth.signUp({ ...input.data, options: { emailRedirectTo: env.SUPABASE_URL } });
  if (error) return response.status(400).json({ error: error.message });
  if (data.session) setSession(response, data.session);
  response.status(201).json({ needsEmailConfirmation: !data.session, user: { id: data.user?.id, email: data.user?.email } });
});

authRouter.post("/sign-out", (_request, response) => {
  response.clearCookie("nazoft_access_token", { path: "/" });
  response.clearCookie("nazoft_refresh_token", { path: "/" });
  response.status(204).end();
});

authRouter.get("/session", requireAuth, (request, response) => response.json({ user: { id: request.user.id, email: request.user.email } }));
