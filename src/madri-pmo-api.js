// MADRI PMO — Plano Mestre operacional sobre work_items (fonte única de ações).
// Escopo deliberadamente isolado: somente tenant Madrid/Madri + pmo_scope=MADRI_NUCCI.
const mpStatuses=['Planejado','Em andamento','Atrasado','Concluído'];
const mpCadenceStatuses=['Realizada','Planejada','A confirmar','Cancelada','Não realizada'];
const mpWrite=['admin','pmo','gestor','techlead'].includes(user.role);
const mpNorm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const mpCompany=async()=>{
  const rows=(await DB.prepare('SELECT id,name FROM companies').all()).results||[];
  const matches=rows.filter(r=>['madrid','madri'].includes(mpNorm(r.id))||['madrid','madri'].includes(mpNorm(r.name)));
  if(matches.length!==1)return null;
  return matches[0];
};
const mpProject=async cid=>{
  const rows=(await DB.prepare('SELECT id,name,company_id FROM projects WHERE company_id=? ORDER BY id').bind(cid).all()).results||[];
  const preferred=rows.find(r=>/nucci/i.test(String(r.name||'')))||rows.find(r=>/madri|madrid/i.test(String(r.name||'')))||rows[0]||null;
  return preferred;
};
const mpContext=async()=>{const company=await mpCompany();if(!company)return null;const project=await mpProject(company.id);return {company,project}};
const mpAction=async(id,cid,includeArchived=false)=>DB.prepare(`SELECT * FROM work_items WHERE id=? AND company_id=? AND pmo_scope='MADRI_NUCCI' ${includeArchived?'':'AND archived_at IS NULL'}`).bind(id,cid).first();
const mpEvent=async(item,name,meta={})=>{
  try{await DB.prepare("INSERT INTO work_events(company_id,project_id,work_item_id,event_type,event_name,actor,metadata_json) VALUES(?,?,?,?,?,?,?)").bind(item.company_id,item.project_id||null,item.id,'madri_pmo',name,user.name,JSON.stringify(meta)).run()}catch(e){console.error('[madri-pmo:event]',e?.message||e)}
};
const mpRefreshLate=async cid=>{
  await DB.prepare("UPDATE work_items SET status='Atrasado',updated_at=datetime('now'),version=COALESCE(version,1)+1 WHERE company_id=? AND pmo_scope='MADRI_NUCCI' AND archived_at IS NULL AND due_date IS NOT NULL AND due_date<>'' AND date(due_date)<date('now') AND status NOT IN ('Concluído','Atrasado')").bind(cid).run();
};
const mpNextId=async(prefix,table='work_items',column='id')=>{
  let rows=[];
  if(table==='work_items')rows=(await DB.prepare("SELECT id FROM work_items WHERE pmo_scope='MADRI_NUCCI' AND id LIKE ?").bind(prefix+'%').all()).results||[];
  else rows=(await DB.prepare(`SELECT ${column} AS id FROM ${table} WHERE ${column} LIKE ?`).bind(prefix+'%').all()).results||[];
  const max=rows.reduce((m,r)=>Math.max(m,Number(String(r.id||'').slice(prefix.length))||0),0);
  return prefix+String(max+1).padStart(3,'0');
};
const mpNeedWrite=()=>mpWrite?null:json({error:'Sem permissão para alterar o Plano MADRI'},403);
const mpCleanStatus=s=>mpStatuses.includes(String(s||''))?String(s):null;

if(path==='madri-pmo/context'&&request.method==='GET'){
  const ctx=await mpContext();
  if(!ctx)return json({error:'Tenant Madrid não resolvido de forma única'},409);
  return json({company:{id:String(ctx.company.id),name:ctx.company.name},project:ctx.project?{id:ctx.project.id,name:ctx.project.name}:null,pmo_scope:'MADRI_NUCCI'});
}

if(path==='madri-pmo/actions'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  await mpRefreshLate(ctx.company.id);
  const where=["company_id=?","pmo_scope='MADRI_NUCCI'","archived_at IS NULL"],args=[ctx.company.id];
  const status=url.searchParams.get('status'),front=url.searchParams.get('front'),q=url.searchParams.get('q');
  if(status){where.push('status=?');args.push(status)}
  if(front){where.push('front=?');args.push(front)}
  if(q){where.push('(title LIKE ? OR description LIKE ? OR owner LIKE ? OR evidence LIKE ?)');const x='%'+q+'%';args.push(x,x,x,x)}
  const rows=(await DB.prepare('SELECT * FROM work_items WHERE '+where.join(' AND ')+' ORDER BY critical_path DESC,COALESCE(due_date,\'9999-12-31\'),rank,id').bind(...args).all()).results||[];
  return json(rows);
}

