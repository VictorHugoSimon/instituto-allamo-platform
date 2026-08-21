// Államo Reports & Roadmap — histórico nativo e integração opcional com Work Management.
const rmReportWrite=['admin','pmo','techlead'].includes(user.role);
const rmRoadmapWrite=['admin','pmo','techlead','gestor'].includes(user.role);
const rmScope=id=>!scope||String(id)===String(scope);
const rmStatuses=['RASCUNHO','EM REVISÃO','PUBLICADO','ARQUIVADO'];
const rmRoadStatuses=['PLANEJADO','EM ANDAMENTO','BLOQUEADO','CONCLUÍDO','CANCELADO'];
const rmParties=['CLIENTE','DEV','TERCEIRO','PMO'];
const rmReport=async id=>DB.prepare('SELECT * FROM report_records WHERE id=? AND archived_at IS NULL').bind(id).first();
const rmRoad=async id=>DB.prepare('SELECT * FROM report_roadmap_items WHERE id=? AND archived_at IS NULL').bind(id).first();
const rmCompany=async id=>DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(id).first();
const rmProject=async id=>DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(id).first();
const rmWork=async id=>DB.prepare('SELECT id,title,company_id,project_id,status,item_type,owner,due_date FROM work_items WHERE id=? AND archived_at IS NULL').bind(id).first();
const rmNewId=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,5).toUpperCase();
const rmParse=s=>{try{return JSON.parse(s||'{}')}catch(e){return {}}};
const rmValidateContext=async(companyId,projectId)=>{
  if(!companyId)return 'Empresa é obrigatória';
  const c=await rmCompany(companyId);if(!c)return 'Empresa não encontrada';if(!rmScope(companyId))return 'Fora do escopo';
  if(projectId!=null&&projectId!==''){const p=await rmProject(projectId);if(!p)return 'Projeto não encontrado';if(String(p.company_id)!==String(companyId))return 'O projeto não pertence à empresa selecionada'}
  return '';
};
const rmRoadRows=async reportId=>(await DB.prepare("SELECT r.*,w.title AS work_title,w.status AS work_status,w.item_type AS work_type,w.owner AS work_owner,w.due_date AS work_due_date FROM report_roadmap_items r LEFT JOIN work_items w ON w.id=r.work_item_id AND w.archived_at IS NULL WHERE r.report_id=? AND r.archived_at IS NULL ORDER BY r.rank ASC,r.created_at ASC").bind(reportId).all()).results||[];
const rmSnapshot=async(reportId,note='')=>{
  const r=await rmReport(reportId);if(!r)return;
  const roadmap=await rmRoadRows(reportId);
  const n=await DB.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS n FROM report_versions WHERE report_id=?').bind(reportId).first();
  const snap={report:{...r,data:rmParse(r.data_json)},roadmap};
  await DB.prepare('INSERT INTO report_versions(report_id,company_id,project_id,version_no,snapshot_json,change_note,created_by) VALUES(?,?,?,?,?,?,?)').bind(reportId,r.company_id,r.project_id||null,Number(n?.n||1),JSON.stringify(snap),note||'',user.name).run();
};
const rmValidateWork=async(workId,companyId,projectId)=>{
  if(!workId)return '';
  const w=await rmWork(workId);if(!w)return 'Tarefa/Demanda vinculada não encontrada';
  if(String(w.company_id)!==String(companyId))return 'A tarefa/demanda pertence a outra empresa';
  if(projectId&&w.project_id&&String(w.project_id)!==String(projectId))return 'A tarefa/demanda pertence a outro projeto';
  return '';
};

if(path==='report-records'&&request.method==='GET'){
  const c=['archived_at IS NULL'],a=[];
  if(scope){c.push('company_id=?');a.push(scope)}
  for(const [q,col] of [['company','company_id'],['project','project_id'],['status','status']]){const v=url.searchParams.get(q);if(v){c.push(col+'=?');a.push(v)}}
  const q=url.searchParams.get('q');if(q){c.push('(title LIKE ? OR reference LIKE ? OR executive_summary LIKE ?)');a.push('%'+q+'%','%'+q+'%','%'+q+'%')}
  return json((await DB.prepare("SELECT r.*,c.name AS company_name,p.name AS project_name,(SELECT COUNT(*) FROM report_versions v WHERE v.report_id=r.id) AS version_count,(SELECT COUNT(*) FROM report_roadmap_items m WHERE m.report_id=r.id AND m.archived_at IS NULL) AS roadmap_count FROM report_records r LEFT JOIN companies c ON c.id=r.company_id LEFT JOIN projects p ON p.id=r.project_id WHERE "+c.map(x=>'r.'+x).join(' AND ')+' ORDER BY r.updated_at DESC').bind(...a).all()).results||[]);
}

