import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getRequestAccessToken } from "../middleware/auth.js";
import { clearSessionCookies, setSessionCookies } from "../services/session.js";
import { createSessionClient, requireSupabase } from "../services/supabase.js";
import { env } from "../config/env.js";

export const authRouter = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });
const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
authRouter.post("/sign-in", authLimit, async (request, response) => {
  const input = credentials.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid email and password of at least 8 characters." });
  const { data, error } = await requireSupabase().auth.signInWithPassword(input.data);
  if (error || !data.session) return response.status(401).json({ error: "Invalid email or password." });
  setSessionCookies(response, data.session);
  response.json({ user: { id: data.user.id, email: data.user.email } });
});

authRouter.post("/sign-up", authLimit, async (request, response) => {
  if (!env.ALLOW_PUBLIC_SIGNUP) return response.status(403).json({ error: "Public registration is disabled. Ask an administrator for an invitation." });
  const input = credentials.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid email and password of at least 8 characters." });
  const { data, error } = await requireSupabase().auth.signUp(input.data);
  if (error) return response.status(400).json({ error: error.message });
  if (data.session) setSessionCookies(response, data.session);
  response.status(201).json({ needsEmailConfirmation: !data.session, user: { id: data.user?.id, email: data.user?.email } });
});

const emailInput = z.object({ email: z.string().email(), purpose: z.enum(["signin", "recovery"]).default("signin") });
const otpInput = z.object({ email: z.string().email(), token: z.string().regex(/^\d{6,8}$/) });
const passwordInput = z.object({ password: z.string().min(8).max(128) });

authRouter.post("/otp/request", authLimit, async (request, response) => {
  const input = emailInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter a valid email address." });
  const redirect = env.APP_URL ? new URL(env.APP_URL) : null;
  if (redirect) redirect.searchParams.set("auth", input.data.purpose);
  const { error } = await requireSupabase().auth.signInWithOtp({
    email: input.data.email,
    options: { shouldCreateUser: false, ...(redirect ? { emailRedirectTo: redirect.toString() } : {}) },
  });
  if (error?.status === 429) return response.status(429).json({ error: "Too many email requests. Please wait and try again." });
  if (error) console.warn("Supabase OTP request failed:", error.message);
  response.status(202).json({ message: "If this email belongs to an active account, a verification code has been sent." });
});

const exchangeInput = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20),
  expiresIn: z.coerce.number().int().positive().max(86_400).default(3600),
});

authRouter.post("/exchange", authLimit, async (request, response) => {
  const input = exchangeInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "The email sign-in link is incomplete or invalid." });
  const client = requireSupabase();
  const { data: accessData, error: accessError } = await client.auth.getUser(input.data.accessToken);
  if (accessError || !accessData.user) return response.status(401).json({ error: "The email sign-in link is invalid or expired." });
  const { data: refreshed, error: refreshError } = await createSessionClient(input.data.accessToken).auth.refreshSession({
    refresh_token: input.data.refreshToken,
  });
  if (refreshError || !refreshed.session || !refreshed.user || refreshed.user.id !== accessData.user.id) {
    return response.status(401).json({ error: "The email sign-in session is invalid or expired." });
  }
  setSessionCookies(response, refreshed.session);
  response.json({ user: { id: refreshed.user.id, email: refreshed.user.email } });
});

authRouter.post("/otp/verify", authLimit, async (request, response) => {
  const input = otpInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Enter the email address and verification code from your message." });
  const { data, error } = await requireSupabase().auth.verifyOtp({ ...input.data, type: "email" });
  if (error || !data.session) return response.status(401).json({ error: "The verification code is invalid or expired." });
  setSessionCookies(response, data.session);
  response.json({ user: { id: data.user.id, email: data.user.email } });
});

authRouter.post("/password", authLimit, requireAuth, async (request, response) => {
  const input = passwordInput.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: "Use a password between 8 and 128 characters." });
  const accessToken = getRequestAccessToken(request);
  if (!accessToken) return response.status(401).json({ error: "Your session has expired. Verify your email again." });
  const { error } = await createSessionClient(accessToken).auth.updateUser({ password: input.data.password });
  if (error) return response.status(400).json({ error: "Unable to update the password. Request a new verification code and try again." });
  response.status(204).end();
});

authRouter.post("/sign-out", async (request, response) => {
  try {
    const accessToken = getRequestAccessToken(request);
    if (accessToken) await createSessionClient(accessToken).auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn("Unable to revoke the remote session during sign-out:", error.message);
  } finally {
    clearSessionCookies(response);
    response.status(204).end();
  }
});

authRouter.get("/session", requireAuth, (request, response) => response.json({ user: { id: request.user.id, email: request.user.email } }));
