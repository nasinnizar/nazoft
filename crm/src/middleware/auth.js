import { supabase } from "../services/supabase.js";

export async function requireAuth(request, response, next) {
  const bearer = request.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || request.cookies.nazoft_access_token;
  if (!token) return response.status(401).json({ error: "Authentication required" });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return response.status(401).json({ error: "Session expired. Please sign in again." });
  request.user = data.user;
  next();
}
