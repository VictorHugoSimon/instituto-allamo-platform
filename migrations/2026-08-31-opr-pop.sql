PRAGMA foreign_keys = ON;

-- POP operacional da OPR. Isolamento lógico por company_id + project_id.
CREATE TABLE IF NOT EXISTS opr_pop_config (
  project_id INTEGER PRIMARY KEY,
  company_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  document_status TEXT NOT NULL DEFAULT 'Minuta para validação',
  governance_owner TEXT NOT NULL DEFAULT 'PMO',
  approver TEXT NOT NULL DEFAULT 'A confirmar',
  objective TEXT NOT NULL DEFAULT 'Padronizar a operação, governança, rastreabilidade e comunicação do projeto OPR.',
  initialized_at TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opr_pop_sequence (
  project_id INTEGER PRIMARY KEY,
  company_id TEXT NOT NULL,
  next_value INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opr_pop_procedures (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  procedure_text TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  trigger_frequency TEXT NOT NULL DEFAULT 'A confirmar',
  evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  done_criteria TEXT NOT NULL DEFAULT 'A confirmar',
  status TEXT NOT NULL DEFAULT 'Ativo',
  next_step TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'POP-OPR-ERP-v1.0',
  rank INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS opr_pop_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  procedure_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  actor TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opr_pop_display_id ON opr_pop_procedures(project_id, display_id);
CREATE INDEX IF NOT EXISTS idx_opr_pop_project ON opr_pop_procedures(company_id, project_id, archived_at, status, rank);
CREATE INDEX IF NOT EXISTS idx_opr_pop_history ON opr_pop_history(project_id, procedure_id, id DESC);
