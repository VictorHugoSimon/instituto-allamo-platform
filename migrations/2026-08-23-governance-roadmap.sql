-- Governança de projeto: agendas, reuniões, stakeholders, pautas, decisões e demandas.
-- Migration aditiva e persistente. Não remove nem altera dados existentes.

CREATE TABLE IF NOT EXISTS governance_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  report_id TEXT,
  roadmap_item_id TEXT,
  event_type TEXT NOT NULL DEFAULT 'REUNIAO',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  area TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  start_at TEXT,
  end_at TEXT,
  location TEXT DEFAULT '',
  meeting_url TEXT DEFAULT '',
  recurrence_rule TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PLANEJADA',
  minutes_summary TEXT DEFAULT '',
  decisions_summary TEXT DEFAULT '',
  client_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS governance_event_agenda_items (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  area TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ABERTA',
  rank REAL NOT NULL DEFAULT 0,
  client_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS governance_event_stakeholders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  stakeholder_type TEXT NOT NULL DEFAULT 'INTERNO',
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  role_name TEXT DEFAULT '',
  area TEXT DEFAULT '',
  attendance_status TEXT NOT NULL DEFAULT 'CONVIDADO',
  client_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS governance_event_work_links (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  work_item_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'DEMANDA',
  client_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  UNIQUE(event_id,work_item_id,relation_type)
);

CREATE TABLE IF NOT EXISTS governance_event_decisions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  decision_text TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'ABERTA',
  client_visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_governance_events_context ON governance_events(company_id,project_id,archived_at,start_at);
CREATE INDEX IF NOT EXISTS idx_governance_events_report ON governance_events(report_id,archived_at,start_at);
CREATE INDEX IF NOT EXISTS idx_governance_events_status ON governance_events(company_id,project_id,status,start_at);
CREATE INDEX IF NOT EXISTS idx_governance_agenda_event ON governance_event_agenda_items(event_id,archived_at,rank);
CREATE INDEX IF NOT EXISTS idx_governance_stakeholders_event ON governance_event_stakeholders(event_id,archived_at,name);
CREATE INDEX IF NOT EXISTS idx_governance_work_event ON governance_event_work_links(event_id,archived_at,work_item_id);
CREATE INDEX IF NOT EXISTS idx_governance_work_item ON governance_event_work_links(work_item_id,archived_at);
CREATE INDEX IF NOT EXISTS idx_governance_decisions_event ON governance_event_decisions(event_id,archived_at,due_date);