if(path==='madri-pmo/actions'&&request.method==='POST'){
  const denied=mpNeedWrite();if(denied)return denied;
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const b=await request.json();
  const title=String(b.action||b.title||'').trim();if(!title)return json({error:'Ação é obrigatória'},400);
  const status=mpCleanStatus(b.status||'Planejado');if(!status)return json({error:'Status inválido'},400);
  const id=await mpNextId('MADRI-ACT-');
  const owner=String(b.responsible||b.owner||'').trim()||'PENDENTE DE VALIDAÇÃO';
  const type=String(b.item_type||'AÇÃO').toUpperCase();
  await DB.prepare("INSERT INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)")
    .bind(id,ctx.company.id,ctx.project?.id||null,ctx.project?.name||'Implantação NUCCI ERP',type,title,b.description||'',status,b.priority||'Média',owner,b.start_date||null,b.due_date||null,Date.now(),JSON.stringify(['MADRI_PMO',type==='CUSTOMIZACAO'?'CUSTOMIZACAO':'PLANO']),user.name,user.name,'MADRI_NUCCI',b.front||'',b.dependency||'',b.impact||'',b.critical_path?1:0,b.next_step||'',b.evidence||'',b.source_ref||'').run();
  const item=await mpAction(id,ctx.company.id);await mpEvent(item,'INSERT',{fields:Object.keys(b),source:'manual'});
  return json({ok:true,id,item},201);
}

