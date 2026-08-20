CREATE TABLE IF NOT EXISTS plan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT,
  project_id TEXT,
  fase TEXT,
  etapa TEXT,
  responsavel TEXT,
  owner_tipo TEXT,
  horas_prev REAL DEFAULT 0,
  horas_real REAL DEFAULT 0,
  inicio TEXT,
  fim TEXT,
  status TEXT DEFAULT 'pendente',
  ordem INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_plan_company ON plan_items(company_id, ordem);
CREATE INDEX IF NOT EXISTS idx_plan_project ON plan_items(project_id, ordem);
