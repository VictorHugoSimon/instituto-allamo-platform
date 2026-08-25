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

CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY,
  last_run TEXT,
  detail TEXT
);
