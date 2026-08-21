// Evidências/documentos por grande marco do projeto. Metadados no D1; arquivo físico no binding R2 DOCS quando disponível.
const meWrite=['admin','pmo','techlead','gestor'].includes(user.role);
const meScope=id=>!scope||String(id)===String(scope);
const meNew=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
const meSafe=(v,n=5000)=>String(v??'').slice(0,n);
const meProject=async id=>DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(id).first();
const meContext=async(companyId,projectId)=>{
  if(!companyId||!projectId)return {error:'Empresa e projeto são obrigatórios',status:400};
  if(!meScope(companyId))return {error:'Fora do escopo',status:403};
  const c=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(companyId).first();if(!c)return {error:'Empresa não encontrada',status:404};
  const p=await meProject(projectId);if(!p)return {error:'Projeto não encontrado',status:404};
  if(String(p.company_id)!==String(companyId))return {error:'Projeto não pertence à empresa informada',status:400};
  return {company:c,project:p};
};
const meAsset=async id=>DB.prepare('SELECT * FROM project_milestone_assets WHERE id=? AND archived_at IS NULL').bind(id).first();

if(path==='project-milestone-evidence'&&request.method==='GET'){
  const company=url.searchParams.get('company'),project=url.searchParams.get('project');const ctx=await meContext(company,project);if(ctx.error)return json({error:ctx.error},ctx.status);
  const details=(await DB.prepare('SELECT * FROM project_milestone_details WHERE company_id=? AND project_id=? ORDER BY phase_rank ASC,milestone_rank ASC,updated_at DESC').bind(company,project).all()).results||[];
  const assets=(await DB.prepare('SELECT id,company_id,project_id,phase_key,milestone_key,phase_title,milestone_title,asset_type,title,description,link_url,file_name,mime_type,size_bytes,client_visible,created_by,created_at FROM project_milestone_assets WHERE company_id=? AND project_id=? AND archived_at IS NULL ORDER BY created_at DESC').bind(company,project).all()).results||[];
  return json({company:ctx.company,project:ctx.project,details,assets,storage:{r2:!!env.DOCS}});
}

if(path==='project-milestone-details'&&request.method==='POST'){
  if(!meWrite)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await meContext(b.company_id,b.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);
  const phaseKey=meSafe(b.phase_key,180),milestoneKey=meSafe(b.milestone_key,180);if(!phaseKey||!milestoneKey)return json({error:'Fase e marco são obrigatórios'},400);
  await DB.prepare("INSERT INTO project_milestone_details(company_id,project_id,phase_key,milestone_key,phase_title,milestone_title,description,subdescription,phase_rank,milestone_rank,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(company_id,project_id,phase_key,milestone_key) DO UPDATE SET phase_title=excluded.phase_title,milestone_title=excluded.milestone_title,description=excluded.description,subdescription=excluded.subdescription,phase_rank=excluded.phase_rank,milestone_rank=excluded.milestone_rank,updated_by=excluded.updated_by,updated_at=datetime('now')")
    .bind(b.company_id,b.project_id,phaseKey,milestoneKey,meSafe(b.phase_title,500),meSafe(b.milestone_title,500),meSafe(b.description,20000),meSafe(b.subdescription,20000),Number(b.phase_rank||0),Number(b.milestone_rank||0),user.name).run();
  await logEvent(env,user,'marco:detalhar',`${b.company_id}/${b.project_id}/${milestoneKey}`,meSafe(b.milestone_title,500));return json({ok:true});
}

