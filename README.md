# Nazoft CRM

The existing Nazoft CRM prototype, now served through a structured Node.js API and persisted per authenticated user in Supabase PostgreSQL.

## Run locally

1. Copy `.env.example` to `.env` and set the encoded Supabase PostgreSQL URL, Supabase project URL, and anon/public key.
2. Install packages with `pnpm install`.
3. Create the database table with `pnpm db:migrate`.
4. Start the CRM with `pnpm dev` and open `http://localhost:3000`.

The browser keeps a local copy for resilience. When served through the Node server, Supabase Auth protects every API route and each signed-in user has an isolated `crm_user_workspaces` record. Configure email/password auth in the Supabase dashboard before inviting users.

## Vercel deployment

The included `api/index.js` is a Vercel serverless entry point and `vercel.json` routes the CRM and API through it. In Vercel Project Settings → Environment Variables, add `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `COOKIE_SECURE=true`. Run `pnpm db:migrate` once from a trusted local environment before the first deploy.
