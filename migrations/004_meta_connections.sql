create table if not exists public.meta_oauth_states (
  state_hash text primary key, user_id uuid not null, organization_id uuid not null references public.organizations(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.meta_pages (
  page_id text primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  page_name text not null, token_cipher text not null, owner_email text,
  subscribed boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists public.meta_received_leads (
  page_id text not null references public.meta_pages(page_id) on delete cascade,
  lead_id text not null, received_at timestamptz not null default now(), primary key(page_id,lead_id)
);
alter table public.meta_oauth_states enable row level security;
alter table public.meta_pages enable row level security;
alter table public.meta_received_leads enable row level security;
revoke all on public.meta_oauth_states, public.meta_pages, public.meta_received_leads from anon, authenticated;
