// Arquivo multitenant: metadados/governança no D1; conteúdo físico no R2 DOCS.
const tfWrite=['admin','pmo','techlead','gestor'].includes(user.role);
const tfScope=id=>!scope||String(id)===String(scope);
const tfNew=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
const tfSafe=(v,n=5000)=>String(v??'').slice(0,n);
const tfProject=async id=>DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(id).first();
const tfContext=async(companyId,projectId)=>{
 if(!companyId)return {error:'Empresa é obrigatória',status:400};if(!tfScope(companyId))return {error:'Fora do escopo',status:403};
 const c=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(companyId).first();if(!c)return {error:'Empresa não encontrada',status:404};
 let p=null;if(projectId!=null&&projectId!==''){p=await tfProject(projectId);if(!p)return {error:'Projeto não encontrado',status:404};if(String(p.company_id)!==String(companyId))return {error:'Projeto não pertence à empresa',status:400}}
 return {company:c,project:p};
};
const tfRow=async id=>DB.prepare('SELECT * FROM tenant_files WHERE id=?').bind(id).first();

if(path==='tenant-files'&&request.method==='GET'){
 const company=url.searchParams.get('company'),project=url.searchParams.get('project'),entityType=tfSafe(url.searchParams.get('entity_type')||'',80),entityId=tfSafe(url.searchParams.get('entity_id')||'',180),archived=url.searchParams.get('archived')==='1';const ctx=await tfContext(company,project);if(ctx.error)return json({error:ctx.error},ctx.status);
 const cond=['company_id=?'],args=[company];if(project){cond.push('project_id=?');args.push(project)}else cond.push('project_id IS NULL');if(entityType){cond.push('entity_type=?');args.push(entityType)}if(entityId){cond.push('entity_id=?');args.push(entityId)}cond.push(archived?'archived_at IS NOT NULL':'archived_at IS NULL');
 const rows=(await DB.prepare('SELECT id,company_id,project_id,entity_type,entity_id,category,title,description,file_name,mime_type,size_bytes,version_no,client_visible,status,created_by,created_at,archived_at FROM tenant_files WHERE '+cond.join(' AND ')+' ORDER BY created_at DESC').bind(...args).all()).results||[];return json({rows,storage:{r2:!!env.DOCS}});
}

if(path==='tenant-files/upload'&&request.method==='POST'){
 if(!tfWrite)return json({error:'Sem permissão'},403);if(!env.DOCS)return json({error:'Armazenamento R2 DOCS ainda não configurado'},503);
 const form=await request.formData(),company=form.get('company_id'),project=form.get('project_id')||null,ctx=await tfContext(company,project);if(ctx.error)return json({error:ctx.error},ctx.status);const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function')return json({error:'Selecione um arquivo'},400);const max=20*1024*1024;if(Number(file.size||0)>max)return json({error:'Arquivo excede 20 MB'},413);
 const entityType=tfSafe(form.get('entity_type')||'PROJECT',80).toUpperCase(),entityId=tfSafe(form.get('entity_id')||project||company,180),category=tfSafe(form.get('category')||'DOCUMENTO',80),id=tfNew('TFL');const safeName=String(file.name||'arquivo').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-160);const key=`${company}/${project||'_company'}/${entityType}/${entityId}/${id}/${safeName}`;
 const prev=await DB.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS n FROM tenant_files WHERE company_id=? AND COALESCE(project_id,0)=COALESCE(?,0) AND entity_type=? AND entity_id=? AND category=?').bind(company,project,entityType,entityId,category).first();const ver=Number(prev?.n||1);
 await env.DOCS.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{company_id:String(company),project_id:String(project||''),entity_type:entityType,entity_id:entityId,file_id:id,version:String(ver)}});
 await DB.prepare('INSERT INTO tenant_files(id,company_id,project_id,entity_type,entity_id,category,title,description,object_key,file_name,mime_type,size_bytes,version_no,client_visible,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,company,project,entityType,entityId,category,tfSafe(form.get('title')||file.name,500),tfSafe(form.get('description'),5000),key,tfSafe(file.name,500),tfSafe(file.type,200),Number(file.size||0),ver,String(form.get('client_visible')||'1')==='0'?0:1,'ACTIVE',user.name).run();
 await logEvent(env,user,'arquivo:upload',id,`${company}/${project||'-'} ${file.name}`);return json({ok:true,id,version_no:ver,file_name:file.name},201);
}

if(path.match(/^tenant-files\/[^/]+\/content$/)&&request.method==='GET'){
 const id=decodeURIComponent(path.split('/')[1]),f=await tfRow(id);if(!f||f.archived_at)return json({error:'Arquivo não encontrado'},404);if(!tfScope(f.company_id))return json({error:'Fora do escopo'},403);const ctx=await tfContext(f.company_id,f.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);if(!env.DOCS||!f.object_key)return json({error:'Conteúdo indisponível'},404);const obj=await env.DOCS.get(f.object_key);if(!obj)return json({error:'Conteúdo indisponível'},404);const h=new Headers();h.set('content-type',f.mime_type||obj.httpMetadata?.contentType||'application/octet-stream');h.set('content-disposition',`inline; filename="${String(f.file_name||'arquivo').replace(/["\r\n]/g,'')}"`);h.set('cache-control','private, max-age=60');return new Response(obj.body,{headers:h});
}

if(path.match(/^tenant-files\/[^/]+$/)&&request.method==='DELETE'){
 if(!tfWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),f=await tfRow(id);if(!f)return json({error:'Arquivo não encontrado'},404);if(!tfScope(f.company_id))return json({error:'Fora do escopo'},403);const ctx=await tfContext(f.company_id,f.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);
 // Arquiva metadados, mas NÃO apaga o objeto físico automaticamente: preserva histórico/auditoria.
 await DB.prepare("UPDATE tenant_files SET status='ARCHIVED',archived_at=COALESCE(archived_at,datetime('now')) WHERE id=?").bind(id).run();await logEvent(env,user,'arquivo:arquivar',id,f.file_name||f.title||'');return json({ok:true,archived:true});
}

if(path.match(/^tenant-files\/[^/]+\/restore$/)&&request.method==='POST'){
 if(!tfWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),f=await tfRow(id);if(!f)return json({error:'Arquivo não encontrado'},404);if(!tfScope(f.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE tenant_files SET status='ACTIVE',archived_at=NULL WHERE id=?").bind(id).run();await logEvent(env,user,'arquivo:restaurar',id,f.file_name||f.title||'');return json({ok:true,restored:true});
}

if(path.match(/^public-tenant-files\/[^/]+\/content$/)&&request.method==='GET'){
 const id=decodeURIComponent(path.split('/')[1]),company=url.searchParams.get('company');if(!company)return json({error:'Informe a empresa'},400);const f=await DB.prepare("SELECT * FROM tenant_files WHERE id=? AND company_id=? AND client_visible=1 AND status='ACTIVE' AND archived_at IS NULL").bind(id,company).first();if(!f||!f.object_key||!env.DOCS)return json({error:'Arquivo indisponível'},404);if(f.project_id){const p=await tfProject(f.project_id);if(!p||String(p.company_id)!==String(company))return json({error:'Contexto inválido'},403)}const obj=await env.DOCS.get(f.object_key);if(!obj)return json({error:'Arquivo indisponível'},404);const h=new Headers();h.set('content-type',f.mime_type||obj.httpMetadata?.contentType||'application/octet-stream');h.set('content-disposition',`inline; filename="${String(f.file_name||'arquivo').replace(/["\r\n]/g,'')}"`);return new Response(obj.body,{headers:h});
}
