import fs from 'node:fs';

const files = {
  official: '.github/workflows/sync-fch-curve-detailed.yml',
  legacyA: '.github/workflows/fch-hours-sync.yml',
  legacyB: '.github/workflows/sync-fch-hours.yml'
};
const read = p => fs.readFileSync(p, 'utf8');
const official = read(files.official);
const legacyA = read(files.legacyA);
const legacyB = read(files.legacyB);
const all = [official, legacyA, legacyB];

const hasSchedule = text => /^\s*schedule:\s*$/m.test(text);
const scheduled = all.filter(hasSchedule).length;
if (scheduled !== 1) throw new Error(`Deve existir exatamente uma rotina FCH agendada; encontrado: ${scheduled}.`);
if (!hasSchedule(official)) throw new Error('A rotina FCH oficial precisa ser a única agendada.');
if (hasSchedule(legacyA) || hasSchedule(legacyB)) throw new Error('Workflow FCH legado ainda possui schedule.');

for (const needle of [
  'Preflight Google Drive read-only',
  'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'scripts/read-fch-detailed-readonly.py',
  'scripts/sync-fch-detailed-to-d1.mjs --env=stage',
  'scripts/sync-fch-detailed-to-d1.mjs --env=production',
  'drive.readonly'
]) {
  if (!official.includes(needle)) throw new Error(`Governança FCH oficial incompleta: ${needle}`);
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

console.log('OK: existe uma única rotina FCH agendada; legados são manuais e a fonte oficial exige Google Drive read-only antes de qualquer escrita.');
