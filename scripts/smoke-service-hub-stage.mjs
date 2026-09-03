import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const config=process.env.ALLAMO_STAGE_WRANGLER_CONFIG||'wrangler.stage.toml';
const marker='SERVICE HUB SMOKE '+Date.now();
const fail=m=>{throw new Error('[SERVICE HUB SMOKE] '+m)};
const sqlq=v=>"'"+String(v??'').replace(/'/g,"''")+"'";
let sessionToken='',companyId='',otherCompanyId='',projectId='',systemId='',channelId='',whatsappChannelId='',slaId='',ticketId='',providerEventId='',providerMessageId='';

function parseD1(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  try{return JSON.parse(clean)}catch{}
  const starts=[];for(let i=0;i<clean.length;i++)if(clean[i]==='['||clean[i]==='{')starts.push(i);
  for(const a of starts)for(let b=clean.length-1;b>a;b--){if(clean[b]!==']'&&clean[b]!=='}')continue;try{return JSON.parse(clean.slice(a,b+1))}catch{}}
  fail('Resposta D1 não é JSON reconhecível.');
}
function rowsDeep(node){const found=[];const walk=v=>{if(Array.isArray(v)){if(v.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))found.push(v);for(const x of v)walk(x)}else if(v&&typeof v==='object'){if(Array.isArray(v.results))found.unshift(v.results);for(const x of Object.values(v))walk(x)}};walk(node);return found[0]||[]}
function d1(sql,{json=true}={}){
  const args=['--yes','wrangler@4.124.0','d1','execute','DB','--remote','--config',config,'--command',sql];if(json)args.push('--json');
  const r=spawnSync('npx',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false});
  if(r.error)throw r.error;if(r.status!==0){process.stderr.write(String(r.stderr||''));fail('Wrangler D1 falhou ('+r.status+').')}
  return json?rowsDeep(parseD1(String(r.stdout||'')+String(r.stderr||''))):[];
}
function pathWithCompany(path,company=companyId){const u=new URL(base+path);if(company)u.searchParams.set('company',company);return u.pathname+u.search}
async function rawReq(path,opt={},company=companyId){
  const headers={'content-type':'application/json','cache-control':'no-cache','pragma':'no-cache',...(opt.headers||{})};
  if(sessionToken)headers.authorization='Bearer '+sessionToken;
  const finalPath=pathWithCompany(path,company);
  const r=await fetch(base+finalPath,{...opt,headers,cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
  return {status:r.status,ok:r.ok,data,path:finalPath};
}
async function anonReq(path,opt={}){
  const headers={'content-type':'application/json','cache-control':'no-cache','pragma':'no-cache',...(opt.headers||{})};
  const u=new URL(base+path);
  const r=await fetch(u,{...opt,headers,cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
  return {status:r.status,ok:r.ok,data,path:u.pathname+u.search};
}
async function req(path,opt={},company=companyId){const r=await rawReq(path,opt,company);if(!r.ok)fail(`${opt.method||'GET'} ${r.path} -> ${r.status} ${typeof r.data==='string'?r.data:JSON.stringify(r.data)}`);return r.data}
async function cleanup(){
  try{
    if(providerEventId){d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(providerEventId)};`,{json:false});d1(`DELETE FROM service_hub_provider_events WHERE id=${sqlq(providerEventId)};`,{json:false})}
    if(ticketId){d1(`DELETE FROM service_hub_ticket_events WHERE ticket_id=${sqlq(ticketId)};`,{json:false});d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(ticketId)};`,{json:false});d1(`DELETE FROM service_hub_tickets WHERE id=${sqlq(ticketId)};`,{json:false})}
    if(slaId){d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(slaId)};`,{json:false});d1(`DELETE FROM service_hub_sla_policies WHERE id=${sqlq(slaId)};`,{json:false})}
    if(whatsappChannelId){d1(`DELETE FROM service_hub_messages WHERE channel_id=${sqlq(whatsappChannelId)};`,{json:false});d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(whatsappChannelId)};`,{json:false});d1(`DELETE FROM service_hub_channels WHERE id=${sqlq(whatsappChannelId)};`,{json:false})}
    if(channelId){d1(`DELETE FROM service_hub_messages WHERE channel_id=${sqlq(channelId)};`,{json:false});d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(channelId)};`,{json:false});d1(`DELETE FROM service_hub_channels WHERE id=${sqlq(channelId)};`,{json:false})}
    if(systemId){d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(systemId)};`,{json:false});d1(`DELETE FROM service_hub_systems WHERE id=${sqlq(systemId)};`,{json:false})}
    if(sessionToken)d1(`DELETE FROM sessions WHERE token=${sqlq(sessionToken)};`,{json:false});
  }catch(e){console.error('[SERVICE HUB SMOKE] limpeza técnica falhou:',e.message)}
}

