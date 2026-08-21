-- Instituto Államo PMO — campos dinâmicos + arquivo multitenant
-- Migration persistente / não destrutiva. Não executa DELETE, DROP ou TRUNCATE.

CREATE TABLE IF NOT EXISTS tenant_field_definitions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  entity_type TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  config_json TEXT NOT NULL DEFAULT '{}',
  required INTEGER NOT NULL DEFAULT 0,
  client_visible INTEGER NOT NULL DEFAULT 1,
  rank REAL NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS tenant_field_values (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT 'null',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(definition_id,company_id,project_id,entity_type,entity_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_field_defs_context ON tenant_field_definitions(company_id,project_id,entity_type,archived_at,rank);
CREATE INDEX IF NOT EXISTS idx_tenant_field_values_context ON tenant_field_values(company_id,project_id,entity_type,entity_id,archived_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_field_defs_key ON tenant_field_definitions(company_id,COALESCE(project_id,0),entity_type,field_key) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS tenant_files (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  entity_type TEXT NOT NULL DEFAULT 'PROJECT',
  entity_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'DOCUMENTO',
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  version_no INTEGER NOT NULL DEFAULT 1,
  client_visible INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tenant_files_context ON tenant_files(company_id,project_id,entity_type,entity_id,status,archived_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_files_object ON tenant_files(object_key);
