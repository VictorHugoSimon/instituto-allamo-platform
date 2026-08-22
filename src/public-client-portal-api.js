// Portal público do cliente: empresa da URL é a única fonte de verdade.
// Retorna somente dados necessários para navegação Empresa -> Projetos -> Reports publicados.
// Compatível com evolução de schema: campos auxiliares nunca podem derrubar o painel público.
if(path==='public-client-projects'&&request.method==='GET'){
  const requested=url.searchParams.get('company');
  const cid=String(requested||'').trim();
  if(!cid)return json({error:'Informe a empresa'},400);

  // Nunca seleciona colunas opcionais nominalmente: SELECT * tolera tenants/bancos em versões diferentes de schema.
  // Resolve somente pelo ID da empresa (case-insensitive para links antigos). Nunca usa primeira empresa, sessão ou outro tenant.
  const co=await DB.prepare('SELECT * FROM companies WHERE CAST(id AS TEXT)=? OR lower(CAST(id AS TEXT))=lower(?) LIMIT 1').bind(cid,cid).first();
  if(!co)return json({error:'Empresa não encontrada'},404);
  const canonicalId=String(co.id);

  // Projetos são carregados sem depender de badge/summary/start_date/meta_date existirem fisicamente.
  const projectRows=(await DB.prepare('SELECT * FROM projects p WHERE p.company_id=? ORDER BY p.id DESC').bind(canonicalId).all()).results||[];

  // Estatísticas de Report são enriquecimento, nunca requisito para abrir o painel.
  // Suporta schema atual e também bancos anteriores sem archived_at.
  let reportStats=[];
  try{
    reportStats=(await DB.prepare("SELECT project_id,COUNT(id) AS published_reports,MAX(COALESCE(published_at,updated_at)) AS last_report_at FROM report_records WHERE company_id=? AND status='PUBLICADO' AND archived_at IS NULL GROUP BY project_id").bind(canonicalId).all()).results||[];
  }catch(primaryError){
    try{
      reportStats=(await DB.prepare("SELECT project_id,COUNT(id) AS published_reports,MAX(COALESCE(published_at,updated_at)) AS last_report_at FROM report_records WHERE company_id=? AND status='PUBLICADO' GROUP BY project_id").bind(canonicalId).all()).results||[];
    }catch(legacyError){
      console.error('[public-client-projects] report stats indisponíveis',legacyError?.message||legacyError,primaryError?.message||primaryError);
      reportStats=[];
    }
  }
  const statsByProject=new Map(reportStats.map(r=>[String(r.project_id),r]));
  const projects=projectRows.map(p=>{
    const stats=statsByProject.get(String(p.id))||{};
    return {
      id:String(p.id),
      name:p.name||p.title||'Projeto',
      status:p.status||'',
      badge:p.badge||'',
      summary:p.summary||p.description||'',
      start_date:p.start_date||p.created_at||null,
      meta_date:p.meta_date||p.end_date||null,
      published_reports:Number(stats.published_reports||0),
      last_report_at:stats.last_report_at||null
    };
  });

  return json({
    requested_company:cid,
    company:{id:canonicalId,name:co.name||co.company_name||canonicalId,city:co.city||'',status:co.status||'',status_text:co.status_text||''},
    projects,
    context_locked:true,
    schema_compatible:true
  });
}
