create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  personal_owner_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'sales' check (role in ('admin', 'manager', 'sales', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id, status);

create table if not exists public.organization_workspaces (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_admin(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;

do $$
declare
  legacy record;
  target_organization_id uuid;
begin
  for legacy in select owner_id, state, created_at, updated_at from public.crm_user_workspaces loop
    insert into public.organizations (name, created_by, personal_owner_id, created_at, updated_at)
    values ('My organization', legacy.owner_id, legacy.owner_id, legacy.created_at, legacy.updated_at)
    on conflict (personal_owner_id) do update set updated_at = greatest(public.organizations.updated_at, excluded.updated_at)
    returning id into target_organization_id;

    insert into public.profiles (user_id, display_name)
    values (legacy.owner_id, '')
    on conflict (user_id) do nothing;

    insert into public.organization_members (organization_id, user_id, role, status, created_at, updated_at)
    values (target_organization_id, legacy.owner_id, 'admin', 'active', legacy.created_at, legacy.updated_at)
    on conflict (organization_id, user_id) do update set role = 'admin', status = 'active', updated_at = excluded.updated_at;

    insert into public.organization_workspaces (organization_id, state, created_at, updated_at)
    values (target_organization_id, legacy.state, legacy.created_at, legacy.updated_at)
    on conflict (organization_id) do nothing;
  end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_workspaces enable row level security;

drop policy if exists "Organization members can read profiles" on public.profiles;
create policy "Organization members can read profiles"
  on public.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organization_members mine
      join public.organization_members theirs using (organization_id)
      where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = profiles.user_id
    )
  );

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Members can read their organizations" on public.organizations;
create policy "Members can read their organizations"
  on public.organizations for select to authenticated
  using (public.is_organization_member(id));

drop policy if exists "Admins can update their organizations" on public.organizations;
create policy "Admins can update their organizations"
  on public.organizations for update to authenticated
  using (public.is_organization_admin(id)) with check (public.is_organization_admin(id));

drop policy if exists "Members can read organization membership" on public.organization_members;
create policy "Members can read organization membership"
  on public.organization_members for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "Admins can add organization members" on public.organization_members;
create policy "Admins can add organization members"
  on public.organization_members for insert to authenticated
  with check (public.is_organization_admin(organization_id));

drop policy if exists "Admins can update organization members" on public.organization_members;
create policy "Admins can update organization members"
  on public.organization_members for update to authenticated
  using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));

drop policy if exists "Admins can remove organization members" on public.organization_members;
create policy "Admins can remove organization members"
  on public.organization_members for delete to authenticated
  using (public.is_organization_admin(organization_id) and user_id <> auth.uid());

drop policy if exists "Members can read organization workspaces" on public.organization_workspaces;
create policy "Members can read organization workspaces"
  on public.organization_workspaces for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists "Editors can update organization workspaces" on public.organization_workspaces;
create policy "Editors can update organization workspaces"
  on public.organization_workspaces for update to authenticated
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = organization_workspaces.organization_id
        and user_id = auth.uid() and status = 'active' and role in ('admin', 'manager', 'sales')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_id = organization_workspaces.organization_id
        and user_id = auth.uid() and status = 'active' and role in ('admin', 'manager', 'sales')
    )
  );

grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, update on public.organization_workspaces to authenticated;

-- The old anonymous workspace has no ownership mapping. Keep RLS enabled and
-- intentionally provide no policies, so browser roles cannot access it.
alter table if exists public.crm_workspaces enable row level security;
