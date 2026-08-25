# Nazoft CRM

The existing Nazoft CRM prototype, now served through a small Node.js API and persisted to Supabase PostgreSQL.

## Run locally

1. Copy `.env.example` to `.env` and set the encoded Supabase PostgreSQL URL.
2. Install packages with `pnpm install`.
3. Create the database table with `pnpm db:migrate`.
4. Start the CRM with `pnpm dev` and open `http://localhost:3000`.

The browser still keeps a local copy for resilience. When served through the Node server, Supabase is the shared source of truth and changes sync after each save.

