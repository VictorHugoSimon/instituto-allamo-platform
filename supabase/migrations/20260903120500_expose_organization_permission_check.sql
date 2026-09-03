begin;

create or replace function public.has_organization_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_organization_owner(p_organization_id))
    or
    (select private.has_permission(p_organization_id, p_permission_code));
$$;

grant execute on function public.has_organization_permission(uuid, text) to authenticated;

commit;
