// STAGE runtime bootstrap — usa exatamente o D1 vinculado ao Pages STAGE.
// Nunca executa em produção: hostname precisa conter allamo-pmo-stage.pages.dev.
const STAGE_BUILD = 'awm-stage-20260820-2245';
const stageHost = (url.hostname || '').toLowerCase();
const isAllamoStage = stageHost === 'allamo-pmo-stage.pages.dev' || stageHost.endsWith('.allamo-pmo-stage.pages.dev');

const stageSafe = async (sql, ...args) => {
  try { await DB.prepare(sql).bind(...args).run(); return true; }
  catch (e) { console.warn('[stage-bootstrap]', sql.slice(0,80), String(e)); return false; }
};
const stageCount = async (table) => {
  try { const r = await DB.prepare('SELECT COUNT(*) AS n FROM ' + table).first(); return Number(r?.n || 0); }
  catch (e) { return null; }
};

if (isAllamoStage) {
  await stageSafe("CREATE TABLE IF NOT EXISTS stage_runtime_flags (key TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')), detail TEXT)");

  // O Work Management se auto-provisiona no banco realmente usado pelo STAGE.
  await stageSafe("CREATE TABLE IF NOT EXISTS work_items (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id INTEGER, project TEXT, parent_id TEXT, sprint_id TEXT, item_type TEXT NOT NULL DEFAULT 'TASK', title TEXT NOT NULL, description TEXT DEFAULT '', acceptance_criteria TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'BACKLOG', priority TEXT NOT NULL DEFAULT 'Média', owner TEXT DEFAULT '', reporter TEXT DEFAULT '', start_date TEXT, due_date TEXT, story_points REAL, estimate_hours REAL, rank REAL NOT NULL DEFAULT 0, labels TEXT DEFAULT '[]', blocked INTEGER NOT NULL DEFAULT 0, blocked_reason TEXT DEFAULT '', created_by TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), archived_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_sprints (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, project_id INTEGER, name TEXT NOT NULL, goal TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'PLANEJADA', start_date TEXT, end_date TEXT, capacity_points REAL, capacity_hours REAL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), started_at TEXT, completed_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, work_item_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT, deleted_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_checklist (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, work_item_id TEXT NOT NULL, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, rank REAL NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT, deleted_at TEXT)");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_links (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, source_item_id TEXT NOT NULL, target_item_id TEXT NOT NULL, link_type TEXT NOT NULL, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(source_item_id,target_item_id,link_type))");
  await stageSafe("CREATE TABLE IF NOT EXISTS work_events (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT, project_id INTEGER, work_item_id TEXT, event_type TEXT NOT NULL DEFAULT 'usage', event_name TEXT NOT NULL, actor TEXT, metadata_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_work_items_company_project ON work_items(company_id,project_id,archived_at)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(company_id,status,rank)");
  await stageSafe("CREATE INDEX IF NOT EXISTS idx_work_sprints_company_project ON work_sprints(company_id,project_id,status)");

  // Baseline limpo solicitado para homologação. Executa UMA única vez neste D1 de STAGE.
  const resetKey = 'clean-baseline-2026-08-21-v3';
  let resetApplied = null;
  try { resetApplied = await DB.prepare('SELECT key FROM stage_runtime_flags WHERE key=?').bind(resetKey).first(); } catch (e) {}
  if (!resetApplied) {
    const tables = [
      'work_comments','work_checklist','work_links','work_events','work_items','work_sprints',
      'plan_items','issues','gmud','releases','documents','notifications','project_reports','report_snapshots','projects',
      'horas_import','sync_state','email_outbox'
    ];
    for (const t of tables) await stageSafe('DELETE FROM ' + t);
    // Preserva somente contas internas e remove qualquer vínculo com cliente.
    await stageSafe("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id IS NOT NULL OR role IN ('gestor','usuario'))");
    await stageSafe("DELETE FROM users WHERE company_id IS NOT NULL OR role IN ('gestor','usuario')");
    await stageSafe("UPDATE users SET company_id=NULL WHERE role IN ('admin','pmo','techlead')");
    await stageSafe('DELETE FROM companies');
    await stageSafe('DELETE FROM audit_log');
    await stageSafe("INSERT OR REPLACE INTO stage_runtime_flags(key,applied_at,detail) VALUES (?,datetime('now'),?)", resetKey, 'Stage zerado pelo runtime bound D1; produção não afetada');
    console.log('[stage-bootstrap] baseline limpo aplicado ao D1 do Stage');
  }

  // Health-check público APENAS no hostname de homologação. Serve para comprovar
  // a versão realmente publicada e o banco realmente lido pelo Pages STAGE.
  if (path === 'stage-health' && request.method === 'GET') {
    return json({
      ok: true,
      environment: 'stage',
      build: STAGE_BUILD,
      host: stageHost,
      counts: {
        companies: await stageCount('companies'),
        projects: await stageCount('projects'),
        issues: await stageCount('issues'),
        work_items: await stageCount('work_items'),
        work_sprints: await stageCount('work_sprints'),
        plan_items: await stageCount('plan_items')
      },
      reset_key: resetKey
    });
  }
}
