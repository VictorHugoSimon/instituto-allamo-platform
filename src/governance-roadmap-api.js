// Governança do Roadmap — agendas, reuniões, stakeholders, pautas, decisões e demandas.
const grWrite=['admin','pmo','techlead','gestor'].includes(user.role);
const grScope=id=>!scope||String(id)===String(scope);
const grEventTypes=['AGENDA','REUNIAO','COMITE','WORKSHOP','CHECKPOINT','GO_LIVE','HYPERCARE'];
const grEventStatuses=['PLANEJADA','CONFIRMADA','REALIZADA','CANCELADA'];
const grAgendaStatuses=['ABERTA','EM_ANDAMENTO','CONCLUIDA','CANCELADA'];
const grStakeholderTypes=['INTERNO','CLIENTE','TERCEIRO','PMO'];
const grAttendance=['CONVIDADO','CONFIRMADO','PRESENTE','AUSENTE'];
const grRelationTypes=['DEMANDA','ACAO','DECISAO','DEPENDENCIA'];
const grDecisionStatuses=['ABERTA','EM_ANDAMENTO','CONCLUIDA','CANCELADA'];
const grId=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
const grBool=v=>v===false||v===0||v==='0'?0:1;
const grCompany=async id=>DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(id).first();
const grProject=async id=>DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(id).first();
const grReport=async id=>DB.prepare('SELECT id,company_id,project_id,title FROM report_records WHERE id=? AND archived_at IS NULL').bind(id).first();
const grRoad=async id=>DB.prepare('SELECT id,company_id,project_id,report_id,title FROM report_roadmap_items WHERE id=? AND archived_at IS NULL').bind(id).first();
const grWork=async id=>DB.prepare('SELECT id,company_id,project_id,title,status,owner,due_date,item_type FROM work_items WHERE id=? AND archived_at IS NULL').bind(id).first();
const grEvent=async id=>DB.prepare('SELECT * FROM governance_events WHERE id=? AND archived_at IS NULL').bind(id).first();
const grValidateContext=async(companyId,projectId)=>{
  if(!companyId)return 'Empresa é obrigatória';
  if(projectId==null||projectId==='')return 'Projeto é obrigatório';
  const c=await grCompany(companyId);if(!c)return 'Empresa não encontrada';if(!grScope(companyId))return 'Fora do escopo';
  const p=await grProject(projectId);if(!p)return 'Projeto não encontrado';if(String(p.company_id)!==String(companyId))return 'O projeto não pertence à empresa selecionada';
  return '';
};
const grValidateRefs=async(b,companyId,projectId)=>{
  if(b.report_id){const r=await grReport(b.report_id);if(!r)return 'Report não encontrado';if(String(r.company_id)!==String(companyId)||String(r.project_id||'')!==String(projectId||''))return 'Report pertence a outro contexto'}
  if(b.roadmap_item_id){const m=await grRoad(b.roadmap_item_id);if(!m)return 'Item de roadmap não encontrado';if(String(m.company_id)!==String(companyId)||String(m.project_id||'')!==String(projectId||''))return 'Item de roadmap pertence a outro contexto'}
  return '';
};
const grLoadDetail=async ev=>{
  const [agenda,stakeholders,work,decisions]=await Promise.all([
    DB.prepare('SELECT * FROM governance_event_agenda_items WHERE event_id=? AND archived_at IS NULL ORDER BY rank ASC,created_at ASC').bind(ev.id).all(),
    DB.prepare('SELECT * FROM governance_event_stakeholders WHERE event_id=? AND archived_at IS NULL ORDER BY name ASC').bind(ev.id).all(),
    DB.prepare("SELECT l.*,w.title AS work_title,w.status AS work_status,w.owner AS work_owner,w.due_date AS work_due_date,w.item_type AS work_type FROM governance_event_work_links l LEFT JOIN work_items w ON w.id=l.work_item_id AND w.archived_at IS NULL WHERE l.event_id=? AND l.archived_at IS NULL ORDER BY l.created_at ASC").bind(ev.id).all(),
    DB.prepare('SELECT * FROM governance_event_decisions WHERE event_id=? AND archived_at IS NULL ORDER BY due_date ASC,created_at ASC').bind(ev.id).all()
  ]);
  return {...ev,agenda_items:agenda.results||[],stakeholders:stakeholders.results||[],work_links:work.results||[],decisions:decisions.results||[]};
};

