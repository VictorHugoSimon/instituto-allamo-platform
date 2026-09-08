-- PMO onboarding seguro: ledger de idempotência para criação explícita de empresa/projeto.
-- Aditivo: não cria tenants, não altera registros de negócio existentes e não possui DELETE/seed.

CREATE TABLE IF NOT EXISTS onboarding_requests (
  request_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company','project')),
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  entity_id TEXT,
  company_id TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status_created
  ON onboarding_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_requests_company
  ON onboarding_requests(company_id, created_at DESC);
