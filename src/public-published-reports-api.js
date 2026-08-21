// Reports nativos publicados no link público do cliente (sem login).
if(path==='public-published-reports'&&request.method==='GET'){
  const cid=url.searchParams.get('company');const pid=url.searchParams.get('project');
  if(!cid)return json({error:'Informe a empresa'},400);
  const co=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(cid).first();if(!co)return json({error:'Empresa não encontrada'},404);
  const cond=['r.company_id=?',"r.status='PUBLICADO'",'r.archived_at IS NULL'],args=[cid];if(pid){cond.push('r.project_id=?');args.push(pid)}
  const rows=(await DB.prepare("SELECT r.id,r.company_id,r.project_id,r.title,r.reference,r.status,r.executive_summary,r.published_at,r.updated_at,p.name AS project_name FROM report_records r LEFT JOIN projects p ON p.id=r.project_id WHERE "+cond.join(' AND ')+" ORDER BY COALESCE(r.published_at,r.updated_at) DESC").bind(...args).all()).results||[];
  return json(rows);
}
if(path.match(/^public-published-reports\/[^/]+$/)&&request.method==='GET'){
  const cid=url.searchParams.get('company');if(!cid)return json({error:'Informe a empresa'},400);
  const id=decodeURIComponent(path.split('/')[1]);
  const r=await DB.prepare("SELECT * FROM report_records WHERE id=? AND company_id=? AND status='PUBLICADO' AND archived_at IS NULL").bind(id,cid).first();if(!r)return json({error:'Report publicado não encontrado'},404);
  let data={};try{data=JSON.parse(r.data_json||'{}')}catch(_){}
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(cid).first();
  const project=r.project_id?await DB.prepare('SELECT id,name,company_id FROM projects WHERE id=?').bind(r.project_id).first():null;
  const roadmap=(await DB.prepare("SELECT id,title,description,responsible_party,responsible_name,external_party,status,start_date,due_date,progress FROM report_roadmap_items WHERE report_id=? AND archived_at IS NULL ORDER BY rank ASC,created_at ASC").bind(id).all()).results||[];
  return json({...r,data,company,project,roadmap});
}
