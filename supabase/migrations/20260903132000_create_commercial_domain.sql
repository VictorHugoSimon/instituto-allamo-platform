begin;

-- ============================================================
-- PERMISSÕES COMERCIAIS
-- ============================================================

insert into public.permissions (code, name, description, module)
values
  ('commercial.read', 'Visualizar comercial', 'Permite consultar carteira, oportunidades e indicadores comerciais.', 'commercial'),
  ('commercial.manage', 'Gerenciar comercial', 'Permite criar e editar contas, oportunidades, campanhas e rotas.', 'commercial'),
  ('commercial.field', 'Executar atividades de campo', 'Permite registrar visitas, interações e execução de rotas.', 'commercial'),
  ('commercial.approve', 'Aprovar condições comerciais', 'Permite decidir solicitações de desconto, crédito e exceções comerciais.', 'commercial')
on conflict (code) do nothing;

-- owner/admin: todas as permissões comerciais.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'commercial.read', 'commercial.manage', 'commercial.field', 'commercial.approve'
)
where r.organization_id is null
  and r.code in ('owner', 'admin')
on conflict do nothing;

-- manager: leitura, gestão, campo e aprovação.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'commercial.read', 'commercial.manage', 'commercial.field', 'commercial.approve'
)
where r.organization_id is null
  and r.code = 'manager'
on conflict do nothing;

-- member: consulta + execução em campo.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('commercial.read', 'commercial.field')
where r.organization_id is null
  and r.code = 'member'
on conflict do nothing;

-- ============================================================
-- CONTAS / CARTEIRA
-- ============================================================

create table public.commercial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  legal_name text,
  document_number text,
  account_type text not null default 'prospect',
  status text not null default 'active',
  city text,
  state text,
  country text not null default 'BR',
  latitude numeric(9,6),
  longitude numeric(9,6),
  segment text,
  crops text[] not null default '{}'::text[],
  hectares numeric(14,2),
  annual_potential_value numeric(16,2),
  score integer not null default 0,
  source text,
  owner_user_id uuid references public.profiles(id) on delete set null,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commercial_accounts_name_length check (char_length(name) between 2 and 180),
  constraint commercial_accounts_type_check check (account_type in ('prospect', 'lead', 'customer', 'partner', 'revenda', 'producer', 'cooperative', 'other')),
  constraint commercial_accounts_status_check check (status in ('active', 'inactive', 'blocked', 'archived')),
  constraint commercial_accounts_score_check check (score between 0 and 100),
  constraint commercial_accounts_hectares_check check (hectares is null or hectares >= 0),
  constraint commercial_accounts_potential_check check (annual_potential_value is null or annual_potential_value >= 0),
  constraint commercial_accounts_lat_check check (latitude is null or latitude between -90 and 90),
  constraint commercial_accounts_long_check check (longitude is null or longitude between -180 and 180)
);

create index commercial_accounts_org_idx on public.commercial_accounts (organization_id, status);
create index commercial_accounts_owner_idx on public.commercial_accounts (organization_id, owner_user_id);
create index commercial_accounts_score_idx on public.commercial_accounts (organization_id, score desc);
create index commercial_accounts_geo_idx on public.commercial_accounts (organization_id, state, city);
create unique index commercial_accounts_document_unique_idx
  on public.commercial_accounts (organization_id, document_number)
  where document_number is not null;

create trigger commercial_accounts_set_updated_at
before update on public.commercial_accounts
for each row execute function public.set_updated_at();

-- ============================================================
-- OPORTUNIDADES
-- ============================================================