if(path==='project-milestone-assets'&&request.method==='POST'){
  if(!meWrite)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await meContext(b.company_id,b.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);
  const type=String(b.asset_type||'LINK').toUpperCase();if(type!=='LINK')return json({error:'Use a rota de upload para arquivos'},400);if(!/^https?:\/\//i.test(String(b.link_url||'')))return json({error:'Informe um link http(s) válido'},400);
  const id=meNew('MEA');await DB.prepare('INSERT INTO project_milestone_assets(id,company_id,project_id,phase_key,milestone_key,phase_title,milestone_title,asset_type,title,description,link_url,client_visible,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(id,b.company_id,b.project_id,meSafe(b.phase_key,180),meSafe(b.milestone_key,180),meSafe(b.phase_title,500),meSafe(b.milestone_title,500),'LINK',meSafe(b.title,500),meSafe(b.description,5000),meSafe(b.link_url,5000),b.client_visible===false?0:1,user.name).run();
  await logEvent(env,user,'marco:link',id,meSafe(b.title,500));return json({ok:true,id},201);
}

if(path==='project-milestone-assets/upload'&&request.method==='POST'){
  if(!meWrite)return json({error:'Sem permissão'},403);if(!env.DOCS)return json({error:'Armazenamento de arquivos ainda não configurado. Configure o binding R2 DOCS; links já podem ser usados.'},503);
  const form=await request.formData();const company=form.get('company_id'),project=form.get('project_id');const ctx=await meContext(company,project);if(ctx.error)return json({error:ctx.error},ctx.status);
  const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function')return json({error:'Selecione um arquivo'},400);const max=20*1024*1024;if(Number(file.size||0)>max)return json({error:'Arquivo excede 20 MB'},413);
  const id=meNew('MEA'),safeName=String(file.name||'arquivo').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-160),key=`${company}/${project}/${id}/${safeName}`;
  await env.DOCS.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{company_id:String(company),project_id:String(project),asset_id:id}});
  await DB.prepare('INSERT INTO project_milestone_assets(id,company_id,project_id,phase_key,milestone_key,phase_title,milestone_title,asset_type,title,description,object_key,file_name,mime_type,size_bytes,client_visible,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,company,project,meSafe(form.get('phase_key'),180),meSafe(form.get('milestone_key'),180),meSafe(form.get('phase_title'),500),meSafe(form.get('milestone_title'),500),'FILE',meSafe(form.get('title')||file.name,500),meSafe(form.get('description'),5000),key,meSafe(file.name,500),meSafe(file.type,200),Number(file.size||0),String(form.get('client_visible')||'1')==='0'?0:1,user.name).run();
  await logEvent(env,user,'marco:arquivo',id,meSafe(file.name,500));return json({ok:true,id,file_name:file.name},201);
}

if(path.match(/^project-milestone-assets\/[^/]+\/content$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),a=await meAsset(id);if(!a)return json({error:'Arquivo não encontrado'},404);if(!meScope(a.company_id))return json({error:'Fora do escopo'},403);const ctx=await meContext(a.company_id,a.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);if(a.asset_type!=='FILE'||!a.object_key)return json({error:'Este item não é um arquivo'},400);if(!env.DOCS)return json({error:'Armazenamento R2 DOCS não configurado'},503);
  const obj=await env.DOCS.get(a.object_key);if(!obj)return json({error:'Conteúdo do arquivo não encontrado'},404);const h=new Headers();h.set('content-type',a.mime_type||obj.httpMetadata?.contentType||'application/octet-stream');h.set('content-disposition',`inline; filename="${String(a.file_name||'arquivo').replace(/["\r\n]/g,'')}"`);h.set('cache-control','private, max-age=60');return new Response(obj.body,{headers:h});
}

if(path.match(/^public-milestone-assets\/[^/]+\/content$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]),company=url.searchParams.get('company');if(!company)return json({error:'Informe a empresa'},400);const a=await DB.prepare('SELECT * FROM project_milestone_assets WHERE id=? AND company_id=? AND client_visible=1 AND archived_at IS NULL').bind(id,company).first();if(!a)return json({error:'Arquivo não disponível para esta empresa'},404);const p=await meProject(a.project_id);if(!p||String(p.company_id)!==String(company))return json({error:'Contexto inválido'},403);if(a.asset_type!=='FILE'||!a.object_key||!env.DOCS)return json({error:'Arquivo indisponível'},404);const obj=await env.DOCS.get(a.object_key);if(!obj)return json({error:'Arquivo indisponível'},404);const h=new Headers();h.set('content-type',a.mime_type||obj.httpMetadata?.contentType||'application/octet-stream');h.set('content-disposition',`inline; filename="${String(a.file_name||'arquivo').replace(/["\r\n]/g,'')}"`);return new Response(obj.body,{headers:h});
}

if(path.match(/^project-milestone-assets\/[^/]+$/)&&request.method==='DELETE'){
  if(!meWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),a=await meAsset(id);if(!a)return json({error:'Item não encontrado'},404);if(!meScope(a.company_id))return json({error:'Fora do escopo'},403);const ctx=await meContext(a.company_id,a.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);await DB.prepare("UPDATE project_milestone_assets SET archived_at=datetime('now') WHERE id=?").bind(id).run();if(a.object_key&&env.DOCS)try{await env.DOCS.delete(a.object_key)}catch(_){}await logEvent(env,user,'marco:evidencia-remover',id,a.title||a.file_name||'');return json({ok:true});
}
