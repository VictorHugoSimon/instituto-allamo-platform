// Campos dinâmicos multitenant sem ALTER TABLE por campo de tela.
const dfWrite=['admin','pmo','techlead','gestor'].includes(user.role);
const dfScope=id=>!scope||String(id)===String(scope);
const dfNew=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
const dfSafe=(v,n=5000)=>String(v??'').slice(0,n);
const dfTypes=['text','textarea','number','percentage','hours','date','status','select','list','person','risk','kpi','milestone','table','checklist','curve_s','chart','roadmap','separator','json'];
const dfProject=async id=>DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(id).first();
const dfContext=async(companyId,projectId)=>{
  if(!companyId)return {error:'Empresa é obrigatória',status:400};
  if(!dfScope(companyId))return {error:'Fora do escopo',status:403};
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(companyId).first();if(!company)return {error:'Empresa não encontrada',status:404};
  let project=null;if(projectId!=null&&projectId!==''){project=await dfProject(projectId);if(!project)return {error:'Projeto não encontrado',status:404};if(String(project.company_id)!==String(companyId))return {error:'Projeto não pertence à empresa informada',status:400}}
  return {company,project};
};
const dfDef=async id=>DB.prepare('SELECT * FROM tenant_field_definitions WHERE id=?').bind(id).first();
const dfParse=s=>{try{return JSON.parse(s||'{}')}catch(_){return {}}};

if(path==='dynamic-fields'&&request.method==='GET'){
  const company=url.searchParams.get('company'),project=url.searchParams.get('project'),entity=dfSafe(url.searchParams.get('entity_type')||'PROJECT',80).toUpperCase(),includeArchived=url.searchParams.get('archived')==='1';
  const ctx=await dfContext(company,project);if(ctx.error)return json({error:ctx.error},ctx.status);
  const cond=['company_id=?','entity_type=?'],args=[company,entity];
  if(project){cond.push('(project_id IS NULL OR project_id=?)');args.push(project)}else cond.push('project_id IS NULL');
  if(!includeArchived)cond.push('archived_at IS NULL');
  const rows=(await DB.prepare('SELECT * FROM tenant_field_definitions WHERE '+cond.join(' AND ')+' ORDER BY rank ASC,created_at ASC').bind(...args).all()).results||[];
  return json(rows.map(r=>({...r,config:dfParse(r.config_json)})));
}

