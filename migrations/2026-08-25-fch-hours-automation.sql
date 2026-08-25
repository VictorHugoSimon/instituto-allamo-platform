-- FCH -> Portal PMO -> Curva S
-- Schema aditivo e idempotente. Não altera nem remove dados existentes.

CREATE TABLE IF NOT EXISTS horas_import (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_key TEXT NOT NULL DEFAULT '',
  project_key TEXT NOT NULL DEFAULT '',
  mes TEXT NOT NULL DEFAULT '',
  pessoa TEXT NOT NULL DEFAULT '',
  horas REAL NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_horas_import_company_month
  ON horas_import(company_key, mes);

CREATE INDEX IF NOT EXISTS idx_horas_import_project_month
  ON horas_import(project_key, mes);

-- Fatos normalizados a partir do XLSX original do Google Drive.
-- Uma mesma entrada pode possuir duas alocações analíticas (OPR e MADRI),
-- mas source_entry_hash preserva a entrada única para cálculo de capacidade.
CREATE TABLE IF NOT EXISTS fch_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id TEXT NOT NULL,
  source_file_name TEXT NOT NULL DEFAULT '',
  source_modified_at TEXT NOT NULL DEFAULT '',
  source_sheet TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  person TEXT NOT NULL DEFAULT '',
  activity_date TEXT NOT NULL,
  source_project TEXT NOT NULL,
  target_project TEXT NOT NULL,
  allocation_rule TEXT NOT NULL DEFAULT '',
  source_entry_hash TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_entry_hash, target_project)
);

CREATE INDEX IF NOT EXISTS idx_fch_entries_target_date
  ON fch_entries(target_project, activity_date);

CREATE INDEX IF NOT EXISTS idx_fch_entries_source_hash
  ON fch_entries(source_entry_hash);

CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY,
  last_run TEXT,
  detail TEXT
);
