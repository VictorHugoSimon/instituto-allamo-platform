const norm = (value) => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isDone = (status) => ['completo', 'concluido', 'done', 'completed'].includes(norm(status));
const isCancelled = (status) => ['cancelado', 'cancelled'].includes(norm(status));
const isBacklog = (status) => ['backlog', 'planejado', 'planned'].includes(norm(status));
const isRunning = (status, badge) => ['em andamento', 'in progress', 'doing'].includes(norm(status)) || norm(badge) === 'started';
const isCritical = (value) => /critico|vermelho|critical|red/.test(norm(value));
const isAttention = (value) => /atencao|amarelo|attention|yellow/.test(norm(value));
const isHealthy = (value) => /verde|saudavel|estavel|no ritmo|green|healthy|stable|ok/.test(norm(value));
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';

export function classifyProjectHealth(project = {}, latestReport = null, today = new Date().toISOString().slice(0, 10)) {
  const status = project.status || project.badge || '';
  if (isDone(status) || isCancelled(status) || isBacklog(status)) return 'not_applicable';

  const metaDate = isoDate(project.meta_date);
  const delayed = Boolean(metaDate && metaDate < today);
  if (delayed || isCritical(project.pmo_read)) return 'red';
  if (isAttention(project.pmo_read)) return 'yellow';
  if (!latestReport) return 'stale';
  if (isHealthy(project.pmo_read)) return 'green';
  return 'stale';
}

export function buildPortfolioSummary({ companies = [], projects = [], latestReportsByProject = new Map(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const summary = {
    companies: companies.length,
    projects: projects.length,
    active: 0,
    inProgress: 0,
    atRisk: 0,
    delayed: 0,
    backlog: 0,
    completed: 0,
    cancelled: 0,
    health: { green: 0, yellow: 0, red: 0, stale: 0, not_applicable: 0 },
  };

  for (const project of projects) {
    const status = project.status || project.badge || '';
    const metaDate = isoDate(project.meta_date);
    const delayed = Boolean(metaDate && metaDate < today && !isDone(status) && !isCancelled(status));

    if (!isDone(status) && !isCancelled(status)) summary.active += 1;
    if (isRunning(project.status, project.badge)) summary.inProgress += 1;
    if (isCritical(project.pmo_read) || isAttention(project.pmo_read)) summary.atRisk += 1;
    if (delayed) summary.delayed += 1;
    if (isBacklog(status)) summary.backlog += 1;
    if (isDone(status)) summary.completed += 1;
    if (isCancelled(status)) summary.cancelled += 1;

    const latest = latestReportsByProject instanceof Map
      ? latestReportsByProject.get(String(project.id))
      : latestReportsByProject?.[String(project.id)];
    const health = classifyProjectHealth(project, latest || null, today);
    summary.health[health] += 1;
  }

  return summary;
}

export function displayMetric(value, unavailableLabel = 'Não disponível') {
  return value === null || value === undefined || Number.isNaN(value) ? unavailableLabel : value;
}
