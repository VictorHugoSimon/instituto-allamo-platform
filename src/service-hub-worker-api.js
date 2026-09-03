// Valkíria Service Hub — API runtime injetada dentro de handleApi.
// Dependências disponíveis no escopo: request, DB, url, path, json, user, scope, logEvent, env.
const shwRolesRead=['admin','pmo','techlead','gestor'];
const shwCanRead=shwRolesRead.includes(user.role);
const shwCanConfigure=['admin','pmo','techlead'].includes(user.role);
const shwCanManage=['admin','pmo','techlead','gestor'].includes(user.role);
const shwCanCreateTicket=[...shwRolesRead,'usuario'].includes(user.role);
const shwTenant=scope?String(scope):'';
const shwStatuses=['new','triage','in_progress','waiting_customer','waiting_vendor','resolved','closed','cancelled'];
const shwPriorities=['low','normal','medium','high','critical'];
const shwTypes=['incident','request','change','blocker','question'];
const shwSource=['whatsapp','sallamos','portal','api','manual','valkiria'];
const shwId=p=>p+':'+crypto.randomUUID();
const shwClean=(v,max=500)=>String(v??'').trim().slice(0,max);
const shwOne=(v,list)=>{const x=shwClean(v,80).toLowerCase();return list.includes(x)?x:''};
const shwBody=()=>request.json().catch(()=>({}));
const shwRedact=v=>{
  let t=String(v??'').slice(0,12000);
  const rules=[
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL_REDACTED]'],
    [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,'[CPF_REDACTED]'],
    [/\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g,'[CNPJ_REDACTED]'],
    [/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g,'[PHONE_REDACTED]'],
    [/\b(?:\d[ -]*?){13,19}\b/g,'[CARD_REDACTED]'],
    [/(bearer\s+)[a-z0-9._~+\/-]+=*/gi,'$1[TOKEN_REDACTED]'],
    [/((?:api[_-]?key|token|secret|password|senha)\s*[:=]\s*)[^\s,;]+/gi,'$1[SECRET_REDACTED]']
  ];
  for(const [r,repl] of rules)t=t.replace(r,repl);
  return t;
};
const shwProject=async(projectId,tenant)=>DB.prepare('SELECT id,name,company_id FROM projects WHERE id=? AND company_id=? LIMIT 1').bind(String(projectId),String(tenant)).first();
const shwSystem=async(id,tenant)=>DB.prepare('SELECT * FROM service_hub_systems WHERE id=? AND tenant_id=? AND active=1 LIMIT 1').bind(id,tenant).first();
const shwChannel=async(id,tenant)=>DB.prepare('SELECT * FROM service_hub_channels WHERE id=? AND tenant_id=? AND active=1 LIMIT 1').bind(id,tenant).first();
const shwTicket=async(id,tenant)=>DB.prepare('SELECT * FROM service_hub_tickets WHERE id=? AND tenant_id=? LIMIT 1').bind(id,tenant).first();
const shwTable=async name=>!!(await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(name).first());
const shwRequiredTables=['service_hub_systems','service_hub_channels','service_hub_sla_policies','service_hub_routing_rules','service_hub_tickets','service_hub_ticket_events','service_hub_messages','service_hub_audit_log'];
const shwReady=async()=>{for(const t of shwRequiredTables)if(!(await shwTable(t)))return false;return true};
const shwAudit=async(tenant,entityType,entityId,action,meta={})=>DB.prepare('INSERT INTO service_hub_audit_log(id,tenant_id,entity_type,entity_id,action,actor_type,actor_ref,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(shwId('aud'),tenant,entityType,entityId,action,'user',String(user.id||user.email||user.name||''),JSON.stringify(meta).slice(0,12000),new Date().toISOString()).run();
const shwEvent=async(tenant,ticketId,eventType,payload={})=>DB.prepare('INSERT INTO service_hub_ticket_events(id,ticket_id,tenant_id,event_type,actor_type,actor_ref,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(shwId('evt'),ticketId,tenant,eventType,'user',String(user.id||user.email||user.name||''),JSON.stringify(payload).slice(0,12000),new Date().toISOString()).run();
const shwTicketKey=()=>`ALS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
const shwAddMin=(iso,min)=>new Date(new Date(iso).getTime()+Number(min)*60000).toISOString();

if(path==='service-hub/health'&&request.method==='GET'){
  if(!shwCanRead)return json({error:'Sem permissão para visualizar o Service Hub'},403);
  const ready=await shwReady();
  return json({ok:ready,service:'valkiria-service-hub',schema:ready?'ready':'missing'},ready?200:503);
}

if(path.startsWith('service-hub/')&&path!=='service-hub/health'){
  if(!shwTenant)return json({error:'Selecione uma empresa para acessar o Service Hub',code:'company_required'},400);
  if(!(await shwReady()))return json({error:'Schema do Service Hub ainda não foi aplicado',code:'service_hub_schema_missing'},503);
}

if(path==='service-hub/systems'&&request.method==='GET'){
  if(!shwCanRead)return json({error:'Sem permissão para visualizar sistemas'},403);
  const project=shwClean(url.searchParams.get('projectId'),120),args=[shwTenant];let where='tenant_id=?';
  if(project){where+=' AND project_id=?';args.push(project)}
  const rows=(await DB.prepare(`SELECT id,tenant_id,project_id,name,system_kind,lifecycle_phase,official_ticket_source,external_ref,active,created_at,updated_at FROM service_hub_systems WHERE ${where} ORDER BY updated_at DESC LIMIT 200`).bind(...args).all()).results||[];
  return json(rows);
}

if(path==='service-hub/systems'&&request.method==='POST'){
  if(!shwCanConfigure)return json({error:'Sem permissão para configurar sistemas'},403);
  const b=await shwBody(),projectId=shwClean(b.projectId,120),name=shwClean(b.name,180),kind=shwOne(b.systemKind,['sallamos','external','internal']),phase=shwOne(b.lifecyclePhase,['implementation','hypercare','production','support','closed']),official=shwOne(b.officialTicketSource,['sallamos','allamo','project_queue','manual']);
  if(!projectId||!name||!kind||!phase||!official)return json({error:'Dados obrigatórios inválidos'},400);
  const project=await shwProject(projectId,shwTenant);if(!project)return json({error:'Projeto não pertence à empresa selecionada'},400);
  const id=shwId('sys'),now=new Date().toISOString();
  await DB.prepare('INSERT INTO service_hub_systems(id,tenant_id,project_id,name,system_kind,lifecycle_phase,official_ticket_source,external_ref,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)').bind(id,shwTenant,projectId,name,kind,phase,official,shwClean(b.externalRef,300)||null,now,now).run();
  await shwAudit(shwTenant,'system',id,'create',{projectId,name,kind,phase,official});await logEvent(env,user,'service-hub:sistema-criar',id,name);
  return json({ok:true,id},201);
}

if(path==='service-hub/channels'&&request.method==='GET'){
  if(!shwCanRead)return json({error:'Sem permissão para visualizar canais'},403);
  const project=shwClean(url.searchParams.get('projectId'),120),system=shwClean(url.searchParams.get('systemId'),160),args=[shwTenant];let where='tenant_id=?';
  if(project){where+=' AND project_id=?';args.push(project)}if(system){where+=' AND system_id=?';args.push(system)}
  const rows=(await DB.prepare(`SELECT id,tenant_id,project_id,system_id,provider,external_channel_id,name,active,created_at,updated_at FROM service_hub_channels WHERE ${where} ORDER BY updated_at DESC LIMIT 200`).bind(...args).all()).results||[];
  return json(rows);
}

if(path==='service-hub/channels'&&request.method==='POST'){
  if(!shwCanConfigure)return json({error:'Sem permissão para configurar canais'},403);
  const b=await shwBody(),projectId=shwClean(b.projectId,120),systemId=shwClean(b.systemId,160),provider=shwOne(b.provider,['whatsapp','sallamos','portal','email','api','other']),name=shwClean(b.name,180);
  if(!projectId||!systemId||!provider||!name)return json({error:'Dados obrigatórios inválidos'},400);
  const project=await shwProject(projectId,shwTenant),system=await shwSystem(systemId,shwTenant);if(!project||!system||String(system.project_id)!==String(projectId))return json({error:'Projeto/sistema inválido para a empresa'},400);
  const id=shwId('chn'),now=new Date().toISOString();
  try{await DB.prepare('INSERT INTO service_hub_channels(id,tenant_id,project_id,system_id,provider,external_channel_id,name,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)').bind(id,shwTenant,projectId,systemId,provider,shwClean(b.externalChannelId,300)||null,name,now,now).run()}catch(e){if(String(e).toLowerCase().includes('unique'))return json({error:'Canal externo já cadastrado'},409);throw e}
  await shwAudit(shwTenant,'channel',id,'create',{projectId,systemId,provider,name});await logEvent(env,user,'service-hub:canal-criar',id,name);
  return json({ok:true,id},201);
}

if(path==='service-hub/sla-policies'&&request.method==='GET'){
  if(!shwCanRead)return json({error:'Sem permissão para visualizar SLA'},403);
  const rows=(await DB.prepare('SELECT id,tenant_id,project_id,system_id,priority,first_response_minutes,resolution_minutes,business_hours_only,active,created_at,updated_at FROM service_hub_sla_policies WHERE tenant_id=? ORDER BY priority,updated_at DESC LIMIT 200').bind(shwTenant).all()).results||[];
  return json(rows);
}

if(path==='service-hub/sla-policies'&&request.method==='POST'){
  if(!shwCanConfigure)return json({error:'Sem permissão para configurar SLA'},403);
  const b=await shwBody(),priority=shwOne(b.priority,shwPriorities),first=Number(b.firstResponseMinutes),resolution=Number(b.resolutionMinutes),projectId=shwClean(b.projectId,120)||null,systemId=shwClean(b.systemId,160)||null;
  if(!priority||!Number.isInteger(first)||first<=0||!Number.isInteger(resolution)||resolution<=0)return json({error:'Política de SLA inválida'},400);
  if(b.businessHoursOnly)return json({error:'SLA em horário comercial aguarda calendário oficial',code:'business_hours_sla_not_supported_in_mvp'},400);
  if(projectId&&!(await shwProject(projectId,shwTenant)))return json({error:'Projeto inválido para a empresa'},400);
  if(systemId&&!(await shwSystem(systemId,shwTenant)))return json({error:'Sistema inválido para a empresa'},400);
  const id=shwId('sla'),now=new Date().toISOString();
  await DB.prepare('INSERT INTO service_hub_sla_policies(id,tenant_id,project_id,system_id,priority,first_response_minutes,resolution_minutes,business_hours_only,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)').bind(id,shwTenant,projectId,systemId,priority,first,resolution,0,now,now).run();
  await shwAudit(shwTenant,'sla_policy',id,'create',{projectId,systemId,priority,first,resolution});await logEvent(env,user,'service-hub:sla-criar',id,priority);
  return json({ok:true,id},201);
}

if(path==='service-hub/tickets'&&request.method==='GET'){
  if(!shwCanRead)return json({error:'Sem permissão para visualizar chamados'},403);
  const args=[shwTenant],where=['tenant_id=?'];const project=shwClean(url.searchParams.get('projectId'),120),status=shwOne(url.searchParams.get('status'),shwStatuses),priority=shwOne(url.searchParams.get('priority'),shwPriorities);
  if(project){where.push('project_id=?');args.push(project)}if(status){where.push('status=?');args.push(status)}if(priority){where.push('priority=?');args.push(priority)}
  const rows=(await DB.prepare(`SELECT id,ticket_key,tenant_id,project_id,system_id,channel_id,external_ticket_id,source,message_type,priority,status,title,assigned_to,sla_policy_id,first_response_due_at,resolution_due_at,first_responded_at,resolved_at,created_at,updated_at FROM service_hub_tickets WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 200`).bind(...args).all()).results||[];
  return json(rows);
}

if(path==='service-hub/tickets'&&request.method==='POST'){
  if(!shwCanCreateTicket)return json({error:'Sem permissão para abrir chamado'},403);
  const b=await shwBody(),projectId=shwClean(b.projectId,120),systemId=shwClean(b.systemId,160)||null,channelId=shwClean(b.channelId,160)||null,source=shwOne(b.source||'manual',shwSource),type=shwOne(b.messageType||'request',shwTypes),priority=shwOne(b.priority||'normal',shwPriorities),title=shwRedact(shwClean(b.title,220)).slice(0,220);
  if(!projectId||!source||!type||!priority||!title)return json({error:'Dados obrigatórios do chamado inválidos'},400);
  if(!(await shwProject(projectId,shwTenant)))return json({error:'Projeto inválido para a empresa'},400);
  if(systemId){const s=await shwSystem(systemId,shwTenant);if(!s||String(s.project_id)!==String(projectId))return json({error:'Sistema inválido para o projeto'},400)}
  if(channelId){const c=await shwChannel(channelId,shwTenant);if(!c||String(c.project_id)!==String(projectId))return json({error:'Canal inválido para o projeto'},400)}
  const now=new Date().toISOString(),id=shwId('tkt'),key=shwTicketKey(),desc=shwRedact(b.description),sla=await DB.prepare('SELECT id,first_response_minutes,resolution_minutes,business_hours_only FROM service_hub_sla_policies WHERE tenant_id=? AND priority=? AND active=1 AND (project_id IS NULL OR project_id=?) AND (system_id IS NULL OR system_id=?) ORDER BY (project_id IS NOT NULL) DESC,(system_id IS NOT NULL) DESC,updated_at DESC LIMIT 1').bind(shwTenant,priority,projectId,systemId).first();
  if(sla&&Number(sla.business_hours_only)===1)return json({error:'SLA em horário comercial ainda não suportado'},409);
  const firstDue=sla?shwAddMin(now,sla.first_response_minutes):null,resDue=sla?shwAddMin(now,sla.resolution_minutes):null;
  await DB.prepare('INSERT INTO service_hub_tickets(id,ticket_key,tenant_id,project_id,system_id,channel_id,external_ticket_id,source,message_type,priority,status,title,description_redacted,assigned_to,sla_policy_id,first_response_due_at,resolution_due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,key,shwTenant,projectId,systemId,channelId,shwClean(b.externalTicketId,180)||null,source,type,priority,'new',title,desc,shwClean(b.assignedTo,180)||null,sla?.id||null,firstDue,resDue,now,now).run();
  await shwEvent(shwTenant,id,'ticket.created',{source,type,priority});await shwAudit(shwTenant,'ticket',id,'create',{ticketKey:key,projectId,systemId,channelId,source,type,priority});await logEvent(env,user,'service-hub:chamado-criar',id,key+' · '+title);
  return json({ok:true,id,ticket_key:key,status:'new',first_response_due_at:firstDue,resolution_due_at:resDue},201);
}

if(path.match(/^service-hub\/tickets\/[^/]+$/)&&request.method==='GET'){
  if(!shwCanRead)return json({error:'Sem permissão para visualizar chamado'},403);
  const id=decodeURIComponent(path.split('/')[2]),ticket=await shwTicket(id,shwTenant);if(!ticket)return json({error:'Chamado não encontrado'},404);return json(ticket);
}

if(path.match(/^service-hub\/tickets\/[^/]+\/events$/)&&request.method==='GET'){
  if(!shwCanRead)return json({error:'Sem permissão para visualizar histórico'},403);
  const id=decodeURIComponent(path.split('/')[2]),ticket=await shwTicket(id,shwTenant);if(!ticket)return json({error:'Chamado não encontrado'},404);
  const rows=(await DB.prepare('SELECT id,ticket_id,tenant_id,event_type,actor_type,actor_ref,payload_json,created_at FROM service_hub_ticket_events WHERE ticket_id=? AND tenant_id=? ORDER BY created_at ASC LIMIT 500').bind(id,shwTenant).all()).results||[];return json(rows);
}

if(path.match(/^service-hub\/tickets\/[^/]+\/status$/)&&request.method==='POST'){
  if(!shwCanManage)return json({error:'Sem permissão para atualizar chamado'},403);
  const id=decodeURIComponent(path.split('/')[2]),old=await shwTicket(id,shwTenant);if(!old)return json({error:'Chamado não encontrado'},404);
  const b=await shwBody(),status=shwOne(b.status,shwStatuses);if(!status)return json({error:'Status inválido'},400);
  const now=new Date().toISOString(),assigned=shwClean(b.assignedTo,180)||null,resolved=(status==='resolved'||status==='closed')?now:(old.resolved_at||null),firstResponded=old.first_responded_at||((status!=='new'&&status!=='cancelled')?now:null),note=shwRedact(b.note).slice(0,4000);
  await DB.prepare("UPDATE service_hub_tickets SET status=?,assigned_to=COALESCE(?,assigned_to),first_responded_at=?,resolved_at=?,updated_at=? WHERE id=? AND tenant_id=?").bind(status,assigned,firstResponded,resolved,now,id,shwTenant).run();
  await shwEvent(shwTenant,id,'ticket.status_changed',{from:old.status,to:status,note,firstResponseRecorded:!old.first_responded_at&&!!firstResponded});await shwAudit(shwTenant,'ticket',id,'status_change',{from:old.status,to:status});await logEvent(env,user,'service-hub:chamado-status',id,old.status+' → '+status);
  return json({ok:true,id,status,updated_at:now,first_responded_at:firstResponded,resolved_at:resolved});
}
