begin;

-- Garante isolamento relacional no próprio banco: um registro filho não pode
-- apontar para conta, oportunidade ou rota de outra organização, mesmo que um
-- cliente malformado tente enviar IDs cruzados.

alter table public.commercial_accounts
  add constraint commercial_accounts_id_org_unique unique (id, organization_id);

alter table public.commercial_opportunities
  add constraint commercial_opportunities_id_org_unique unique (id, organization_id),
  add constraint commercial_opportunities_account_same_org_fk
    foreign key (account_id, organization_id)
    references public.commercial_accounts (id, organization_id)
    on delete cascade;

alter table public.commercial_routes
  add constraint commercial_routes_id_org_unique unique (id, organization_id);

alter table public.commercial_interactions
  add constraint commercial_interactions_account_same_org_fk
    foreign key (account_id, organization_id)
    references public.commercial_accounts (id, organization_id)
    on delete cascade,
  add constraint commercial_interactions_opportunity_same_org_fk
    foreign key (opportunity_id, organization_id)
    references public.commercial_opportunities (id, organization_id)
    on delete set null;

alter table public.commercial_route_stops
  add constraint commercial_route_stops_route_same_org_fk
    foreign key (route_id, organization_id)
    references public.commercial_routes (id, organization_id)
    on delete cascade,
  add constraint commercial_route_stops_account_same_org_fk
    foreign key (account_id, organization_id)
    references public.commercial_accounts (id, organization_id)
    on delete restrict;

alter table public.commercial_approvals
  add constraint commercial_approvals_opportunity_same_org_fk
    foreign key (opportunity_id, organization_id)
    references public.commercial_opportunities (id, organization_id)
    on delete set null,
  add constraint commercial_approvals_account_same_org_fk
    foreign key (account_id, organization_id)
    references public.commercial_accounts (id, organization_id)
    on delete set null;

-- Reescreve as políticas de paradas com referências externas qualificadas.
drop policy if exists "commercial_route_stops_insert" on public.commercial_route_stops;
drop policy if exists "commercial_route_stops_update" on public.commercial_route_stops;

create policy "commercial_route_stops_insert"
on public.commercial_route_stops
for insert
to authenticated
with check (
  (select private.has_permission(
    commercial_route_stops.organization_id,
    'commercial.field'
  ))
  and exists (
    select 1
    from public.commercial_routes route
    where route.id = commercial_route_stops.route_id
      and route.organization_id = commercial_route_stops.organization_id
      and (
        route.owner_user_id = (select auth.uid())
        or (select private.has_permission(
          commercial_route_stops.organization_id,
          'commercial.manage'
        ))
      )
  )
);

create policy "commercial_route_stops_update"
on public.commercial_route_stops
for update
to authenticated
using (
  exists (
    select 1
    from public.commercial_routes route
    where route.id = commercial_route_stops.route_id
      and route.organization_id = commercial_route_stops.organization_id
      and (
        route.owner_user_id = (select auth.uid())
        or (select private.has_permission(
          commercial_route_stops.organization_id,
          'commercial.manage'
        ))
      )
  )
)
with check (
  exists (
    select 1
    from public.commercial_routes route
    where route.id = commercial_route_stops.route_id
      and route.organization_id = commercial_route_stops.organization_id
      and (
        route.owner_user_id = (select auth.uid())
        or (select private.has_permission(
          commercial_route_stops.organization_id,
          'commercial.manage'
        ))
      )
  )
);

commit;
