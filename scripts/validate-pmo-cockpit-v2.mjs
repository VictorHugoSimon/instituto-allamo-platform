import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
const page = fs.readFileSync('public/pmo-cockpit/index.html', 'utf8');
const operational = fs.readFileSync('public/pmo-cockpit/operational-blocks.js', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');
const api = fs.readFileSync('src/pmo-cockpit-api.js', 'utf8');
const hardener = fs.readFileSync('scripts/harden-pmo-cockpit-v2.mjs', 'utf8');
const domain = fs.readFileSync('src/pmo-cockpit-v2.mjs', 'utf8');

function must(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`PMO Cockpit v2: ausente ${label}: ${needle}`);
}

// Contratos PMO existentes que o Cockpit 2.0 deve preservar e reutilizar.
must(worker, "path === 'dash-curve'", 'endpoint Curva S consolidada');
must(index, 'Visão Executiva', 'Visão Executiva do PMO');
must(index, 'Riscos', 'bloco de riscos');
must(index, 'Curva S', 'Curva S');

// Contrato consolidado do Cockpit 2.0.
must(api, "path==='pmo-cockpit'", 'endpoint consolidado');
must(api, 'project_reports_p', 'Status Report por projeto');
must(api, 'pmo_read', 'leitura PMO do projeto');
must(api, 'meta_date', 'data-meta do projeto');
must(api, "source:'D1'", 'fonte real D1');
must(api, "if(!['admin','pmo'].includes(user.role))", 'controle de acesso PMO');
must(api, 'management,', 'bloco Gestão');
must(api, 'capacity,', 'bloco Capacidade');
must(api, 'governance,', 'bloco Governança');
must(api, 'adoption,', 'bloco Adoção');
must(api, 'work_items', 'fonte Work Management');
must(api, 'governance_event_decisions', 'fonte de decisões');
must(api, 'sprint_documents', 'fonte DoR/DoD');
must(api, 'work_events', 'eventos operacionais');
must(api, 'source_entry_hash', 'deduplicação de horas FCH');
must(api, 'target_project_map', 'mapeamento FCH para projetos reais');
must(api, 'Registro genérico estruturado de riscos críticos ainda não está disponível', 'risco sem fonte não é inventado');
must(api, 'Não há SLA/limiar de atualização de Status Report configurado', 'SLA de report não é inventado');
must(api, 'Telemetria global de uso ainda não está integrada', 'telemetria não é inventada');
must(hardener, 'BEGIN ALLAMO PMO COCKPIT V2', 'marcador de injeção');
must(hardener, '/pmo-cockpit/operational-blocks.js', 'extensão operacional no build');
must(worker, "path==='pmo-cockpit'", 'API injetada no Worker');
must(domain, "return 'stale'", 'estado sem atualização');
must(domain, 'Não disponível', 'tratamento de métrica ausente');

// Página e extensão isoladas de homologação do Cockpit.
must(page, 'Cockpit Executivo 2.0', 'título do cockpit');
must(page, "fetch('/api/pmo-cockpit'", 'consumo da API consolidada');
must(page, "fetch('/api/dash-curve'", 'consumo da Curva S real');
must(page, 'Sem atualização', 'estado sem atualização na UI');
must(page, 'Não disponível', 'ausência de dado explícita na UI');
must(page, 'sem KPI fictício', 'regra visual de dados reais');
must(page, '<script src="/pmo-cockpit/operational-blocks.js"></script>', 'extensão operacional materializada');
must(operational, 'Gestão e riscos', 'seção Gestão');
must(operational, 'Capacidade e horas', 'seção Capacidade');
must(operational, 'Governança', 'seção Governança');
must(operational, 'Adoção e telemetria', 'seção Adoção');
must(operational, 'Riscos críticos estruturados', 'indisponibilidade explícita de risco estruturado');
must(operational, 'Utilização por profissional', 'utilização sem denominador fictício');
must(operational, 'Mapa de calor', 'estrutura de adoção preparada');
must(operational, 'Não disponível', 'métrica indisponível explícita');

// Regras de segurança do pacote.
const forbidden = [
  'service-hub/',
  'sallamos-ai/',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
];
for (const token of forbidden) {
  if (process.env.PMO_CHANGED_FILES?.split(',').some((f) => f.startsWith(token))) {
    throw new Error(`PMO Cockpit v2: alteração fora do escopo: ${token}`);
  }
}

console.log('PMO Cockpit v2: portfólio, gestão, capacidade, governança, adoção, API, UI e contratos validados.');