if(path==='report-records'&&request.method==='POST'){
  if(!rmReportWrite)return json({error:'Sem permissão para criar report'},403);
  const b=await request.json();if(!String(b.title||'').trim())return json({error:'Título do report é obrigatório'},400);
  const ctx=await rmValidateContext(b.company_id,b.project_id);if(ctx)return json({error:ctx},400);
  const status=String(b.status||'RASCUNHO').toUpperCase();if(!rmStatuses.includes(status))return json({error:'Status inválido'},400);
  const id=rmNewId('RPT');
  const data=b.data&&typeof b.data==='object'?b.data:{};
  await DB.prepare('INSERT INTO report_records(id,company_id,project_id,title,reference,status,executive_summary,data_json,created_by,updated_by,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,b.company_id,b.project_id||null,String(b.title).trim(),b.reference||'',status,b.executive_summary||'',JSON.stringify(data),user.name,user.name,status==='PUBLICADO'?new Date().toISOString():null).run();
  await rmSnapshot(id,'Report criado');
  await logEvent(env,user,'report-nativo:criar',id,String(b.title).trim());
  return json({ok:true,id},201);
}

if(path.match(/^report-records\/[^/]+$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),r=await rmReport(id);if(!r)return json({error:'Report não encontrado'},404);if(!rmScope(r.company_id))return json({error:'Fora do escopo'},403);
  const [roadmap,versions,company,project]=await Promise.all([rmRoadRows(id),DB.prepare('SELECT id,version_no,change_note,created_by,created_at FROM report_versions WHERE report_id=? ORDER BY version_no DESC LIMIT 100').bind(id).all(),rmCompany(r.company_id),r.project_id?rmProject(r.project_id):null]);
  return json({...r,data:rmParse(r.data_json),roadmap,versions:versions.results||[],company,project});
}

if(path.match(/^report-records\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!rmReportWrite)return json({error:'Sem permissão para editar report'},403);
  const id=decodeURIComponent(path.split('/')[1]),r=await rmReport(id);if(!r)return json({error:'Report não encontrado'},404);if(!rmScope(r.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json();
  const companyId=Object.prototype.hasOwnProperty.call(b,'company_id')?b.company_id:r.company_id,projectId=Object.prototype.hasOwnProperty.call(b,'project_id')?b.project_id:r.project_id;
  const ctx=await rmValidateContext(companyId,projectId);if(ctx)return json({error:ctx},400);
  if(b.status&&!rmStatuses.includes(String(b.status).toUpperCase()))return json({error:'Status inválido'},400);
  if(Object.prototype.hasOwnProperty.call(b,'title')&&!String(b.title||'').trim())return json({error:'Título é obrigatório'},400);
  const sets=[],args=[];
  for(const f of ['company_id','project_id','title','reference','executive_summary'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='title'?String(b[f]).trim():b[f])}
  if(Object.prototype.hasOwnProperty.call(b,'status')){const st=String(b.status).toUpperCase();sets.push('status=?');args.push(st);if(st==='PUBLICADO'){sets.push("published_at=COALESCE(published_at,datetime('now'))")}}
  if(Object.prototype.hasOwnProperty.call(b,'data')){sets.push('data_json=?');args.push(JSON.stringify(b.data&&typeof b.data==='object'?b.data:{}))}
  if(sets.length){sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE report_records SET '+sets.join(',')+' WHERE id=?').bind(...args).run()}
  await rmSnapshot(id,b.change_note||'Report atualizado');
  await logEvent(env,user,'report-nativo:editar',id,b.change_note||'Report atualizado');
  return json({ok:true,id});
}

if(path.match(/^report-records\/[^/]+$/)&&request.method==='DELETE'){
  if(!rmReportWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),r=await rmReport(id);if(!r)return json({error:'Report não encontrado'},404);if(!rmScope(r.company_id))return json({error:'Fora do escopo'},403);
  await rmSnapshot(id,'Report arquivado');
  await DB.prepare("UPDATE report_records SET archived_at=datetime('now'),status='ARQUIVADO',updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();
  await logEvent(env,user,'report-nativo:arquivar',id,r.title);return json({ok:true});
}

if(path.match(/^report-records\/[^/]+\/publish$/)&&request.method==='POST'){
  if(!rmReportWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),r=await rmReport(id);if(!r)return json({error:'Report não encontrado'},404);if(!rmScope(r.company_id))return json({error:'Fora do escopo'},403);
  await DB.prepare("UPDATE report_records SET status='PUBLICADO',published_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();await rmSnapshot(id,'Report publicado');await logEvent(env,user,'report-nativo:publicar',id,r.title);return json({ok:true});
}

if(path.match(/^report-records\/[^/]+\/history$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),r=await rmReport(id);if(!r)return json({error:'Report não encontrado'},404);if(!rmScope(r.company_id))return json({error:'Fora do escopo'},403);
  const rows=(await DB.prepare('SELECT id,version_no,snapshot_json,change_note,created_by,created_at FROM report_versions WHERE report_id=? ORDER BY version_no DESC').bind(id).all()).results||[];
  return json(rows.map(v=>({...v,snapshot:rmParse(v.snapshot_json)})));
}

if(path.match(/^report-records\/[^/]+\/roadmap$/)&&request.method==='POST'){
  if(!rmRoadmapWrite)return json({error:'Sem permissão para editar roadmap'},403);const reportId=decodeURIComponent(path.split('/')[1]),r=await rmReport(reportId);if(!r)return json({error:'Report não encontrado'},404);if(!rmScope(r.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json();if(!String(b.title||'').trim())return json({error:'Título do item é obrigatório'},400);
  const party=String(b.responsible_party||'DEV').toUpperCase(),status=String(b.status||'PLANEJADO').toUpperCase();if(!rmParties.includes(party))return json({error:'Responsabilidade inválida'},400);if(!rmRoadStatuses.includes(status))return json({error:'Status inválido'},400);
  const workErr=await rmValidateWork(b.work_item_id,r.company_id,r.project_id);if(workErr)return json({error:workErr},400);
  const id=rmNewId('RDM');const progress=Math.max(0,Math.min(100,Number(b.progress||0)));
  await DB.prepare('INSERT INTO report_roadmap_items(id,report_id,company_id,project_id,title,description,responsible_party,responsible_name,external_party,status,start_date,due_date,progress,work_item_id,rank,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,reportId,r.company_id,r.project_id||null,String(b.title).trim(),b.description||'',party,b.responsible_name||'',b.external_party||'',status,b.start_date||null,b.due_date||null,progress,b.work_item_id||null,b.rank??Date.now(),user.name,user.name).run();
  await rmSnapshot(reportId,'Roadmap: item criado — '+String(b.title).trim());await logEvent(env,user,'report-roadmap:criar',id,String(b.title).trim());return json({ok:true,id},201);
}

if(path.match(/^report-roadmap\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!rmRoadmapWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),m=await rmRoad(id);if(!m)return json({error:'Item de roadmap não encontrado'},404);if(!rmScope(m.company_id))return json({error:'Fora do escopo'},403);const b=await request.json();
  if(b.responsible_party&&!rmParties.includes(String(b.responsible_party).toUpperCase()))return json({error:'Responsabilidade inválida'},400);if(b.status&&!rmRoadStatuses.includes(String(b.status).toUpperCase()))return json({error:'Status inválido'},400);if(Object.prototype.hasOwnProperty.call(b,'work_item_id')){const e=await rmValidateWork(b.work_item_id,m.company_id,m.project_id);if(e)return json({error:e},400)}
  const sets=[],args=[];for(const f of ['title','description','responsible_name','external_party','start_date','due_date','work_item_id','rank'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(f==='title'?String(b[f]||'').trim():b[f])}
  if(Object.prototype.hasOwnProperty.call(b,'responsible_party')){sets.push('responsible_party=?');args.push(String(b.responsible_party).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'status')){sets.push('status=?');args.push(String(b.status).toUpperCase())}if(Object.prototype.hasOwnProperty.call(b,'progress')){sets.push('progress=?');args.push(Math.max(0,Math.min(100,Number(b.progress||0))))}
  if(!sets.length)return json({ok:true,id});sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE report_roadmap_items SET '+sets.join(',')+' WHERE id=?').bind(...args).run();await rmSnapshot(m.report_id,'Roadmap: item atualizado — '+(b.title||m.title));await logEvent(env,user,'report-roadmap:editar',id,b.title||m.title);return json({ok:true,id});
}

if(path.match(/^report-roadmap\/[^/]+$/)&&request.method==='DELETE'){
  if(!rmRoadmapWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),m=await rmRoad(id);if(!m)return json({error:'Item não encontrado'},404);if(!rmScope(m.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE report_roadmap_items SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();await rmSnapshot(m.report_id,'Roadmap: item removido — '+m.title);return json({ok:true});
}
