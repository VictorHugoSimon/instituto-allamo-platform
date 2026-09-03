begin;

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role_id uuid references public.roles(id) on delete set null,
  token_hash bytea not null unique,
  status text not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint organization_invitations_email_format
    check (position('@' in email) > 1),

  constraint organization_invitations_status_check
    check (status in ('pending', 'accepted', 'cancelled', 'expired')),

  constraint organization_invitations_acceptance_check
    check (
      (status = 'accepted' and accepted_by is not null and accepted_at is not null)
      or status <> 'accepted'
    )
);

create index organization_invitations_org_idx
  on public.organization_invitations (organization_id, status, created_at desc);

create index organization_invitations_email_idx
  on public.organization_invitations (lower(email));

create unique index organization_invitations_pending_unique_idx
  on public.organization_invitations (organization_id, lower(email))
  where status = 'pending';

create trigger organization_invitations_set_updated_at
before update on public.organization_invitations
for each row
execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;

grant select, update
  on public.organization_invitations
  to authenticated;

create policy "organization_invitations_select_managers"
on public.organization_invitations
for select
to authenticated
using (
  (select private.has_permission(organization_id, 'members.read'))
  or (select private.has_permission(organization_id, 'members.manage'))
);

create policy "organization_invitations_update_managers"
on public.organization_invitations
for update
to authenticated
using (
  (select private.has_permission(organization_id, 'members.manage'))
)
with check (
  (select private.has_permission(organization_id, 'members.manage'))
);

create or replace function public.create_organization_invitation(
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
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  if not (select private.has_permission(p_organization_id, 'members.manage')) then
    raise exception 'members_manage_permission_required';
  end if;

  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'invalid_email';
  end if;

  if v_role_code not in ('member', 'manager', 'admin') then
    raise exception 'invalid_invitation_role';
  end if;

  if v_role_code = 'admin'
     and not (select private.is_organization_owner(p_organization_id)) then
    raise exception 'only_owner_can_invite_admin';
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
    'organization.invitation.created',
    'organization_invitation',
    v_invitation_id::text,
    jsonb_build_object('email', v_email, 'role', v_role_code, 'expires_at', v_expires_at)
  );

  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

create or replace function public.accept_organization_invitation(
  p_token text
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_invitation public.organization_invitations%rowtype;
  v_member_id uuid;
  v_org public.organizations%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if trim(coalesce(p_token, '')) = '' then
    raise exception 'invitation_token_required';
  end if;

  select *
    into v_invitation
  from public.organization_invitations oi
  where oi.token_hash = digest(trim(p_token), 'sha256')
  limit 1;

  if v_invitation.id is null then
    raise exception 'invalid_invitation';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if v_invitation.expires_at <= timezone('utc', now()) then
    update public.organization_invitations
    set status = 'expired'
    where id = v_invitation.id;
    raise exception 'invitation_expired';
  end if;

  if v_user_email = '' or v_user_email <> lower(v_invitation.email) then
    raise exception 'invitation_email_mismatch';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    status,
    is_owner,
    invited_by,
    joined_at
  ) values (
    v_invitation.organization_id,
    v_user_id,
    'active',
    false,
    v_invitation.invited_by,
    timezone('utc', now())
  )
  on conflict (organization_id, user_id)
  do update set
    status = 'active',
    invited_by = excluded.invited_by,
    joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at)
  returning id into v_member_id;

  if v_invitation.role_id is not null then
    insert into public.member_roles (
      organization_member_id,
      role_id,
      assigned_by
    ) values (
      v_member_id,
      v_invitation.role_id,
      v_invitation.invited_by
    )
    on conflict do nothing;
  end if;

  update public.organization_invitations
  set
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = timezone('utc', now())
  where id = v_invitation.id;

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    new_data
  ) values (
    v_invitation.organization_id,
    v_user_id,
    'organization.invitation.accepted',
    'organization_invitation',
    v_invitation.id::text,
    jsonb_build_object('email', v_invitation.email)
  );

  select * into v_org
  from public.organizations o
  where o.id = v_invitation.organization_id;

  return query select v_org.id, v_org.name, v_org.slug;
end;
$$;

create or replace function public.cancel_organization_invitation(
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
  select organization_id into v_org_id
  from public.organization_invitations
  where id = p_invitation_id;

  if v_org_id is null then
    raise exception 'invitation_not_found';
  end if;

  if not (select private.has_permission(v_org_id, 'members.manage')) then
    raise exception 'members_manage_permission_required';
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
    'organization.invitation.cancelled',
    'organization_invitation',
    p_invitation_id::text
  );
end;
$$;

grant execute on function public.create_organization_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.cancel_organization_invitation(uuid) to authenticated;

commit;