if(path==='dynamic-fields'&&request.method==='POST'){
  if(!dfWrite)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await dfContext(b.company_id,b.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);
  const entity=dfSafe(b.entity_type||'PROJECT',80).toUpperCase(),fieldType=dfSafe(b.field_type||'text',40).toLowerCase();if(!dfTypes.includes(fieldType))return json({error:'Tipo de campo inválido'},400);
  const key=dfSafe(b.field_key||b.key,100).trim().toLowerCase().replace(/[^a-z0-9_\-]+/g,'_').replace(/^_+|_+$/g,'');if(!key)return json({error:'Chave do campo é obrigatória'},400);
  const label=dfSafe(b.label||key,300).trim();
  const exists=await DB.prepare('SELECT id FROM tenant_field_definitions WHERE company_id=? AND COALESCE(project_id,0)=COALESCE(?,0) AND entity_type=? AND field_key=? AND archived_at IS NULL').bind(b.company_id,b.project_id||null,entity,key).first();if(exists)return json({error:'Já existe um campo ativo com esta chave',id:exists.id},409);
  const id=dfNew('TDF');await DB.prepare('INSERT INTO tenant_field_definitions(id,company_id,project_id,entity_type,field_key,label,field_type,config_json,required,client_visible,rank,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(id,b.company_id,b.project_id||null,entity,key,label,fieldType,JSON.stringify(b.config&&typeof b.config==='object'?b.config:{}),b.required?1:0,b.client_visible===false?0:1,Number(b.rank||Date.now()),user.name,user.name).run();
  await logEvent(env,user,'campo-dinamico:criar',id,`${entity}/${key}`);return json({ok:true,id},201);
}

if(path.match(/^dynamic-fields\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!dfWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),d=await dfDef(id);if(!d||d.archived_at)return json({error:'Campo não encontrado'},404);if(!dfScope(d.company_id))return json({error:'Fora do escopo'},403);const ctx=await dfContext(d.company_id,d.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);const b=await request.json(),sets=[],args=[];
  if(Object.prototype.hasOwnProperty.call(b,'label')){sets.push('label=?');args.push(dfSafe(b.label,300))}
  if(Object.prototype.hasOwnProperty.call(b,'field_type')){const t=dfSafe(b.field_type,40).toLowerCase();if(!dfTypes.includes(t))return json({error:'Tipo inválido'},400);sets.push('field_type=?');args.push(t)}
  if(Object.prototype.hasOwnProperty.call(b,'config')){sets.push('config_json=?');args.push(JSON.stringify(b.config&&typeof b.config==='object'?b.config:{}))}
  if(Object.prototype.hasOwnProperty.call(b,'required')){sets.push('required=?');args.push(b.required?1:0)}
  if(Object.prototype.hasOwnProperty.call(b,'client_visible')){sets.push('client_visible=?');args.push(b.client_visible?1:0)}
  if(Object.prototype.hasOwnProperty.call(b,'rank')){sets.push('rank=?');args.push(Number(b.rank||0))}
  if(!sets.length)return json({ok:true,id});sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE tenant_field_definitions SET '+sets.join(',')+' WHERE id=?').bind(...args).run();await logEvent(env,user,'campo-dinamico:editar',id,d.field_key);return json({ok:true,id});
}

if(path.match(/^dynamic-fields\/[^/]+$/)&&request.method==='DELETE'){
  if(!dfWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),d=await dfDef(id);if(!d)return json({error:'Campo não encontrado'},404);if(!dfScope(d.company_id))return json({error:'Fora do escopo'},403);
  await DB.prepare("UPDATE tenant_field_definitions SET archived_at=COALESCE(archived_at,datetime('now')),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();await DB.prepare("UPDATE tenant_field_values SET archived_at=COALESCE(archived_at,datetime('now')),updated_at=datetime('now'),updated_by=? WHERE definition_id=?").bind(user.name,id).run();await logEvent(env,user,'campo-dinamico:arquivar',id,d.field_key);return json({ok:true,archived:true});
}

if(path==='dynamic-values'&&request.method==='GET'){
  const company=url.searchParams.get('company'),project=url.searchParams.get('project'),entity=dfSafe(url.searchParams.get('entity_type')||'PROJECT',80).toUpperCase(),entityId=dfSafe(url.searchParams.get('entity_id')||project||company,180);const ctx=await dfContext(company,project);if(ctx.error)return json({error:ctx.error},ctx.status);
  const rows=(await DB.prepare("SELECT v.*,d.field_key,d.label,d.field_type,d.config_json,d.required,d.client_visible,d.rank FROM tenant_field_values v JOIN tenant_field_definitions d ON d.id=v.definition_id AND d.archived_at IS NULL WHERE v.company_id=? AND COALESCE(v.project_id,0)=COALESCE(?,0) AND v.entity_type=? AND v.entity_id=? AND v.archived_at IS NULL ORDER BY d.rank ASC").bind(company,project||null,entity,entityId).all()).results||[];
  return json(rows.map(r=>({...r,value:dfParse(r.value_json),config:dfParse(r.config_json)})));
}

if(path==='dynamic-values'&&(request.method==='POST'||request.method==='PUT')){
  if(!dfWrite)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await dfContext(b.company_id,b.project_id);if(ctx.error)return json({error:ctx.error},ctx.status);const d=await dfDef(b.definition_id);if(!d||d.archived_at)return json({error:'Definição de campo não encontrada'},404);if(String(d.company_id)!==String(b.company_id))return json({error:'Campo pertence a outra empresa'},403);if(d.project_id!=null&&String(d.project_id)!==String(b.project_id||''))return json({error:'Campo pertence a outro projeto'},403);
  const entity=dfSafe(b.entity_type||d.entity_type,80).toUpperCase(),entityId=dfSafe(b.entity_id||b.project_id||b.company_id,180);if(entity!==String(d.entity_type).toUpperCase())return json({error:'Tipo de entidade incompatível'},400);const value=b.value===undefined?null:b.value;
  const current=await DB.prepare('SELECT id FROM tenant_field_values WHERE definition_id=? AND company_id=? AND COALESCE(project_id,0)=COALESCE(?,0) AND entity_type=? AND entity_id=?').bind(d.id,b.company_id,b.project_id||null,entity,entityId).first();
  if(current){await DB.prepare("UPDATE tenant_field_values SET value_json=?,archived_at=NULL,updated_at=datetime('now'),updated_by=? WHERE id=?").bind(JSON.stringify(value),user.name,current.id).run();await logEvent(env,user,'campo-dinamico:valor-editar',current.id,d.field_key);return json({ok:true,id:current.id})}
  const id=dfNew('TDV');await DB.prepare('INSERT INTO tenant_field_values(id,definition_id,company_id,project_id,entity_type,entity_id,value_json,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,d.id,b.company_id,b.project_id||null,entity,entityId,JSON.stringify(value),user.name,user.name).run();await logEvent(env,user,'campo-dinamico:valor-criar',id,d.field_key);return json({ok:true,id},201);
}
