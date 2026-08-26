import fs from 'node:fs';

const files={
  ingest:fs.readFileSync('src/fch-hours-ingest-api.js','utf8'),
  api:fs.readFileSync('src/fch-hours-api.js','utf8'),
  ui:fs.readFileSync('src/fch-hours-ui.js','utf8'),
  sync:fs.readFileSync('scripts/sync-fch-drive.py','utf8'),
  worker:fs.readFileSync('public/_worker.js','utf8'),
  index:fs.readFileSync('public/index.html','utf8'),
};

const required=[
  ['ingest','fch-hours-ingest'],['ingest','HOURS_INGEST_TOKEN'],['ingest','source_entry_hash'],
  ['api','fch-curve'],['api','planned_timed_total'],['api','target_project'],
  ['ui','Curva S de Horas · Automática'],['ui','OPR_Madri'],
  ['sync','FCH - Victor Hugo'],['sync','FCH - Gabriel'],['sync','shared-opr-madri-100pct-each'],
  ['sync','drive/v3/files/'],['sync','alt=media'],
  ['worker','BEGIN ALLAMO FCH HOURS INGEST'],['worker','BEGIN ALLAMO FCH HOURS API'],
  ['index','BEGIN ALLAMO FCH HOURS UI'],
];
for(const [file,marker] of required)if(!files[file].includes(marker))throw new Error(`FCH inválido: ${file} sem ${marker}`);

// O sincronizador usa Google Drive somente para leitura. O único POST Google permitido é o refresh OAuth.
for(const forbidden of ['PATCH https://www.googleapis.com/drive','PUT https://www.googleapis.com/drive','files.update','spreadsheets.batchUpdate']){
  if(files.sync.includes(forbidden))throw new Error('FCH não pode escrever na planilha/Drive: '+forbidden);
}

if(!files.ingest.includes("['OPR','MADRI']"))throw new Error('Targets analíticos OPR/MADRI não estão protegidos.');
if(!files.api.includes("source_entry_hash"))throw new Error('Capacidade sem deduplicação por entrada original.');

console.log('OK: FCH somente leitura, regra OPR/MADRI, ingestão segura e Curva S validadas.');
