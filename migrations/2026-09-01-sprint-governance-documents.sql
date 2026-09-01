CREATE TABLE IF NOT EXISTS sprint_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK(document_type IN ('DOR','DOD')),
  sprint_name TEXT NOT NULL DEFAULT '',
  sprint_number TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  cycle_start TEXT,
  cycle_end TEXT,
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  score INTEGER NOT NULL DEFAULT 0,
  critical_pending INTEGER NOT NULL DEFAULT 0,
  decision TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  FOREIGN KEY(company_id) REFERENCES companies(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_sprint_documents_context ON sprint_documents(company_id, project_id, document_type, archived_at);
CREATE INDEX IF NOT EXISTS idx_sprint_documents_updated ON sprint_documents(updated_at DESC);

CREATE TABLE IF NOT EXISTS sprint_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  score INTEGER NOT NULL DEFAULT 0,
  critical_pending INTEGER NOT NULL DEFAULT 0,
  decision TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(document_id) REFERENCES sprint_documents(id),
  UNIQUE(document_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_sprint_document_versions_doc ON sprint_document_versions(document_id, version_no DESC);