if(path.match(/^madri-pmo\/actions\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  const denied=mpNeedWrite();if(denied)return denied;
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const id=decodeURIComponent(path.split('/')[2]),old=await mpAction(id,ctx.company.id);if(!old)return json({error:'Ação não encontrada'},404);
  const b=await request.json();if(Object.prototype.hasOwnProperty.call(b,'status')&&!mpCleanStatus(b.status))return json({error:'Status inválido'},400);
  const map={front:'front',action:'title',title:'title',description:'description',responsible:'owner',owner:'owner',start_date:'start_date',due_date:'due_date',status:'status',dependency:'dependency_text',impact:'impact_text',critical_path:'critical_path',next_step:'next_step',evidence:'evidence',source_ref:'source_ref',priority:'priority'};
  const sets=[],args=[],changed=[];
  for(const [input,col] of Object.entries(map))if(Object.prototype.hasOwnProperty.call(b,input)){
    let v=b[input];if(col==='critical_path')v=v?1:0;if(col==='owner'&&!String(v||'').trim())v='PENDENTE DE VALIDAÇÃO';if(col==='title'&&!String(v||'').trim())return json({error:'Ação é obrigatória'},400);
    sets.push(col+'=?');args.push(v);changed.push(input);
  }
  if(!sets.length)return json({ok:true,id});
  sets.push("updated_at=datetime('now')","updated_by=?","version=COALESCE(version,1)+1");args.push(user.name,id);
  await DB.prepare('UPDATE work_items SET '+sets.join(',')+' WHERE id=? AND company_id=? AND pmo_scope=\'MADRI_NUCCI\'').bind(...args,ctx.company.id).run();
  const item=await mpAction(id,ctx.company.id);await mpEvent(item,'UPDATE',{fields:changed,before:Object.fromEntries(changed.map(k=>[k,old[map[k]]]))});
  return json({ok:true,id,item});
}

if(path.match(/^madri-pmo\/actions\/[^/]+\/status$/)&&request.method==='POST'){
  const denied=mpNeedWrite();if(denied)return denied;
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const id=decodeURIComponent(path.split('/')[2]),old=await mpAction(id,ctx.company.id);if(!old)return json({error:'Ação não encontrada'},404);
  const b=await request.json(),status=mpCleanStatus(b.status);if(!status)return json({error:'Status inválido'},400);
  await DB.prepare("UPDATE work_items SET status=?,updated_at=datetime('now'),updated_by=?,version=COALESCE(version,1)+1 WHERE id=? AND company_id=? AND pmo_scope='MADRI_NUCCI'").bind(status,user.name,id,ctx.company.id).run();
  const item=await mpAction(id,ctx.company.id);await mpEvent(item,'UPDATE',{field:'status',from:old.status,to:status});
  return json({ok:true,id,status,version:item.version});
}

if(path.match(/^madri-pmo\/actions\/[^/]+$/)&&request.method==='DELETE'){
  const denied=mpNeedWrite();if(denied)return denied;
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const id=decodeURIComponent(path.split('/')[2]),item=await mpAction(id,ctx.company.id);if(!item)return json({error:'Ação não encontrada'},404);
  await DB.prepare("UPDATE work_items SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=?,version=COALESCE(version,1)+1 WHERE id=? AND company_id=? AND pmo_scope='MADRI_NUCCI'").bind(user.name,id,ctx.company.id).run();
  await mpEvent(item,'SOFT_DELETE',{});return json({ok:true,id});
}

if(path==='madri-pmo/trash'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const rows=(await DB.prepare("SELECT * FROM work_items WHERE company_id=? AND pmo_scope='MADRI_NUCCI' AND archived_at IS NOT NULL ORDER BY archived_at DESC").bind(ctx.company.id).all()).results||[];
  return json(rows);
}

if(path.match(/^madri-pmo\/actions\/[^/]+\/restore$/)&&request.method==='POST'){
  const denied=mpNeedWrite();if(denied)return denied;
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const id=decodeURIComponent(path.split('/')[2]),item=await mpAction(id,ctx.company.id,true);if(!item||!item.archived_at)return json({error:'Item não encontrado na lixeira'},404);
  await DB.prepare("UPDATE work_items SET archived_at=NULL,updated_at=datetime('now'),updated_by=?,version=COALESCE(version,1)+1 WHERE id=? AND company_id=? AND pmo_scope='MADRI_NUCCI'").bind(user.name,id,ctx.company.id).run();
  await mpEvent(item,'RESTORE',{});return json({ok:true,id});
}

if(path==='madri-pmo/history'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const id=url.searchParams.get('action');const where=["e.company_id=?","e.event_type='madri_pmo'"],args=[ctx.company.id];if(id){where.push('e.work_item_id=?');args.push(id)}
  const rows=(await DB.prepare("SELECT e.*,w.title,w.version FROM work_events e LEFT JOIN work_items w ON w.id=e.work_item_id WHERE "+where.join(' AND ')+" ORDER BY e.id DESC LIMIT 500").bind(...args).all()).results||[];
  return json(rows.map(r=>({...r,metadata:(()=>{try{return JSON.parse(r.metadata_json||'{}')}catch{return {}}})()})));
}

if(path==='madri-pmo/customizations'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);await mpRefreshLate(ctx.company.id);
  const rows=(await DB.prepare("SELECT * FROM work_items WHERE company_id=? AND pmo_scope='MADRI_NUCCI' AND archived_at IS NULL AND item_type='CUSTOMIZACAO' ORDER BY critical_path DESC,rank,id").bind(ctx.company.id).all()).results||[];
  return json(rows);
}

if(path==='madri-pmo/pendings'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);await mpRefreshLate(ctx.company.id);
  const actions=(await DB.prepare("SELECT * FROM work_items WHERE company_id=? AND pmo_scope='MADRI_NUCCI' AND archived_at IS NULL ORDER BY id").bind(ctx.company.id).all()).results||[];
  const cadence=(await DB.prepare("SELECT * FROM madri_pmo_cadence WHERE company_id=? AND archived_at IS NULL AND status='A confirmar' ORDER BY period").bind(ctx.company.id).all()).results||[];
  const out=[];
  for(const a of actions){
    if(!a.owner||a.owner==='PENDENTE DE VALIDAÇÃO')out.push({type:'responsável pendente',action_id:a.id,front:a.front,detail:'Responsável = PENDENTE DE VALIDAÇÃO'});
    if(!a.due_date&&a.status!=='Concluído')out.push({type:'prazo pendente',action_id:a.id,front:a.front,detail:'Prazo = A confirmar'});
    if(!a.evidence)out.push({type:'evidência pendente',action_id:a.id,front:a.front,detail:'Sem evidência suficiente'});
    if(a.status==='Atrasado')out.push({type:'atraso',action_id:a.id,front:a.front,detail:'Prazo vencido e ação não concluída'});
    if(a.critical_path&&a.dependency_text)out.push({type:'dependência crítica',action_id:a.id,front:a.front,detail:a.dependency_text});
  }
  cadence.forEach(c=>out.push({type:'informação não validada',action_id:c.action_id||'',front:'Cadência',detail:`${c.agenda}: A confirmar`}));
  return json(out);
}

