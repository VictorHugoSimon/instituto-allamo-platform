// Protege e expõe Reports publicados para o painel da empresa/cliente.
// Executa antes do report-management-api para impedir leitura de rascunhos por usuário cliente.
const rpcParse=s=>{try{return JSON.parse(s||'{}')}catch(_){return {}}};
const rpcScopeOk=id=>!scope||String(id)===String(scope);

if(path==='published-reports'&&request.method==='GET'){
  const cond=['r.archived_at IS NULL',"r.status='PUBLICADO'"],args=[];
  const company=url.searchParams.get('company');
  const project=url.searchParams.get('project');
  if(scope){cond.push('r.company_id=?');args.push(scope)}
  else if(company){cond.push('r.company_id=?');args.push(company)}
  if(project){cond.push('r.project_id=?');args.push(project)}
  const rows=(await DB.prepare("SELECT r.id,r.company_id,r.project_id,r.title,r.reference,r.status,r.executive_summary,r.published_at,r.updated_at,c.name AS company_name,p.name AS project_name FROM report_records r LEFT JOIN companies c ON c.id=r.company_id LEFT JOIN projects p ON p.id=r.project_id WHERE "+cond.join(' AND ')+" ORDER BY COALESCE(r.published_at,r.updated_at) DESC").bind(...args).all()).results||[];
  return json(rows);
}

if(path.match(/^published-reports\/[^/]+$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]);
  const r=await DB.prepare("SELECT * FROM report_records WHERE id=? AND archived_at IS NULL AND status='PUBLICADO'").bind(id).first();
  if(!r)return json({error:'Report publicado não encontrado'},404);
  if(!rpcScopeOk(r.company_id))return json({error:'Fora do escopo'},403);
  const roadmap=(await DB.prepare("SELECT id,title,description,responsible_party,responsible_name,external_party,status,start_date,due_date,progress FROM report_roadmap_items WHERE report_id=? AND archived_at IS NULL ORDER BY rank ASC,created_at ASC").bind(id).all()).results||[];
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(r.company_id).first();
  const project=r.project_id?await DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(r.project_id).first():null;
  return json({...r,data:rpcParse(r.data_json),roadmap,company,project});
}

// Segurança: usuário cliente nunca consome rascunhos pela API administrativa.
if(user.role==='usuario'&&path==='report-records'&&request.method==='GET'){
  const cond=['r.archived_at IS NULL',"r.status='PUBLICADO'",'r.company_id=?'],args=[scope||user.company_id];
  const project=url.searchParams.get('project');if(project){cond.push('r.project_id=?');args.push(project)}
  return json((await DB.prepare("SELECT r.*,c.name AS company_name,p.name AS project_name,(SELECT COUNT(*) FROM report_versions v WHERE v.report_id=r.id) AS version_count FROM report_records r LEFT JOIN companies c ON c.id=r.company_id LEFT JOIN projects p ON p.id=r.project_id WHERE "+cond.join(' AND ')+" ORDER BY COALESCE(r.published_at,r.updated_at) DESC").bind(...args).all()).results||[]);
}
if(user.role==='usuario'&&path.match(/^report-records\/[^/]+$/)&&request.method==='GET'){
  const id=decodeURIComponent(path.split('/')[1]);
  const r=await DB.prepare("SELECT * FROM report_records WHERE id=? AND company_id=? AND status='PUBLICADO' AND archived_at IS NULL").bind(id,scope||user.company_id).first();
  if(!r)return json({error:'Report não encontrado'},404);
  return json({...r,data:rpcParse(r.data_json)});
}
if(user.role==='usuario'&&path.startsWith('report-records/')&&request.method!=='GET')return json({error:'Sem permissão'},403);
