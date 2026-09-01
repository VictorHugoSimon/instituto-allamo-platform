import { redactServiceText } from './redact.mjs';

export function createServiceHubRepository(db) {
  if (!db?.prepare) throw new Error('d1_database_required');
  return {
    listSystems: (ctx, filters={}) => listSystems(db, ctx, filters),
    createSystem: (ctx, input) => createSystem(db, ctx, input),
    listChannels: (ctx, filters={}) => listChannels(db, ctx, filters),
    createChannel: (ctx, input) => createChannel(db, ctx, input),
    listSlaPolicies: (ctx, filters={}) => listSlaPolicies(db, ctx, filters),
    createSlaPolicy: (ctx, input) => createSlaPolicy(db, ctx, input),
    listTickets: (ctx, filters={}) => listTickets(db, ctx, filters),
    getTicket: (ctx, ticketId) => getTicket(db, ctx, ticketId),
    createTicket: (ctx, input) => createTicket(db, ctx, input),
    updateTicketStatus: (ctx, ticketId, input) => updateTicketStatus(db, ctx, ticketId, input),
    listTicketEvents: (ctx, ticketId) => listTicketEvents(db, ctx, ticketId)
  };
}

async function listSystems(db,ctx,filters){
  const tenant=tenantOf(ctx), binds=[tenant]; let where='tenant_id=?';
  if(filters.projectId){where+=' AND project_id=?';binds.push(clean(filters.projectId,120));}
  if(filters.active!==undefined){where+=' AND active=?';binds.push(filters.active?1:0);}
  const q=await db.prepare(`SELECT id,tenant_id,project_id,name,system_kind,lifecycle_phase,official_ticket_source,external_ref,active,created_at,updated_at FROM service_hub_systems WHERE ${where} ORDER BY updated_at DESC LIMIT 200`).bind(...binds).all();
  return q.results??[];
}

async function createSystem(db,ctx,input){
  const tenant=tenantOf(ctx), projectId=required(input.projectId,'project_id_required'), name=required(input.name,'system_name_required');
  const systemKind=one(input.systemKind,['sallamos','external','internal'],'invalid_system_kind');
  const phase=one(input.lifecyclePhase,['implementation','hypercare','production','support','closed'],'invalid_lifecycle_phase');
  const official=one(input.officialTicketSource,['sallamos','allamo','project_queue','manual'],'invalid_ticket_source');
  const id='sys:'+crypto.randomUUID(), now=new Date().toISOString();
  await db.prepare(`INSERT INTO service_hub_systems(id,tenant_id,project_id,name,system_kind,lifecycle_phase,official_ticket_source,external_ref,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)`).bind(id,tenant,projectId,name,systemKind,phase,official,clean(input.externalRef,300)||null,now,now).run();
  await audit(db,ctx,'system',id,'create',{projectId,name,systemKind,phase,official});
  return {id,tenantId:tenant,projectId,name,systemKind,lifecyclePhase:phase,officialTicketSource:official,active:true};
}

async function listChannels(db,ctx,filters){
  const tenant=tenantOf(ctx),binds=[tenant];let where='tenant_id=?';
  if(filters.projectId){where+=' AND project_id=?';binds.push(clean(filters.projectId,120));}
  if(filters.systemId){where+=' AND system_id=?';binds.push(clean(filters.systemId,160));}
  const q=await db.prepare(`SELECT id,tenant_id,project_id,system_id,provider,external_channel_id,name,active,created_at,updated_at FROM service_hub_channels WHERE ${where} ORDER BY updated_at DESC LIMIT 200`).bind(...binds).all();
  return q.results??[];
}

async function createChannel(db,ctx,input){
  const tenant=tenantOf(ctx),projectId=required(input.projectId,'project_id_required'),systemId=required(input.systemId,'system_id_required');
  await assertTenantEntity(db,'service_hub_systems',systemId,tenant,'system_not_found');
  const provider=one(input.provider,['whatsapp','sallamos','portal','email','api','other'],'invalid_channel_provider');
  const name=required(input.name,'channel_name_required'), external=clean(input.externalChannelId,300)||null;
  const id='chn:'+crypto.randomUUID(),now=new Date().toISOString();
  await db.prepare(`INSERT INTO service_hub_channels(id,tenant_id,project_id,system_id,provider,external_channel_id,name,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)`).bind(id,tenant,projectId,systemId,provider,external,name,now,now).run();
  await audit(db,ctx,'channel',id,'create',{projectId,systemId,provider,name});
  return {id,tenantId:tenant,projectId,systemId,provider,externalChannelId:external,name,active:true};
}

async function listSlaPolicies(db,ctx,filters){
  const tenant=tenantOf(ctx),binds=[tenant];let where='tenant_id=?';
  if(filters.projectId){where+=' AND project_id=?';binds.push(clean(filters.projectId,120));}
  const q=await db.prepare(`SELECT id,tenant_id,project_id,system_id,priority,first_response_minutes,resolution_minutes,business_hours_only,active,created_at,updated_at FROM service_hub_sla_policies WHERE ${where} ORDER BY priority,updated_at DESC LIMIT 200`).bind(...binds).all();
  return q.results??[];
}