create table public.commercial_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.commercial_accounts(id) on delete cascade,
  title text not null,
  crop text,
  stage text not null default 'mapped',
  status text not null default 'open',
  score integer not null default 0,
  potential_value numeric(16,2),
  potential_hectares numeric(14,2),
  probability integer not null default 0,
  expected_close_date date,
  owner_user_id uuid references public.profiles(id) on delete set null,
  loss_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commercial_opportunities_title_length check (char_length(title) between 2 and 200),
  constraint commercial_opportunities_stage_check check (stage in ('mapped', 'qualified', 'contact', 'diagnosis', 'proposal', 'negotiation', 'won', 'lost')),
  constraint commercial_opportunities_status_check check (status in ('open', 'won', 'lost', 'cancelled')),
  constraint commercial_opportunities_score_check check (score between 0 and 100),
  constraint commercial_opportunities_probability_check check (probability between 0 and 100),
  constraint commercial_opportunities_value_check check (potential_value is null or potential_value >= 0),
  constraint commercial_opportunities_hectares_check check (potential_hectares is null or potential_hectares >= 0)
);

create index commercial_opportunities_org_idx on public.commercial_opportunities (organization_id, status, stage);
create index commercial_opportunities_account_idx on public.commercial_opportunities (organization_id, account_id);
create index commercial_opportunities_owner_idx on public.commercial_opportunities (organization_id, owner_user_id);
create index commercial_opportunities_score_idx on public.commercial_opportunities (organization_id, score desc);
create index commercial_opportunities_close_idx on public.commercial_opportunities (organization_id, expected_close_date);

create trigger commercial_opportunities_set_updated_at
before update on public.commercial_opportunities
for each row execute function public.set_updated_at();

-- ============================================================
-- INTERAÇÕES / VISITAS
-- ============================================================

create table public.commercial_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.commercial_accounts(id) on delete cascade,
  opportunity_id uuid references public.commercial_opportunities(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  interaction_type text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  summary text not null,
  next_action text,
  next_action_at timestamptz,
  latitude numeric(9,6),
  longitude numeric(9,6),
  evidence_urls text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commercial_interactions_type_check check (interaction_type in ('call', 'message', 'email', 'meeting', 'visit', 'technical_visit', 'complaint', 'support', 'other')),
  constraint commercial_interactions_summary_length check (char_length(summary) between 2 and 4000),
  constraint commercial_interactions_lat_check check (latitude is null or latitude between -90 and 90),
  constraint commercial_interactions_long_check check (longitude is null or longitude between -180 and 180)
);

create index commercial_interactions_org_date_idx on public.commercial_interactions (organization_id, occurred_at desc);
create index commercial_interactions_account_idx on public.commercial_interactions (organization_id, account_id, occurred_at desc);
create index commercial_interactions_user_idx on public.commercial_interactions (organization_id, user_id, occurred_at desc);

create trigger commercial_interactions_set_updated_at
before update on public.commercial_interactions
for each row execute function public.set_updated_at();

-- ============================================================
-- ROTAS E PARADAS
-- ============================================================

create table public.commercial_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  route_date date not null,
  status text not null default 'planned',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commercial_routes_name_length check (char_length(name) between 2 and 160),
  constraint commercial_routes_status_check check (status in ('planned', 'in_progress', 'completed', 'cancelled'))
);

create index commercial_routes_org_date_idx on public.commercial_routes (organization_id, route_date);
create index commercial_routes_owner_idx on public.commercial_routes (organization_id, owner_user_id, route_date);

create trigger commercial_routes_set_updated_at
before update on public.commercial_routes
for each row execute function public.set_updated_at();

create table public.commercial_route_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  route_id uuid not null references public.commercial_routes(id) on delete cascade,
  account_id uuid not null references public.commercial_accounts(id) on delete restrict,
  position integer not null,
  planned_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commercial_route_stops_position_check check (position > 0),
  constraint commercial_route_stops_status_check check (status in ('planned', 'arrived', 'completed', 'skipped', 'cancelled')),
  constraint commercial_route_stops_unique_position unique (route_id, position)
);

create index commercial_route_stops_route_idx on public.commercial_route_stops (organization_id, route_id, position);
create index commercial_route_stops_account_idx on public.commercial_route_stops (organization_id, account_id);

