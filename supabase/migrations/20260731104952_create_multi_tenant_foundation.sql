-- ============================================================
-- Instituto Államo Platform
-- Fundação multiempresa: organizações, usuários, papéis,
-- permissões e auditoria.
-- ============================================================

begin;

-- ============================================================
-- EXTENSÕES
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- TIPOS
-- ============================================================

create type public.organization_status as enum (
  'active',
  'inactive',
  'suspended'
);

create type public.organization_member_status as enum (
  'invited',
  'active',
  'inactive',
  'suspended'
);

-- ============================================================
-- FUNÇÕES UTILITÁRIAS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================
-- PERFIS
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  full_name text,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,

  is_active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint profiles_full_name_length
    check (full_name is null or char_length(full_name) between 2 and 150),

  constraint profiles_first_name_length
    check (first_name is null or char_length(first_name) between 1 and 80),

  constraint profiles_last_name_length
    check (last_name is null or char_length(last_name) between 1 and 100)
);

comment on table public.profiles is
  'Perfil público e corporativo associado ao usuário autenticado.';

comment on column public.profiles.id is
  'Identificador correspondente ao usuário em auth.users.';

-- ============================================================
-- ORGANIZAÇÕES
-- ============================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  legal_name text,
  slug text not null,
  document_number text,
  email text,
  phone text,
  logo_url text,

  status public.organization_status not null default 'active',

  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint organizations_name_length
    check (char_length(name) between 2 and 150),

  constraint organizations_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint organizations_slug_length
    check (char_length(slug) between 2 and 100)
);

create unique index organizations_slug_unique_idx
  on public.organizations (lower(slug));

create unique index organizations_document_number_unique_idx
  on public.organizations (document_number)
  where document_number is not null;

create index organizations_created_by_idx
  on public.organizations (created_by);

create index organizations_status_idx
  on public.organizations (status);

comment on table public.organizations is
  'Empresas, institutos ou clientes cadastrados na plataforma SaaS.';

-- ============================================================
-- MEMBROS DAS ORGANIZAÇÕES
-- ============================================================

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  status public.organization_member_status not null default 'active',

  is_owner boolean not null default false,

  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint organization_members_unique_user
    unique (organization_id, user_id),

  constraint organization_members_joined_at_required
    check (
      status <> 'active'
      or joined_at is not null
    )
);

create index organization_members_user_id_idx
  on public.organization_members (user_id);

create index organization_members_organization_id_idx
  on public.organization_members (organization_id);

create index organization_members_status_idx
  on public.organization_members (status);

create unique index organization_single_owner_idx
  on public.organization_members (organization_id)
  where is_owner = true;

comment on table public.organization_members is
  'Relacionamento entre usuários e organizações da plataforma.';

-- ============================================================
-- PAPÉIS
-- ============================================================

create table public.roles (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid
    references public.organizations(id) on delete cascade,

  name text not null,
  code text not null,
  description text,

  is_system boolean not null default false,
  is_active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint roles_name_length
    check (char_length(name) between 2 and 100),

  constraint roles_code_format
    check (code ~ '^[a-z][a-z0-9._-]*$'),

  constraint roles_system_scope
    check (
      (is_system = true and organization_id is null)
      or
      (is_system = false and organization_id is not null)
    )
);

create unique index roles_system_code_unique_idx
  on public.roles (code)
  where organization_id is null;

create unique index roles_organization_code_unique_idx
  on public.roles (organization_id, code)
  where organization_id is not null;

create index roles_organization_id_idx
  on public.roles (organization_id);

comment on table public.roles is
  'Papéis de acesso globais ou específicos de cada organização.';

-- ============================================================
-- PERMISSÕES
-- ============================================================

create table public.permissions (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  name text not null,
  description text,
  module text not null,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint permissions_code_format
    check (code ~ '^[a-z][a-z0-9._-]*$'),

  constraint permissions_module_format
    check (module ~ '^[a-z][a-z0-9._-]*$'),

  constraint permissions_name_length
    check (char_length(name) between 2 and 120)
);

create index permissions_module_idx
  on public.permissions (module);

comment on table public.permissions is
  'Catálogo global de permissões disponíveis na plataforma.';

-- ============================================================
-- PERMISSÕES DOS PAPÉIS
-- ============================================================

create table public.role_permissions (
  role_id uuid not null
    references public.roles(id) on delete cascade,

  permission_id uuid not null
    references public.permissions(id) on delete cascade,

  created_at timestamptz not null default timezone('utc', now()),

  primary key (role_id, permission_id)
);

