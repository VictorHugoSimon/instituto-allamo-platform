import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/service-hub-worker-api.js';
const providerEventsApiFile='src/service-hub-provider-events-api.js';
const metaProviderFile='service-hub/src/providers/meta-whatsapp.mjs';
const metaWebhookFile='src/service-hub-whatsapp-webhook-api.js';

const start='    // BEGIN ALLAMO VALKIRIA SERVICE HUB';
const end='    // END ALLAMO VALKIRIA SERVICE HUB';
const reviewStart='    // BEGIN ALLAMO VALKIRIA WHATSAPP QUARANTINE REVIEW';
const reviewEnd='    // END ALLAMO VALKIRIA WHATSAPP QUARANTINE REVIEW';
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
const reviewApi=fs.readFileSync(providerEventsApiFile,'utf8');
const metaProvider=fs.readFileSync(metaProviderFile,'utf8').replace(/\bexport\s+/g,'');
const metaWebhook=fs.readFileSync(metaWebhookFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');

const block=start+'\n'+api+'\n'+end;
const reviewBlock=reviewStart+'\n'+reviewApi+'\n'+reviewEnd;
const webhookBlock=webhookStart+'\n'+metaProvider+'\n'+metaWebhook+'\n'+webhookEnd;

const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const markerRe=marker=>new RegExp(`^[\\t ]*${escRe(marker.trim())}[\\t ]*$`,'gm');
const countMarker=(text,marker)=>(text.match(markerRe(marker))||[]).length;
const stripAll=(text,s,e,label)=>{
  const starts=countMarker(text,s),ends=countMarker(text,e);
  if(starts!==ends)throw new Error(`${label}: wrappers inconsistentes (begin=${starts}, end=${ends}).`);
  if(!starts)return text;
  const re=new RegExp(`^[\\t ]*${escRe(s.trim())}[\\t ]*\\r?\\n[\\s\\S]*?^[\\t ]*${escRe(e.trim())}[\\t ]*(?:\\r?\\n)?`,'gm');
  const cleaned=text.replace(re,'');
  const rs=countMarker(cleaned,s),reCount=countMarker(cleaned,e);
  if(rs||reCount)throw new Error(`${label}: wrappers residuais após limpeza (begin=${rs}, end=${reCount}).`);
  return cleaned;
};

// Build idempotente: removemos todas as materializações anteriores e reinjetamos
// uma única cópia de cada bloco na ordem correta do pipeline.
worker=stripAll(worker,webhookStart,webhookEnd,'Webhook WhatsApp');
worker=stripAll(worker,reviewStart,reviewEnd,'Fila de quarentena');
worker=stripAll(worker,start,end,'Service Hub');

// 1) Webhook machine-to-machine: antes da autenticação de usuário.
if(worker.includes(currentUserNeedle)){
  worker=worker.replace(currentUserNeedle,webhookBlock+'\n'+currentUserNeedle);
}else if(worker.includes(authNeedle)){
  worker=worker.replace(authNeedle,webhookBlock+'\n'+authNeedle);
}else{
  throw new Error('Ponto de injeção pre-auth do webhook WhatsApp não encontrado no Worker.');
}

// 2) Fila de quarentena: após o gate de autenticação, antes das APIs tenant-scoped.
if(worker.includes(authNeedle)){
  worker=worker.replace(authNeedle,authNeedle+'\n'+reviewBlock);
}else{
  throw new Error('Ponto de injeção autenticado da fila de quarentena não encontrado no Worker.');
}

// 3) API tenant-scoped autenticada do Service Hub.
const generatedNeedle=generatedCandidates.find(x=>worker.includes(x));
if(generatedNeedle){
  worker=worker.replace(generatedNeedle,block+'\n'+generatedNeedle);
}else if(worker.includes(sourceWhereNeedle)){
  worker=worker.replace(sourceWhereNeedle,block+'\n'+sourceWhereNeedle);
}else if(worker.includes(sourceScopeNeedle)){
  worker=worker.replace(sourceScopeNeedle,sourceScopeNeedle+'\n'+block);
}else{
  throw new Error('Ponto de injeção do Service Hub não encontrado no Worker.');
}

const starts=countMarker(worker,start),ends=countMarker(worker,end);
const reviewStarts=countMarker(worker,reviewStart),reviewEnds=countMarker(worker,reviewEnd);
const webhookStarts=countMarker(worker,webhookStart),webhookEnds=countMarker(worker,webhookEnd);
if(starts!==1||ends!==1)throw new Error(`Service Hub deve existir uma única vez no Worker (begin=${starts}, end=${ends}).`);
if(reviewStarts!==1||reviewEnds!==1)throw new Error(`Fila de quarentena deve existir uma única vez no Worker (begin=${reviewStarts}, end=${reviewEnds}).`);
if(webhookStarts!==1||webhookEnds!==1)throw new Error(`Webhook WhatsApp deve existir uma única vez no Worker (begin=${webhookStarts}, end=${webhookEnds}).`);
const webhookPos=worker.indexOf(webhookStart),authPos=worker.indexOf(authNeedle),reviewPos=worker.indexOf(reviewStart),servicePos=worker.indexOf(start);
if(webhookPos>authPos)throw new Error('Webhook WhatsApp foi injetado depois do bloqueio de autenticação.');
if(reviewPos<authPos)throw new Error('Fila de quarentena foi injetada antes do gate de autenticação.');
if(servicePos>=0&&reviewPos>servicePos)throw new Error('Fila de quarentena deve executar antes da API tenant-scoped do Service Hub.');

fs.writeFileSync(workerFile,worker);
console.log('OK: Service Hub + webhook pre-auth + fila autenticada de quarentena injetados de forma idempotente.');
