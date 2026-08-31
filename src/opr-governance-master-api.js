// OPR — Governança Mestre sobre a fonte canônica work_items + opr_action_meta.
// Este bloco é injetado ANTES da API OPR legada para assumir somente as rotas
// que precisam do contrato mestre: PA-xxx sequencial, histórico/lixeira por PA,
// papéis completos, customizações completas, pendências e auditoria de completude.
const oprMasterWrite=['admin','pmo','gestor','techlead'].includes(user.role);
const oprMasterStatuses=['Planejado','Em andamento','Atrasado','Concluído'];
const oprMasterCadenceStatuses=['Realizada','Planejada','A confirmar','Cancelada','Não realizada'];
const oprMasterTriageStatuses=['Capturada','Em triagem','Aprovada','Rejeitada','Concluída'];
const oprMasterCustomStages=['Análise','Revisão','Aprovação','Desenvolvimento','Disponível para Teste','Validação','Aceite'];
const oprMasterAuditClasses=['COBERTO','INCLUÍDO NESTA AUDITORIA','COBERTO POR DECOMPOSIÇÃO','MARCO RASTREADO','PENDENTE DE VALIDAÇÃO'];
const oprMasterNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const oprMasterId=prefix=>prefix+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
const oprMasterToday=()=>new Date().toISOString().slice(0,10);
const oprMasterEffectiveStatus=(status,due)=>status!=='Concluído'&&due&&String(due)<oprMasterToday()?'Atrasado':status;
const oprMasterGenericStatus=s=>s==='Concluído'?'CONCLUÍDO':(s==='Planejado'?'A FAZER':'EM ANDAMENTO');
const oprMasterCanScope=companyId=>!scope||String(scope)===String(companyId);
const oprMasterProjectContext=async projectId=>{
  if(!projectId&&projectId!==0)return {error:'Projeto OPR é obrigatório'};
  const row=await DB.prepare(`SELECT p.id project_id,p.name project_name,p.company_id,c.name company_name FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.id=?`).bind(projectId).first();
  if(!row)return {error:'Projeto não encontrado'};
  if(!oprMasterCanScope(row.company_id))return {error:'Projeto fora do escopo do usuário'};
  if(!oprMasterNorm(row.company_name).includes('opr'))return {error:'Este endpoint aceita exclusivamente projetos da OPR'};
  return row;
};
const oprMasterTakeNumber=async ctx=>{
  await DB.prepare(`INSERT OR IGNORE INTO opr_action_sequence(project_id,company_id,next_value,updated_at) VALUES(?,?,1,datetime('now'))`).bind(ctx.project_id,ctx.company_id).run();
  const r=await DB.prepare(`UPDATE opr_action_sequence SET next_value=next_value+1,updated_at=datetime('now') WHERE project_id=? RETURNING next_value-1 AS n`).bind(ctx.project_id).first();
  const n=Number(r?.n||0);if(!n)throw new Error('Falha ao reservar ID sequencial do Plano de Ação');
  return 'PA-'+String(n).padStart(3,'0');
};
const oprMasterEnsureDisplayIds=async ctx=>{
  await DB.prepare(`INSERT OR IGNORE INTO opr_action_sequence(project_id,company_id,next_value,updated_at) VALUES(?,?,1,datetime('now'))`).bind(ctx.project_id,ctx.company_id).run();
  const mx=await DB.prepare(`SELECT MAX(CAST(SUBSTR(display_id,4) AS INTEGER)) max_n FROM opr_action_meta WHERE project_id=? AND display_id GLOB 'PA-[0-9]*'`).bind(ctx.project_id).first();
  const maxN=Number(mx?.max_n||0),seq=await DB.prepare(`SELECT next_value FROM opr_action_sequence WHERE project_id=?`).bind(ctx.project_id).first();
  if(Number(seq?.next_value||1)<=maxN)await DB.prepare(`UPDATE opr_action_sequence SET next_value=?,updated_at=datetime('now') WHERE project_id=?`).bind(maxN+1,ctx.project_id).run();
  const missing=(await DB.prepare(`SELECT w.id FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND (m.display_id IS NULL OR m.display_id='') ORDER BY w.created_at,w.rank,w.id`).bind(ctx.project_id).all()).results||[];
  for(const row of missing){const pa=await oprMasterTakeNumber(ctx);await DB.prepare(`UPDATE opr_action_meta SET display_id=?,updated_at=datetime('now') WHERE work_item_id=? AND (display_id IS NULL OR display_id='')`).bind(pa,row.id).run()}
};
const oprMasterResolveActionId=async(ref,projectId=null)=>{
  const raw=String(ref||'').trim();if(!raw)return null;
  if(/^PA-\d+$/i.test(raw)){
    const row=projectId==null
      ?await DB.prepare(`SELECT work_item_id FROM opr_action_meta WHERE UPPER(display_id)=UPPER(?)`).bind(raw).first()
      :await DB.prepare(`SELECT work_item_id FROM opr_action_meta WHERE project_id=? AND UPPER(display_id)=UPPER(?)`).bind(projectId,raw).first();
    return row?.work_item_id||null;
  }
  return raw;
};
const oprMasterActionRow=async(ref,includeArchived=false)=>{
  const id=await oprMasterResolveActionId(ref);if(!id)return null;
  return DB.prepare(`SELECT w.id work_item_id,w.company_id,w.project_id,w.item_type,w.title action,w.description,w.priority,w.owner responsible,w.reporter,w.start_date,w.due_date,w.blocked,w.blocked_reason,w.created_at,w.updated_at,w.archived_at,m.display_id,m.front,m.plan_status status,m.dependency,m.impact,m.critical_path,m.next_step,m.evidence,m.source,m.version FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.id=? ${includeArchived?'':'AND w.archived_at IS NULL'}`).bind(id).first();
};
const oprMasterSnapshot=async ref=>{const x=await oprMasterActionRow(ref,true);return x?JSON.stringify(x):'{}'};
const oprMasterHistory=async(item,actionType,version)=>{
  if(!item)return;const snap=await oprMasterSnapshot(item.work_item_id);
  await DB.prepare(`INSERT INTO opr_action_history(company_id,project_id,work_item_id,action_type,version,actor,snapshot_json) VALUES(?,?,?,?,?,?,?)`).bind(item.company_id,item.project_id,item.work_item_id,actionType,version||item.version||1,user.name||'',snap).run();
};
const oprMasterRefreshOverdue=async ctx=>{
  const rows=(await DB.prepare(`SELECT w.id,m.version FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND w.archived_at IS NULL AND m.plan_status NOT IN ('Concluído','Atrasado') AND w.due_date IS NOT NULL AND w.due_date<>'' AND w.due_date<date('now')`).bind(ctx.project_id).all()).results||[];
  for(const r of rows){const before=await oprMasterActionRow(r.id);const next=Number(r.version||1)+1;await DB.prepare(`UPDATE opr_action_meta SET plan_status='Atrasado',version=?,updated_at=datetime('now') WHERE work_item_id=?`).bind(next,r.id).run();await DB.prepare(`UPDATE work_items SET status='EM ANDAMENTO',updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(user.name||'',r.id).run();const after=await oprMasterActionRow(r.id);await oprMasterHistory(after,'UPDATE',next);try{await logEvent(env,user,'opr-action:auto-atrasado',after?.display_id||r.id,before?.due_date||'')}catch{}}
};
const oprMasterCreateAction=async(ctx,b,historyType='INSERT')=>{
  const title=String(b.action||b.title||'').trim();if(!title)throw new Error('Ação é obrigatória');
  await oprMasterEnsureDisplayIds(ctx);
  let ps=String(b.plan_status||b.status||'Planejado');if(!oprMasterStatuses.includes(ps))ps='Planejado';ps=oprMasterEffectiveStatus(ps,b.due_date||null);
  const workId=oprMasterId('OPR-ACT-'),displayId=await oprMasterTakeNumber(ctx),owner=String(b.owner||b.responsible||'').trim()||'PENDENTE DE VALIDAÇÃO';
  await DB.prepare(`INSERT INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,reporter,start_date,due_date,rank,labels,blocked,blocked_reason,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(workId,ctx.company_id,ctx.project_id,ctx.project_name,'AÇÃO',title,b.description||'',oprMasterGenericStatus(ps),b.priority||'Média',owner,user.name||'',b.start_date||null,b.due_date||null,Date.now(),JSON.stringify(['OPR','PLANO_PMO']),b.blocked?1:0,b.blocked_reason||'',user.name||'',user.name||'').run();
  await DB.prepare(`INSERT INTO opr_action_meta(work_item_id,company_id,project_id,display_id,front,plan_status,dependency,impact,critical_path,next_step,evidence,source,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(workId,ctx.company_id,ctx.project_id,displayId,b.front||'',ps,b.dependency||'',b.impact||'',b.critical_path?1:0,b.next_step||'',b.evidence||'',b.source||'').run();
  const item=await oprMasterActionRow(workId);await oprMasterHistory(item,historyType,1);try{await logEvent(env,user,'opr-action:criar',displayId,title)}catch{}
  return {work_item_id:workId,display_id:displayId};
};

// ===== Plano Mestre: contrato externo usa PA-xxx; work_item_id permanece interno. =====
if(path==='opr-actions'&&request.method==='GET'){
  const ctx=await oprMasterProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprMasterEnsureDisplayIds(ctx);await oprMasterRefreshOverdue(ctx);
  const trash=url.searchParams.get('trash')==='1';const rows=(await DB.prepare(`SELECT w.id work_item_id,w.company_id,w.project_id,w.item_type,w.title action,w.description,w.priority,w.owner responsible,w.start_date,w.due_date,w.blocked,w.blocked_reason,w.created_at,w.updated_at,w.archived_at,m.display_id,m.front,m.plan_status status,m.dependency,m.impact,m.critical_path,m.next_step,m.evidence,m.source,m.version FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND ${trash?'w.archived_at IS NOT NULL':'w.archived_at IS NULL'} ORDER BY CAST(SUBSTR(m.display_id,4) AS INTEGER),w.created_at`).bind(ctx.project_id).all()).results||[];
  return json(rows.map(r=>({...r,id:r.display_id||r.work_item_id,status:oprMasterEffectiveStatus(r.status,r.due_date)})));
}
if(path==='opr-actions'&&request.method==='POST'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprMasterProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);
  try{const x=await oprMasterCreateAction(ctx,b);return json({ok:true,id:x.display_id,work_item_id:x.work_item_id},201)}catch(e){return json({error:e.message||'Falha ao criar ação'},400)}
}
if(path.match(/^opr-actions\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const ref=decodeURIComponent(path.split('/')[1]),id=await oprMasterResolveActionId(ref),old=await oprMasterActionRow(id);if(!old)return json({error:'Ação não encontrada'},404);const ctx=await oprMasterProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));
  let ps=Object.prototype.hasOwnProperty.call(b,'status')?String(b.status):old.status;if(!oprMasterStatuses.includes(ps))return json({error:'Status inválido'},400);const due=Object.prototype.hasOwnProperty.call(b,'due_date')?b.due_date:old.due_date;ps=oprMasterEffectiveStatus(ps,due);
  const wf=[],wa=[];for(const [k,col] of [['action','title'],['description','description'],['priority','priority'],['responsible','owner'],['start_date','start_date'],['due_date','due_date'],['blocked','blocked'],['blocked_reason','blocked_reason']])if(Object.prototype.hasOwnProperty.call(b,k)){wf.push(col+'=?');wa.push(k==='blocked'?(b[k]?1:0):b[k])}
  if(Object.prototype.hasOwnProperty.call(b,'status')||ps!==old.status){wf.push('status=?');wa.push(oprMasterGenericStatus(ps))}
  if(wf.length){wf.push("updated_at=datetime('now')","updated_by=?");wa.push(user.name||'',id);await DB.prepare('UPDATE work_items SET '+wf.join(',')+' WHERE id=?').bind(...wa).run()}
  const mf=[],ma=[];for(const [k,col] of [['front','front'],['dependency','dependency'],['impact','impact'],['critical_path','critical_path'],['next_step','next_step'],['evidence','evidence'],['source','source']])if(Object.prototype.hasOwnProperty.call(b,k)){mf.push(col+'=?');ma.push(k==='critical_path'?(b[k]?1:0):b[k])}
  if(ps!==old.status||Object.prototype.hasOwnProperty.call(b,'status')){mf.push('plan_status=?');ma.push(ps)}
  const next=Number(old.version||1)+1;mf.push('version=?',"updated_at=datetime('now')");ma.push(next,id);await DB.prepare('UPDATE opr_action_meta SET '+mf.join(',')+' WHERE work_item_id=?').bind(...ma).run();const item=await oprMasterActionRow(id);await oprMasterHistory(item,'UPDATE',next);try{await logEvent(env,user,'opr-action:editar',item.display_id||id,Object.keys(b).join(','))}catch{}return json({ok:true,id:item.display_id,status:ps,version:next});
}
if(path.match(/^opr-actions\/[^/]+$/)&&request.method==='DELETE'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const ref=decodeURIComponent(path.split('/')[1]),id=await oprMasterResolveActionId(ref),item=await oprMasterActionRow(id);if(!item)return json({error:'Ação não encontrada'},404);const ctx=await oprMasterProjectContext(item.project_id);if(ctx.error)return json({error:ctx.error},403);const next=Number(item.version||1)+1;await DB.prepare(`UPDATE work_items SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(user.name||'',id).run();await DB.prepare(`UPDATE opr_action_meta SET version=?,updated_at=datetime('now') WHERE work_item_id=?`).bind(next,id).run();const archived=await oprMasterActionRow(id,true);await oprMasterHistory(archived,'SOFT_DELETE',next);return json({ok:true,id:archived.display_id});
}
if(path.match(/^opr-actions\/[^/]+\/restore$/)&&request.method==='POST'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const ref=decodeURIComponent(path.split('/')[1]),id=await oprMasterResolveActionId(ref),item=await oprMasterActionRow(id,true);if(!item)return json({error:'Ação não encontrada'},404);const ctx=await oprMasterProjectContext(item.project_id);if(ctx.error)return json({error:ctx.error},403);if(!item.archived_at)return json({ok:true,id:item.display_id});const next=Number(item.version||1)+1;await DB.prepare(`UPDATE work_items SET archived_at=NULL,updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(user.name||'',id).run();await DB.prepare(`UPDATE opr_action_meta SET version=?,updated_at=datetime('now') WHERE work_item_id=?`).bind(next,id).run();const restored=await oprMasterActionRow(id);await oprMasterHistory(restored,'RESTORE',next);return json({ok:true,id:restored.display_id});
}
if(path.match(/^opr-actions\/[^/]+\/history$/)&&request.method==='GET'){
  const ref=decodeURIComponent(path.split('/')[1]),id=await oprMasterResolveActionId(ref),item=await oprMasterActionRow(id,true);if(!item)return json({error:'Ação não encontrada'},404);const ctx=await oprMasterProjectContext(item.project_id);if(ctx.error)return json({error:ctx.error},403);const rows=(await DB.prepare(`SELECT id,action_type,version,actor,snapshot_json,created_at FROM opr_action_history WHERE work_item_id=? ORDER BY id DESC`).bind(id).all()).results||[];return json(rows.map(r=>({...r,action_id:item.display_id})));
}

// ===== Entrada de Demandas: PA relacionado visível, chave interna preservada. =====
if(path==='opr-intake'&&request.method==='GET'){
  const ctx=await oprMasterProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprMasterEnsureDisplayIds(ctx);const rows=(await DB.prepare(`SELECT i.*,m.display_id created_action_display_id FROM opr_intake i LEFT JOIN opr_action_meta m ON m.work_item_id=i.created_action_id WHERE i.project_id=? AND i.archived_at IS NULL ORDER BY i.created_at DESC`).bind(ctx.project_id).all()).results||[];return json(rows.map(r=>({...r,created_action_work_item_id:r.created_action_id,created_action_id:r.created_action_display_id||r.created_action_id||null})));
}
if(path.match(/^opr-intake\/[^/]+\/approve$/)&&request.method==='POST'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),i=await DB.prepare(`SELECT * FROM opr_intake WHERE id=? AND archived_at IS NULL`).bind(id).first();if(!i)return json({error:'Entrada não encontrada'},404);const ctx=await oprMasterProjectContext(i.project_id);if(ctx.error)return json({error:ctx.error},403);await oprMasterEnsureDisplayIds(ctx);
  if(i.created_action_id){const a=await oprMasterActionRow(i.created_action_id,true);return json({ok:true,action_id:a?.display_id||i.created_action_id,already_created:true})}
  const x=await oprMasterCreateAction(ctx,{action:i.demand,front:i.front,responsible:i.owner,due_date:i.due_date,plan_status:'Planejado',evidence:i.evidence,source:'Entrada de Demandas '+i.id,next_step:'Acompanhar demanda aprovada',impact:'A confirmar'});await DB.prepare(`UPDATE opr_intake SET triage_status='Aprovada',created_action_id=?,version=version+1,updated_at=datetime('now'),updated_by=? WHERE id=?`).bind(x.work_item_id,user.name||'',id).run();return json({ok:true,action_id:x.display_id},201);
}

// ===== Cadência: relacionamento usa PA no front e work_item_id no banco. =====
if(path==='opr-cadence'&&request.method==='GET'){
  const ctx=await oprMasterProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprMasterEnsureDisplayIds(ctx);const rows=(await DB.prepare(`SELECT c.*,m.display_id action_display_id FROM opr_cadence c LEFT JOIN opr_action_meta m ON m.work_item_id=c.action_id WHERE c.project_id=? AND c.archived_at IS NULL ORDER BY c.period,c.created_at`).bind(ctx.project_id).all()).results||[];return json(rows.map(r=>({...r,action_work_item_id:r.action_id,action_id:r.action_display_id||r.action_id||null})));
}
if(path==='opr-cadence'&&request.method==='POST'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprMasterProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);if(!String(b.agenda||'').trim())return json({error:'Agenda é obrigatória'},400);let st=String(b.status||'A confirmar');if(!oprMasterCadenceStatuses.includes(st))st='A confirmar';const actionId=b.action_id?await oprMasterResolveActionId(b.action_id,ctx.project_id):null,id=oprMasterId('OPR-AGD-');await DB.prepare(`INSERT INTO opr_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.company_id,ctx.project_id,b.period||'',String(b.agenda).trim(),b.objective||'',b.participants||'',st,b.result_next_step||'',actionId,b.source||'',user.name||'',user.name||'').run();return json({ok:true,id},201);
}
if(path.match(/^opr-cadence\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await DB.prepare(`SELECT * FROM opr_cadence WHERE id=? AND archived_at IS NULL`).bind(id).first();if(!old)return json({error:'Agenda não encontrada'},404);const ctx=await oprMasterProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));if(b.status&&!oprMasterCadenceStatuses.includes(b.status))return json({error:'Status inválido'},400);const sets=[],args=[];for(const f of ['period','agenda','objective','participants','status','result_next_step','source'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(b[f])}if(Object.prototype.hasOwnProperty.call(b,'action_id')){sets.push('action_id=?');args.push(b.action_id?await oprMasterResolveActionId(b.action_id,ctx.project_id):null)}if(!sets.length)return json({ok:true,id});sets.push('version=version+1',"updated_at=datetime('now')","updated_by=?");args.push(user.name||'',id);await DB.prepare('UPDATE opr_cadence SET '+sets.join(',')+' WHERE id=?').bind(...args).run();return json({ok:true,id});
}

// ===== Responsáveis por Papel =====
if(path==='opr-roles'&&request.method==='GET'){
  const ctx=await oprMasterProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);return json((await DB.prepare(`SELECT * FROM opr_role_assignments WHERE project_id=? ORDER BY scope_ref`).bind(ctx.project_id).all()).results||[]);
}
if(path==='opr-roles'&&request.method==='POST'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprMasterProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);const p='PENDENTE DE VALIDAÇÃO',scopeRef=String(b.scope_ref||b.front||'Projeto').trim()||'Projeto';await DB.prepare(`INSERT INTO opr_role_assignments(company_id,project_id,scope_ref,client_approver,key_user,operational_owner,functional_owner,technical_owner,development_owner,supplier,pmo,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,scope_ref) DO UPDATE SET client_approver=excluded.client_approver,key_user=excluded.key_user,operational_owner=excluded.operational_owner,functional_owner=excluded.functional_owner,technical_owner=excluded.technical_owner,development_owner=excluded.development_owner,supplier=excluded.supplier,pmo=excluded.pmo,version=opr_role_assignments.version+1,updated_at=datetime('now'),updated_by=excluded.updated_by`).bind(ctx.company_id,ctx.project_id,scopeRef,b.client_approver||p,b.key_user||p,b.operational_owner||p,b.functional_owner||p,b.technical_owner||p,b.development_owner||p,b.supplier||p,b.pmo||p,user.name||'',user.name||'').run();return json({ok:true});
}

// ===== Customizações / Desenvolvimentos =====
if(path==='opr-customizations'&&request.method==='GET'){
  const ctx=await oprMasterProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprMasterEnsureDisplayIds(ctx);const rows=(await DB.prepare(`SELECT c.*,m.display_id related_action_display_id FROM opr_customizations c LEFT JOIN opr_action_meta m ON m.work_item_id=c.related_action_id WHERE c.project_id=? AND c.archived_at IS NULL ORDER BY c.created_at`).bind(ctx.project_id).all()).results||[];return json(rows.map(r=>({...r,related_action_work_item_id:r.related_action_id,related_action_id:r.related_action_display_id||r.related_action_id||null})));
}
if(path==='opr-customizations'&&request.method==='POST'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprMasterProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);if(!String(b.subject||'').trim())return json({error:'Assunto é obrigatório'},400);let stage=String(b.situation||'Análise');if(!oprMasterCustomStages.includes(stage))stage='Análise';const p='PENDENTE DE VALIDAÇÃO',related=b.related_action_id?await oprMasterResolveActionId(b.related_action_id,ctx.project_id):null,id=oprMasterId('OPR-CUS-');await DB.prepare(`INSERT INTO opr_customizations(id,company_id,project_id,official_code,subject,situation,approval,validation_owner,key_user,functional_owner,technical_owner,development_owner,pmo,related_action_id,next_step,evidence,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.company_id,ctx.project_id,b.official_code||'',String(b.subject).trim(),stage,b.approval||p,b.validation_owner||p,b.key_user||p,b.functional_owner||p,b.technical_owner||p,b.development_owner||p,b.pmo||p,related,b.next_step||'',b.evidence||'',user.name||'',user.name||'').run();return json({ok:true,id},201);
}
if(path.match(/^opr-customizations\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await DB.prepare(`SELECT * FROM opr_customizations WHERE id=? AND archived_at IS NULL`).bind(id).first();if(!old)return json({error:'Customização não encontrada'},404);const ctx=await oprMasterProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));if(b.situation&&!oprMasterCustomStages.includes(b.situation))return json({error:'Etapa inválida'},400);const sets=[],args=[];for(const f of ['official_code','subject','situation','approval','validation_owner','key_user','functional_owner','technical_owner','development_owner','pmo','next_step','evidence'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(b[f])}if(Object.prototype.hasOwnProperty.call(b,'related_action_id')){sets.push('related_action_id=?');args.push(b.related_action_id?await oprMasterResolveActionId(b.related_action_id,ctx.project_id):null)}if(!sets.length)return json({ok:true,id});sets.push('version=version+1',"updated_at=datetime('now')","updated_by=?");args.push(user.name||'',id);await DB.prepare('UPDATE opr_customizations SET '+sets.join(',')+' WHERE id=?').bind(...args).run();return json({ok:true,id});
}

// ===== Pendências automáticas: somente inferências baseadas em campos/markers explícitos. =====
if(path==='opr-pendencies'&&request.method==='GET'){
  const ctx=await oprMasterProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprMasterEnsureDisplayIds(ctx);await oprMasterRefreshOverdue(ctx);const rows=(await DB.prepare(`SELECT w.id,m.display_id,w.title,w.owner,w.due_date,m.front,m.plan_status,m.evidence,m.dependency,m.impact,m.critical_path,m.next_step FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND w.archived_at IS NULL`).bind(ctx.project_id).all()).results||[],out=[];
  const explicitPending=v=>/pendente de validacao|a confirmar|nao informado|sem evidencia suficiente/i.test(oprMasterNorm(v));
  for(const x of rows){const st=oprMasterEffectiveStatus(x.plan_status,x.due_date),id=x.display_id||x.id,add=(type)=>out.push({action_id:id,type,action:x.title,status:st});if(!x.owner||explicitPending(x.owner))add('Responsável pendente');if(!x.due_date)add('Prazo pendente');if(!x.evidence||explicitPending(x.evidence))add('Evidência pendente');if(st==='Atrasado')add('Atraso');if(x.critical_path&&(!x.dependency||explicitPending(x.dependency)))add('Dependência crítica');const combined=[x.title,x.impact,x.dependency,x.next_step].join(' ');if(/decisao/i.test(oprMasterNorm(combined))&&explicitPending(combined))add('Decisão pendente');if([x.owner,x.evidence,x.dependency,x.impact,x.next_step].some(explicitPending))add('Informação não validada')}
  return json(out);
}

// ===== Auditoria de Completude =====
if(path==='opr-audit'&&request.method==='GET'){
  const ctx=await oprMasterProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprMasterEnsureDisplayIds(ctx);const rows=(await DB.prepare(`SELECT a.*,m.display_id related_action_display_id FROM opr_completeness_audit a LEFT JOIN opr_action_meta m ON m.work_item_id=a.related_action_id WHERE a.project_id=? ORDER BY a.audit_date DESC,a.created_at DESC`).bind(ctx.project_id).all()).results||[];return json(rows.map(r=>({...r,related_action_work_item_id:r.related_action_id,related_action_id:r.related_action_display_id||r.related_action_id||null})));
}
if(path==='opr-audit'&&request.method==='POST'){
  if(!oprMasterWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprMasterProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);if(!String(b.source_type||'').trim()||!String(b.item_summary||'').trim())return json({error:'Fonte e item da auditoria são obrigatórios'},400);if(!oprMasterAuditClasses.includes(String(b.classification||'')))return json({error:'Classificação de auditoria inválida'},400);const related=b.related_action_id?await oprMasterResolveActionId(b.related_action_id,ctx.project_id):null,id=oprMasterId('OPR-AUD-');await DB.prepare(`INSERT INTO opr_completeness_audit(id,company_id,project_id,audit_date,source_type,source_ref,item_summary,classification,related_action_id,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.company_id,ctx.project_id,b.audit_date||oprMasterToday(),String(b.source_type).trim(),b.source_ref||'',String(b.item_summary).trim(),b.classification,related,b.notes||'',user.name||'').run();return json({ok:true,id},201);
}
