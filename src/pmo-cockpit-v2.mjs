export function classifyProjectHealth(project = {}, latestReport = null) {
  const status = String(project.status || '').trim().toLowerCase();
  const risk = String(project.risk_level || project.risk || '').trim().toLowerCase();

  if (['critical', 'critico', 'crítico', 'red', 'vermelho'].includes(risk)) return 'red';
  if (['high', 'alto', 'yellow', 'amarelo'].includes(risk)) return 'yellow';
  if (['atrasado', 'delayed', 'blocked', 'bloqueado'].includes(status)) return 'red';
  if (!latestReport) return 'stale';
  if (['em risco', 'at risk', 'attention', 'atenção'].includes(status)) return 'yellow';
  if (['concluido', 'concluído', 'done', 'completed'].includes(status)) return 'green';
  return 'green';
}

export function buildPortfolioSummary({ companies = [], projects = [], latestReportsByProject = new Map() } = {}) {
  const summary = {
    companies: companies.length,
    projects: projects.length,
    active: 0,
    inProgress: 0,
    atRisk: 0,
    delayed: 0,
    backlog: 0,
    completed: 0,
    health: { green: 0, yellow: 0, red: 0, stale: 0 },
  };

  for (const project of projects) {
    const status = String(project.status || '').trim().toLowerCase();
    if (!['concluido', 'concluído', 'done', 'completed', 'cancelado', 'cancelled'].includes(status)) summary.active += 1;
    if (['em andamento', 'in progress', 'doing'].includes(status)) summary.inProgress += 1;
    if (['em risco', 'at risk', 'attention', 'atenção'].includes(status)) summary.atRisk += 1;
    if (['atrasado', 'delayed', 'blocked', 'bloqueado'].includes(status)) summary.delayed += 1;
    if (['backlog', 'planejado', 'planned'].includes(status)) summary.backlog += 1;
    if (['concluido', 'concluído', 'done', 'completed'].includes(status)) summary.completed += 1;

    const latest = latestReportsByProject instanceof Map
      ? latestReportsByProject.get(String(project.id))
      : latestReportsByProject?.[String(project.id)];
    const health = classifyProjectHealth(project, latest || null);
    summary.health[health] += 1;
  }

  return summary;
}

export function displayMetric(value, unavailableLabel = 'Não disponível') {
  return value === null || value === undefined || Number.isNaN(value) ? unavailableLabel : value;
}
