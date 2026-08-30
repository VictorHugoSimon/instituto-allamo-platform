// OPR PMO — Plano de Ação operacional sobre o Work Management canônico.
// Escopo rígido: somente empresa OPR + projeto explicitamente selecionado.
const oprWrite=['admin','pmo','gestor','techlead'].includes(user.role);
const oprPlanStatuses=['Planejado','Em andamento','Atrasado','Concluído'];
const oprCadenceStatuses=['Realizada','Planejada','A confirmar','Cancelada','Não realizada'];
const oprTriageStatuses=['Capturada','Em triagem','Aprovada','Rejeitada','Concluída'];
const oprCustomizationStages=['Análise','Revisão','Aprovação/Assinatura','Desenvolvimento','Disponível para Teste','Validação','Aceite'];
const oprNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const oprId=prefix=>prefix+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
const oprGenericStatus=s=>s==='Concluído'?'CONCLUÍDO':(s==='Planejado'?'A FAZER':'EM ANDAMENTO');
const oprToday=()=>new Date().toISOString().slice(0,10);
const oprEffectiveStatus=(status,due)=>status!=='Concluído'&&due&&String(due)<oprToday()?'Atrasado':status;
const oprCanScope=companyId=>!scope||String(scope)===String(companyId);

const oprProjectContext=async projectId=>{
  if(!projectId&&projectId!==0)return {error:'Projeto OPR é obrigatório'};
  const row=await DB.prepare(`SELECT p.id project_id,p.name project_name,p.company_id,c.name company_name
    FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.id=?`).bind(projectId).first();
  if(!row)return {error:'Projeto não encontrado'};
  if(!oprCanScope(row.company_id))return {error:'Projeto fora do escopo do usuário'};
  if(!oprNorm(row.company_name).includes('opr'))return {error:'Este endpoint aceita exclusivamente projetos da OPR'};
  return row;
};

const oprActionRow=async(id,includeArchived=false)=>DB.prepare(`SELECT w.id,w.company_id,w.project_id,w.item_type,w.title,w.description,w.priority,w.owner,w.reporter,w.start_date,w.due_date,w.blocked,w.blocked_reason,w.created_at,w.updated_at,w.archived_at,
  m.front,m.plan_status,m.dependency,m.impact,m.critical_path,m.next_step,m.evidence,m.source,m.version
  FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.id=? ${includeArchived?'':'AND w.archived_at IS NULL'}`).bind(id).first();

const oprSnapshot=async id=>{const x=await oprActionRow(id,true);return x?JSON.stringify(x):'{}'};
const oprHistory=async(item,actionType,version)=>{
  if(!item)return;
  const snap=await oprSnapshot(item.id);
  await DB.prepare(`INSERT INTO opr_action_history(company_id,project_id,work_item_id,action_type,version,actor,snapshot_json)
    VALUES(?,?,?,?,?,?,?)`).bind(item.company_id,item.project_id,item.id,actionType,version||item.version||1,user.name||'',snap).run();
};

