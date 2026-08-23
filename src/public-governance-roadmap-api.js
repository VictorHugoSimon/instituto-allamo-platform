// Governança pública do cliente — somente conteúdo explicitamente visível e tenant/project locked.
if(path==='public-governance'&&request.method==='GET'){
  const requested=String(url.searchParams.get('company')||'').trim(),projectId=String(url.searchParams.get('project')||'').trim();
  if(!requested||!projectId)return json({error:'Informe empresa e projeto'},400);
  const token=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  let co=await DB.prepare('SELECT * FROM companies WHERE CAST(id AS TEXT)=? OR lower(CAST(id AS TEXT))=lower(?) LIMIT 1').bind(requested,requested).first();
  if(!co){const wanted=token(requested),all=(await DB.prepare('SELECT * FROM companies').all()).results||[],matches=all.filter(row=>[row.public_slug,row.slug,row.client_slug,row.name,row.company_name,row.nome_fantasia].some(v=>v!=null&&token(v)===wanted));if(matches.length>1)return json({error:'Link público ambíguo'},409);co=matches[0]||null}
  if(!co)return json({error:'Empresa não encontrada'},404);
  const companyId=String(co.id),project=await DB.prepare('SELECT * FROM projects WHERE id=? AND company_id=?').bind(projectId,companyId).first();
  if(!project)return json({error:'Projeto não encontrado para esta empresa'},404);
  let events=[];
  try{events=(await DB.prepare("SELECT id,event_type,title,description,area,sector,start_at,end_at,location,meeting_url,status,minutes_summary,decisions_summary FROM governance_events WHERE company_id=? AND project_id=? AND client_visible=1 AND archived_at IS NULL ORDER BY CASE WHEN start_at IS NULL THEN 1 ELSE 0 END,start_at ASC,created_at DESC").bind(companyId,projectId).all()).results||[]}catch(e){return json({company:{id:companyId,name:co.name||co.company_name||companyId},project:{id:String(project.id),name:project.name||project.title||'Projeto'},events:[],governance_available:false,context_locked:true})}
  const out=[];
  for(const ev of events){
    const [agenda,stakeholders,work,decisions]=await Promise.all([
      DB.prepare("SELECT id,title,description,area,owner_name,status,rank FROM governance_event_agenda_items WHERE event_id=? AND company_id=? AND project_id=? AND client_visible=1 AND archived_at IS NULL ORDER BY rank ASC,created_at ASC").bind(ev.id,companyId,projectId).all(),
      DB.prepare("SELECT id,stakeholder_type,name,role_name,area,attendance_status FROM governance_event_stakeholders WHERE event_id=? AND company_id=? AND project_id=? AND client_visible=1 AND archived_at IS NULL ORDER BY name ASC").bind(ev.id,companyId,projectId).all(),
      DB.prepare("SELECT l.id,l.relation_type,w.id AS work_item_id,w.title AS work_title,w.status AS work_status,w.owner AS work_owner,w.due_date AS work_due_date,w.item_type AS work_type FROM governance_event_work_links l JOIN work_items w ON w.id=l.work_item_id AND w.archived_at IS NULL WHERE l.event_id=? AND l.company_id=? AND l.project_id=? AND l.client_visible=1 AND l.archived_at IS NULL AND w.company_id=? AND w.project_id=? ORDER BY l.created_at ASC").bind(ev.id,companyId,projectId,companyId,projectId).all(),
      DB.prepare("SELECT id,title,decision_text,owner_name,due_date,status FROM governance_event_decisions WHERE event_id=? AND company_id=? AND project_id=? AND client_visible=1 AND archived_at IS NULL ORDER BY due_date ASC,created_at ASC").bind(ev.id,companyId,projectId).all()
    ]);
    out.push({...ev,agenda_items:agenda.results||[],stakeholders:stakeholders.results||[],work_links:work.results||[],decisions:decisions.results||[]});
  }
  return json({company:{id:companyId,name:co.name||co.company_name||co.nome_fantasia||companyId},project:{id:String(project.id),name:project.name||project.title||'Projeto'},events:out,governance_available:true,context_locked:true});
}
