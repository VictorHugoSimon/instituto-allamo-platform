import fs from 'node:fs';

const worker = fs.readFileSync('public/_worker.js','utf8');
const gs = fs.readFileSync('integrations/google-apps-script/FCH-Horas-PMO.gs','utf8');

const mustWorker = [
  'async function syncHorasIfStale',
  'async function enrichReportWithImportedHours',
  "FCH · atualização automática",
  "refresh GET falhou",
  "replace(/\\s/g,'').replace(',','.').replace(/[^0-9.-]/g,'')"
];
for(const n of mustWorker){
  if(!worker.includes(n)) throw new Error('Worker sem automação FCH: '+n);
}

const mustGs = [
  "const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
  'function openReadOnlySpreadsheet_',
  'Drive.Files.create',
  'FCH_FILE_ID',
  'FCH_FOLDER_ID',
  "p.indexOf('oprmadri') >= 0"
];
for(const n of mustGs){
  if(!gs.includes(n)) throw new Error('Apps Script FCH incompleto: '+n);
}

// A fonte original só pode ser consultada. Escritas de planilha no script de coleta
// são proibidas. A única exclusão permitida é a cópia temporária criada pelo próprio script.
const forbidden = [
  /file\.setName\s*\(/,
  /file\.setTrashed\s*\(/,
  /\.setValue\s*\(/,
  /\.setValues\s*\(/,
  /\.clearContent\s*\(/,
  /\.deleteSheet\s*\(/
];
for(const rx of forbidden){
  if(rx.test(gs)) throw new Error('Operação de escrita proibida detectada no coletor FCH: '+rx);
}

if(!gs.includes("DriveApp.getFileById(tempId).setTrashed(true)")){
  throw new Error('Limpeza da cópia técnica temporária não encontrada.');
}

console.log('OK: FCH original somente leitura e Curva S automática validados.');
