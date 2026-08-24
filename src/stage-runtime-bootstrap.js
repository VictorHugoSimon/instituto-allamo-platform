// STAGE runtime bootstrap — usa exatamente o D1 vinculado ao Pages STAGE.
// Nunca executa em produção: hostname precisa conter allamo-pmo-stage.pages.dev.
// MODO PERSISTENTE: deploy nunca apaga dados cadastrados.
const STAGE_BUILD = 'awm-stage-20260822-1845';
const stageHost = (url.hostname || '').toLowerCase();
const isAllamoStage = stageHost === 'allamo-pmo-stage.pages.dev' || stageHost.endsWith('.allamo-pmo-stage.pages.dev');
const DATA_PERSISTENCE_MODE = 'persistent';
// Mantido apenas para rastreabilidade histórica/compatibilidade de release. NÃO é executado.
const legacyResetKey = 'clean-baseline-2026-08-21-v4';

const stageSafe = async (sql, ...args) => {
  try { await DB.prepare(sql).bind(...args).run(); return true; }
  catch (e) { console.warn('[stage-bootstrap]', sql.slice(0,80), String(e)); return false; }
};
const stageCount = async (table) => {
  try { const r = await DB.prepare('SELECT COUNT(*) AS n FROM ' + table).first(); return Number(r?.n || 0); }
  catch (e) { return null; }
};
const stageEnsureColumn = async (table, column, definition) => {
  try {
    const info = (await DB.prepare('PRAGMA table_info(' + table + ')').all()).results || [];
    if (info.some(c => String(c.name || '') === column)) return true;
    return await stageSafe('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
  } catch (e) {
    console.warn('[stage-bootstrap] schema', table + '.' + column, String(e));
    return false;
  }
};

if (isAllamoStage) {
  await stageSafe("CREATE TABLE IF NOT EXISTS stage_runtime_flags (key TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')), detail TEXT)");

  // Compatibilidade de schema legado. /api/releases e o cadastro de GMUD usam
  // gmud.project; bases antigas podem não possuir a coluna. A evolução é aditiva,
  // idempotente e preserva todas as linhas existentes.
  const gmudProjectReady = await stageEnsureColumn('gmud', 'project', "TEXT NOT NULL DEFAULT ''");
  if (gmudProjectReady) {
    await stageSafe("INSERT OR REPLACE INTO stage_runtime_flags(key,applied_at,detail) VALUES (?,datetime('now'),?)", 'schema-gmud-project', 'Coluna gmud.project disponível para associação de GMUD a projeto');
  }

  // Work Management nativo — apenas criação idempotente de estrutura, sem limpeza de dados.
  await stageSafe("CREATE TABLE IF NOT EXISTS work_items (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id INTEGER, project TEXT, parent_id TEXT, sprint_id TEXT, item_type TEXT NOT NULL DEFAULT 'TASK', title TEXT NOT NULL, description TEXT DEFAULT '', acceptance_criteria TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'BACKLOG', priority TEXT NOT NULL DEFAULT 'Média', owner TEXT DEFAULT '', reporter TEXT DEFAULT '', start_date TEXT, due_date TEXT, story_points REAL, estimate_hours REAL, rank REAL NOT NULL DEFAULT 0, labels TEXT DEFAULT '[]', blocked INTEGER NOT NULL DEFAULT 0, blocked_reason TEXT DEFAULT '', created_by TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), archived_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_sprints (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id INTEGER, name TEXT NOT NULL, goal TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'PLANEJADA', start_date TEXT, end_date TEXT, capacity_points REAL, capacity_hours REAL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), started_at TEXT, completed_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, work_item_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT, deleted_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_checklist (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, work_item_id TEXT NOT NULL, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, rank REAL NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT, deleted_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_links (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, source_item_id TEXT NOT NULL, target_item_id TEXT NOT NULL, link_type TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(source_item_id,target_item_id,link_type))");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_events (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT, project_id INTEGER, work_item_id TEXT, event_type TEXT NOT NULL DEFAULT 'usage', event_name TEXT NOT NULL, actor TEXT, metadata_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_work_items_company_project ON work_items(company_id,project_id,archived_at)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(company_id,status,rank)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_work_sprints_company_project ON work_sprints(company_id,project_id,status)");

  // Reports, histórico e Roadmap — somente criação idempotente de estrutura.
  await stageSafe("CREATE TABLE IF NOT EXISTS report_records (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id INTEGER, title TEXT NOT NULL, reference TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'RASCUNHO', executive_summary TEXT DEFAULT '', data_json TEXT DEFAULT '{}', created_by TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), published_at TEXT, archived_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS report_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT NOT NULL, company_id TEXT NOT NULL, project_id INTEGER, version_no INTEGER NOT NULL, snapshot_json TEXT NOT NULL, change_note TEXT DEFAULT '', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(report_id,version_no))");
  await stageSafe("CREATE TABLE IF NOT EXISTS report_roadmap_items (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, company_id TEXT NOT NULL, project_id INTEGER, title TEXT NOT NULL, description TEXT DEFAULT '', responsible_party TEXT NOT NULL DEFAULT 'DEV', responsible_name TEXT DEFAULT '', external_party TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'PLANEJADO', start_date TEXT, due_date TEXT, progress INTEGER NOT NULL DEFAULT 0, work_item_id TEXT, rank REAL NOT NULL DEFAULT 0, created_by TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), archived_at TEXT)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_records_company ON report_records(company_id,archived_at,updated_at)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_records_project ON report_records(project_id,archived_at,updated_at)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_versions_report ON report_versions(report_id,version_no DESC)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_roadmap_report ON report_roadmap_items(report_id,archived_at,rank)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_report_roadmap_work ON report_roadmap_items(work_item_id,archived_at)");

  // IMPORTANTE: o antigo baseline v4 foi desativado. Nenhum DELETE/reset acontece no deploy.
  await stageSafe("INSERT OR REPLACE INTO stage_runtime_flags(key,applied_at,detail) VALUES (?,datetime('now'),?)", 'data-persistence-enabled', 'Deploy persistente: nenhum reset automático; chave histórica '+legacyResetKey+' desativada');

  // Health-check público APENAS no hostname de homologação.
  if (path === 'stage-health' && request.method === 'GET') {
    return json({
      ok: true,
      environment: 'stage',
      build: STAGE_BUILD,
      host: stageHost,
      data_persistence: DATA_PERSISTENCE_MODE,
      reset_disabled: true,
      schema: { gmud_project: gmudProjectReady },
      counts: {
        companies: await stageCount('companies'),
        projects: await stageCount('projects'),
        issues: await stageCount('issues'),
        work_items: await stageCount('work_items'),
        work_sprints: await stageCount('work_sprints'),
        plan_items: await stageCount('plan_items'),
        report_records: await stageCount('report_records'),
        report_versions: await stageCount('report_versions'),
        report_roadmap_items: await stageCount('report_roadmap_items'),
        governance_events: await stageCount('governance_events'),
        governance_agenda_items: await stageCount('governance_event_agenda_items'),
        governance_stakeholders: await stageCount('governance_event_stakeholders'),
        governance_work_links: await stageCount('governance_event_work_links'),
        governance_decisions: await stageCount('governance_event_decisions')
      },
      reset_key: null,
      legacy_reset_key: legacyResetKey
    });
  }
}