create index role_permissions_permission_id_idx
  on public.role_permissions (permission_id);

-- ============================================================
-- PAPÉIS DOS MEMBROS
-- ============================================================

create table public.member_roles (
  organization_member_id uuid not null
    references public.organization_members(id) on delete cascade,

  role_id uuid not null
    references public.roles(id) on delete cascade,

  assigned_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default timezone('utc', now()),

  primary key (organization_member_id, role_id)
);

create index member_roles_role_id_idx
  on public.member_roles (role_id);

-- ============================================================
-- AUDITORIA
-- ============================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,

  organization_id uuid
    references public.organizations(id) on delete set null,

  actor_user_id uuid
    references public.profiles(id) on delete set null,

  action text not null,
  entity_type text not null,
  entity_id text,

  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,

  ip_address inet,
  user_agent text,

  created_at timestamptz not null default timezone('utc', now()),

  constraint audit_logs_action_length
    check (char_length(action) between 2 and 100),

  constraint audit_logs_entity_type_length
    check (char_length(entity_type) between 2 and 100)
);

create index audit_logs_organization_id_idx
  on public.audit_logs (organization_id);

create index audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id);

create index audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

comment on table public.audit_logs is
  'Registro imutável de ações relevantes realizadas na plataforma.';

-- ============================================================
-- TRIGGERS DE UPDATED_AT
-- ============================================================

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

create trigger roles_set_updated_at
before update on public.roles
for each row
execute function public.set_updated_at();

create trigger permissions_set_updated_at
before update on public.permissions
for each row
execute function public.set_updated_at();

-- ============================================================
-- CRIAÇÃO AUTOMÁTICA DO PERFIL
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    first_name,
    last_name,
    phone,
    avatar_url
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ============================================================
-- FUNÇÕES DE AUTORIZAÇÃO
-- ============================================================

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function private.is_organization_member(
  requested_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = requested_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  );
$$;

create or replace function private.is_organization_owner(
  requested_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = requested_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and om.is_owner = true
  );
$$;

create or replace function private.has_permission(
  requested_organization_id uuid,
  requested_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    inner join public.member_roles mr
      on mr.organization_member_id = om.id
    inner join public.roles r
      on r.id = mr.role_id
    inner join public.role_permissions rp
      on rp.role_id = r.id
    inner join public.permissions p
      on p.id = rp.permission_id
    where om.organization_id = requested_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and r.is_active = true
      and p.code = requested_permission_code
      and (
        r.organization_id = requested_organization_id
        or r.organization_id is null
      )
  );
$$;

-- ============================================================
-- GRANTS
-- ============================================================

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on schema public to authenticated;

grant select, update
  on public.profiles
  to authenticated;

grant select, insert, update, delete
  on public.organizations,
     public.organization_members,
     public.roles,
     public.role_permissions,
     public.member_roles
  to authenticated;

grant select
  on public.permissions,
     public.audit_logs
  to authenticated;

grant usage, select
  on sequence public.audit_logs_id_seq
  to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- POLÍTICAS: PROFILES
-- ============================================================

create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and id = (select auth.uid())
);

create policy "profiles_select_same_organization"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members viewer_membership
    inner join public.organization_members target_membership
      on target_membership.organization_id =
         viewer_membership.organization_id
    where viewer_membership.user_id = (select auth.uid())
      and viewer_membership.status = 'active'
      and target_membership.user_id = profiles.id
      and target_membership.status = 'active'
  )
);

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);

-- ============================================================
-- POLÍTICAS: ORGANIZATIONS
-- ============================================================

create policy "organizations_select_members"
on public.organizations
for select
to authenticated
using (
  (select private.is_organization_member(id))
);

create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and created_by = (select auth.uid())
);

create policy "organizations_update_owner"
on public.organizations
for update
to authenticated
using (
  (select private.is_organization_owner(id))
)
with check (
  (select private.is_organization_owner(id))
);

create policy "organizations_delete_owner"
on public.organizations
for delete
to authenticated
using (
  (select private.is_organization_owner(id))
);

-- ============================================================
-- POLÍTICAS: ORGANIZATION_MEMBERS
-- ============================================================

create policy "organization_members_select_members"
on public.organization_members
for select
to authenticated
using (
  (select private.is_organization_member(organization_id))
);

