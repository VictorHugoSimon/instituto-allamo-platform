import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/pmo-cockpit-api.js';
const start='    // BEGIN ALLAMO PMO COCKPIT V2';
const end='    // END ALLAMO PMO COCKPIT V2';
const needle='    // BEGIN ALLAMO SPRINT GOVERNANCE';

const api=fs.readFileSync(apiFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');
const block=start+'\n'+api+'\n'+end;

if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do PMO Cockpit v2 ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  if(!worker.includes(needle))throw new Error('Ponto de injeção antes da Governança de Sprint não encontrado.');
  worker=worker.replace(needle,block+'\n'+needle);
}

if(!worker.includes("path==='pmo-cockpit'"))throw new Error('Endpoint pmo-cockpit não foi injetado.');
fs.writeFileSync(workerFile,worker);
console.log('OK: PMO Cockpit Executivo 2.0 injetado no Worker.');
