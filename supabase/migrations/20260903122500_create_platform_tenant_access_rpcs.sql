begin;

create or replace function public.platform_list_organization_members(
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
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required';
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

create or replace function public.platform_list_organization_invitations(
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
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required';
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

create or replace function public.platform_create_organization_invitation(
  p_organization_id uuid,
  p_email text,
  p_role_code text default 'member',
  p_expires_hours integer default 168
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_role_code text := lower(trim(coalesce(p_role_code, 'member')));
  v_role_id uuid;
  v_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required';
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = p_organization_id
      and o.status = 'active'
  ) then
    raise exception 'organization_not_available';
  end if;

  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'invalid_email';
  end if;

  if v_role_code not in ('member', 'manager', 'admin') then
    raise exception 'invalid_invitation_role';
  end if;

  if p_expires_hours < 1 or p_expires_hours > 720 then
    raise exception 'invalid_expiration_window';
  end if;

  if exists (
    select 1
    from public.organization_members om
    inner join auth.users au on au.id = om.user_id
    where om.organization_id = p_organization_id
      and lower(coalesce(au.email, '')) = v_email
      and om.status = 'active'
  ) then
    raise exception 'user_already_member';
  end if;

  select r.id
    into v_role_id
  from public.roles r
  where r.code = v_role_code
    and r.is_active = true
    and (r.organization_id = p_organization_id or r.organization_id is null)
  order by (r.organization_id = p_organization_id) desc
  limit 1;

  if v_role_id is null then
    raise exception 'role_not_found';
  end if;

  update public.organization_invitations
  set status = 'expired'
  where organization_id = p_organization_id
    and lower(email) = v_email
    and status = 'pending'
    and expires_at <= timezone('utc', now());

  delete from public.organization_invitations
  where organization_id = p_organization_id
    and lower(email) = v_email
    and status = 'pending';

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := timezone('utc', now()) + make_interval(hours => p_expires_hours);

  insert into public.organization_invitations (
    organization_id,
    email,
    role_id,
    token_hash,
    status,
    invited_by,
    expires_at
  ) values (
    p_organization_id,
    v_email,
    v_role_id,
    digest(v_token, 'sha256'),
    'pending',
    (select auth.uid()),
    v_expires_at
  )
  returning id into v_invitation_id;

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  ) values (
    p_organization_id,
    (select auth.uid()),
    'platform.tenant.invitation.created',
    'organization_invitation',
    v_invitation_id::text,
    jsonb_build_object('email', v_email, 'role', v_role_code, 'expires_at', v_expires_at)
  );

  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

create or replace function public.platform_cancel_organization_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required';
  end if;

  select organization_id into v_org_id
  from public.organization_invitations
  where id = p_invitation_id;

  if v_org_id is null then
    raise exception 'invitation_not_found';
  end if;

  update public.organization_invitations
  set status = 'cancelled'
  where id = p_invitation_id
    and status = 'pending';

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id
  ) values (
    v_org_id,
    (select auth.uid()),
    'platform.tenant.invitation.cancelled',
    'organization_invitation',
    p_invitation_id::text
  );
end;
$$;

grant execute on function public.platform_list_organization_members(uuid) to authenticated;
grant execute on function public.platform_list_organization_invitations(uuid) to authenticated;
grant execute on function public.platform_create_organization_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.platform_cancel_organization_invitation(uuid) to authenticated;

commit;
