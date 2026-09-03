import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/service-hub-worker-api.js';
const start='    // BEGIN ALLAMO VALKIRIA SERVICE HUB';
const end='    // END ALLAMO VALKIRIA SERVICE HUB';
const candidates=[
  '    // BEGIN ALLAMO SPRINT GOVERNANCE',
  '    // BEGIN ALLAMO REPORT MANAGEMENT'
];
const api=fs.readFileSync(apiFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');
const block=start+'\n'+api+'\n'+end;

if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do Valkíria Service Hub ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  const needle=candidates.find(x=>worker.includes(x));
  if(!needle)throw new Error('Ponto de injeção do Service Hub não encontrado no Worker.');
  worker=worker.replace(needle,block+'\n'+needle);
}

fs.writeFileSync(workerFile,worker);
console.log('OK: Valkíria Service Hub injetado no Worker principal.');
