import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/sprint-governance-api.js';
const start='    // BEGIN ALLAMO SPRINT GOVERNANCE';
const end='    // END ALLAMO SPRINT GOVERNANCE';
const needle='    // BEGIN ALLAMO REPORT MANAGEMENT';
const api=fs.readFileSync(apiFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');
const block=start+'\n'+api+'\n'+end;
if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final de Sprint Governance ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  if(!worker.includes(needle))throw new Error('Ponto de injeção do Report Management não encontrado.');
  worker=worker.replace(needle,block+'\n'+needle);
}
fs.writeFileSync(workerFile,worker);
console.log('OK: API de Governança de Sprint (DoR/DoD) injetada no Worker.');
