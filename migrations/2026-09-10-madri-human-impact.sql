PRAGMA foreign_keys = ON;

-- MADRI · Mapa de Impacto Humano / Change Management
-- Persistência isolada por company_id + project_id. Horas permanecem texto para permitir "A medir".
CREATE TABLE IF NOT EXISTS madri_human_impact (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  person_group TEXT NOT NULL DEFAULT 'Pessoa',
  area TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  process TEXT NOT NULL DEFAULT '',
  manuality_current TEXT NOT NULL DEFAULT 'A confirmar',
  as_is TEXT NOT NULL DEFAULT '',
  to_be TEXT NOT NULL DEFAULT '',
  automated TEXT NOT NULL DEFAULT '',
  decreases TEXT NOT NULL DEFAULT '',
  continues TEXT NOT NULL DEFAULT '',
  new_responsibility TEXT NOT NULL DEFAULT '',
  change_impact TEXT NOT NULL DEFAULT 'A confirmar',
  change_impact_score INTEGER NOT NULL DEFAULT 3 CHECK(change_impact_score BETWEEN 1 AND 5),
  adoption_status TEXT NOT NULL DEFAULT 'A CONFIRMAR',
  adoption_reason TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  observed_evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  confidence_level TEXT NOT NULL DEFAULT 'Baixa',
  resistance_risk TEXT NOT NULL DEFAULT 'A confirmar',
  resistance_risk_score INTEGER NOT NULL DEFAULT 3 CHECK(resistance_risk_score BETWEEN 1 AND 5),
  current_hours TEXT NOT NULL DEFAULT 'A medir',
  future_hours TEXT NOT NULL DEFAULT 'A medir',
  capacity_released TEXT NOT NULL DEFAULT 'A medir',
  source_ref TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id,display_id)
);

CREATE INDEX IF NOT EXISTS idx_madri_human_impact_project
  ON madri_human_impact(company_id,project_id,archived_at,adoption_status,change_impact_score,resistance_risk_score);
