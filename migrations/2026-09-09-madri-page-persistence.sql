PRAGMA foreign_keys = ON;

-- Persistência global de páginas executivas MADRI.
-- Substitui localStorage como fonte operacional de POP e Mapa Mestre.
CREATE TABLE IF NOT EXISTS madri_page_documents (
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  page_key TEXT NOT NULL CHECK(page_key IN ('pop','map')),
  title TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(project_id,page_key)
);

CREATE TABLE IF NOT EXISTS madri_page_document_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  page_key TEXT NOT NULL CHECK(page_key IN ('pop','map')),
  version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_madri_page_docs_scope
  ON madri_page_documents(company_id,project_id,page_key);
CREATE INDEX IF NOT EXISTS idx_madri_page_history_scope
  ON madri_page_document_history(company_id,project_id,page_key,id DESC);
