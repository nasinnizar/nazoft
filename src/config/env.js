import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const nonEmpty = value => typeof value === "string" && value.trim() ? value.trim() : undefined;
loadDotenv({ path: nonEmpty(process.env.NAZOFT_ENV_FILE) ?? ".env" });
const nodeEnv = nonEmpty(process.env.NODE_ENV) ?? "development";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NAZOFT_ENV_FILE: z.preprocess(nonEmpty, z.string().optional()),
  PORT: z.preprocess(nonEmpty, z.coerce.number().int().positive().default(3000)),
  DATABASE_URL: z.string().url({ message: "Set DATABASE_URL (or Vercel POSTGRES_URL) to a valid PostgreSQL connection URL." }),
  SUPABASE_URL: z.preprocess(nonEmpty, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(nonEmpty, z.string().min(20).optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(nonEmpty, z.string().min(20).optional()),
  APP_URL: z.preprocess(nonEmpty, z.string().url().optional()),
  ALLOW_PUBLIC_SIGNUP: z.preprocess(
    value => nonEmpty(value) ?? "false",
    z.enum(["true", "false"]).transform(value => value === "true"),
  ),
  COOKIE_SECURE: z.preprocess(
    value => nonEmpty(value) ?? (nodeEnv === "production" ? "true" : "false"),
    z.enum(["true", "false"]).transform(value => value === "true"),
  ),
});

export const env = schema.parse({
  ...process.env,
  NODE_ENV: nodeEnv,
  DATABASE_URL: nonEmpty(process.env.DATABASE_URL)
    ?? nonEmpty(process.env.POSTGRES_URL)
    ?? nonEmpty(process.env.POSTGRES_PRISMA_URL)
    ?? nonEmpty(process.env.POSTGRES_URL_NON_POOLING),
});
