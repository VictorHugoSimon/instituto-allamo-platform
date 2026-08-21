PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  project TEXT,
  parent_id TEXT,
  sprint_id TEXT,
  item_type TEXT NOT NULL DEFAULT 'TASK',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  acceptance_criteria TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'BACKLOG',
  priority TEXT NOT NULL DEFAULT 'Média',
  owner TEXT DEFAULT '',
  reporter TEXT DEFAULT '',
  start_date TEXT,
  due_date TEXT,
  story_points REAL,
  estimate_hours REAL,
  rank REAL NOT NULL DEFAULT 0,
  labels TEXT DEFAULT '[]',
  blocked INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT DEFAULT '',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  FOREIGN KEY(parent_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS work_sprints (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  name TEXT NOT NULL,
  goal TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PLANEJADA',
  start_date TEXT,
  end_date TEXT,
  capacity_points REAL,
  capacity_hours REAL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS work_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY(work_item_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS work_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  rank REAL NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY(work_item_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS work_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  target_item_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_item_id,target_item_id,link_type),
  FOREIGN KEY(source_item_id) REFERENCES work_items(id),
  FOREIGN KEY(target_item_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS work_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT,
  project_id INTEGER,
  work_item_id TEXT,
  event_type TEXT NOT NULL DEFAULT 'usage',
  event_name TEXT NOT NULL,
  actor TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_items_company_project ON work_items(company_id, project_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(company_id, status, rank);
CREATE INDEX IF NOT EXISTS idx_work_items_sprint ON work_items(sprint_id, status);
CREATE INDEX IF NOT EXISTS idx_work_sprints_company_project ON work_sprints(company_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_work_comments_item ON work_comments(work_item_id, id);
CREATE INDEX IF NOT EXISTS idx_work_checklist_item ON work_checklist(work_item_id, rank);
CREATE INDEX IF NOT EXISTS idx_work_events_company ON work_events(company_id, id DESC);
