// Portal público do cliente: o parâmetro ?company é a única fonte de verdade.
// Retorna somente dados necessários para navegação Empresa -> Projetos -> Reports publicados.
// Compatível com evolução de schema: campos auxiliares nunca podem derrubar o painel público.
if(path==='public-client-projects'&&request.method==='GET'){
  const requested=url.searchParams.get('company');
  const cid=String(requested||'').trim();
  if(!cid)return json({error:'Informe a empresa'},400);

  // IDs internos continuam sendo a chave canônica. Links antigos/amigáveis também podem usar um slug
  // EXATO do nome da empresa. Nunca usa LIKE, aproximação, primeira empresa ou contexto de sessão.
  const pcToken=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const pcSlug=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  let co=await DB.prepare('SELECT * FROM companies WHERE CAST(id AS TEXT)=? OR lower(CAST(id AS TEXT))=lower(?) LIMIT 1').bind(cid,cid).first();
  let resolvedBy='id';
  if(!co){
    const wanted=pcToken(cid);
    const all=(await DB.prepare('SELECT * FROM companies').all()).results||[];
    const matches=all.filter(row=>{
      const aliases=[row.public_slug,row.slug,row.client_slug,row.name,row.company_name,row.nome_fantasia];
      return aliases.some(v=>v!=null&&pcToken(v)===wanted);
    });
    if(matches.length>1)return json({error:'Link público ambíguo. Gere um novo link para esta empresa.'},409);
    co=matches[0]||null;
    resolvedBy=co?'slug':'none';
  }
  if(!co)return json({error:'Empresa não encontrada'},404);
  const canonicalId=String(co.id);
  const displayName=co.name||co.company_name||co.nome_fantasia||canonicalId;
  const publicSlug=pcSlug(co.public_slug||co.slug||co.client_slug||displayName);

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
    resolved_by:resolvedBy,
    public_slug:publicSlug,
    company:{id:canonicalId,name:displayName,city:co.city||'',status:co.status||'',status_text:co.status_text||''},
    projects,
    context_locked:true,
    schema_compatible:true
  });
}