create trigger commercial_route_stops_set_updated_at
before update on public.commercial_route_stops
for each row execute function public.set_updated_at();

-- ============================================================
-- CAMPANHAS
-- ============================================================

create table public.commercial_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft',
  start_date date,
  end_date date,
  budget numeric(16,2),
  target_crops text[] not null default '{}'::text[],
  target_regions text[] not null default '{}'::text[],
  audience jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commercial_campaigns_name_length check (char_length(name) between 2 and 180),
  constraint commercial_campaigns_status_check check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  constraint commercial_campaigns_budget_check check (budget is null or budget >= 0),
  constraint commercial_campaigns_period_check check (end_date is null or start_date is null or end_date >= start_date)
);

create index commercial_campaigns_org_idx on public.commercial_campaigns (organization_id, status, start_date);

create trigger commercial_campaigns_set_updated_at
before update on public.commercial_campaigns
for each row execute function public.set_updated_at();

-- ============================================================
-- APROVAÇÕES COMERCIAIS
-- ============================================================

create table public.commercial_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.commercial_opportunities(id) on delete set null,
  account_id uuid references public.commercial_accounts(id) on delete set null,
  approval_type text not null,
  status text not null default 'pending',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  requested_discount_percent numeric(6,3),
  requested_value numeric(16,2),
  justification text not null,
  decision_notes text,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commercial_approvals_type_check check (approval_type in ('discount', 'credit', 'price_exception', 'payment_terms', 'other')),
  constraint commercial_approvals_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint commercial_approvals_discount_check check (requested_discount_percent is null or requested_discount_percent between 0 and 100),
  constraint commercial_approvals_value_check check (requested_value is null or requested_value >= 0),
  constraint commercial_approvals_justification_length check (char_length(justification) between 2 and 4000)
);

create index commercial_approvals_org_status_idx on public.commercial_approvals (organization_id, status, created_at desc);
create index commercial_approvals_assigned_idx on public.commercial_approvals (organization_id, assigned_to, status);

create trigger commercial_approvals_set_updated_at
before update on public.commercial_approvals
for each row execute function public.set_updated_at();

-- ============================================================
-- GRANTS + RLS
-- ============================================================

grant select, insert, update, delete on
  public.commercial_accounts,
  public.commercial_opportunities,
  public.commercial_interactions,
  public.commercial_routes,
  public.commercial_route_stops,
  public.commercial_campaigns,
  public.commercial_approvals
to authenticated;

alter table public.commercial_accounts enable row level security;
alter table public.commercial_opportunities enable row level security;
alter table public.commercial_interactions enable row level security;
alter table public.commercial_routes enable row level security;
alter table public.commercial_route_stops enable row level security;
alter table public.commercial_campaigns enable row level security;
alter table public.commercial_approvals enable row level security;

-- Leitura: commercial.read. Escrita estrutural: commercial.manage.
create policy "commercial_accounts_select" on public.commercial_accounts
for select to authenticated using ((select private.has_permission(organization_id, 'commercial.read')));
create policy "commercial_accounts_insert" on public.commercial_accounts
for insert to authenticated with check ((select private.has_permission(organization_id, 'commercial.manage')));
create policy "commercial_accounts_update" on public.commercial_accounts
for update to authenticated using ((select private.has_permission(organization_id, 'commercial.manage'))) with check ((select private.has_permission(organization_id, 'commercial.manage')));
create policy "commercial_accounts_delete" on public.commercial_accounts
for delete to authenticated using ((select private.has_permission(organization_id, 'commercial.manage')));

create policy "commercial_opportunities_select" on public.commercial_opportunities
for select to authenticated using ((select private.has_permission(organization_id, 'commercial.read')));
create policy "commercial_opportunities_insert" on public.commercial_opportunities
for insert to authenticated with check ((select private.has_permission(organization_id, 'commercial.manage')));
create policy "commercial_opportunities_update" on public.commercial_opportunities
for update to authenticated using ((select private.has_permission(organization_id, 'commercial.manage'))) with check ((select private.has_permission(organization_id, 'commercial.manage')));
create policy "commercial_opportunities_delete" on public.commercial_opportunities
for delete to authenticated using ((select private.has_permission(organization_id, 'commercial.manage')));

