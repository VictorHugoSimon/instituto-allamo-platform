import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/service-hub-worker-api.js';
const metaProviderFile='service-hub/src/providers/meta-whatsapp.mjs';
const metaWebhookFile='src/service-hub-whatsapp-webhook-api.js';

const start='    // BEGIN ALLAMO VALKIRIA SERVICE HUB';
const end='    // END ALLAMO VALKIRIA SERVICE HUB';
const webhookStart='    // BEGIN ALLAMO VALKIRIA WHATSAPP WEBHOOK';
const webhookEnd='    // END ALLAMO VALKIRIA WHATSAPP WEBHOOK';

const generatedCandidates=[
  '    // BEGIN ALLAMO SPRINT GOVERNANCE',
  '    // BEGIN ALLAMO REPORT MANAGEMENT',
  '    // BEGIN ALLAMO OPR GOVERNANCE PLATFORM'
];
const sourceScopeNeedle="    const scope = scopeCompany(user, url.searchParams.get('company'));";
const sourceWhereNeedle="    const where = scope ? ' WHERE company_id = ?' : '';";
const currentUserNeedle='    const user = await currentUser(request, env);';
const authNeedle="    if (!user) return json({ error: 'Não autenticado' }, 401);";

const api=fs.readFileSync(apiFile,'utf8');
const metaProvider=fs.readFileSync(metaProviderFile,'utf8').replace(/\bexport\s+/g,'');
const metaWebhook=fs.readFileSync(metaWebhookFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');

const block=start+'\n'+api+'\n'+end;
const webhookBlock=webhookStart+'\n'+metaProvider+'\n'+metaWebhook+'\n'+webhookEnd;

// 1) Webhook machine-to-machine: precisa existir antes da autenticação de usuário.
if(worker.includes(webhookStart)){
  const a=worker.indexOf(webhookStart),b=worker.indexOf(webhookEnd,a);
  if(b<0)throw new Error('Marcador final do webhook WhatsApp ausente.');
  worker=worker.slice(0,a)+webhookBlock+worker.slice(b+webhookEnd.length);
}else if(worker.includes(currentUserNeedle)){
  worker=worker.replace(currentUserNeedle,webhookBlock+'\n'+currentUserNeedle);
}else if(worker.includes(authNeedle)){
  // Fallback seguro: ainda fica antes do bloqueio 401, embora currentUser já tenha sido consultado.
  worker=worker.replace(authNeedle,webhookBlock+'\n'+authNeedle);
}else{
  throw new Error('Ponto de injeção pre-auth do webhook WhatsApp não encontrado no Worker.');
}

// 2) API autenticada do Service Hub.
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
const webhookStarts=worker.split(webhookStart).length-1,webhookEnds=worker.split(webhookEnd).length-1;
if(starts!==1||ends!==1)throw new Error(`Service Hub deve existir uma única vez no Worker (begin=${starts}, end=${ends}).`);
if(webhookStarts!==1||webhookEnds!==1)throw new Error(`Webhook WhatsApp deve existir uma única vez no Worker (begin=${webhookStarts}, end=${webhookEnds}).`);
if(worker.indexOf(webhookStart)>worker.indexOf(authNeedle))throw new Error('Webhook WhatsApp foi injetado depois do bloqueio de autenticação.');

fs.writeFileSync(workerFile,worker);
console.log('OK: Valkíria Service Hub + webhook WhatsApp pre-auth injetados no Worker principal.');
