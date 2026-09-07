import fs from 'node:fs';

const files = {
  official: '.github/workflows/sync-fch-curve-detailed.yml',
  sync: 'scripts/sync-fch-detailed-to-d1.mjs',
  legacyA: '.github/workflows/fch-hours-sync.yml',
  legacyB: '.github/workflows/sync-fch-hours.yml'
};
const read = p => fs.readFileSync(p, 'utf8');
const official = read(files.official);
const sync = read(files.sync);
const legacyA = read(files.legacyA);
const legacyB = read(files.legacyB);
const all = [official, legacyA, legacyB];

const hasSchedule = text => /^\s*schedule:\s*$/m.test(text);
const scheduled = all.filter(hasSchedule).length;
if (scheduled !== 1) throw new Error(`Deve existir exatamente uma rotina FCH agendada; encontrado: ${scheduled}.`);
if (!hasSchedule(official)) throw new Error('A rotina FCH oficial precisa ser a única agendada.');
if (hasSchedule(legacyA) || hasSchedule(legacyB)) throw new Error('Workflow FCH legado ainda possui schedule.');

for (const needle of [
  'Gate de ativação + baseline zero',
  'ALLAMO_FCH_SYNC_ENABLED',
  'FCH_TARGET_PROJECT_MAP_STAGE',
  'FCH_TARGET_PROJECT_MAP_PRODUCTION',
  'FCH_SHOULD_SYNC',
  'Preflight Google Drive read-only',
  'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'scripts/read-fch-detailed-readonly.py',
  'scripts/sync-fch-detailed-to-d1.mjs --env=stage',
  'scripts/sync-fch-detailed-to-d1.mjs --env=production',
  'drive.readonly',
  'baseline zero',
  'Nenhuma credencial foi exigida e nenhuma escrita foi executada.'
]) {
  if (!official.includes(needle)) throw new Error(`Governança FCH oficial incompleta: ${needle}`);
}

const gateIndex=official.indexOf('Gate de ativação + baseline zero');
const googleIndex=official.indexOf('Preflight Google Drive read-only');
const stageWriteIndex=official.indexOf('Atualizar fatos da Curva S no Stage');
if (!(gateIndex >= 0 && googleIndex > gateIndex && stageWriteIndex > googleIndex)) {
  throw new Error('Ordem FCH inválida: gate zero-state deve preceder credencial Google e qualquer escrita.');
}

for (const step of [
  'Preflight Google Drive read-only',
  'Dependências do leitor read-only',
  'Ler FCH sem modificar origem',
  'Preparar autenticação Cloudflare',
  'Garantir schema Stage',
  'Atualizar fatos da Curva S no Stage',
  'Garantir schema Produção',
  'Atualizar fatos da Curva S em Produção'
]) {
  const at=official.indexOf(`- name: ${step}`);
  if(at<0) throw new Error(`Etapa FCH ausente: ${step}`);
  const window=official.slice(at,at+320);
  if(!window.includes("if: env.FCH_SHOULD_SYNC == 'true'")) throw new Error(`Etapa ${step} pode executar sem gate FCH_SHOULD_SYNC.`);
}

for (const needle of [
  'FCH_TARGET_PROJECT_MAP',
  'Mapeamento FCH ausente',
  'SELECT p.id,p.name,p.company_id,c.name AS company_name FROM projects p JOIN companies c',
  'Nenhuma empresa/projeto é criada por esta rotina',
  'validateTargetsBeforeWrite()'
]) {
  if (!sync.includes(needle)) throw new Error(`Proteção do sincronizador FCH incompleta: ${needle}`);
}
if (sync.indexOf('validateTargetsBeforeWrite()') > sync.indexOf("execute('DELETE FROM fch_entries;')")) {
  throw new Error('FCH pode apagar fatos antes de validar projetos reais.');
}

for (const forbidden of ['repair-core-tenants', 'ensure-semeali-tenant', 'INSERT INTO companies', 'INSERT INTO projects']) {
  if (official.includes(forbidden) || sync.includes(forbidden)) throw new Error(`FCH não pode provisionar dados de negócio automaticamente: ${forbidden}`);
}

if (/FCH_DRIVE_DOWNLOAD_URL/.test(official)) {
  throw new Error('A rotina oficial não pode depender de URL pública/compartilhada do FCH.');
}
if (!legacyA.includes('[LEGACY MANUAL]') || !legacyB.includes('[LEGACY MANUAL]')) {
  throw new Error('Rotinas legadas precisam estar explicitamente marcadas como manuais.');
}
if (!legacyA.includes('não grava dados') || !legacyB.includes('não altera Stage ou Produção')) {
  throw new Error('Rotinas legadas precisam declarar que não fazem escrita operacional.');
}

console.log('OK: FCH oficial é zero-state safe, opt-in, read-only na origem e só grava com projetos reais explicitamente mapeados; legados permanecem manuais.');