// Entrada de Demandas
if(path==='madri-pmo/demands'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);
  const rows=(await DB.prepare('SELECT * FROM madri_pmo_demands WHERE company_id=? AND archived_at IS NULL ORDER BY entry_date DESC,created_at DESC').bind(ctx.company.id).all()).results||[];return json(rows);
}
if(path==='madri-pmo/demands'&&request.method==='POST'){
  const denied=mpNeedWrite();if(denied)return denied;const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);const b=await request.json();if(!String(b.demand||'').trim())return json({error:'Demanda é obrigatória'},400);
  const id=await mpNextId('MADRI-ENT-','madri_pmo_demands');await DB.prepare("INSERT INTO madri_pmo_demands(id,company_id,project_id,entry_date,origin,demand,front,responsible,due_date,triage_status,evidence,observation,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,ctx.company.id,ctx.project?.id||null,b.entry_date||new Date().toISOString().slice(0,10),b.origin||'',String(b.demand).trim(),b.front||'',b.responsible||'PENDENTE DE VALIDAÇÃO',b.due_date||null,b.triage_status||'Capturada',b.evidence||'',b.observation||'',user.name,user.name).run();return json({ok:true,id},201);
}
if(path.match(/^madri-pmo\/demands\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  const denied=mpNeedWrite();if(denied)return denied;const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);const id=decodeURIComponent(path.split('/')[2]);const old=await DB.prepare('SELECT * FROM madri_pmo_demands WHERE id=? AND company_id=? AND archived_at IS NULL').bind(id,ctx.company.id).first();if(!old)return json({error:'Entrada não encontrada'},404);const b=await request.json();
  const map={entry_date:'entry_date',origin:'origin',demand:'demand',front:'front',responsible:'responsible',due_date:'due_date',triage_status:'triage_status',evidence:'evidence',observation:'observation'},sets=[],args=[];for(const [k,col] of Object.entries(map))if(Object.prototype.hasOwnProperty.call(b,k)){sets.push(col+'=?');args.push(b[k])}
  if(sets.length){sets.push("updated_at=datetime('now')","updated_by=?","version=version+1");args.push(user.name,id,ctx.company.id);await DB.prepare('UPDATE madri_pmo_demands SET '+sets.join(',')+' WHERE id=? AND company_id=?').bind(...args).run()}
  let row=await DB.prepare('SELECT * FROM madri_pmo_demands WHERE id=? AND company_id=?').bind(id,ctx.company.id).first();
  if(String(row.triage_status).toLowerCase()==='aprovada'&&!row.action_id){
    const actionId=await mpNextId('MADRI-ACT-');await DB.prepare("INSERT INTO work_items(id,company_id,project_id,project,item_type,title,description,status,priority,owner,start_date,due_date,rank,labels,created_by,updated_by,pmo_scope,front,dependency_text,impact_text,critical_path,next_step,evidence,source_ref,version) VALUES(?,?,?,?,? ,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)").bind(actionId,ctx.company.id,ctx.project?.id||null,ctx.project?.name||'Implantação NUCCI ERP','AÇÃO',row.demand,row.observation||'','Planejado','Média',row.responsible||'PENDENTE DE VALIDAÇÃO',row.entry_date,row.due_date,Date.now(),JSON.stringify(['MADRI_PMO','ENTRADA_DEMANDA']),user.name,user.name,'MADRI_NUCCI',row.front||'','','',0,'Classificar e executar demanda aprovada.',row.evidence||'',`Entrada de Demanda ${row.id}`).run();const item=await mpAction(actionId,ctx.company.id);await mpEvent(item,'INSERT',{source:'demand',demand_id:id});await DB.prepare("UPDATE madri_pmo_demands SET action_id=?,updated_at=datetime('now'),updated_by=?,version=version+1 WHERE id=? AND company_id=?").bind(actionId,user.name,id,ctx.company.id).run();row=await DB.prepare('SELECT * FROM madri_pmo_demands WHERE id=? AND company_id=?').bind(id,ctx.company.id).first();
  }
  return json({ok:true,item:row});
}

