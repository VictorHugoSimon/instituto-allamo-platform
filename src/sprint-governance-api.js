// Sprint Governance — DoR / DoD persistentes, versionados e tenant-safe.
const sgWrite=['admin','pmo','techlead','gestor'].includes(user.role);
const sgScope=id=>!scope||String(id)===String(scope);
const sgTypes=['DOR','DOD'];
const sgStatuses=['RASCUNHO','APROVADO','APROVADO_COM_RESSALVAS','NAO_APROVADO'];
const sgId=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
const sgInt=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number.parseInt(v,10)||0));
const sgJson=v=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v&&typeof v==='object'?v:{})}catch(_){return {}}};
const sgDoc=async id=>DB.prepare('SELECT * FROM sprint_documents WHERE id=? AND archived_at IS NULL').bind(id).first();
const sgCompany=async id=>DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(id).first();
const sgProject=async id=>DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(id).first();
const sgContext=async(companyId,projectId)=>{
  if(!companyId)return 'Empresa é obrigatória';
  if(projectId==null||projectId==='')return 'Projeto é obrigatório';
  const c=await sgCompany(companyId);if(!c)return 'Empresa não encontrada';
  if(!sgScope(companyId))return 'Fora do escopo';
  const p=await sgProject(projectId);if(!p)return 'Projeto não encontrado';
  if(String(p.company_id)!==String(companyId))return 'O projeto não pertence à empresa selecionada';
  return '';
};
const sgNormalize=row=>row?{...row,content:sgJson(row.content_json),content_json:undefined}:row;
const sgSnapshot=async(doc,actor)=>{
  const v=await DB.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS next_version FROM sprint_document_versions WHERE document_id=?').bind(doc.id).first();
  const no=Number(v?.next_version||1);
  await DB.prepare('INSERT INTO sprint_document_versions(id,document_id,version_no,status,score,critical_pending,decision,content_json,created_by) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(sgId('SGV'),doc.id,no,doc.status||'RASCUNHO',sgInt(doc.score),sgInt(doc.critical_pending,0,999),doc.decision||'',doc.content_json||'{}',actor||'').run();
  return no;
};

if(path==='sprint-documents'&&request.method==='GET'){
  const where=['d.archived_at IS NULL'],args=[];
  if(scope){where.push('d.company_id=?');args.push(scope)}
  const map=[['company','d.company_id'],['project','d.project_id'],['type','d.document_type'],['status','d.status']];
  for(const [q,col] of map){const v=url.searchParams.get(q);if(v){where.push(col+'=?');args.push(q==='type'||q==='status'?String(v).toUpperCase():v)}}
  const q=String(url.searchParams.get('q')||'').trim();
  if(q){where.push('(LOWER(d.sprint_name) LIKE ? OR LOWER(d.sprint_number) LIKE ? OR LOWER(d.title) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(p.name) LIKE ?)');const like='%'+q.toLowerCase()+'%';args.push(like,like,like,like,like)}
  const rows=(await DB.prepare(`SELECT d.id,d.company_id,d.project_id,d.document_type,d.sprint_name,d.sprint_number,d.title,d.cycle_start,d.cycle_end,d.status,d.score,d.critical_pending,d.decision,d.created_by,d.updated_by,d.created_at,d.updated_at,c.name AS company_name,p.name AS project_name,(SELECT COUNT(*) FROM sprint_document_versions v WHERE v.document_id=d.id) AS version_count FROM sprint_documents d LEFT JOIN companies c ON c.id=d.company_id LEFT JOIN projects p ON p.id=d.project_id WHERE ${where.join(' AND ')} ORDER BY d.updated_at DESC,d.created_at DESC`).bind(...args).all()).results||[];
  return json(rows);
}

if(path==='sprint-documents'&&request.method==='POST'){
  if(!sgWrite)return json({error:'Sem permissão para criar DoR/DoD'},403);
  const b=await request.json().catch(()=>({}));
  const type=String(b.document_type||'').toUpperCase();if(!sgTypes.includes(type))return json({error:'document_type deve ser DOR ou DOD'},400);
  const ctx=await sgContext(b.company_id,b.project_id);if(ctx)return json({error:ctx},ctx==='Fora do escopo'?403:400);
  const id=sgId(type),status=sgStatuses.includes(String(b.status||'').toUpperCase())?String(b.status).toUpperCase():'RASCUNHO';
  const title=String(b.title||(`${type} · ${b.sprint_name||b.sprint_number||'Sprint'}`)).trim();
  const content=JSON.stringify(sgJson(b.content||b.content_json||{}));
  await DB.prepare('INSERT INTO sprint_documents(id,company_id,project_id,document_type,sprint_name,sprint_number,title,cycle_start,cycle_end,status,score,critical_pending,decision,content_json,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,b.company_id,b.project_id,type,String(b.sprint_name||''),String(b.sprint_number||''),title,b.cycle_start||null,b.cycle_end||null,status,sgInt(b.score),sgInt(b.critical_pending,0,999),String(b.decision||''),content,user.name,user.name).run();
  const doc=await sgDoc(id);await sgSnapshot(doc,user.name);await logEvent(env,user,'sprint-document:criar',id,type+' · '+title);
  return json({ok:true,id},201);
}

if(path.match(/^sprint-documents\/[^/]+$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),doc=await sgDoc(id);if(!doc)return json({error:'Documento não encontrado'},404);if(!sgScope(doc.company_id))return json({error:'Fora do escopo'},403);
  const [company,project,versions]=await Promise.all([sgCompany(doc.company_id),sgProject(doc.project_id),DB.prepare('SELECT id,version_no,status,score,critical_pending,decision,created_by,created_at FROM sprint_document_versions WHERE document_id=? ORDER BY version_no DESC').bind(id).all()]);
  return json({...sgNormalize(doc),company_name:company?.name||'',project_name:project?.name||'',versions:versions.results||[]});
}

if(path.match(/^sprint-documents\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!sgWrite)return json({error:'Sem permissão para editar DoR/DoD'},403);
  const id=decodeURIComponent(path.split('/')[1]),old=await sgDoc(id);if(!old)return json({error:'Documento não encontrado'},404);if(!sgScope(old.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json().catch(()=>({}));
  const companyId=Object.prototype.hasOwnProperty.call(b,'company_id')?b.company_id:old.company_id,projectId=Object.prototype.hasOwnProperty.call(b,'project_id')?b.project_id:old.project_id;
  const ctx=await sgContext(companyId,projectId);if(ctx)return json({error:ctx},ctx==='Fora do escopo'?403:400);
  if(b.document_type&&!sgTypes.includes(String(b.document_type).toUpperCase()))return json({error:'Tipo inválido'},400);
  if(b.status&&!sgStatuses.includes(String(b.status).toUpperCase()))return json({error:'Status inválido'},400);
  const sets=[],args=[];
  for(const f of ['company_id','project_id','sprint_name','sprint_number','title','cycle_start','cycle_end','decision'])if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+'=?');args.push(b[f]??'')}
  if(Object.prototype.hasOwnProperty.call(b,'document_type')){sets.push('document_type=?');args.push(String(b.document_type).toUpperCase())}
  if(Object.prototype.hasOwnProperty.call(b,'status')){sets.push('status=?');args.push(String(b.status).toUpperCase())}
  if(Object.prototype.hasOwnProperty.call(b,'score')){sets.push('score=?');args.push(sgInt(b.score))}
  if(Object.prototype.hasOwnProperty.call(b,'critical_pending')){sets.push('critical_pending=?');args.push(sgInt(b.critical_pending,0,999))}
  if(Object.prototype.hasOwnProperty.call(b,'content')||Object.prototype.hasOwnProperty.call(b,'content_json')){sets.push('content_json=?');args.push(JSON.stringify(sgJson(b.content||b.content_json||{})))}
  if(!sets.length)return json({ok:true,id,unchanged:true});
  sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);
  await DB.prepare('UPDATE sprint_documents SET '+sets.join(',')+' WHERE id=?').bind(...args).run();
  const doc=await sgDoc(id);const version=await sgSnapshot(doc,user.name);await logEvent(env,user,'sprint-document:editar',id,'v'+version+' · '+Object.keys(b).join(','));
  return json({ok:true,id,version});
}

if(path.match(/^sprint-documents\/[^/]+\/archive$/)&&request.method==='POST'){
  if(!sgWrite)return json({error:'Sem permissão para arquivar documento'},403);
  const id=decodeURIComponent(path.split('/')[1]),doc=await sgDoc(id);if(!doc)return json({error:'Documento não encontrado'},404);if(!sgScope(doc.company_id))return json({error:'Fora do escopo'},403);
  await DB.prepare("UPDATE sprint_documents SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();
  await logEvent(env,user,'sprint-document:arquivar',id,doc.title);
  return json({ok:true,id,archived:true});
}

if(path.match(/^sprint-documents\/[^/]+$/)&&request.method==='DELETE'){
  if(!sgWrite)return json({error:'Sem permissão para arquivar documento'},403);
  const id=decodeURIComponent(path.split('/')[1]),doc=await sgDoc(id);if(!doc)return json({error:'Documento não encontrado'},404);if(!sgScope(doc.company_id))return json({error:'Fora do escopo'},403);
  await DB.prepare("UPDATE sprint_documents SET archived_at=datetime('now'),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();await logEvent(env,user,'sprint-document:arquivar',id,doc.title);return json({ok:true});
}

if(path.match(/^sprint-documents\/[^/]+\/versions$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),doc=await sgDoc(id);if(!doc)return json({error:'Documento não encontrado'},404);if(!sgScope(doc.company_id))return json({error:'Fora do escopo'},403);
  const rows=(await DB.prepare('SELECT id,version_no,status,score,critical_pending,decision,content_json,created_by,created_at FROM sprint_document_versions WHERE document_id=? ORDER BY version_no DESC').bind(id).all()).results||[];
  return json(rows.map(x=>({...x,content:sgJson(x.content_json),content_json:undefined})));
}

if(path.match(/^sprint-documents\/[^/]+\/duplicate$/)&&request.method==='POST'){
  if(!sgWrite)return json({error:'Sem permissão para duplicar documento'},403);
  const sourceId=decodeURIComponent(path.split('/')[1]),src=await sgDoc(sourceId);if(!src)return json({error:'Documento não encontrado'},404);if(!sgScope(src.company_id))return json({error:'Fora do escopo'},403);
  const b=await request.json().catch(()=>({})),id=sgId(src.document_type),title=String(b.title||src.title+' · Cópia').trim();
  await DB.prepare('INSERT INTO sprint_documents(id,company_id,project_id,document_type,sprint_name,sprint_number,title,cycle_start,cycle_end,status,score,critical_pending,decision,content_json,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,src.company_id,src.project_id,src.document_type,String(b.sprint_name??src.sprint_name),String(b.sprint_number??src.sprint_number),title,b.cycle_start??src.cycle_start,b.cycle_end??src.cycle_end,'RASCUNHO',0,0,'',src.content_json||'{}',user.name,user.name).run();
  const doc=await sgDoc(id);await sgSnapshot(doc,user.name);await logEvent(env,user,'sprint-document:duplicar',id,'origem='+sourceId);return json({ok:true,id},201);
}
