begin;

create or replace function public.list_organization_members(
  p_organization_id uuid
)
returns table (
  member_id uuid,
  user_id uuid,
  full_name text,
  email text,
  member_status text,
  is_owner boolean,
  role_codes text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  if not (
    (select private.has_permission(p_organization_id, 'members.read'))
    or (select private.has_permission(p_organization_id, 'members.manage'))
    or (select private.is_organization_owner(p_organization_id))
  ) then
    raise exception 'members_read_permission_required';
  end if;

  return query
  select
    om.id,
    om.user_id,
    p.full_name,
    au.email::text,
    om.status::text,
    om.is_owner,
    coalesce(
      array_agg(distinct r.code order by r.code) filter (where r.code is not null),
      array[]::text[]
    )
  from public.organization_members om
  left join public.profiles p on p.id = om.user_id
  left join auth.users au on au.id = om.user_id
  left join public.member_roles mr on mr.organization_member_id = om.id
  left join public.roles r on r.id = mr.role_id
  where om.organization_id = p_organization_id
  group by om.id, om.user_id, p.full_name, au.email, om.status, om.is_owner
  order by om.is_owner desc, coalesce(p.full_name, au.email::text, om.user_id::text);
end;
$$;

create or replace function public.list_organization_invitations(
  p_organization_id uuid
)
returns table (
  invitation_id uuid,
  email text,
  invitation_status text,
  role_code text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  if not (
    (select private.has_permission(p_organization_id, 'members.read'))
    or (select private.has_permission(p_organization_id, 'members.manage'))
    or (select private.is_organization_owner(p_organization_id))
  ) then
    raise exception 'members_read_permission_required';
  end if;

  return query
  select
    oi.id,
    oi.email,
    oi.status,
    r.code,
    oi.expires_at,
    oi.created_at
  from public.organization_invitations oi
  left join public.roles r on r.id = oi.role_id
  where oi.organization_id = p_organization_id
  order by oi.created_at desc;
end;
$$;

grant execute on function public.list_organization_members(uuid) to authenticated;
grant execute on function public.list_organization_invitations(uuid) to authenticated;

commit;
