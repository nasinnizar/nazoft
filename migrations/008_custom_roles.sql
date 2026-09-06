alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role ~ '^[a-z][a-z0-9_-]{1,31}$') not valid;

alter table public.organization_members
  validate constraint organization_members_role_check;

drop policy if exists "Editors can update organization workspaces" on public.organization_workspaces;
create policy "Permission holders can update organization workspaces"
  on public.organization_workspaces for update to authenticated
  using (
    exists (
      select 1
        from public.organization_members member
        join public.organizations organization on organization.id = member.organization_id
       where member.organization_id = organization_workspaces.organization_id
         and member.user_id = (select auth.uid())
         and member.status = 'active'
         and (
           member.role = 'admin'
           or coalesce(organization.role_permissions -> member.role, '[]'::jsonb) ?| array[
             'Create leads', 'Edit leads', 'Delete leads', 'Assign leads', 'Manage follow-ups',
             'Create tasks', 'Edit tasks', 'Complete tasks', 'Delete tasks',
             'Move pipeline leads', 'Manage pipelines', 'Create proposals', 'Edit proposals',
             'Create content', 'Edit content', 'Delete content', 'Log activities', 'Edit CRM settings'
           ]
         )
    )
  )
  with check (
    exists (
      select 1
        from public.organization_members member
        join public.organizations organization on organization.id = member.organization_id
       where member.organization_id = organization_workspaces.organization_id
         and member.user_id = (select auth.uid())
         and member.status = 'active'
         and (
           member.role = 'admin'
           or coalesce(organization.role_permissions -> member.role, '[]'::jsonb) ?| array[
             'Create leads', 'Edit leads', 'Delete leads', 'Assign leads', 'Manage follow-ups',
             'Create tasks', 'Edit tasks', 'Complete tasks', 'Delete tasks',
             'Move pipeline leads', 'Manage pipelines', 'Create proposals', 'Edit proposals',
             'Create content', 'Edit content', 'Delete content', 'Log activities', 'Edit CRM settings'
           ]
         )
    )
  );