async function createSlaPolicy(db,ctx,input){
  const tenant=tenantOf(ctx),priority=one(input.priority,['low','normal','medium','high','critical'],'invalid_priority');
  const first=positiveInt(input.firstResponseMinutes,'invalid_first_response_minutes'),resolution=positiveInt(input.resolutionMinutes,'invalid_resolution_minutes');
  const projectId=clean(input.projectId,120)||null,systemId=clean(input.systemId,160)||null;
  if(input.businessHoursOnly)throw httpError(400,'business_hours_sla_not_supported_in_mvp');
  if(systemId)await assertTenantEntity(db,'service_hub_systems',systemId,tenant,'system_not_found');
  const id='sla:'+crypto.randomUUID(),now=new Date().toISOString(),business=0;
  await db.prepare(`INSERT INTO service_hub_sla_policies(id,tenant_id,project_id,system_id,priority,first_response_minutes,resolution_minutes,business_hours_only,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)`).bind(id,tenant,projectId,systemId,priority,first,resolution,business,now,now).run();
  await audit(db,ctx,'sla_policy',id,'create',{projectId,systemId,priority,first,resolution,businessHoursOnly:false});
  return {id,tenantId:tenant,projectId,systemId,priority,firstResponseMinutes:first,resolutionMinutes:resolution,businessHoursOnly:false,active:true};
}

async function listTickets(db,ctx,filters){
  const tenant=tenantOf(ctx),binds=[tenant];let where='tenant_id=?';
  if(filters.projectId){where+=' AND project_id=?';binds.push(clean(filters.projectId,120));}
  if(filters.status){where+=' AND status=?';binds.push(one(filters.status,TICKET_STATUS,'invalid_ticket_status'));}
  if(filters.priority){where+=' AND priority=?';binds.push(one(filters.priority,PRIORITIES,'invalid_priority'));}
  const limit=Math.min(Math.max(Number(filters.limit)||50,1),200);
  binds.push(limit);
  const q=await db.prepare(`SELECT id,ticket_key,tenant_id,project_id,system_id,channel_id,external_ticket_id,source,message_type,priority,status,title,assigned_to,sla_policy_id,first_response_due_at,resolution_due_at,first_responded_at,resolved_at,created_at,updated_at FROM service_hub_tickets WHERE ${where} ORDER BY updated_at DESC LIMIT ?`).bind(...binds).all();
  return q.results??[];
}

async function getTicket(db,ctx,ticketId){
  const tenant=tenantOf(ctx),id=required(ticketId,'ticket_id_required');
  const row=await db.prepare(`SELECT * FROM service_hub_tickets WHERE id=? AND tenant_id=? LIMIT 1`).bind(id,tenant).first();
  if(!row)throw httpError(404,'ticket_not_found');
  return row;
}