create policy "organization_members_insert_owner"
on public.organization_members
for insert
to authenticated
with check (
  (select private.is_organization_owner(organization_id))
);

create policy "organization_members_update_owner"
on public.organization_members
for update
to authenticated
using (
  (select private.is_organization_owner(organization_id))
)
with check (
  (select private.is_organization_owner(organization_id))
);

create policy "organization_members_delete_owner"
on public.organization_members
for delete
to authenticated
using (
  (select private.is_organization_owner(organization_id))
  and is_owner = false
);

-- ============================================================
-- POLÍTICAS: ROLES
-- ============================================================

create policy "roles_select_members"
on public.roles
for select
to authenticated
using (
  organization_id is null
  or (select private.is_organization_member(organization_id))
);

create policy "roles_insert_owner"
on public.roles
for insert
to authenticated
with check (
  organization_id is not null
  and is_system = false
  and (select private.is_organization_owner(organization_id))
);

create policy "roles_update_owner"
on public.roles
for update
to authenticated
using (
  organization_id is not null
  and is_system = false
  and (select private.is_organization_owner(organization_id))
)
with check (
  organization_id is not null
  and is_system = false
  and (select private.is_organization_owner(organization_id))
);

create policy "roles_delete_owner"
on public.roles
for delete
to authenticated
using (
  organization_id is not null
  and is_system = false
  and (select private.is_organization_owner(organization_id))
);

-- ============================================================
-- POLÍTICAS: PERMISSIONS
-- ============================================================

create policy "permissions_select_authenticated"
on public.permissions
for select
to authenticated
using (
  (select auth.uid()) is not null
);

-- ============================================================
-- POLÍTICAS: ROLE_PERMISSIONS
-- ============================================================

create policy "role_permissions_select_members"
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and (
        r.organization_id is null
        or (select private.is_organization_member(r.organization_id))
      )
  )
);

create policy "role_permissions_insert_owner"
on public.role_permissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and r.organization_id is not null
      and r.is_system = false
      and (select private.is_organization_owner(r.organization_id))
  )
);

create policy "role_permissions_delete_owner"
on public.role_permissions
for delete
to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and r.organization_id is not null
      and r.is_system = false
      and (select private.is_organization_owner(r.organization_id))
  )
);

-- ============================================================
-- POLÍTICAS: MEMBER_ROLES
-- ============================================================

create policy "member_roles_select_members"
on public.member_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.id = member_roles.organization_member_id
      and (select private.is_organization_member(om.organization_id))
  )
);

create policy "member_roles_insert_owner"
on public.member_roles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    inner join public.roles r
      on r.id = member_roles.role_id
    where om.id = member_roles.organization_member_id
      and (
        r.organization_id = om.organization_id
        or r.organization_id is null
      )
      and (select private.is_organization_owner(om.organization_id))
  )
);

create policy "member_roles_delete_owner"
on public.member_roles
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.id = member_roles.organization_member_id
      and (select private.is_organization_owner(om.organization_id))
  )
);

-- ============================================================
-- POLÍTICAS: AUDIT_LOGS
-- ============================================================

create policy "audit_logs_select_authorized"
on public.audit_logs
for select
to authenticated
using (
  organization_id is not null
  and (
    (select private.is_organization_owner(organization_id))
    or
    (select private.has_permission(
      organization_id,
      'audit.read'
    ))
  )
);

-- ============================================================
-- PERMISSÕES INICIAIS
-- ============================================================

insert into public.permissions (
  code,
  name,
  description,
  module
)
values
  (
    'organization.read',
    'Visualizar organização',
    'Permite visualizar os dados da organização.',
    'organization'
  ),
  (
    'organization.update',
    'Editar organização',
    'Permite editar os dados da organização.',
    'organization'
  ),
  (
    'members.read',
    'Visualizar membros',
    'Permite visualizar membros da organização.',
    'members'
  ),
  (
    'members.manage',
    'Gerenciar membros',
    'Permite convidar, editar e remover membros.',
    'members'
  ),
  (
    'roles.read',
    'Visualizar papéis',
    'Permite visualizar papéis e permissões.',
    'access-control'
  ),
  (
    'roles.manage',
    'Gerenciar papéis',
    'Permite criar e alterar papéis.',
    'access-control'
  ),
  (
    'audit.read',
    'Visualizar auditoria',
    'Permite consultar registros de auditoria.',
    'audit'
  )
on conflict (code) do nothing;

commit;