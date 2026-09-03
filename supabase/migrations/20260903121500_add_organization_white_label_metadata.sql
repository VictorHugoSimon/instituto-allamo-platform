begin;

alter table public.organizations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.organizations.metadata is
  'Configurações extensíveis da organização, incluindo experiência white-label e módulos contratados.';

commit;