if(path==='governance-events'&&request.method==='GET'){
  const where=['archived_at IS NULL'],args=[];
  if(scope){where.push('company_id=?');args.push(scope)}
  for(const [q,col] of [['company','company_id'],['project','project_id'],['report','report_id'],['status','status'],['type','event_type'],['area','area'],['sector','sector']]){const v=url.searchParams.get(q);if(v){where.push(col+'=?');args.push(v)}}
  const from=url.searchParams.get('from'),to=url.searchParams.get('to');if(from){where.push('COALESCE(start_at,created_at)>=?');args.push(from)}if(to){where.push('COALESCE(start_at,created_at)<=?');args.push(to)}
  const rows=(await DB.prepare('SELECT * FROM governance_events WHERE '+where.join(' AND ')+' ORDER BY CASE WHEN start_at IS NULL THEN 1 ELSE 0 END,start_at ASC,created_at DESC').bind(...args).all()).results||[];
  return json(rows);
}

if(path==='governance-events'&&request.method==='POST'){
  if(!grWrite)return json({error:'Sem permissão para criar agenda/reunião'},403);
  const b=await request.json();if(!String(b.title||'').trim())return json({error:'Título é obrigatório'},400);
  const ctx=await grValidateContext(b.company_id,b.project_id);if(ctx)return json({error:ctx},400);
  const refs=await grValidateRefs(b,b.company_id,b.project_id);if(refs)return json({error:refs},400);
  const type=String(b.event_type||'REUNIAO').toUpperCase(),status=String(b.status||'PLANEJADA').toUpperCase();
  if(!grEventTypes.includes(type))return json({error:'Tipo de evento inválido'},400);if(!grEventStatuses.includes(status))return json({error:'Status inválido'},400);
  const id=grId('GOV');
  await DB.prepare('INSERT INTO governance_events(id,company_id,project_id,report_id,roadmap_item_id,event_type,title,description,area,sector,start_at,end_at,location,meeting_url,recurrence_rule,status,minutes_summary,decisions_summary,client_visible,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,b.company_id,b.project_id,b.report_id||null,b.roadmap_item_id||null,type,String(b.title).trim(),b.description||'',b.area||'',b.sector||'',b.start_at||null,b.end_at||null,b.location||'',b.meeting_url||'',b.recurrence_rule||'',status,b.minutes_summary||'',b.decisions_summary||'',grBool(b.client_visible),user.name,user.name).run();
  await logEvent(env,user,'governance-event:criar',id,String(b.title).trim());return json({ok:true,id},201);
}

if(path.match(/^governance-events\/[^/]+$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),ev=await grEvent(id);if(!ev)return json({error:'Evento não encontrado'},404);if(!grScope(ev.company_id))return json({error:'Fora do escopo'},403);return json(await grLoadDetail(ev));
}

if(path.match(/^governance-events\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await grEvent(id);if(!old)return json({error:'Evento não encontrado'},404);if(!grScope(old.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();
  const companyId=Object.prototype.hasOwnProperty.call(b,'company_id')?b.company_id:old.company_id,projectId=Object.prototype.hasOwnProperty.call(b,'project_id')?b.project_id:old.project_id;
  const ctx=await grValidateContext(companyId,projectId);if(ctx)return json({error:ctx},400);const refs=await grValidateRefs({...old,...b},companyId,projectId);if(refs)return json({error:refs},400);
  if(b.event_type&&!grEventTypes.includes(String(b.event_type).toUpperCase()))return json({error:'Tipo inválido'},400);if(b.status&&!grEventStatuses.includes(String(b.status).toUpperCase()))return json({error:'Status inválido'},400);if(Object.prototype.hasOwnProperty.call(b,'title')&&!String(b.title||'').trim())return json({error:'Título é obrigatório'},400);
  const fields=['company_id','project_id','report_id','roadmap_item_id','title','description','area','sector','start_at','end_at','location','meeting_url','recurrence_rule','minutes_summary','decisions_summary'],sets=[],args=[];
  for(const f of fields)if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='title'?String(b[f]).trim():b[f])}
  if(Object.prototype.hasOwnProperty.call(b,'event_type')){sets.push('event_type=?');args.push(String(b.event_type).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'status')){sets.push('status=?');args.push(String(b.status).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'client_visible')){sets.push('client_visible=?');args.push(grBool(b.client_visible))}
  if(sets.length){sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE governance_events SET '+sets.join(',')+' WHERE id=?').bind(...args).run()}
  await logEvent(env,user,'governance-event:editar',id,Object.keys(b).join(','));return json({ok:true,id});
}

if(path.match(/^governance-events\/[^/]+$/)&&request.method==='DELETE'){
  if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),ev=await grEvent(id);if(!ev)return json({error:'Evento não encontrado'},404);if(!grScope(ev.company_id))return json({error:'Fora do escopo'},403);
  await DB.prepare("UPDATE governance_events SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();await logEvent(env,user,'governance-event:arquivar',id,ev.title);return json({ok:true});
}

const grParent=async eventId=>{const ev=await grEvent(eventId);if(!ev)return {error:'Evento não encontrado'};if(!grScope(ev.company_id))return {error:'Fora do escopo',status:403};return {ev}};

if(path.match(/^governance-events\/[^/]+\/agenda$/)&&request.method==='POST'){
  if(!grWrite)return json({error:'Sem permissão'},403);const eventId=decodeURIComponent(path.split('/')[1]),p=await grParent(eventId);if(p.error)return json({error:p.error},p.status||404);const b=await request.json();if(!String(b.title||'').trim())return json({error:'Título da pauta é obrigatório'},400);const st=String(b.status||'ABERTA').toUpperCase();if(!grAgendaStatuses.includes(st))return json({error:'Status da pauta inválido'},400);const id=grId('GAG');await DB.prepare('INSERT INTO governance_event_agenda_items(id,event_id,company_id,project_id,title,description,area,owner_name,status,rank,client_visible,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,eventId,p.ev.company_id,p.ev.project_id,String(b.title).trim(),b.description||'',b.area||'',b.owner_name||'',st,b.rank??Date.now(),grBool(b.client_visible),user.name,user.name).run();return json({ok:true,id},201);
}
if(path.match(/^governance-agenda\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_agenda_items WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Pauta não encontrada'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();if(b.status&&!grAgendaStatuses.includes(String(b.status).toUpperCase()))return json({error:'Status inválido'},400);const sets=[],args=[];for(const f of ['title','description','area','owner_name','rank'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='title'?String(b[f]||'').trim():b[f])}if(Object.prototype.hasOwnProperty.call(b,'status')){sets.push('status=?');args.push(String(b.status).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'client_visible')){sets.push('client_visible=?');args.push(grBool(b.client_visible))}if(sets.length){sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE governance_event_agenda_items SET '+sets.join(',')+' WHERE id=?').bind(...args).run()}return json({ok:true,id});
}
if(path.match(/^governance-agenda\/[^/]+$/)&&request.method==='DELETE'){if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_agenda_items WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Pauta não encontrada'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE governance_event_agenda_items SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();return json({ok:true})}

if(path.match(/^governance-events\/[^/]+\/stakeholders$/)&&request.method==='POST'){
  if(!grWrite)return json({error:'Sem permissão'},403);const eventId=decodeURIComponent(path.split('/')[1]),p=await grParent(eventId);if(p.error)return json({error:p.error},p.status||404);const b=await request.json();if(!String(b.name||'').trim())return json({error:'Nome do stakeholder é obrigatório'},400);const type=String(b.stakeholder_type||'INTERNO').toUpperCase(),att=String(b.attendance_status||'CONVIDADO').toUpperCase();if(!grStakeholderTypes.includes(type)||!grAttendance.includes(att))return json({error:'Tipo/status de stakeholder inválido'},400);const id=grId('GST');await DB.prepare('INSERT INTO governance_event_stakeholders(id,event_id,company_id,project_id,stakeholder_type,name,email,role_name,area,attendance_status,client_visible,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,eventId,p.ev.company_id,p.ev.project_id,type,String(b.name).trim(),b.email||'',b.role_name||'',b.area||'',att,grBool(b.client_visible),user.name,user.name).run();return json({ok:true,id},201);
}
if(path.match(/^governance-stakeholders\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_stakeholders WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Stakeholder não encontrado'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();if(b.stakeholder_type&&!grStakeholderTypes.includes(String(b.stakeholder_type).toUpperCase()))return json({error:'Tipo inválido'},400);if(b.attendance_status&&!grAttendance.includes(String(b.attendance_status).toUpperCase()))return json({error:'Presença inválida'},400);const sets=[],args=[];for(const f of ['name','email','role_name','area'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='name'?String(b[f]||'').trim():b[f])}if(Object.prototype.hasOwnProperty.call(b,'stakeholder_type')){sets.push('stakeholder_type=?');args.push(String(b.stakeholder_type).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'attendance_status')){sets.push('attendance_status=?');args.push(String(b.attendance_status).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'client_visible')){sets.push('client_visible=?');args.push(grBool(b.client_visible))}if(sets.length){sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE governance_event_stakeholders SET '+sets.join(',')+' WHERE id=?').bind(...args).run()}return json({ok:true,id});
}
if(path.match(/^governance-stakeholders\/[^/]+$/)&&request.method==='DELETE'){if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_stakeholders WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Stakeholder não encontrado'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE governance_event_stakeholders SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();return json({ok:true})}

if(path.match(/^governance-events\/[^/]+\/work-links$/)&&request.method==='POST'){
  if(!grWrite)return json({error:'Sem permissão'},403);const eventId=decodeURIComponent(path.split('/')[1]),p=await grParent(eventId);if(p.error)return json({error:p.error},p.status||404);const b=await request.json(),w=await grWork(b.work_item_id);if(!w)return json({error:'Demanda/Tarefa não encontrada'},404);if(String(w.company_id)!==String(p.ev.company_id)||String(w.project_id||'')!==String(p.ev.project_id||''))return json({error:'A demanda/tarefa pertence a outro tenant/projeto'},400);const rt=String(b.relation_type||'DEMANDA').toUpperCase();if(!grRelationTypes.includes(rt))return json({error:'Relação inválida'},400);const id=grId('GWL');try{await DB.prepare('INSERT INTO governance_event_work_links(id,event_id,company_id,project_id,work_item_id,relation_type,client_visible,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,eventId,p.ev.company_id,p.ev.project_id,w.id,rt,grBool(b.client_visible),user.name).run()}catch(e){return json({error:'Demanda já vinculada com esta relação'},409)}return json({ok:true,id},201);
}
if(path.match(/^governance-work-links\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_work_links WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Vínculo não encontrado'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();if(b.relation_type&&!grRelationTypes.includes(String(b.relation_type).toUpperCase()))return json({error:'Relação inválida'},400);await DB.prepare("UPDATE governance_event_work_links SET relation_type=COALESCE(?,relation_type),client_visible=COALESCE(?,client_visible) WHERE id=?").bind(b.relation_type?String(b.relation_type).toUpperCase():null,Object.prototype.hasOwnProperty.call(b,'client_visible')?grBool(b.client_visible):null,id).run();return json({ok:true,id})}
if(path.match(/^governance-work-links\/[^/]+$/)&&request.method==='DELETE'){if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_work_links WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Vínculo não encontrado'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE governance_event_work_links SET archived_at=datetime('now') WHERE id=?").bind(id).run();return json({ok:true})}

if(path.match(/^governance-events\/[^/]+\/decisions$/)&&request.method==='POST'){
  if(!grWrite)return json({error:'Sem permissão'},403);const eventId=decodeURIComponent(path.split('/')[1]),p=await grParent(eventId);if(p.error)return json({error:p.error},p.status||404);const b=await request.json();if(!String(b.title||'').trim())return json({error:'Título da decisão é obrigatório'},400);const st=String(b.status||'ABERTA').toUpperCase();if(!grDecisionStatuses.includes(st))return json({error:'Status inválido'},400);const id=grId('GDC');await DB.prepare('INSERT INTO governance_event_decisions(id,event_id,company_id,project_id,title,decision_text,owner_name,due_date,status,client_visible,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,eventId,p.ev.company_id,p.ev.project_id,String(b.title).trim(),b.decision_text||'',b.owner_name||'',b.due_date||null,st,grBool(b.client_visible),user.name,user.name).run();return json({ok:true,id},201);
}
if(path.match(/^governance-decisions\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_decisions WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Decisão não encontrada'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();if(b.status&&!grDecisionStatuses.includes(String(b.status).toUpperCase()))return json({error:'Status inválido'},400);const sets=[],args=[];for(const f of ['title','decision_text','owner_name','due_date'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='title'?String(b[f]||'').trim():b[f])}if(Object.prototype.hasOwnProperty.call(b,'status')){sets.push('status=?');args.push(String(b.status).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'client_visible')){sets.push('client_visible=?');args.push(grBool(b.client_visible))}if(sets.length){sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE governance_event_decisions SET '+sets.join(',')+' WHERE id=?').bind(...args).run()}return json({ok:true,id})}
if(path.match(/^governance-decisions\/[^/]+$/)&&request.method==='DELETE'){if(!grWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),x=await DB.prepare('SELECT * FROM governance_event_decisions WHERE id=? AND archived_at IS NULL').bind(id).first();if(!x)return json({error:'Decisão não encontrada'},404);if(!grScope(x.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE governance_event_decisions SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();return json({ok:true})}
