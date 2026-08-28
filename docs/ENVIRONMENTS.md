# Testing and production workflow

## Environment layout

Use two completely separate Supabase projects:

| Use | Git | Vercel | Supabase | Local file |
| --- | --- | --- | --- | --- |
| Local development | feature branches | not required | testing project | `.env.testing` |
| Shared testing | `develop` or feature branch | Preview | testing project | none in Vercel |
| Production | `main` | Production | production project | none in Vercel |

The current Nazoft Supabase project should be treated as production because it already contains real authentication and CRM workspace data. Create a second project named something like **Nazoft CRM Testing** for development. Do not clone real customer data into it; use synthetic leads and test users.

## One-time testing setup

1. Create a separate Supabase project for testing.
2. Copy `.env.testing.example` to `.env.testing` and add only testing-project values.
3. In the testing Supabase dashboard, set Authentication Site URL to `http://localhost:3000` and add `http://localhost:3000/**` to Redirect URLs.
4. Keep public signup disabled. Create or invite dedicated test users instead.
5. Run `pnpm db:migrate:testing` to apply the same additive schema to the testing database.
6. Run `pnpm dev:testing` and test at `http://localhost:3000`.
7. In Vercel Preview environment variables, add the testing Supabase and database values. Never reuse the production service-role key.

## Production setup

Set production values only in Vercel's **Production** environment scope. Use the production Supabase project, `APP_URL=https://nazoft.vercel.app`, `COOKIE_SECURE=true`, and `ALLOW_PUBLIC_SIGNUP=false`. Configure the production Site URL and redirect allow-list in Supabase. SMTP credentials should also be scoped to production.

## Safe development cycle

1. Create a feature branch from the latest `main`.
2. Develop locally using `.env.testing` and synthetic data.
3. Add every schema change as a new additive migration. Never edit a migration already applied to production.
4. Apply migrations to testing first and run lint, tests, build, and login/workflow checks.
5. Push the branch and inspect its Vercel Preview deployment, which must use testing environment variables.
6. Review the code and database migration before merging to `main`.
7. Back up production before any material database migration.
8. Apply the reviewed migration to production, then merge/deploy `main`.
9. Run a short production smoke test: login, tenant isolation, lead read/write, logout, and invitation email.

## Rollback rule

Vercel can roll application code back to an earlier deployment. Database migrations should remain backward-compatible for at least one release so the previous code can still run. Do not drop or rename production columns in the same release that stops using them; migrate data first, deploy compatible code, and remove obsolete schema only in a later reviewed release.

## Secret-safety checklist

- `.env`, `.env.testing`, and `.env.production.local` are ignored by Git.
- Commit only `.example` files containing placeholders.
- The service-role key is server-only and must never appear in `index.html`, browser JavaScript, screenshots, issues, or chat.
- Scope Vercel variables separately for Preview and Production.
- Rotate a password or service key immediately if it is exposed.
- Use different database passwords and service keys for testing and production.
- Give test accounts fake data and the minimum role needed.
- Keep RLS enabled in both projects and run migrations in both environments.
