-- Reports Dinâmicos + Copiloto PMO IA
-- CREATE-ONLY / PERSISTENTE
-- Esta migration somente cria estruturas novas. Nunca remove, reseta ou sobrescreve dados de negócio.

CREATE TABLE IF NOT EXISTS legacy_report_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  company_id TEXT,
  project_id INTEGER,
  version_no INTEGER NOT NULL,
  ref TEXT DEFAULT '',
  snapshot_json TEXT NOT NULL,
  change_note TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scope_type, scope_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_legacy_report_versions_scope
ON legacy_report_versions(scope_type, scope_id, version_no DESC);

CREATE TABLE IF NOT EXISTS report_ai_runs (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  company_id TEXT,
  project_id INTEGER,
  model TEXT NOT NULL,
  input_summary TEXT DEFAULT '',
  output_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'GENERATED',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_ai_runs_scope
ON report_ai_runs(scope_type, scope_id, created_at DESC);
