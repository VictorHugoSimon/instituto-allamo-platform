import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
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

// Novo contrato do Cockpit 2.0.
must(api, "path==='pmo-cockpit'", 'endpoint consolidado');
must(api, 'project_reports_p', 'Status Report por projeto');
must(api, 'pmo_read', 'leitura PMO do projeto');
must(api, 'meta_date', 'data-meta do projeto');
must(api, "source:'D1'", 'fonte real D1');
must(api, "if(!['admin','pmo'].includes(user.role))", 'controle de acesso PMO');
must(hardener, 'BEGIN ALLAMO PMO COCKPIT V2', 'marcador de injeção');
must(worker, "path==='pmo-cockpit'", 'API injetada no Worker');
must(domain, "return 'stale'", 'estado sem atualização');
must(domain, 'Não disponível', 'tratamento de métrica ausente');

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

console.log('PMO Cockpit v2: domínio, API, injeção e contratos validados.');
