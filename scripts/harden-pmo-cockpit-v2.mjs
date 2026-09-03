import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/pmo-cockpit-api.js';
const start='    // BEGIN ALLAMO PMO COCKPIT V2';
const end='    // END ALLAMO PMO COCKPIT V2';
// Ponto-base estável do Worker bruto, usado também pela montagem das APIs do portal.
// O hardener precisa funcionar tanto antes quanto depois dos demais blocos serem injetados.
const needle="if (path === 'projects' && request.method === 'GET')";

const api=fs.readFileSync(apiFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');
const block=start+'\n'+api+'\n'+end;

if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do PMO Cockpit v2 ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  const p=worker.indexOf(needle);
  if(p<0)throw new Error('Ponto-base projects GET não encontrado no Worker.');
  worker=worker.slice(0,p)+block+'\n    '+worker.slice(p);
}

if(!worker.includes("path==='pmo-cockpit'"))throw new Error('Endpoint pmo-cockpit não foi injetado.');
fs.writeFileSync(workerFile,worker);
console.log('OK: PMO Cockpit Executivo 2.0 injetado no Worker.');