const oprRefreshOverdue=async projectId=>{
  const rows=(await DB.prepare(`SELECT w.id,m.version FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id
    WHERE w.project_id=? AND w.archived_at IS NULL AND m.plan_status NOT IN ('Concluído','Atrasado') AND w.due_date IS NOT NULL AND w.due_date<>'' AND w.due_date<date('now')`).bind(projectId).all()).results||[];
  for(const r of rows){
    const before=await oprActionRow(r.id);
    const next=Number(r.version||1)+1;
    await DB.prepare("UPDATE opr_action_meta SET plan_status='Atrasado',version=?,updated_at=datetime('now') WHERE work_item_id=?").bind(next,r.id).run();
    await DB.prepare("UPDATE work_items SET status='EM ANDAMENTO',updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name||'',r.id).run();
    const after=await oprActionRow(r.id);
    await oprHistory(after,'UPDATE',next);
    try{await logEvent(env,user,'opr-action:auto-atrasado',r.id,before?.due_date||'')}catch(e){}
  }
};

const oprCreateAction=async(ctx,b,historyType='INSERT')=>{
  if(!String(b.action||b.title||'').trim())throw new Error('Ação é obrigatória');
  let ps=String(b.plan_status||b.status||'Planejado');if(!oprPlanStatuses.includes(ps))ps='Planejado';
  ps=oprEffectiveStatus(ps,b.due_date||null);
  const id=oprId('OPR-ACT-');
  const owner=String(b.owner||b.responsible||'').trim()||'PENDENTE DE VALIDAÇÃO';
  const title=String(b.action||b.title).trim();
  await DB.prepare(`INSERT INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,reporter,start_date,due_date,rank,labels,blocked,blocked_reason,created_by,updated_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.company_id,ctx.project_id,ctx.project_name,'AÇÃO',title,b.description||'',oprGenericStatus(ps),b.priority||'Média',owner,user.name||'',b.start_date||null,b.due_date||null,Date.now(),JSON.stringify(['OPR','PLANO_PMO']),b.blocked?1:0,b.blocked_reason||'',user.name||'',user.name||'').run();
  await DB.prepare(`INSERT INTO opr_action_meta(work_item_id,company_id,project_id,front,plan_status,dependency,impact,critical_path,next_step,evidence,source,version)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`).bind(id,ctx.company_id,ctx.project_id,b.front||'',ps,b.dependency||'',b.impact||'',b.critical_path?1:0,b.next_step||'',b.evidence||'',b.source||'').run();
  const item=await oprActionRow(id);await oprHistory(item,historyType,1);
  try{await logEvent(env,user,'opr-action:criar',id,title)}catch(e){}
  return id;
};

if(path==='opr-projects'&&request.method==='GET'){
  const where=["UPPER(c.name) LIKE '%OPR%'"];const args=[];if(scope){where.push('c.id=?');args.push(scope)}
  return json((await DB.prepare(`SELECT p.id,p.name,p.company_id,c.name company_name FROM projects p JOIN companies c ON c.id=p.company_id WHERE ${where.join(' AND ')} ORDER BY p.name`).bind(...args).all()).results||[]);
}

if(path==='opr-actions'&&request.method==='GET'){
  const projectId=url.searchParams.get('project'),ctx=await oprProjectContext(projectId);if(ctx.error)return json({error:ctx.error},400);await oprRefreshOverdue(ctx.project_id);
  const trash=url.searchParams.get('trash')==='1';const rows=(await DB.prepare(`SELECT w.id,w.company_id,w.project_id,w.item_type,w.title action,w.description,w.priority,w.owner responsible,w.start_date,w.due_date,w.blocked,w.blocked_reason,w.created_at,w.updated_at,w.archived_at,
    m.front,m.plan_status status,m.dependency,m.impact,m.critical_path,m.next_step,m.evidence,m.source,m.version
    FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND ${trash?'w.archived_at IS NOT NULL':'w.archived_at IS NULL'} ORDER BY w.rank,w.created_at`).bind(ctx.project_id).all()).results||[];
  return json(rows.map(r=>({...r,status:oprEffectiveStatus(r.status,r.due_date)})));
}
if(path==='opr-actions'&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);
  try{const id=await oprCreateAction(ctx,b);return json({ok:true,id},201)}catch(e){return json({error:e.message||'Falha ao criar ação'},400)}
}
if(path.match(/^opr-actions\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await oprActionRow(id);if(!old)return json({error:'Ação não encontrada'},404);const ctx=await oprProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));
  let ps=Object.prototype.hasOwnProperty.call(b,'status')?String(b.status):old.plan_status;if(!oprPlanStatuses.includes(ps))return json({error:'Status inválido'},400);const due=Object.prototype.hasOwnProperty.call(b,'due_date')?b.due_date:old.due_date;ps=oprEffectiveStatus(ps,due);
  const wf=[],wa=[];for(const [k,col] of [['action','title'],['description','description'],['priority','priority'],['responsible','owner'],['start_date','start_date'],['due_date','due_date'],['blocked','blocked'],['blocked_reason','blocked_reason']])if(Object.prototype.hasOwnProperty.call(b,k)){wf.push(col+'=?');wa.push(k==='blocked'?(b[k]?1:0):b[k])}
  if(Object.prototype.hasOwnProperty.call(b,'status')){wf.push('status=?');wa.push(oprGenericStatus(ps))}else if(ps==='Atrasado'&&old.plan_status!=='Atrasado'){wf.push('status=?');wa.push('EM ANDAMENTO')}
  if(wf.length){wf.push("updated_at=datetime('now')","updated_by=?");wa.push(user.name||'',id);await DB.prepare('UPDATE work_items SET '+wf.join(',')+' WHERE id=?').bind(...wa).run()}
  const mf=[],ma=[];for(const [k,col] of [['front','front'],['dependency','dependency'],['impact','impact'],['critical_path','critical_path'],['next_step','next_step'],['evidence','evidence'],['source','source']])if(Object.prototype.hasOwnProperty.call(b,k)){mf.push(col+'=?');ma.push(k==='critical_path'?(b[k]?1:0):b[k])}
  if(ps!==old.plan_status||Object.prototype.hasOwnProperty.call(b,'status')){mf.push('plan_status=?');ma.push(ps)}
  const next=Number(old.version||1)+1;mf.push('version=?',"updated_at=datetime('now')");ma.push(next,id);await DB.prepare('UPDATE opr_action_meta SET '+mf.join(',')+' WHERE work_item_id=?').bind(...ma).run();const item=await oprActionRow(id);await oprHistory(item,'UPDATE',next);try{await logEvent(env,user,'opr-action:editar',id,Object.keys(b).join(','))}catch(e){}return json({ok:true,id,status:ps,version:next});
}
if(path.match(/^opr-actions\/[^/]+$/)&&request.method==='DELETE'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),item=await oprActionRow(id);if(!item)return json({error:'Ação não encontrada'},404);const ctx=await oprProjectContext(item.project_id);if(ctx.error)return json({error:ctx.error},403);const next=Number(item.version||1)+1;await DB.prepare("UPDATE work_items SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name||'',id).run();await DB.prepare("UPDATE opr_action_meta SET version=?,updated_at=datetime('now') WHERE work_item_id=?").bind(next,id).run();const archived=await oprActionRow(id,true);await oprHistory(archived,'SOFT_DELETE',next);return json({ok:true});
}
if(path.match(/^opr-actions\/[^/]+\/restore$/)&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),item=await oprActionRow(id,true);if(!item)return json({error:'Ação não encontrada'},404);const ctx=await oprProjectContext(item.project_id);if(ctx.error)return json({error:ctx.error},403);if(!item.archived_at)return json({ok:true,id});const next=Number(item.version||1)+1;await DB.prepare("UPDATE work_items SET archived_at=NULL,updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name||'',id).run();await DB.prepare("UPDATE opr_action_meta SET version=?,updated_at=datetime('now') WHERE work_item_id=?").bind(next,id).run();const restored=await oprActionRow(id);await oprHistory(restored,'RESTORE',next);return json({ok:true,id});
}
if(path.match(/^opr-actions\/[^/]+\/history$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),item=await oprActionRow(id,true);if(!item)return json({error:'Ação não encontrada'},404);const ctx=await oprProjectContext(item.project_id);if(ctx.error)return json({error:ctx.error},403);return json((await DB.prepare('SELECT * FROM opr_action_history WHERE work_item_id=? ORDER BY id DESC').bind(id).all()).results||[]);
}

if(path==='opr-intake'&&request.method==='GET'){
  const projectId=url.searchParams.get('project'),ctx=await oprProjectContext(projectId);if(ctx.error)return json({error:ctx.error},400);return json((await DB.prepare("SELECT * FROM opr_intake WHERE project_id=? AND archived_at IS NULL ORDER BY created_at DESC").bind(ctx.project_id).all()).results||[]);
}
if(path==='opr-intake'&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);if(!String(b.demand||'').trim())return json({error:'Demanda é obrigatória'},400);const id=oprId('OPR-ENT-');let st=String(b.triage_status||'Capturada');if(!oprTriageStatuses.includes(st))st='Capturada';await DB.prepare(`INSERT INTO opr_intake(id,company_id,project_id,intake_date,origin,demand,front,owner,due_date,triage_status,evidence,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.company_id,ctx.project_id,b.intake_date||oprToday(),b.origin||'',String(b.demand).trim(),b.front||'',b.owner||'PENDENTE DE VALIDAÇÃO',b.due_date||null,st,b.evidence||'',b.notes||'',user.name||'',user.name||'').run();return json({ok:true,id},201);
}
if(path.match(/^opr-intake\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await DB.prepare("SELECT * FROM opr_intake WHERE id=? AND archived_at IS NULL").bind(id).first();if(!old)return json({error:'Entrada não encontrada'},404);const ctx=await oprProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));if(b.triage_status&&!oprTriageStatuses.includes(b.triage_status))return json({error:'Status de triagem inválido'},400);const fields=['intake_date','origin','demand','front','owner','due_date','triage_status','evidence','notes'],sets=[],args=[];for(const f of fields)if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(b[f])}if(!sets.length)return json({ok:true,id});sets.push('version=version+1',"updated_at=datetime('now')","updated_by=?");args.push(user.name||'',id);await DB.prepare('UPDATE opr_intake SET '+sets.join(',')+' WHERE id=?').bind(...args).run();return json({ok:true,id});
}
if(path.match(/^opr-intake\/[^/]+\/approve$/)&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),i=await DB.prepare("SELECT * FROM opr_intake WHERE id=? AND archived_at IS NULL").bind(id).first();if(!i)return json({error:'Entrada não encontrada'},404);const ctx=await oprProjectContext(i.project_id);if(ctx.error)return json({error:ctx.error},403);if(i.created_action_id)return json({ok:true,action_id:i.created_action_id,already_created:true});
  const actionId=await oprCreateAction(ctx,{action:i.demand,front:i.front,responsible:i.owner,due_date:i.due_date,plan_status:'Planejado',evidence:i.evidence,source:'Entrada de Demandas '+i.id,next_step:'Acompanhar demanda aprovada',impact:'A confirmar'});await DB.prepare("UPDATE opr_intake SET triage_status='Aprovada',created_action_id=?,version=version+1,updated_at=datetime('now'),updated_by=? WHERE id=?").bind(actionId,user.name||'',id).run();return json({ok:true,action_id:actionId},201);
}

