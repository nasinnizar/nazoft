# Nazoft CRM

Nazoft CRM is a browser-based CRM served by Node.js locally and Vercel serverless functions in production. Supabase provides PostgreSQL and authentication. CRM state is shared inside an organization and isolated from every other organization.

## Architecture

- Frontend: one dependency-free HTML/JavaScript application in `index.html`, with shared polish in `styles/audit-polish.css`.
- Local backend: Express 5 in `src/app.js` and `scripts/local-server.js`.
- Production backend: Vercel functions in `api/`.
- Database: Supabase PostgreSQL through `pg`; additive SQL migrations live in `migrations/`.
- Authentication: Supabase email/password and email OTP. Tokens are stored only in HttpOnly, SameSite cookies.
- Tenancy: `organizations`, `organization_members`, and `organization_workspaces`. RLS denies cross-organization reads and writes.
- Roles: admin, manager, sales, and viewer. Invitations require the server-only Supabase service-role key.
- Storage: no Supabase Storage bucket is currently used; small profile images remain embedded in the organization workspace JSON.

## Run locally

1. Copy `.env.example` to `.env` and set the database URL, Supabase URL, and anon/public key.
2. Run `pnpm install`.
3. Run `pnpm db:migrate`.
4. Run `pnpm dev` and open `http://localhost:3000`.

Use `pnpm run lint`, `pnpm test`, and `pnpm run build` before committing.

For ongoing development, use a separate Supabase testing project: copy `.env.testing.example` to `.env.testing`, run `pnpm db:migrate:testing`, then run `pnpm dev:testing`. See `docs/ENVIRONMENTS.md` for the complete testing-to-production promotion and rollback process.

## Authentication setup

In Supabase Authentication:

1. Set **URL Configuration → Site URL** to the production application URL.
2. Add the production URL (and localhost for development) to **Redirect URLs**.
3. Configure **Emails → SMTP Settings** with a real SMTP provider before inviting external business users. Supabase's default mailer is intended only for limited testing.
4. Ensure the **Magic link or OTP** template includes `{{ .Token }}` so users receive the code expected by the CRM.

Public sign-up is disabled by default. Administrators invite users from **Settings → Users & access** after `SUPABASE_SERVICE_ROLE_KEY` is configured on the server.

## Vercel deployment

Vercel serves the static client and runs files in `api/` as serverless functions. Configure these environment variables for Production and Preview as appropriate:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for invitations; never expose it to the client)
- `APP_URL`
- `ALLOW_PUBLIC_SIGNUP=false`
- `COOKIE_SECURE=true`

Run `pnpm db:migrate` from a trusted environment when new migration files are added. Migrations are tracked in `crm_schema_migrations` and must remain additive unless a destructive change is explicitly reviewed.
