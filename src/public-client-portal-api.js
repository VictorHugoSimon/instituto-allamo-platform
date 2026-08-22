// Portal público do cliente: empresa da URL é a única fonte de verdade.
// Retorna somente dados necessários para navegação Empresa -> Projetos -> Reports publicados.
if(path==='public-client-projects'&&request.method==='GET'){
  const requested=url.searchParams.get('company');
  const cid=String(requested||'').trim();
  if(!cid)return json({error:'Informe a empresa'},400);
  // Resolve somente pelo ID da empresa (case-insensitive para links antigos). Nunca usa primeira empresa, sessão ou nome de outro tenant.
  const co=await DB.prepare('SELECT id,name,city,status,status_text FROM companies WHERE id=? OR lower(CAST(id AS TEXT))=lower(?) LIMIT 1').bind(cid,cid).first();
  if(!co)return json({error:'Empresa não encontrada'},404);
  const canonicalId=String(co.id);
  const rows=(await DB.prepare("SELECT p.id,p.name,p.status,p.badge,p.summary,p.start_date,p.meta_date,COUNT(r.id) AS published_reports,MAX(COALESCE(r.published_at,r.updated_at)) AS last_report_at FROM projects p LEFT JOIN report_records r ON r.project_id=p.id AND r.company_id=p.company_id AND r.status='PUBLICADO' AND r.archived_at IS NULL WHERE p.company_id=? GROUP BY p.id,p.name,p.status,p.badge,p.summary,p.start_date,p.meta_date ORDER BY COALESCE(MAX(COALESCE(r.published_at,r.updated_at)),p.start_date) DESC,p.id DESC").bind(canonicalId).all()).results||[];
  return json({requested_company:cid,company:{id:canonicalId,name:co.name,city:co.city||'',status:co.status||'',status_text:co.status_text||''},projects:rows.map(r=>({...r,published_reports:Number(r.published_reports||0)})),context_locked:true});
}
