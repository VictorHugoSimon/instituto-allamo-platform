-- Államo Sales Intelligence — domínio comercial multiempresa no D1.
-- Migration somente aditiva e compatível com o core vivo baseado em company_id.

CREATE TABLE IF NOT EXISTS commercial_accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  document_number TEXT,
  account_type TEXT NOT NULL DEFAULT 'PROSPECT',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'BR',
  latitude REAL,
  longitude REAL,
  segment TEXT,
  crops_json TEXT NOT NULL DEFAULT '[]',
  hectares REAL,
  annual_potential_value REAL,
  score INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  owner TEXT,
  last_contact_at TEXT,
  next_action_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_commercial_accounts_company ON commercial_accounts(company_id,status,archived_at,score DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_accounts_owner ON commercial_accounts(company_id,owner,status,archived_at);
CREATE INDEX IF NOT EXISTS idx_commercial_accounts_geo ON commercial_accounts(company_id,state,city,status,archived_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_accounts_document ON commercial_accounts(company_id,document_number) WHERE document_number IS NOT NULL AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS commercial_opportunities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  crop TEXT,
  stage TEXT NOT NULL DEFAULT 'MAPPED',
  status TEXT NOT NULL DEFAULT 'OPEN',
  score INTEGER NOT NULL DEFAULT 0,
  potential_value REAL,
  potential_hectares REAL,
  probability INTEGER NOT NULL DEFAULT 0,
  expected_close_date TEXT,
  owner TEXT,
  loss_reason TEXT,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_commercial_opportunities_company ON commercial_opportunities(company_id,status,stage,archived_at,score DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_opportunities_account ON commercial_opportunities(company_id,account_id,archived_at);
CREATE INDEX IF NOT EXISTS idx_commercial_opportunities_owner ON commercial_opportunities(company_id,owner,status,archived_at);
CREATE INDEX IF NOT EXISTS idx_commercial_opportunities_close ON commercial_opportunities(company_id,expected_close_date,status,archived_at);

CREATE TABLE IF NOT EXISTS commercial_interactions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  opportunity_id TEXT,
  actor TEXT NOT NULL,
  interaction_type TEXT NOT NULL DEFAULT 'VISIT',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  summary TEXT NOT NULL,
  next_action TEXT,
  next_action_at TEXT,
  latitude REAL,
  longitude REAL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_commercial_interactions_company ON commercial_interactions(company_id,occurred_at DESC,archived_at);
CREATE INDEX IF NOT EXISTS idx_commercial_interactions_account ON commercial_interactions(company_id,account_id,occurred_at DESC,archived_at);
CREATE INDEX IF NOT EXISTS idx_commercial_interactions_actor ON commercial_interactions(company_id,actor,occurred_at DESC,archived_at);

CREATE TABLE IF NOT EXISTS commercial_routes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  route_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_commercial_routes_company ON commercial_routes(company_id,route_date,status,archived_at);
CREATE INDEX IF NOT EXISTS idx_commercial_routes_owner ON commercial_routes(company_id,owner,route_date,archived_at);

CREATE TABLE IF NOT EXISTS commercial_route_stops (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  planned_at TEXT,
  arrived_at TEXT,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_route_position ON commercial_route_stops(company_id,route_id,position) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_route_stops_account ON commercial_route_stops(company_id,account_id,status,archived_at);

CREATE TABLE IF NOT EXISTS commercial_campaigns (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  start_date TEXT,
  end_date TEXT,
  budget REAL,
  target_crops_json TEXT NOT NULL DEFAULT '[]',
  target_regions_json TEXT NOT NULL DEFAULT '[]',
  audience_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_commercial_campaigns_company ON commercial_campaigns(company_id,status,start_date,archived_at);

CREATE TABLE IF NOT EXISTS commercial_approvals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  opportunity_id TEXT,
  account_id TEXT,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_by TEXT NOT NULL,
  assigned_to TEXT,
  decided_by TEXT,
  requested_discount_percent REAL,
  requested_value REAL,
  justification TEXT NOT NULL,
  decision_notes TEXT,
  decided_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_commercial_approvals_company ON commercial_approvals(company_id,status,created_at DESC,archived_at);
CREATE INDEX IF NOT EXISTS idx_commercial_approvals_assignee ON commercial_approvals(company_id,assigned_to,status,archived_at);
