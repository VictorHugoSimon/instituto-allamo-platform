PRAGMA foreign_keys = ON;

-- Extensão operacional exclusiva da OPR sobre o Work Management existente.
-- work_items continua sendo a fonte canônica das ações; estas tabelas guardam
-- somente metadados PMO, entrada de demandas, cadência, papéis e customizações.

CREATE TABLE IF NOT EXISTS opr_action_meta (
  work_item_id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  front TEXT NOT NULL DEFAULT '',
  plan_status TEXT NOT NULL DEFAULT 'Planejado',
  dependency TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  critical_path INTEGER NOT NULL DEFAULT 0,
  next_step TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(work_item_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS opr_action_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  work_item_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  actor TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opr_intake (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  intake_date TEXT,
  origin TEXT NOT NULL DEFAULT '',
  demand TEXT NOT NULL,
  front TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  triage_status TEXT NOT NULL DEFAULT 'Capturada',
  created_action_id TEXT,
  evidence TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS opr_cadence (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  period TEXT NOT NULL DEFAULT '',
  agenda TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'A confirmar',
  result_next_step TEXT NOT NULL DEFAULT '',
  action_id TEXT,
  source TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS opr_role_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  scope_ref TEXT NOT NULL DEFAULT 'Projeto',
  client_approver TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  key_user TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  functional_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  technical_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  pmo TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  operational_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, scope_ref)
);

CREATE TABLE IF NOT EXISTS opr_customizations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  official_code TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  situation TEXT NOT NULL DEFAULT 'Análise',
  approval TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  validation_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  key_user TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  functional_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  development_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  pmo TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  related_action_id TEXT,
  evidence TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS opr_report_publications (
  project_id INTEGER PRIMARY KEY,
  company_id TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  published_by TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_opr_action_meta_project ON opr_action_meta(company_id, project_id, plan_status);
CREATE INDEX IF NOT EXISTS idx_opr_action_history_item ON opr_action_history(work_item_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_opr_action_history_project ON opr_action_history(project_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_opr_intake_project ON opr_intake(company_id, project_id, archived_at, triage_status);
CREATE INDEX IF NOT EXISTS idx_opr_cadence_project ON opr_cadence(company_id, project_id, archived_at, status);
CREATE INDEX IF NOT EXISTS idx_opr_roles_project ON opr_role_assignments(company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_opr_custom_project ON opr_customizations(company_id, project_id, archived_at);