try{
  console.log('[1/11] localizar tenant/projeto e usuário técnico...');
  const context=d1("SELECT c.id AS company_id,p.id AS project_id FROM companies c JOIN projects p ON CAST(p.company_id AS TEXT)=CAST(c.id AS TEXT) ORDER BY c.id,p.id LIMIT 1;")[0];
  if(!context?.company_id||context?.project_id==null)fail('Nenhuma empresa com projeto encontrada no Stage.');companyId=String(context.company_id);projectId=String(context.project_id);
  const other=d1(`SELECT id FROM companies WHERE CAST(id AS TEXT)<>${sqlq(companyId)} ORDER BY id LIMIT 1;`)[0];otherCompanyId=other?.id!=null?String(other.id):'';
  const tech=d1("SELECT id FROM users WHERE role IN ('admin','pmo','techlead') AND COALESCE(status,'Ativo')<>'Bloqueado' ORDER BY CASE WHEN company_id IS NULL THEN 0 ELSE 1 END,id LIMIT 1;")[0];
  if(!tech?.id)fail('Usuário técnico admin/pmo/techlead não encontrado.');sessionToken='service-hub-smoke-'+randomUUID();d1(`INSERT INTO sessions(token,user_id,expires_at) VALUES(${sqlq(sessionToken)},${sqlq(tech.id)},datetime('now','+20 minutes'));`,{json:false});

  console.log('[2/11] webhook Meta fail-closed + quarentena bloqueada sem sessão real...');
  const webhookPath='/api/service-hub/providers/whatsapp/webhook';
  const challenge=new URL(base+webhookPath);challenge.searchParams.set('hub.mode','subscribe');challenge.searchParams.set('hub.verify_token','smoke-invalid-token');challenge.searchParams.set('hub.challenge','smoke-must-not-pass');
  const fakeGet=await anonReq(challenge.pathname+challenge.search);if(![403,503].includes(fakeGet.status))fail(`Challenge falso retornou ${fakeGet.status}: ${JSON.stringify(fakeGet.data)}`);
  const fakePost=await anonReq(webhookPath,{method:'POST',headers:{'x-hub-signature-256':'sha256=00'},body:'{}'});if(![401,503].includes(fakePost.status))fail(`POST sem assinatura válida retornou ${fakePost.status}: ${JSON.stringify(fakePost.data)}`);
  const anonymousQueue=await anonReq('/api/service-hub/provider-events?status=unresolved&limit=1');if(anonymousQueue.status!==401||anonymousQueue.data?.code!=='authenticated_session_required')fail(`Quarentena sem sessão real não foi bloqueada: ${anonymousQueue.status} ${JSON.stringify(anonymousQueue.data)}`);

  console.log('[3/11] health/readiness autenticado...');
  const health=await req('/api/service-hub/health');if(!health?.ok||health.schema!=='ready')fail('Health não confirmou schema ready: '+JSON.stringify(health));

  console.log('[4/11] cadastrar sistema temporário...');
  const sys=await req('/api/service-hub/systems',{method:'POST',body:JSON.stringify({projectId,name:marker+' System',systemKind:'external',lifecyclePhase:'support',officialTicketSource:'allamo'})});systemId=sys.id;if(!systemId)fail('Sistema temporário não retornou id.');

  console.log('[5/11] cadastrar canais API e WhatsApp temporários...');
  const ch=await req('/api/service-hub/channels',{method:'POST',body:JSON.stringify({projectId,systemId,provider:'api',externalChannelId:'smoke-api-'+randomUUID(),name:marker+' API Channel'})});channelId=ch.id;if(!channelId)fail('Canal API temporário não retornou id.');
  const wch=await req('/api/service-hub/channels',{method:'POST',body:JSON.stringify({projectId,systemId,provider:'whatsapp',externalChannelId:'smoke-whatsapp-'+randomUUID(),name:marker+' WhatsApp Channel'})});whatsappChannelId=wch.id;if(!whatsappChannelId)fail('Canal WhatsApp temporário não retornou id.');

  console.log('[6/11] revisar evento de quarentena sem promover mensagem ou chamado...');
  providerEventId='pev:'+randomUUID();providerMessageId='wamid.smoke.'+randomUUID();
  const ticketsBefore=Number(d1(`SELECT COUNT(*) AS total FROM service_hub_tickets WHERE tenant_id=${sqlq(companyId)} AND project_id=${sqlq(projectId)};`)[0]?.total||0);
  d1(`INSERT INTO service_hub_provider_events(id,provider,provider_message_id,external_channel_id,phone_number_id,text_redacted,occurred_at,status,metadata_json) VALUES(${sqlq(providerEventId)},'whatsapp',${sqlq(providerMessageId)},${sqlq('unmapped-'+randomUUID())},'smoke-phone-id','Mensagem sanitizada de smoke',datetime('now'),'unresolved',${sqlq(JSON.stringify({providerType:'messages',requiresChannelResolution:true}))});`,{json:false});
  const queue=await rawReq('/api/service-hub/provider-events?status=unresolved&limit=100',{},'');if(!queue.ok||!Array.isArray(queue.data)||!queue.data.some(x=>x.id===providerEventId))fail('Evento sintético não apareceu na fila autenticada.');
  const resolved=await rawReq('/api/service-hub/provider-events/'+encodeURIComponent(providerEventId)+'/resolve',{method:'POST',body:JSON.stringify({channelId:whatsappChannelId})},'');
  if(!resolved.ok||resolved.data?.status!=='resolved'||String(resolved.data?.tenantId)!==companyId||String(resolved.data?.projectId)!==projectId)fail('Resolução manual não derivou tenant/projeto do canal: '+JSON.stringify(resolved.data));
  const persisted=d1(`SELECT status,channel_id,tenant_id,project_id FROM service_hub_provider_events WHERE id=${sqlq(providerEventId)} LIMIT 1;`)[0];
  if(persisted?.status!=='resolved'||String(persisted?.channel_id)!==whatsappChannelId||String(persisted?.tenant_id)!==companyId||String(persisted?.project_id)!==projectId)fail('Estado resolvido não persistiu corretamente no D1.');
  const messagesAfter=Number(d1(`SELECT COUNT(*) AS total FROM service_hub_messages WHERE provider_message_id=${sqlq(providerMessageId)};`)[0]?.total||0);
  const ticketsAfter=Number(d1(`SELECT COUNT(*) AS total FROM service_hub_tickets WHERE tenant_id=${sqlq(companyId)} AND project_id=${sqlq(projectId)};`)[0]?.total||0);
  if(messagesAfter!==0||ticketsAfter!==ticketsBefore)fail(`Resolução promoveu conteúdo indevido: messages=${messagesAfter}, tickets ${ticketsBefore}->${ticketsAfter}.`);
  const second=await rawReq('/api/service-hub/provider-events/'+encodeURIComponent(providerEventId)+'/resolve',{method:'POST',body:JSON.stringify({channelId:whatsappChannelId})},'');if(second.status!==409||second.data?.code!=='provider_event_already_reviewed')fail('Segunda revisão do mesmo evento não foi bloqueada com 409.');

  console.log('[7/11] configurar SLA corrido...');
  const sla=await req('/api/service-hub/sla-policies',{method:'POST',body:JSON.stringify({projectId,systemId,priority:'medium',firstResponseMinutes:5,resolutionMinutes:30,businessHoursOnly:false})});slaId=sla.id;if(!slaId)fail('SLA temporário não retornou id.');

  console.log('[8/11] criar chamado e validar redaction + deadlines...');
  const created=await req('/api/service-hub/tickets',{method:'POST',body:JSON.stringify({projectId,systemId,channelId,source:'api',messageType:'incident',priority:'medium',title:`${marker} contato smoke@example.com`,description:'CPF 123.456.789-09; email smoke@example.com; token=segredo-smoke'})});ticketId=created.id;if(!ticketId||!created.first_response_due_at||!created.resolution_due_at)fail('Ticket/SLA não criado corretamente: '+JSON.stringify(created));
  let ticket=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId));if(!String(ticket.title||'').includes('[EMAIL_REDACTED]'))fail('Título não foi sanitizado.');if(!String(ticket.description_redacted||'').includes('[EMAIL_REDACTED]')||!String(ticket.description_redacted||'').includes('[CPF_REDACTED]')||!String(ticket.description_redacted||'').includes('[SECRET_REDACTED]'))fail('Descrição não foi sanitizada completamente.');if(ticket.first_responded_at)fail('Ticket novo não deveria possuir primeira resposta.');

  console.log('[9/11] primeira resposta + persistência do marco SLA...');
  const first=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId)+'/status',{method:'POST',body:JSON.stringify({status:'triage',assignedTo:'Smoke N1',note:'Análise iniciada token=nao-persistir'})});if(!first.first_responded_at)fail('Primeira resposta não foi registrada.');const firstAt=first.first_responded_at;
  const secondTicket=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId)+'/status',{method:'POST',body:JSON.stringify({status:'in_progress',note:'Continuidade do atendimento'})});if(secondTicket.first_responded_at!==firstAt)fail('first_responded_at foi sobrescrito na segunda movimentação.');
  const events=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId)+'/events');const statusEvents=events.filter(x=>x.event_type==='ticket.status_changed');if(statusEvents.length<2)fail('Histórico de status incompleto.');const firstPayload=String(statusEvents[0].payload_json||'');if(!firstPayload.includes('[SECRET_REDACTED]')||!firstPayload.includes('firstResponseRecorded'))fail('Evento da primeira resposta não preservou auditoria sanitizada.');

  console.log('[10/11] isolamento entre empresas...');
  if(otherCompanyId){const crossed=await rawReq('/api/service-hub/tickets/'+encodeURIComponent(ticketId),{},otherCompanyId);if(crossed.status!==404)fail(`Cruzamento de tenant: ticket respondeu HTTP ${crossed.status} para outra empresa.`)}else console.log('Stage possui uma única empresa; teste cruzado não aplicável.');

  console.log('[11/11] conclusão...');
  ticket=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId));if(ticket.status!=='in_progress'||ticket.assigned_to!=='Smoke N1')fail('Estado final do ticket não persistiu.');
  console.log(JSON.stringify({ok:true,base,company_id:companyId,project_id:projectId,health:'ready',ticket_key:ticket.ticket_key,redaction:true,first_response_sla:true,tenant_isolation:otherCompanyId?'validated':'not_applicable',webhook_fail_closed:true,anonymous_quarantine_blocked:true,whatsapp_quarantine_review:true,no_auto_promotion:true},null,2));
  console.log('[OK] Valkíria Service Hub: readiness, webhook fail-closed, quarentena segura, CRUD, redaction, SLA e isolamento validados no Stage.');
}finally{await cleanup()}