if(path==='opr-cadence'&&request.method==='GET'){
  const ctx=await oprProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);return json((await DB.prepare("SELECT * FROM opr_cadence WHERE project_id=? AND archived_at IS NULL ORDER BY period,created_at").bind(ctx.project_id).all()).results||[]);
}
if(path==='opr-cadence'&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);if(!String(b.agenda||'').trim())return json({error:'Agenda é obrigatória'},400);let st=String(b.status||'A confirmar');if(!oprCadenceStatuses.includes(st))st='A confirmar';const id=oprId('OPR-AGD-');await DB.prepare(`INSERT INTO opr_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.company_id,ctx.project_id,b.period||'',String(b.agenda).trim(),b.objective||'',b.participants||'',st,b.result_next_step||'',b.action_id||null,b.source||'',user.name||'',user.name||'').run();return json({ok:true,id},201);
}
if(path.match(/^opr-cadence\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await DB.prepare("SELECT * FROM opr_cadence WHERE id=? AND archived_at IS NULL").bind(id).first();if(!old)return json({error:'Agenda não encontrada'},404);const ctx=await oprProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));if(b.status&&!oprCadenceStatuses.includes(b.status))return json({error:'Status inválido'},400);const fields=['period','agenda','objective','participants','status','result_next_step','action_id','source'],sets=[],args=[];for(const f of fields)if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(b[f])}if(!sets.length)return json({ok:true,id});sets.push('version=version+1',"updated_at=datetime('now')","updated_by=?");args.push(user.name||'',id);await DB.prepare('UPDATE opr_cadence SET '+sets.join(',')+' WHERE id=?').bind(...args).run();return json({ok:true,id});
}
if(path.match(/^opr-cadence\/[^/]+$/)&&request.method==='DELETE'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await DB.prepare("SELECT * FROM opr_cadence WHERE id=? AND archived_at IS NULL").bind(id).first();if(!old)return json({error:'Agenda não encontrada'},404);const ctx=await oprProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);await DB.prepare("UPDATE opr_cadence SET archived_at=datetime('now'),version=version+1,updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name||'',id).run();return json({ok:true});
}

if(path==='opr-roles'&&request.method==='GET'){
  const ctx=await oprProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);return json((await DB.prepare('SELECT * FROM opr_role_assignments WHERE project_id=? ORDER BY scope_ref').bind(ctx.project_id).all()).results||[]);
}
if(path==='opr-roles'&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);const scopeRef=String(b.scope_ref||'Projeto').trim()||'Projeto';await DB.prepare(`INSERT INTO opr_role_assignments(company_id,project_id,scope_ref,client_approver,key_user,functional_owner,technical_owner,pmo,operational_owner,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,scope_ref) DO UPDATE SET client_approver=excluded.client_approver,key_user=excluded.key_user,functional_owner=excluded.functional_owner,technical_owner=excluded.technical_owner,pmo=excluded.pmo,operational_owner=excluded.operational_owner,version=opr_role_assignments.version+1,updated_at=datetime('now'),updated_by=excluded.updated_by`).bind(ctx.company_id,ctx.project_id,scopeRef,b.client_approver||'PENDENTE DE VALIDAÇÃO',b.key_user||'PENDENTE DE VALIDAÇÃO',b.functional_owner||'PENDENTE DE VALIDAÇÃO',b.technical_owner||'PENDENTE DE VALIDAÇÃO',b.pmo||'PENDENTE DE VALIDAÇÃO',b.operational_owner||'PENDENTE DE VALIDAÇÃO',user.name||'',user.name||'').run();return json({ok:true});
}

if(path==='opr-customizations'&&request.method==='GET'){
  const ctx=await oprProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);return json((await DB.prepare("SELECT * FROM opr_customizations WHERE project_id=? AND archived_at IS NULL ORDER BY created_at").bind(ctx.project_id).all()).results||[]);
}
if(path==='opr-customizations'&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);if(!String(b.subject||'').trim())return json({error:'Assunto é obrigatório'},400);let stage=String(b.situation||'Análise');if(!oprCustomizationStages.includes(stage))stage='Análise';const id=oprId('OPR-CUS-');await DB.prepare(`INSERT INTO opr_customizations(id,company_id,project_id,official_code,subject,situation,approval,validation_owner,key_user,functional_owner,development_owner,pmo,related_action_id,evidence,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.company_id,ctx.project_id,b.official_code||'',String(b.subject).trim(),stage,b.approval||'PENDENTE DE VALIDAÇÃO',b.validation_owner||'PENDENTE DE VALIDAÇÃO',b.key_user||'PENDENTE DE VALIDAÇÃO',b.functional_owner||'PENDENTE DE VALIDAÇÃO',b.development_owner||'PENDENTE DE VALIDAÇÃO',b.pmo||'PENDENTE DE VALIDAÇÃO',b.related_action_id||null,b.evidence||'',user.name||'',user.name||'').run();return json({ok:true,id},201);
}
if(path.match(/^opr-customizations\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!oprWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await DB.prepare("SELECT * FROM opr_customizations WHERE id=? AND archived_at IS NULL").bind(id).first();if(!old)return json({error:'Customização não encontrada'},404);const ctx=await oprProjectContext(old.project_id);if(ctx.error)return json({error:ctx.error},403);const b=await request.json().catch(()=>({}));if(b.situation&&!oprCustomizationStages.includes(b.situation))return json({error:'Etapa inválida'},400);const fields=['official_code','subject','situation','approval','validation_owner','key_user','functional_owner','development_owner','pmo','related_action_id','evidence'],sets=[],args=[];for(const f of fields)if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(b[f])}if(!sets.length)return json({ok:true,id});sets.push('version=version+1',"updated_at=datetime('now')","updated_by=?");args.push(user.name||'',id);await DB.prepare('UPDATE opr_customizations SET '+sets.join(',')+' WHERE id=?').bind(...args).run();return json({ok:true,id});
}