-- Campo: representantes podem registrar e atualizar apenas suas próprias interações.
create policy "commercial_interactions_select" on public.commercial_interactions
for select to authenticated using ((select private.has_permission(organization_id, 'commercial.read')));
create policy "commercial_interactions_insert" on public.commercial_interactions
for insert to authenticated with check (
  (select private.has_permission(organization_id, 'commercial.field'))
  and user_id = (select auth.uid())
);
create policy "commercial_interactions_update" on public.commercial_interactions
for update to authenticated using (
  user_id = (select auth.uid())
  or (select private.has_permission(organization_id, 'commercial.manage'))
) with check (
  user_id = (select auth.uid())
  or (select private.has_permission(organization_id, 'commercial.manage'))
);
create policy "commercial_interactions_delete" on public.commercial_interactions
for delete to authenticated using ((select private.has_permission(organization_id, 'commercial.manage')));

create policy "commercial_routes_select" on public.commercial_routes
for select to authenticated using ((select private.has_permission(organization_id, 'commercial.read')));
create policy "commercial_routes_insert" on public.commercial_routes
for insert to authenticated with check (
  (select private.has_permission(organization_id, 'commercial.field'))
  and (
    owner_user_id = (select auth.uid())
    or (select private.has_permission(organization_id, 'commercial.manage'))
  )
);
create policy "commercial_routes_update" on public.commercial_routes
for update to authenticated using (
  owner_user_id = (select auth.uid())
  or (select private.has_permission(organization_id, 'commercial.manage'))
) with check (
  owner_user_id = (select auth.uid())
  or (select private.has_permission(organization_id, 'commercial.manage'))
);
create policy "commercial_routes_delete" on public.commercial_routes
for delete to authenticated using ((select private.has_permission(organization_id, 'commercial.manage')));

create policy "commercial_route_stops_select" on public.commercial_route_stops
for select to authenticated using ((select private.has_permission(organization_id, 'commercial.read')));
create policy "commercial_route_stops_insert" on public.commercial_route_stops
for insert to authenticated with check (
  (select private.has_permission(organization_id, 'commercial.field'))
  and exists (
    select 1 from public.commercial_routes route
    where route.id = route_id
      and route.organization_id = organization_id
      and (
        route.owner_user_id = (select auth.uid())
        or (select private.has_permission(organization_id, 'commercial.manage'))
      )
  )
);
create policy "commercial_route_stops_update" on public.commercial_route_stops
for update to authenticated using (
  exists (
    select 1 from public.commercial_routes route
    where route.id = route_id
      and route.organization_id = organization_id
      and (
        route.owner_user_id = (select auth.uid())
        or (select private.has_permission(organization_id, 'commercial.manage'))
      )
  )
) with check (
  exists (
    select 1 from public.commercial_routes route
    where route.id = route_id
      and route.organization_id = organization_id
      and (
        route.owner_user_id = (select auth.uid())
        or (select private.has_permission(organization_id, 'commercial.manage'))
      )
  )
);
create policy "commercial_route_stops_delete" on public.commercial_route_stops
for delete to authenticated using ((select private.has_permission(organization_id, 'commercial.manage')));

create policy "commercial_campaigns_select" on public.commercial_campaigns
for select to authenticated using ((select private.has_permission(organization_id, 'commercial.read')));
create policy "commercial_campaigns_insert" on public.commercial_campaigns
for insert to authenticated with check ((select private.has_permission(organization_id, 'commercial.manage')));
create policy "commercial_campaigns_update" on public.commercial_campaigns
for update to authenticated using ((select private.has_permission(organization_id, 'commercial.manage'))) with check ((select private.has_permission(organization_id, 'commercial.manage')));
create policy "commercial_campaigns_delete" on public.commercial_campaigns
for delete to authenticated using ((select private.has_permission(organization_id, 'commercial.manage')));

