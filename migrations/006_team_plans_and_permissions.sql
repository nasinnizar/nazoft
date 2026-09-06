alter table public.organizations
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'growth', 'scale')),
  add column if not exists role_permissions jsonb not null default '{"admin":["View all leads","Edit leads","Delete leads","Export data","Edit CRM settings","Manage users"],"manager":["View all leads","Edit leads","Delete leads","Export data"],"sales":["Edit leads"],"viewer":["View all leads"]}'::jsonb;

alter table public.organizations
  add constraint organizations_role_permissions_object
  check (jsonb_typeof(role_permissions) = 'object') not valid;

alter table public.organizations validate constraint organizations_role_permissions_object;
