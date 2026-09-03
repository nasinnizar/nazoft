create table if not exists public.security_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  primary key (scope, key_hash)
);

create index if not exists security_rate_limits_window_idx
  on public.security_rate_limits(window_started_at);

alter table public.security_rate_limits enable row level security;

-- This table is consumed only by trusted server code through DATABASE_URL.
-- Browser roles intentionally receive no policy or table grants.
revoke all on public.security_rate_limits from anon, authenticated;
