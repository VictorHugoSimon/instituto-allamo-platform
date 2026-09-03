import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/service-hub-worker-api.js';
const start='    // BEGIN ALLAMO VALKIRIA SERVICE HUB';
const end='    // END ALLAMO VALKIRIA SERVICE HUB';
const generatedCandidates=[
  '    // BEGIN ALLAMO SPRINT GOVERNANCE',
  '    // BEGIN ALLAMO REPORT MANAGEMENT',
  '    // BEGIN ALLAMO OPR GOVERNANCE PLATFORM'
];
const sourceScopeNeedle="    const scope = scopeCompany(user, url.searchParams.get('company'));";
const sourceWhereNeedle="    const where = scope ? ' WHERE company_id = ?' : '';";
const api=fs.readFileSync(apiFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');
const block=start+'\n'+api+'\n'+end;

if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do Valkíria Service Hub ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  const generatedNeedle=generatedCandidates.find(x=>worker.includes(x));
  if(generatedNeedle){
    worker=worker.replace(generatedNeedle,block+'\n'+generatedNeedle);
  }else if(worker.includes(sourceWhereNeedle)){
    // Worker fonte: scope já foi calculado; injeta antes da construção dos filtros legados.
    worker=worker.replace(sourceWhereNeedle,block+'\n'+sourceWhereNeedle);
  }else if(worker.includes(sourceScopeNeedle)){
    // Fallback para variações do Worker fonte que não possuem o `where` legado.
    worker=worker.replace(sourceScopeNeedle,sourceScopeNeedle+'\n'+block);
  }else{
    throw new Error('Ponto de injeção do Service Hub não encontrado no Worker.');
  }
}

const starts=worker.split(start).length-1,ends=worker.split(end).length-1;
if(starts!==1||ends!==1)throw new Error(`Service Hub deve existir uma única vez no Worker (begin=${starts}, end=${ends}).`);
fs.writeFileSync(workerFile,worker);
console.log('OK: Valkíria Service Hub injetado no Worker principal.');
