PRAGMA foreign_keys = ON;

-- Plataforma de Governança OPR v2.
-- Isolamento lógico obrigatório por company_id + project_id.
-- Nenhuma tabela armazena senha, token, API key ou segredo.

CREATE TABLE IF NOT EXISTS opr_platform_sequence (
  project_id INTEGER NOT NULL,
  company_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  next_value INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(project_id, entity)
);

CREATE TABLE IF NOT EXISTS opr_platform_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opr_requirements (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  origin TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  subarea TEXT NOT NULL DEFAULT '',
  requirement TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Média',
  criticality TEXT NOT NULL DEFAULT 'Média',
  eliminatory INTEGER NOT NULL DEFAULT 0,
  source_document TEXT NOT NULL DEFAULT '',
  target_document TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  coverage_status TEXT NOT NULL DEFAULT 'Não localizado',
  gap TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  action_id TEXT,
  test_id TEXT,
  evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  acceptance TEXT NOT NULL DEFAULT 'A confirmar',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_risks (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  probability TEXT NOT NULL DEFAULT 'A confirmar',
  impact TEXT NOT NULL DEFAULT 'A confirmar',
  severity TEXT NOT NULL DEFAULT 'A confirmar',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  mitigation TEXT NOT NULL DEFAULT '',
  contingency TEXT NOT NULL DEFAULT '',
  action_id TEXT,
  status TEXT NOT NULL DEFAULT 'Aberto',
  review_date TEXT,
  evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_integrations (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT '',
  target_system TEXT NOT NULL DEFAULT '',
  process TEXT NOT NULL DEFAULT '',
  integration_type TEXT NOT NULL DEFAULT 'A confirmar',
  layout TEXT NOT NULL DEFAULT '',
  layout_version TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'A confirmar',
  source_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  target_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  environment TEXT NOT NULL DEFAULT 'A confirmar',
  credential_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Planejado',
  last_test TEXT,
  sla TEXT NOT NULL DEFAULT 'A confirmar',
  contingency TEXT NOT NULL DEFAULT '',
  log_reference TEXT NOT NULL DEFAULT '',
  test_id TEXT,
  evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_tests (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'SIT',
  front TEXT NOT NULL DEFAULT '',
  process TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'P2',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  precondition TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '',
  expected_result TEXT NOT NULL DEFAULT '',
  actual_result TEXT NOT NULL DEFAULT '',
  expected_met INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Planejado',
  evidence TEXT NOT NULL DEFAULT '',
  defect_id TEXT,
  origin TEXT NOT NULL DEFAULT '',
  requirement_id TEXT,
  action_id TEXT,
  block_reason TEXT NOT NULL DEFAULT '',
  executed_at TEXT,
  executor TEXT NOT NULL DEFAULT '',
  approver TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_test_defects (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  test_id TEXT,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Sev3',
  impact TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  status TEXT NOT NULL DEFAULT 'Aberto',
  evidence TEXT NOT NULL DEFAULT '',
  correction TEXT NOT NULL DEFAULT '',
  retest_status TEXT NOT NULL DEFAULT 'Pendente',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_documents (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT 'v0.1',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  document_date TEXT,
  origin TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Rascunho',
  url TEXT NOT NULL DEFAULT '',
  hash_reference TEXT NOT NULL DEFAULT '',
  current_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_document_versions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  document_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  version_date TEXT NOT NULL DEFAULT (date('now')),
  actor TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  content_reference TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  hash_reference TEXT NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opr_implementation_phases (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  phase_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  input_text TEXT NOT NULL DEFAULT '',
  activities TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  participants TEXT NOT NULL DEFAULT '',
  output_text TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT 'A confirmar',
  dependencies TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'A confirmar',
  evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  gate TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_readiness (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  condition_text TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  status TEXT NOT NULL DEFAULT 'Pendente',
  evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  blocking INTEGER NOT NULL DEFAULT 0,
  action_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE TABLE IF NOT EXISTS opr_decisions (
  id TEXT PRIMARY KEY,
  display_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  decision TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente',
  evidence TEXT NOT NULL DEFAULT 'Sem evidência suficiente',
  action_id TEXT,
  meeting_ref TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(project_id, display_id)
);

CREATE INDEX IF NOT EXISTS idx_opr_req_project ON opr_requirements(company_id,project_id,archived_at,coverage_status);
CREATE INDEX IF NOT EXISTS idx_opr_risk_project ON opr_risks(company_id,project_id,archived_at,status,severity);
CREATE INDEX IF NOT EXISTS idx_opr_int_project ON opr_integrations(company_id,project_id,archived_at,status);
CREATE INDEX IF NOT EXISTS idx_opr_test_project ON opr_tests(company_id,project_id,archived_at,test_type,status,priority);
CREATE INDEX IF NOT EXISTS idx_opr_bug_project ON opr_test_defects(company_id,project_id,archived_at,status,severity);
CREATE INDEX IF NOT EXISTS idx_opr_doc_project ON opr_documents(company_id,project_id,archived_at,status);
CREATE INDEX IF NOT EXISTS idx_opr_doc_ver ON opr_document_versions(project_id,document_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opr_phase_project ON opr_implementation_phases(company_id,project_id,archived_at,phase_order);
CREATE INDEX IF NOT EXISTS idx_opr_ready_project ON opr_readiness(company_id,project_id,archived_at,status,blocking);
CREATE INDEX IF NOT EXISTS idx_opr_dec_project ON opr_decisions(company_id,project_id,archived_at,status,due_date);
CREATE INDEX IF NOT EXISTS idx_opr_platform_audit ON opr_platform_audit(project_id,entity_type,entity_id,id DESC);
