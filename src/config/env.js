import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.preprocess(value => value || undefined, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(value => value || undefined, z.string().min(20).optional()),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
});

export const env = schema.parse(process.env);
