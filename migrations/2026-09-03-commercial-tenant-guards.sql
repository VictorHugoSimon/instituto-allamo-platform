-- Guardas relacionais do Sales Intelligence no D1.
-- Impedem referências cruzadas entre empresas mesmo fora da API principal.

CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_account_company_insert
BEFORE INSERT ON commercial_opportunities
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM commercial_accounts a
  WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id AND a.archived_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT,'commercial_cross_tenant_account');
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_opportunity_account_company_update
BEFORE UPDATE OF company_id,account_id ON commercial_opportunities
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM commercial_accounts a
  WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id AND a.archived_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT,'commercial_cross_tenant_account');
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_interaction_company_insert
BEFORE INSERT ON commercial_interactions
FOR EACH ROW
WHEN
  NOT EXISTS (
    SELECT 1 FROM commercial_accounts a
    WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id AND a.archived_at IS NULL
  )
  OR (
    NEW.opportunity_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM commercial_opportunities o
      WHERE o.id=NEW.opportunity_id
        AND o.company_id=NEW.company_id
        AND o.account_id=NEW.account_id
        AND o.archived_at IS NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT,'commercial_cross_tenant_interaction');
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_route_stop_company_insert
BEFORE INSERT ON commercial_route_stops
FOR EACH ROW
WHEN
  NOT EXISTS (
    SELECT 1 FROM commercial_routes r
    WHERE r.id=NEW.route_id AND r.company_id=NEW.company_id AND r.archived_at IS NULL
  )
  OR NOT EXISTS (
    SELECT 1 FROM commercial_accounts a
    WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id AND a.archived_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT,'commercial_cross_tenant_route_stop');
END;

CREATE TRIGGER IF NOT EXISTS trg_commercial_approval_company_insert
BEFORE INSERT ON commercial_approvals
FOR EACH ROW
WHEN
  (NEW.account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM commercial_accounts a
    WHERE a.id=NEW.account_id AND a.company_id=NEW.company_id AND a.archived_at IS NULL
  ))
  OR (NEW.opportunity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM commercial_opportunities o
    WHERE o.id=NEW.opportunity_id AND o.company_id=NEW.company_id AND o.archived_at IS NULL
  ))
BEGIN
  SELECT RAISE(ABORT,'commercial_cross_tenant_approval');
END;