async function createTicket(db,ctx,input){
  const tenant=tenantOf(ctx),projectId=required(input.projectId,'project_id_required');
  const systemId=clean(input.systemId,160)||null,channelId=clean(input.channelId,160)||null;
  if(systemId)await assertTenantEntity(db,'service_hub_systems',systemId,tenant,'system_not_found');
  if(channelId)await assertTenantEntity(db,'service_hub_channels',channelId,tenant,'channel_not_found');
  const source=one(input.source,['whatsapp','sallamos','portal','api','manual','valkiria'],'invalid_ticket_source');
  const messageType=one(input.messageType,['incident','request','change','blocker','question'],'invalid_ticket_message_type');
  const priority=one(input.priority??'normal',PRIORITIES,'invalid_priority'),title=required(input.title,'ticket_title_required');
  const sanitized=redactServiceText(input.description,12000), id='tkt:'+crypto.randomUUID(), ticketKey=buildTicketKey(),now=new Date().toISOString();
  const sla=await resolveSla(db,tenant,projectId,systemId,priority);
  if(sla&&Number(sla.business_hours_only)===1)throw httpError(409,'business_hours_sla_not_supported_in_mvp');
  const firstDue=sla?addMinutes(now,Number(sla.first_response_minutes)):null,resolutionDue=sla?addMinutes(now,Number(sla.resolution_minutes)):null;
  await db.prepare(`INSERT INTO service_hub_tickets(id,ticket_key,tenant_id,project_id,system_id,channel_id,external_ticket_id,source,message_type,priority,status,title,description_redacted,assigned_to,sla_policy_id,first_response_due_at,resolution_due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ticketKey,tenant,projectId,systemId,channelId,clean(input.externalTicketId,180)||null,source,messageType,priority,'new',title,sanitized.text,clean(input.assignedTo,180)||null,sla?.id??null,firstDue,resolutionDue,now,now).run();
  await addEvent(db,ctx,id,'ticket.created','system',{source,messageType,priority,redacted:sanitized.redacted});
  await audit(db,ctx,'ticket',id,'create',{ticketKey,projectId,systemId,channelId,source,messageType,priority});
  return {id,ticketKey,tenantId:tenant,projectId,systemId,channelId,source,messageType,priority,status:'new',title,slaPolicyId:sla?.id??null,firstResponseDueAt:firstDue,resolutionDueAt:resolutionDue,redacted:sanitized.redacted};
}

async function updateTicketStatus(db,ctx,ticketId,input){
  const tenant=tenantOf(ctx),id=required(ticketId,'ticket_id_required'),status=one(input.status,TICKET_STATUS,'invalid_ticket_status');
  const existing=await getTicket(db,ctx,id),now=new Date().toISOString();
  const resolved=(status==='resolved'||status==='closed') ? now : (existing.resolved_at ?? null);
  const assignedTo=clean(input.assignedTo,180) || existing.assigned_to || null;
  await db.prepare(`UPDATE service_hub_tickets SET status=?,assigned_to=COALESCE(?,assigned_to),resolved_at=?,updated_at=? WHERE id=? AND tenant_id=?`).bind(status,clean(input.assignedTo,180)||null,resolved,now,id,tenant).run();
  const note=redactServiceText(input.note,4000);
  await addEvent(db,ctx,id,'ticket.status_changed',ctx.actorType??'user',{from:existing.status,to:status,note:note.text,redacted:note.redacted});
  await audit(db,ctx,'ticket',id,'status_change',{from:existing.status,to:status});
  return {id,status,assignedTo,updatedAt:now,resolvedAt:resolved};
}

async function listTicketEvents(db,ctx,ticketId){
  const tenant=tenantOf(ctx),id=required(ticketId,'ticket_id_required');
  await getTicket(db,ctx,id);
  const q=await db.prepare(`SELECT id,ticket_id,tenant_id,event_type,actor_type,actor_ref,payload_json,created_at FROM service_hub_ticket_events WHERE ticket_id=? AND tenant_id=? ORDER BY created_at ASC LIMIT 500`).bind(id,tenant).all();
  return q.results??[];
}

async function resolveSla(db,tenant,projectId,systemId,priority){
  return await db.prepare(`SELECT id,first_response_minutes,resolution_minutes,business_hours_only FROM service_hub_sla_policies WHERE tenant_id=? AND priority=? AND active=1 AND (project_id IS NULL OR project_id=?) AND (system_id IS NULL OR system_id=?) ORDER BY (project_id IS NOT NULL) DESC,(system_id IS NOT NULL) DESC,updated_at DESC LIMIT 1`).bind(tenant,priority,projectId,systemId).first();
}

async function addEvent(db,ctx,ticketId,eventType,actorType,payload){
  await db.prepare(`INSERT INTO service_hub_ticket_events(id,ticket_id,tenant_id,event_type,actor_type,actor_ref,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind('evt:'+crypto.randomUUID(),ticketId,tenantOf(ctx),eventType,one(actorType,['user','client','valkiria','system','integration'],'invalid_actor_type'),clean(ctx.actorRef,180)||null,JSON.stringify(payload??{}).slice(0,12000),new Date().toISOString()).run();
}

async function audit(db,ctx,entityType,entityId,action,metadata){
  await db.prepare(`INSERT INTO service_hub_audit_log(id,tenant_id,entity_type,entity_id,action,actor_type,actor_ref,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind('aud:'+crypto.randomUUID(),tenantOf(ctx),entityType,entityId,action,clean(ctx.actorType,40)||'user',clean(ctx.actorRef,180)||null,JSON.stringify(metadata??{}).slice(0,12000),new Date().toISOString()).run();
}

async function assertTenantEntity(db,table,id,tenant,errorCode){
  const allowed=new Set(['service_hub_systems','service_hub_channels']); if(!allowed.has(table))throw new Error('unsafe_table');
  const row=await db.prepare(`SELECT id FROM ${table} WHERE id=? AND tenant_id=? LIMIT 1`).bind(id,tenant).first();
  if(!row)throw httpError(404,errorCode);
}

const PRIORITIES=['low','normal','medium','high','critical'];
const TICKET_STATUS=['new','triage','in_progress','waiting_customer','waiting_vendor','resolved','closed','cancelled'];
function tenantOf(ctx){const x=clean(ctx?.tenantId,120);if(!x)throw httpError(401,'tenant_required');return x;}
function required(v,code){const x=clean(v,500);if(!x)throw httpError(400,code);return x;}
function one(v,values,code){const x=clean(v,80).toLowerCase();if(!values.includes(x))throw httpError(400,code);return x;}
function positiveInt(v,code){const n=Number(v);if(!Number.isInteger(n)||n<=0||n>525600)throw httpError(400,code);return n;}
function clean(v,max=500){return String(v??'').trim().slice(0,max);}
function buildTicketKey(){return 'ALS-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();}
function addMinutes(iso,minutes){return new Date(new Date(iso).getTime()+minutes*60000).toISOString();}
export function httpError(status,message){const e=new Error(message);e.status=status;return e;}