if(path==='opr-pendencies'&&request.method==='GET'){
  const ctx=await oprProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprRefreshOverdue(ctx.project_id);const a=(await DB.prepare(`SELECT w.id,w.title,w.owner,w.due_date,m.front,m.plan_status,m.evidence,m.dependency,m.critical_path,m.next_step FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND w.archived_at IS NULL`).bind(ctx.project_id).all()).results||[];const out=[];for(const x of a){const st=oprEffectiveStatus(x.plan_status,x.due_date);if(!x.owner||oprNorm(x.owner).includes('pendente de validacao'))out.push({action_id:x.id,type:'Responsável pendente',action:x.title,status:st});if(!x.due_date)out.push({action_id:x.id,type:'Prazo pendente',action:x.title,status:st});if(!x.evidence)out.push({action_id:x.id,type:'Evidência pendente',action:x.title,status:st});if(st==='Atrasado')out.push({action_id:x.id,type:'Atraso',action:x.title,status:st});if(x.critical_path&&!x.dependency)out.push({action_id:x.id,type:'Dependência crítica pendente',action:x.title,status:st})}return json(out);
}

if(path==='opr-report-data'&&request.method==='GET'){
  const ctx=await oprProjectContext(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);await oprRefreshOverdue(ctx.project_id);const actions=(await DB.prepare(`SELECT w.id,w.title action,w.owner responsible,w.start_date,w.due_date,m.front,m.plan_status status,m.dependency,m.impact,m.critical_path,m.next_step FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND w.archived_at IS NULL ORDER BY w.rank,w.created_at`).bind(ctx.project_id).all()).results||[];for(const x of actions)x.status=oprEffectiveStatus(x.status,x.due_date);const cadence=(await DB.prepare("SELECT * FROM opr_cadence WHERE project_id=? AND archived_at IS NULL ORDER BY period,created_at").bind(ctx.project_id).all()).results||[];const customizations=(await DB.prepare("SELECT * FROM opr_customizations WHERE project_id=? AND archived_at IS NULL ORDER BY created_at").bind(ctx.project_id).all()).results||[];const counts=Object.fromEntries(oprPlanStatuses.map(s=>[s,actions.filter(a=>a.status===s).length]));const critical=actions.filter(a=>a.critical_path);const attention=actions.filter(a=>a.status==='Atrasado'||!a.responsible||oprNorm(a.responsible).includes('pendente de validacao')||!a.due_date);return json({context:ctx,generated_at:new Date().toISOString(),counts,actions,critical,attention,cadence,customizations});
}

