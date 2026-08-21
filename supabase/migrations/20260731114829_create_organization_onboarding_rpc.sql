alter table public.organizations
add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.create_organization_onboarding(
  p_name text,
  p_slug text,
  p_segment text default 'instituto'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_organization_id uuid;
  v_member_id uuid;
  v_owner_role_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  p_name := btrim(p_name);
  p_slug := lower(btrim(p_slug));
  p_segment := lower(btrim(coalesce(p_segment, 'instituto')));

  if char_length(p_name) < 3 then
    raise exception 'INVALID_ORGANIZATION_NAME';
  end if;

  if char_length(p_name) > 120 then
    raise exception 'ORGANIZATION_NAME_TOO_LONG';
  end if;

  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'INVALID_ORGANIZATION_SLUG';
  end if;

  if p_segment not in (
    'instituto',
    'empresa',
    'ong',
    'associacao',
    'outro'
  ) then
    raise exception 'INVALID_ORGANIZATION_SEGMENT';
  end if;

  if exists (
    select 1
    from public.organization_members
    where user_id = v_user_id
      and status = 'active'
  ) then
    raise exception 'USER_ALREADY_HAS_ORGANIZATION';
  end if;

  insert into public.organizations (
    name,
    slug,
    created_by,
    metadata
  )
  values (
    p_name,
    p_slug,
    v_user_id,
    jsonb_build_object('segment', p_segment)
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    status,
    is_owner,
    joined_at
  )
  values (
    v_organization_id,
    v_user_id,
    'active',
    true,
    timezone('utc', now())
  )
  returning id into v_member_id;

  select id
  into v_owner_role_id
  from public.roles
  where code = 'owner'
    and organization_id is null
    and is_active = true
  order by created_at
  limit 1;

  if v_owner_role_id is not null then
    insert into public.member_roles (
      organization_member_id,
      role_id,
      assigned_by
    )
    values (
      v_member_id,
      v_owner_role_id,
      v_user_id
    )
    on conflict do nothing;
  end if;

  return v_organization_id;

exception
  when unique_violation then
    raise exception 'ORGANIZATION_SLUG_ALREADY_EXISTS';
end;
$$;

revoke all
on function public.create_organization_onboarding(text, text, text)
from public;

grant execute
on function public.create_organization_onboarding(text, text, text)
to authenticated;

comment on function public.create_organization_onboarding(text, text, text)
is 'Cria atomicamente a primeira organização e vincula o usuário autenticado como proprietário.';