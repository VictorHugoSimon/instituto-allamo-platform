-- Séries recorrentes de Status Reports — SEM SQL destrutivo.
CREATE TABLE IF NOT EXISTS report_series (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'WEEKLY',
  presentation_day INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_series_cycles (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  cycle_no INTEGER NOT NULL,
  report_id TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  presentation_date TEXT,
  previous_cycle_id TEXT,
  source_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  UNIQUE(series_id, cycle_no),
  UNIQUE(report_id)
);

CREATE TABLE IF NOT EXISTS report_series_meetings (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  meeting_date TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'REUNIAO',
  used_cycle_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_report_series_context ON report_series(company_id,project_id,active);
CREATE INDEX IF NOT EXISTS idx_report_series_cycles_series ON report_series_cycles(series_id,cycle_no DESC);
CREATE INDEX IF NOT EXISTS idx_report_series_meetings_pending ON report_series_meetings(series_id,used_cycle_id,meeting_date);