if(path==='opr-report-publish'&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);let row=await DB.prepare('SELECT * FROM opr_report_publications WHERE project_id=?').bind(ctx.project_id).first();const token=row?.public_token||crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');await DB.prepare(`INSERT INTO opr_report_publications(project_id,company_id,public_token,enabled,published_by,published_at,updated_at) VALUES(?,?,?,1,?,datetime('now'),datetime('now')) ON CONFLICT(project_id) DO UPDATE SET enabled=1,published_by=excluded.published_by,updated_at=datetime('now')`).bind(ctx.project_id,ctx.company_id,token,user.name||'').run();const u=new URL(request.url);return json({ok:true,token,public_url:u.origin+'/api/opr-public-report?token='+token});
}

if(path==='opr-bootstrap'&&request.method==='POST'){
  if(!oprWrite)return json({error:'Sem permissão'},403);const b=await request.json().catch(()=>({})),ctx=await oprProjectContext(b.project_id);if(ctx.error)return json({error:ctx.error},400);const seeds=[
    {front:'Governança',action:'Kickoff executivo e abertura do projeto',responsible:'Instituto Államo + OPR',start_date:'2026-02-02',due_date:'2026-02-02',plan_status:'Concluído',impact:'Início formal do Software Selection',next_step:'Preservar evidências do marco',evidence:'Kickoff Software Selection ERP',source:'Kickoff / EAP'},
    {front:'Requisitos',action:'Consolidar e formalizar a baseline oficial de requisitos',responsible:'PMO + Key Users OPR',plan_status:'Em andamento',impact:'Base para aderência, scoring e ranking',dependency:'Resolver divergências entre versões vigentes',next_step:'Confirmar e aprovar a matriz oficial',evidence:'RFP Rev2.0 atualizada em 25/08/2026',source:'RFP OPR Rev2.0 / EAP',critical_path:true},
    {front:'Fornecedores',action:'Consolidar o funil oficial de fornecedores da OPR',responsible:'PMO',plan_status:'Em andamento',impact:'Definir situação real de convidados, respondentes, eliminados e finalistas',dependency:'Respostas e evidências por fornecedor',next_step:'Publicar situação por player',evidence:'Kickoff registra universo inicial de fornecedores; situação atual requer validação',source:'Kickoff / base de sistemas',critical_path:true},
    {front:'Aderência',action:'Consolidar matriz final de aderência e scoring',responsible:'Instituto Államo + OPR',plan_status:'Em andamento',impact:'Suportar short-list e decisão objetiva',dependency:'Baseline oficial de requisitos',next_step:'Fechar pesos, gaps, evidências e critérios eliminatórios',evidence:'Etapa prevista na EAP/RFP; matriz final não consolidada nas fontes auditadas',source:'EAP / RFP',critical_path:true},
    {front:'Financeiro',action:'Equalizar TCO e condições comerciais dos finalistas',responsible:'Controladoria + PMO',plan_status:'Planejado',impact:'Comparabilidade econômica da decisão',dependency:'Finalistas confirmados',next_step:'Comparar a mesma composição de custos e horizonte',evidence:'TCO é critério formal da RFP',source:'RFP',critical_path:true},
    {front:'Avaliação',action:'Consolidar demonstrações e PoC dos finalistas',responsible:'Key Users OPR + PMO',plan_status:'Planejado',impact:'Validar aderência funcional e técnica',dependency:'Short-list oficial',next_step:'Definir roteiro, notas, evidências e conclusão',evidence:'Demos/avaliações e PoC previstas na EAP/RFP',source:'EAP / RFP',critical_path:true},
    {front:'Decisão',action:'Consolidar ranking e recomendação executiva',responsible:'Instituto Államo / PMO',plan_status:'Planejado',impact:'Preparar deliberação do Comitê',dependency:'Aderência + TCO + PoC',next_step:'Emitir recomendação executiva rastreável',evidence:'Recomendação Executiva prevista na EAP',source:'EAP',critical_path:true},
    {front:'Decisão',action:'Formalizar decisão do Comitê Executivo e ERP vencedor',responsible:'Comitê Executivo OPR',plan_status:'Planejado',impact:'Encerrar seleção e liberar transição para implantação',dependency:'Ranking e recomendação executiva',next_step:'Registrar decisão, condicionantes e aceite',evidence:'Decisão e vencedor previstos na EAP; evidência final ainda a confirmar',source:'EAP / RFP',critical_path:true}
  ];let created=0,skipped=0;for(const s of seeds){const ex=await DB.prepare(`SELECT w.id FROM work_items w JOIN opr_action_meta m ON m.work_item_id=w.id WHERE w.project_id=? AND w.archived_at IS NULL AND w.title=?`).bind(ctx.project_id,s.action).first();if(ex){skipped++;continue}await oprCreateAction(ctx,s);created++}return json({ok:true,created,skipped,total:seeds.length});
}
