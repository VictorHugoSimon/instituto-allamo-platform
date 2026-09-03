begin;

-- O pgcrypto foi instalado pela fundação da plataforma. As funções abaixo
-- precisam enxergar o schema public, onde a extensão foi criada, sem depender
-- do search_path da sessão do usuário.
alter function public.create_organization_invitation(uuid, text, text, integer)
  set search_path = pg_catalog, public;

alter function public.accept_organization_invitation(text)
  set search_path = pg_catalog, public;

alter function public.platform_create_organization_invitation(uuid, text, text, integer)
  set search_path = pg_catalog, public;

-- A tabela contém somente hash de token, mas ainda assim não precisa ficar
-- consultável diretamente pelo frontend. Toda leitura/escrita passa pelas RPCs
-- security definer com autorização explícita.
revoke all on public.organization_invitations from authenticated;

grant execute on function public.create_organization_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.cancel_organization_invitation(uuid) to authenticated;
grant execute on function public.list_organization_invitations(uuid) to authenticated;
grant execute on function public.platform_create_organization_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.platform_cancel_organization_invitation(uuid) to authenticated;
grant execute on function public.platform_list_organization_invitations(uuid) to authenticated;

commit;
