begin;

create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint platform_admins_role_check
    check (role in ('owner', 'admin', 'support'))
);

create trigger platform_admins_set_updated_at
before update on public.platform_admins
for each row
execute function public.set_updated_at();

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and pa.is_active = true
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin());
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Bootstrap seguro: se já existir uma organização Államo, o seu proprietário
-- pode assumir a primeira administração da plataforma. Depois do primeiro
-- administrador, o bootstrap deixa de funcionar.
create or replace function public.bootstrap_platform_owner()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_allowed boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if exists (select 1 from public.platform_admins) then
    return (select private.is_platform_admin());
  end if;

  select exists (
    select 1
    from public.organization_members om
    inner join public.organizations o on o.id = om.organization_id
    where om.user_id = v_user_id
      and om.status = 'active'
      and om.is_owner = true
      and (
        lower(o.slug) in ('allamo', 'instituto-allamo', 'instituto-allamo-platform')
        or lower(o.name) like '%allamo%'
        or lower(o.name) like '%államo%'
      )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'allamo_owner_required_for_bootstrap';
  end if;

  insert into public.platform_admins (user_id, role, is_active)
  values (v_user_id, 'owner', true)
  on conflict (user_id) do update set is_active = true, role = 'owner';

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id
  ) values (
    v_user_id,
    'platform.owner.bootstrapped',
    'platform_admin',
    v_user_id::text
  );

  return true;
end;
$$;

grant execute on function public.bootstrap_platform_owner() to authenticated;

-- Se a base já contém uma organização Államo, semeia automaticamente o seu
-- proprietário atual como owner do Control Center.
insert into public.platform_admins (user_id, role, is_active)
select om.user_id, 'owner', true
from public.organization_members om
inner join public.organizations o on o.id = om.organization_id
where om.status = 'active'
  and om.is_owner = true
  and (
    lower(o.slug) in ('allamo', 'instituto-allamo', 'instituto-allamo-platform')
    or lower(o.name) like '%allamo%'
    or lower(o.name) like '%államo%'
  )
order by o.created_at asc
limit 1
on conflict (user_id) do nothing;

create or replace function public.list_platform_tenants()
returns table (
  organization_id uuid,
  name text,
  slug text,
  organization_status text,
  logo_url text,
  metadata jsonb,
  member_count bigint,
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
    o.id,
    o.name,
    o.slug,
    o.status::text,
    o.logo_url,
    o.metadata,
    count(om.id) filter (where om.status = 'active') as member_count,
    o.created_at
  from public.organizations o
  left join public.organization_members om on om.organization_id = o.id
  group by o.id, o.name, o.slug, o.status, o.logo_url, o.metadata, o.created_at
  order by o.created_at desc;
end;
$$;

grant execute on function public.list_platform_tenants() to authenticated;

create or replace function public.platform_create_tenant(
  p_name text,
  p_slug text,
  p_segment text default 'empresa',
  p_product_label text default 'Plataforma Enterprise'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := trim(p_name);
  v_slug text := lower(trim(p_slug));
  v_segment text := lower(trim(coalesce(p_segment, 'empresa')));
  v_product_label text := trim(coalesce(p_product_label, 'Plataforma Enterprise'));
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 150 then
    raise exception 'invalid_organization_name';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_organization_slug';
  end if;

  if exists (select 1 from public.organizations where lower(slug) = v_slug) then
    raise exception 'organization_slug_already_exists';
  end if;

  insert into public.organizations (
    name,
    slug,
    status,
    created_by,
    metadata
  ) values (
    v_name,
    v_slug,
    'active',
    (select auth.uid()),
    jsonb_build_object(
      'segment', v_segment,
      'productLabel', v_product_label,
      'whiteLabel', true,
      'managedBy', 'allamo'
    )
  )
  returning id into v_id;

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  ) values (
    v_id,
    (select auth.uid()),
    'platform.tenant.created',
    'organization',
    v_id::text,
    jsonb_build_object('name', v_name, 'slug', v_slug, 'productLabel', v_product_label)
  );

  return v_id;
end;
$$;

grant execute on function public.platform_create_tenant(text, text, text, text) to authenticated;

commit;
