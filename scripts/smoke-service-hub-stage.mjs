import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const config=process.env.ALLAMO_STAGE_WRANGLER_CONFIG||'wrangler.stage.toml';
const marker='SERVICE HUB SMOKE '+Date.now();
const fail=m=>{throw new Error('[SERVICE HUB SMOKE] '+m)};
const sqlq=v=>"'"+String(v??'').replace(/'/g,"''")+"'";
let sessionToken='',companyId='',otherCompanyId='',projectId='',systemId='',channelId='',slaId='',ticketId='';

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
async function req(path,opt={},company=companyId){const r=await rawReq(path,opt,company);if(!r.ok)fail(`${opt.method||'GET'} ${r.path} -> ${r.status} ${typeof r.data==='string'?r.data:JSON.stringify(r.data)}`);return r.data}
async function cleanup(){
  try{
    if(ticketId){d1(`DELETE FROM service_hub_ticket_events WHERE ticket_id=${sqlq(ticketId)};`,{json:false});d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(ticketId)};`,{json:false});d1(`DELETE FROM service_hub_tickets WHERE id=${sqlq(ticketId)};`,{json:false})}
    if(slaId){d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(slaId)};`,{json:false});d1(`DELETE FROM service_hub_sla_policies WHERE id=${sqlq(slaId)};`,{json:false})}
    if(channelId){d1(`DELETE FROM service_hub_messages WHERE channel_id=${sqlq(channelId)};`,{json:false});d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(channelId)};`,{json:false});d1(`DELETE FROM service_hub_channels WHERE id=${sqlq(channelId)};`,{json:false})}
    if(systemId){d1(`DELETE FROM service_hub_audit_log WHERE entity_id=${sqlq(systemId)};`,{json:false});d1(`DELETE FROM service_hub_systems WHERE id=${sqlq(systemId)};`,{json:false})}
    if(sessionToken)d1(`DELETE FROM sessions WHERE token=${sqlq(sessionToken)};`,{json:false});
  }catch(e){console.error('[SERVICE HUB SMOKE] limpeza técnica falhou:',e.message)}
}

try{
  console.log('[1/9] localizar tenant/projeto e usuário técnico...');
  const context=d1("SELECT c.id AS company_id,p.id AS project_id FROM companies c JOIN projects p ON CAST(p.company_id AS TEXT)=CAST(c.id AS TEXT) ORDER BY c.id,p.id LIMIT 1;")[0];
  if(!context?.company_id||context?.project_id==null)fail('Nenhuma empresa com projeto encontrada no Stage.');companyId=String(context.company_id);projectId=String(context.project_id);
  const other=d1(`SELECT id FROM companies WHERE CAST(id AS TEXT)<>${sqlq(companyId)} ORDER BY id LIMIT 1;`)[0];otherCompanyId=other?.id!=null?String(other.id):'';
  const tech=d1("SELECT id FROM users WHERE role IN ('admin','pmo','techlead') AND COALESCE(status,'Ativo')<>'Bloqueado' ORDER BY CASE WHEN company_id IS NULL THEN 0 ELSE 1 END,id LIMIT 1;")[0];
  if(!tech?.id)fail('Usuário técnico admin/pmo/techlead não encontrado.');sessionToken='service-hub-smoke-'+randomUUID();d1(`INSERT INTO sessions(token,user_id,expires_at) VALUES(${sqlq(sessionToken)},${sqlq(tech.id)},datetime('now','+20 minutes'));`,{json:false});

  console.log('[2/9] health/readiness autenticado...');
  const health=await req('/api/service-hub/health');if(!health?.ok||health.schema!=='ready')fail('Health não confirmou schema ready: '+JSON.stringify(health));

  console.log('[3/9] cadastrar sistema temporário...');
  const sys=await req('/api/service-hub/systems',{method:'POST',body:JSON.stringify({projectId,name:marker+' System',systemKind:'external',lifecyclePhase:'support',officialTicketSource:'allamo'})});systemId=sys.id;if(!systemId)fail('Sistema temporário não retornou id.');

  console.log('[4/9] cadastrar canal idempotentemente identificável...');
  const ch=await req('/api/service-hub/channels',{method:'POST',body:JSON.stringify({projectId,systemId,provider:'api',externalChannelId:'smoke-'+randomUUID(),name:marker+' Channel'})});channelId=ch.id;if(!channelId)fail('Canal temporário não retornou id.');

  console.log('[5/9] configurar SLA corrido...');
  const sla=await req('/api/service-hub/sla-policies',{method:'POST',body:JSON.stringify({projectId,systemId,priority:'medium',firstResponseMinutes:5,resolutionMinutes:30,businessHoursOnly:false})});slaId=sla.id;if(!slaId)fail('SLA temporário não retornou id.');

  console.log('[6/9] criar chamado e validar redaction + deadlines...');
  const created=await req('/api/service-hub/tickets',{method:'POST',body:JSON.stringify({projectId,systemId,channelId,source:'api',messageType:'incident',priority:'medium',title:`${marker} contato smoke@example.com`,description:'CPF 123.456.789-09; email smoke@example.com; token=segredo-smoke'})});ticketId=created.id;if(!ticketId||!created.first_response_due_at||!created.resolution_due_at)fail('Ticket/SLA não criado corretamente: '+JSON.stringify(created));
  let ticket=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId));if(!String(ticket.title||'').includes('[EMAIL_REDACTED]'))fail('Título não foi sanitizado.');if(!String(ticket.description_redacted||'').includes('[EMAIL_REDACTED]')||!String(ticket.description_redacted||'').includes('[CPF_REDACTED]')||!String(ticket.description_redacted||'').includes('[SECRET_REDACTED]'))fail('Descrição não foi sanitizada completamente.');if(ticket.first_responded_at)fail('Ticket novo não deveria possuir primeira resposta.');

  console.log('[7/9] primeira resposta + persistência do marco SLA...');
  const first=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId)+'/status',{method:'POST',body:JSON.stringify({status:'triage',assignedTo:'Smoke N1',note:'Análise iniciada token=nao-persistir'})});if(!first.first_responded_at)fail('Primeira resposta não foi registrada.');const firstAt=first.first_responded_at;
  const second=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId)+'/status',{method:'POST',body:JSON.stringify({status:'in_progress',note:'Continuidade do atendimento'})});if(second.first_responded_at!==firstAt)fail('first_responded_at foi sobrescrito na segunda movimentação.');
  const events=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId)+'/events');const statusEvents=events.filter(x=>x.event_type==='ticket.status_changed');if(statusEvents.length<2)fail('Histórico de status incompleto.');const firstPayload=String(statusEvents[0].payload_json||'');if(!firstPayload.includes('[SECRET_REDACTED]')||!firstPayload.includes('firstResponseRecorded'))fail('Evento da primeira resposta não preservou auditoria sanitizada.');

  console.log('[8/9] isolamento entre empresas...');
  if(otherCompanyId){const crossed=await rawReq('/api/service-hub/tickets/'+encodeURIComponent(ticketId),{},otherCompanyId);if(crossed.status!==404)fail(`Cruzamento de tenant: ticket respondeu HTTP ${crossed.status} para outra empresa.`)}else console.log('Stage possui uma única empresa; teste cruzado não aplicável.');

  console.log('[9/9] conclusão...');
  ticket=await req('/api/service-hub/tickets/'+encodeURIComponent(ticketId));if(ticket.status!=='in_progress'||ticket.assigned_to!=='Smoke N1')fail('Estado final do ticket não persistiu.');
  console.log(JSON.stringify({ok:true,base,company_id:companyId,project_id:projectId,health:'ready',ticket_key:ticket.ticket_key,redaction:true,first_response_sla:true,tenant_isolation:otherCompanyId?'validated':'not_applicable'},null,2));
  console.log('[OK] Valkíria Service Hub: readiness, CRUD, redaction, SLA de primeira resposta e isolamento validados no Stage.');
}finally{await cleanup()}
