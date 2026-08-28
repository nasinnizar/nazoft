create table if not exists public.crm_user_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_user_workspaces_updated_at_idx
  on public.crm_user_workspaces(updated_at desc);

alter table public.crm_user_workspaces enable row level security;

drop policy if exists "Users can read their legacy workspace" on public.crm_user_workspaces;
create policy "Users can read their legacy workspace"
  on public.crm_user_workspaces for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Users can create their legacy workspace" on public.crm_user_workspaces;
create policy "Users can create their legacy workspace"
  on public.crm_user_workspaces for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Users can update their legacy workspace" on public.crm_user_workspaces;
create policy "Users can update their legacy workspace"
  on public.crm_user_workspaces for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Users can delete their legacy workspace" on public.crm_user_workspaces;
create policy "Users can delete their legacy workspace"
  on public.crm_user_workspaces for delete to authenticated
  using (owner_id = auth.uid());

grant select, insert, update, delete on public.crm_user_workspaces to authenticated;
