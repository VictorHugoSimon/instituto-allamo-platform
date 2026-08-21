// Portal público do cliente: empresa da URL é a única fonte de verdade.
// Retorna somente dados necessários para navegação Empresa -> Projetos -> Reports publicados.
if(path==='public-client-projects'&&request.method==='GET'){
  const cid=url.searchParams.get('company');if(!cid)return json({error:'Informe a empresa'},400);
  const co=await DB.prepare('SELECT id,name,city,status,status_text FROM companies WHERE id=?').bind(cid).first();if(!co)return json({error:'Empresa não encontrada'},404);
  const rows=(await DB.prepare("SELECT p.id,p.name,p.status,p.badge,p.summary,p.start_date,p.meta_date,COUNT(r.id) AS published_reports,MAX(COALESCE(r.published_at,r.updated_at)) AS last_report_at FROM projects p LEFT JOIN report_records r ON r.project_id=p.id AND r.company_id=p.company_id AND r.status='PUBLICADO' AND r.archived_at IS NULL WHERE p.company_id=? GROUP BY p.id,p.name,p.status,p.badge,p.summary,p.start_date,p.meta_date ORDER BY COALESCE(MAX(COALESCE(r.published_at,r.updated_at)),p.start_date) DESC,p.id DESC").bind(cid).all()).results||[];
  return json({company:{id:co.id,name:co.name,city:co.city||'',status:co.status||'',status_text:co.status_text||''},projects:rows.map(r=>({...r,published_reports:Number(r.published_reports||0)})),context_locked:true});
}
