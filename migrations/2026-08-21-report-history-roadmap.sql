PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  title TEXT NOT NULL,
  reference TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  executive_summary TEXT DEFAULT '',
  data_json TEXT DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_records_company ON report_records(company_id, archived_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_report_records_project ON report_records(project_id, archived_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_report_records_status ON report_records(status, archived_at, updated_at);

CREATE TABLE IF NOT EXISTS report_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  version_no INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_note TEXT DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_report_versions_report ON report_versions(report_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_report_versions_company ON report_versions(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS report_roadmap_items (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  responsible_party TEXT NOT NULL DEFAULT 'DEV',
  responsible_name TEXT DEFAULT '',
  external_party TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PLANEJADO',
  start_date TEXT,
  due_date TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  work_item_id TEXT,
  rank REAL NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_roadmap_report ON report_roadmap_items(report_id, archived_at, rank);
CREATE INDEX IF NOT EXISTS idx_report_roadmap_company ON report_roadmap_items(company_id, project_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_report_roadmap_work ON report_roadmap_items(work_item_id, archived_at);
