// Schema nativo de Reports no D1 vinculado ao Stage.
// MODO PERSISTENTE: somente CREATE IF NOT EXISTS / índices. Nunca apaga dados.
if (isAllamoStage) {
  await stageSafe("CREATE TABLE IF NOT EXISTS report_records (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id INTEGER, title TEXT NOT NULL, reference TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'RASCUNHO', executive_summary TEXT DEFAULT '', data_json TEXT DEFAULT '{}', created_by TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), published_at TEXT, archived_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS report_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT NOT NULL, company_id TEXT NOT NULL, project_id INTEGER, version_no INTEGER NOT NULL, snapshot_json TEXT NOT NULL, change_note TEXT DEFAULT '', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(report_id,version_no))");
  await stageSafe("CREATE TABLE IF NOT EXISTS report_roadmap_items (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, company_id TEXT NOT NULL, project_id INTEGER, title TEXT NOT NULL, description TEXT DEFAULT '', responsible_party TEXT NOT NULL DEFAULT 'DEV', responsible_name TEXT DEFAULT '', external_party TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'PLANEJADO', start_date TEXT, due_date TEXT, progress INTEGER NOT NULL DEFAULT 0, work_item_id TEXT, rank REAL NOT NULL DEFAULT 0, created_by TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), archived_at TEXT)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_records_company ON report_records(company_id,archived_at,updated_at)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_records_project ON report_records(project_id,archived_at,updated_at)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_versions_report ON report_versions(report_id,version_no DESC)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_roadmap_report ON report_roadmap_items(report_id,archived_at,rank)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_roadmap_work ON report_roadmap_items(work_item_id,archived_at)");

  // Série recorrente: cada ciclo gera um Report imutável ligado ao anterior.
  await stageSafe("CREATE TABLE IF NOT EXISTS report_series (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id INTEGER, name TEXT NOT NULL, cadence TEXT NOT NULL DEFAULT 'WEEKLY', presentation_day INTEGER, active INTEGER NOT NULL DEFAULT 1, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
  await stageSafe("CREATE TABLE IF NOT EXISTS report_series_cycles (id TEXT PRIMARY KEY, series_id TEXT NOT NULL, cycle_no INTEGER NOT NULL, report_id TEXT NOT NULL, period_start TEXT, period_end TEXT, presentation_date TEXT, previous_cycle_id TEXT, source_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'RASCUNHO', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), published_at TEXT, UNIQUE(series_id,cycle_no), UNIQUE(report_id))");
  await stageSafe("CREATE TABLE IF NOT EXISTS report_series_meetings (id TEXT PRIMARY KEY, series_id TEXT NOT NULL, meeting_date TEXT, title TEXT NOT NULL, content TEXT NOT NULL, source TEXT DEFAULT 'REUNIAO', used_cycle_id TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_series_context ON report_series(company_id,project_id,active)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_series_cycles_series ON report_series_cycles(series_id,cycle_no DESC)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_series_meetings_pending ON report_series_meetings(series_id,used_cycle_id,meeting_date)");

  // Histórico do Status Report legado exibido na área do projeto/cliente.
  await stageSafe("CREATE TABLE IF NOT EXISTS legacy_report_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, company_id TEXT, project_id INTEGER, version_no INTEGER NOT NULL, ref TEXT DEFAULT '', snapshot_json TEXT NOT NULL, change_note TEXT DEFAULT '', source TEXT NOT NULL DEFAULT 'MANUAL', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(scope_type,scope_id,version_no))");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_legacy_report_versions_scope ON legacy_report_versions(scope_type,scope_id,version_no DESC)");

  // Auditoria das análises geradas pelo Copiloto PMO. O resultado só é aplicado após aprovação humana.
  await stageSafe("CREATE TABLE IF NOT EXISTS report_ai_runs (id TEXT PRIMARY KEY, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, company_id TEXT, project_id INTEGER, model TEXT NOT NULL, input_summary TEXT DEFAULT '', output_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'GENERATED', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), applied_at TEXT)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_ai_runs_scope ON report_ai_runs(scope_type,scope_id,created_at DESC)");

  await stageSafe("INSERT OR REPLACE INTO stage_runtime_flags(key,applied_at,detail) VALUES ('reports-persistent-schema',datetime('now'),'Reports, séries recorrentes, versões e Copiloto IA em modo persistente; nenhum reset automático')");
}
