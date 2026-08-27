import fs from 'node:fs';

const workerFile='public/_worker.js';
const source=fs.readFileSync('src/global-report-schema-bootstrap.js','utf8');
let worker=fs.readFileSync(workerFile,'utf8');
const start='    // BEGIN ALLAMO GLOBAL REPORT SCHEMA';
const end='    // END ALLAMO GLOBAL REPORT SCHEMA';
const block=start+'\n'+source.split('\n').map(x=>'    '+x).join('\n')+'\n'+end;

if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do schema global ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  const needle='    // BEGIN ALLAMO PUBLIC REPORT CONTEXT GUARD';
  if(!worker.includes(needle))throw new Error('Ponto de injeção do schema global não encontrado.');
  worker=worker.replace(needle,block+'\n'+needle);
}

if(!worker.includes('CREATE TABLE IF NOT EXISTS report_records'))throw new Error('report_records não foi incorporada ao Worker final.');
if(!worker.includes('__allamoGlobalReportSchemaPromise'))throw new Error('Guard global do schema não foi incorporado.');
fs.writeFileSync(workerFile,worker);
console.log('OK: schema global de Reports injetado em Stage e Produção sem operações destrutivas.');