// Responsáveis por papel
if(path==='madri-pmo/roles'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);return json((await DB.prepare('SELECT * FROM madri_pmo_roles WHERE company_id=? AND archived_at IS NULL ORDER BY front,role_type').bind(ctx.company.id).all()).results||[]);
}
if(path.match(/^madri-pmo\/roles\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  const denied=mpNeedWrite();if(denied)return denied;const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);const id=decodeURIComponent(path.split('/')[2]),b=await request.json();const row=await DB.prepare('SELECT * FROM madri_pmo_roles WHERE id=? AND company_id=? AND archived_at IS NULL').bind(id,ctx.company.id).first();if(!row)return json({error:'Papel não encontrado'},404);
  await DB.prepare("UPDATE madri_pmo_roles SET person_name=COALESCE(?,person_name),evidence=COALESCE(?,evidence),status=COALESCE(?,status),updated_at=datetime('now'),version=version+1 WHERE id=? AND company_id=?").bind(b.person_name??null,b.evidence??null,b.status??null,id,ctx.company.id).run();return json({ok:true,id});
}

// Cadência completa
if(path==='madri-pmo/cadence'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);return json((await DB.prepare('SELECT * FROM madri_pmo_cadence WHERE company_id=? AND archived_at IS NULL ORDER BY period,id').bind(ctx.company.id).all()).results||[]);
}
if(path==='madri-pmo/cadence'&&request.method==='POST'){
  const denied=mpNeedWrite();if(denied)return denied;const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);const b=await request.json();if(!b.period||!b.agenda)return json({error:'Data/período e agenda são obrigatórios'},400);if(!mpCadenceStatuses.includes(b.status||'A confirmar'))return json({error:'Status de cadência inválido'},400);const id=await mpNextId('MADRI-CAD-','madri_pmo_cadence');await DB.prepare('INSERT INTO madri_pmo_cadence(id,company_id,project_id,period,agenda,objective,participants,status,result_next_step,action_id,source_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,ctx.company.id,ctx.project?.id||null,b.period,b.agenda,b.objective||'',b.participants||'',b.status||'A confirmar',b.result_next_step||'',b.action_id||null,b.source_ref||'').run();return json({ok:true,id},201);
}
if(path.match(/^madri-pmo\/cadence\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  const denied=mpNeedWrite();if(denied)return denied;const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);const id=decodeURIComponent(path.split('/')[2]),old=await DB.prepare('SELECT * FROM madri_pmo_cadence WHERE id=? AND company_id=? AND archived_at IS NULL').bind(id,ctx.company.id).first();if(!old)return json({error:'Agenda não encontrada'},404);const b=await request.json();if(b.status&&!mpCadenceStatuses.includes(b.status))return json({error:'Status de cadência inválido'},400);const map={period:'period',agenda:'agenda',objective:'objective',participants:'participants',status:'status',result_next_step:'result_next_step',action_id:'action_id',source_ref:'source_ref'},sets=[],args=[];for(const [k,col] of Object.entries(map))if(Object.prototype.hasOwnProperty.call(b,k)){sets.push(col+'=?');args.push(b[k])}if(sets.length){sets.push("updated_at=datetime('now')","version=version+1");args.push(id,ctx.company.id);await DB.prepare('UPDATE madri_pmo_cadence SET '+sets.join(',')+' WHERE id=? AND company_id=?').bind(...args).run()}return json({ok:true,id});
}

if(path==='madri-pmo/dashboard'&&request.method==='GET'){
  const ctx=await mpContext();if(!ctx)return json({error:'Tenant Madrid não encontrado'},404);await mpRefreshLate(ctx.company.id);
  const actions=(await DB.prepare("SELECT * FROM work_items WHERE company_id=? AND pmo_scope='MADRI_NUCCI' AND archived_at IS NULL ORDER BY critical_path DESC,rank,id").bind(ctx.company.id).all()).results||[];
  const cadence=(await DB.prepare('SELECT * FROM madri_pmo_cadence WHERE company_id=? AND archived_at IS NULL ORDER BY period,id').bind(ctx.company.id).all()).results||[];
  const roles=(await DB.prepare('SELECT * FROM madri_pmo_roles WHERE company_id=? AND archived_at IS NULL ORDER BY front,role_type').bind(ctx.company.id).all()).results||[];
  const counts=Object.fromEntries(mpStatuses.map(s=>[s,actions.filter(a=>a.status===s).length]));
  const critical=actions.filter(a=>a.critical_path&&a.status!=='Concluído');
  return json({context:{company:ctx.company,project:ctx.project},counts,total:actions.length,actions,critical,cadence,roles,generated_at:new Date().toISOString(),baseline:{progress:'PENDENTE DE VALIDAÇÃO',go_live:'A confirmar'}});
}
