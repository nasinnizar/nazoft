create table if not exists public.lead_integrations (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('google','website')), key_hash text not null,
 owner_email text not null, last_received_at timestamptz, last_test_at timestamptz,
 unique(organization_id,kind)
);
create table if not exists public.integration_receipts (
 integration_id uuid references public.lead_integrations(id) on delete cascade,
 external_id text not null, primary key(integration_id,external_id)
);
alter table public.lead_integrations enable row level security;
alter table public.integration_receipts enable row level security;
revoke all on public.lead_integrations, public.integration_receipts from anon, authenticated;