-- Solicitação pode ser criada pelo próprio usuário de campo. Decisão exige approve.
create policy "commercial_approvals_select" on public.commercial_approvals
for select to authenticated using ((select private.has_permission(organization_id, 'commercial.read')));
create policy "commercial_approvals_insert" on public.commercial_approvals
for insert to authenticated with check (
  (select private.has_permission(organization_id, 'commercial.field'))
  and requested_by = (select auth.uid())
  and status = 'pending'
);
create policy "commercial_approvals_update" on public.commercial_approvals
for update to authenticated using (
  (status = 'pending' and requested_by = (select auth.uid()))
  or (select private.has_permission(organization_id, 'commercial.approve'))
) with check (
  (requested_by = (select auth.uid()) and status in ('pending', 'cancelled'))
  or (select private.has_permission(organization_id, 'commercial.approve'))
);
create policy "commercial_approvals_delete" on public.commercial_approvals
for delete to authenticated using ((select private.has_permission(organization_id, 'commercial.manage')));

-- ============================================================
-- RESUMO SEGURO PARA O DASHBOARD
-- ============================================================

create or replace function public.commercial_workspace_summary(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (select private.has_permission(p_organization_id, 'commercial.read')) then
    raise exception 'commercial_read_permission_required';
  end if;

  select jsonb_build_object(
    'accounts', (select count(*) from public.commercial_accounts a where a.organization_id = p_organization_id and a.status = 'active'),
    'prospects', (select count(*) from public.commercial_accounts a where a.organization_id = p_organization_id and a.status = 'active' and a.account_type in ('prospect', 'lead')),
    'qualifiedOpportunities', (select count(*) from public.commercial_opportunities o where o.organization_id = p_organization_id and o.status = 'open' and o.stage not in ('mapped')),
    'openOpportunities', (select count(*) from public.commercial_opportunities o where o.organization_id = p_organization_id and o.status = 'open'),
    'pipelineValue', coalesce((select sum(o.potential_value) from public.commercial_opportunities o where o.organization_id = p_organization_id and o.status = 'open'), 0),
    'pipelineHectares', coalesce((select sum(o.potential_hectares) from public.commercial_opportunities o where o.organization_id = p_organization_id and o.status = 'open'), 0),
    'pendingApprovals', (select count(*) from public.commercial_approvals a where a.organization_id = p_organization_id and a.status = 'pending'),
    'visitsLast30Days', (select count(*) from public.commercial_interactions i where i.organization_id = p_organization_id and i.interaction_type in ('visit', 'technical_visit') and i.occurred_at >= timezone('utc', now()) - interval '30 days')
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.commercial_workspace_summary(uuid) to authenticated;

create or replace function public.list_commercial_opportunities(
  p_organization_id uuid,
  p_limit integer default 50
)
returns table (
  opportunity_id uuid,
  account_id uuid,
  account_name text,
  city text,
  state text,
  title text,
  crop text,
  stage text,
  status text,
  score integer,
  potential_value numeric,
  potential_hectares numeric,
  probability integer,
  expected_close_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission(p_organization_id, 'commercial.read')) then
    raise exception 'commercial_read_permission_required';
  end if;

  return query
  select
    o.id,
    a.id,
    a.name,
    a.city,
    a.state,
    o.title,
    o.crop,
    o.stage,
    o.status,
    o.score,
    o.potential_value,
    o.potential_hectares,
    o.probability,
    o.expected_close_date
  from public.commercial_opportunities o
  join public.commercial_accounts a
    on a.id = o.account_id
   and a.organization_id = o.organization_id
  where o.organization_id = p_organization_id
  order by o.score desc, o.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

grant execute on function public.list_commercial_opportunities(uuid, integer) to authenticated;

commit;
