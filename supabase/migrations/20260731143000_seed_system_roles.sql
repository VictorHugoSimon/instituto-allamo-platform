begin;

insert into public.roles (
  organization_id,
  code,
  name,
  description,
  is_system,
  is_active
)
select
  null,
  seed.code,
  seed.name,
  seed.description,
  true,
  true
from (
  values
    (
      'owner',
      'Proprietário',
      'Acesso completo à organização.'
    ),
    (
      'admin',
      'Administrador',
      'Administra membros, papéis, configurações e auditoria.'
    ),
    (
      'manager',
      'Gestor',
      'Visualiza a organização e administra membros.'
    ),
    (
      'member',
      'Colaborador',
      'Acesso básico aos recursos da organização.'
    )
) as seed(code, name, description)
where not exists (
  select 1
  from public.roles existing_role
  where existing_role.organization_id is null
    and existing_role.code = seed.code
);

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  role.id,
  permission.id
from public.roles role
cross join public.permissions permission
where role.organization_id is null
  and role.code in ('owner', 'admin')
  and not exists (
    select 1
    from public.role_permissions existing_assignment
    where existing_assignment.role_id = role.id
      and existing_assignment.permission_id = permission.id
  );

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  role.id,
  permission.id
from public.roles role
inner join public.permissions permission
  on permission.code in (
    'organization.read',
    'members.read',
    'members.manage',
    'roles.read'
  )
where role.organization_id is null
  and role.code = 'manager'
  and not exists (
    select 1
    from public.role_permissions existing_assignment
    where existing_assignment.role_id = role.id
      and existing_assignment.permission_id = permission.id
  );

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  role.id,
  permission.id
from public.roles role
inner join public.permissions permission
  on permission.code = 'organization.read'
where role.organization_id is null
  and role.code = 'member'
  and not exists (
    select 1
    from public.role_permissions existing_assignment
    where existing_assignment.role_id = role.id
      and existing_assignment.permission_id = permission.id
  );

insert into public.member_roles (
  organization_member_id,
  role_id,
  assigned_by
)
select
  organization_member.id,
  owner_role.id,
  organization_member.user_id
from public.organization_members organization_member
cross join public.roles owner_role
where organization_member.is_owner = true
  and organization_member.status = 'active'
  and owner_role.organization_id is null
  and owner_role.code = 'owner'
  and not exists (
    select 1
    from public.member_roles existing_member_role
    where existing_member_role.organization_member_id =
      organization_member.id
      and existing_member_role.role_id = owner_role.id
  );

commit;