-- Evidências/documentos por marco do projeto.
-- Migration não destrutiva: somente CREATE TABLE / INDEX.

CREATE TABLE IF NOT EXISTS project_milestone_details (
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  phase_key TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  phase_title TEXT DEFAULT '',
  milestone_title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  subdescription TEXT DEFAULT '',
  phase_rank INTEGER NOT NULL DEFAULT 0,
  milestone_rank INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(company_id, project_id, phase_key, milestone_key)
);

CREATE TABLE IF NOT EXISTS project_milestone_assets (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  phase_key TEXT NOT NULL,
  milestone_key TEXT NOT NULL,
  phase_title TEXT DEFAULT '',
  milestone_title TEXT DEFAULT '',
  asset_type TEXT NOT NULL DEFAULT 'LINK',
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  link_url TEXT,
  object_key TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  client_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_milestone_details_project
  ON project_milestone_details(company_id, project_id, phase_rank, milestone_rank);

CREATE INDEX IF NOT EXISTS idx_milestone_assets_project
  ON project_milestone_assets(company_id, project_id, phase_key, milestone_key, archived_at);
