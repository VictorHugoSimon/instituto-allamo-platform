import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');

const requiredHtml = [
  ['Work Management UI', '<!-- BEGIN ALLAMO WORK MANAGEMENT UI -->'],
  ['Central de Reports', 'Central de Reports'],
  ['Admin de Reports', 'window.__allamoReportAdminNavLoaded'],
  ['Copiloto PMO', 'Gerar Status Report com IA'],
  ['PWA público', 'window.__allamoPublicPwaRuntime'],
  ['Manifesto tenant-safe', 'public-client-manifest?company='],
  ['Memória do tenant instalado', 'allamo_public_pwa_tenant'],
  ['Editor contextual', 'allamoReportContext'],
  ['RACI visual', 'raci'],
];

const requiredWorker = [
  ['Work Management API', '// BEGIN ALLAMO WORK MANAGEMENT'],
  ['Report Management API', '// BEGIN ALLAMO REPORT MANAGEMENT'],
  ['Report Series API', '// BEGIN ALLAMO REPORT SERIES'],
  ['Portal público do cliente', '// BEGIN ALLAMO PUBLIC CLIENT PORTAL'],
  ['Manifesto PWA multitenant', '// BEGIN ALLAMO PUBLIC CLIENT MANIFEST'],
  ['Reports publicados públicos', '// BEGIN ALLAMO PUBLIC PUBLISHED REPORTS'],
  ['Evidências por marco', '// BEGIN ALLAMO MILESTONE EVIDENCE'],
  ['Arquivos multitenant', '// BEGIN ALLAMO TENANT FILES'],
  ['Campos dinâmicos multitenant', '// BEGIN ALLAMO DYNAMIC TENANT FIELDS'],
  ['Copiloto PMO backend', '// BEGIN ALLAMO LEGACY REPORT AI'],
  ['Endpoint do manifesto público', "path==='public-client-manifest'"],
];

const missing = [];
for (const [name, needle] of requiredHtml) if (!html.includes(needle)) missing.push(`${name} (HTML)`);
for (const [name, needle] of requiredWorker) if (!worker.includes(needle)) missing.push(`${name} (Worker)`);

if (missing.length) {
  console.error('ERRO: baseline funcional incompleto. O deploy deve ser bloqueado.');
  for (const item of missing) console.error(' - ' + item);
  process.exit(1);
}

if (/allamo-pmo\.pages\.dev/.test(html) && !/allamo-pmo-stage/.test(html)) {
  console.warn('AVISO: referência a produção encontrada no HTML; revisar antes de homologar.');
}

console.log('OK: baseline funcional contém Trabalho, Reports, IA, PWA por tenant, portal público, séries, anexos, campos dinâmicos e multitenancy.');
