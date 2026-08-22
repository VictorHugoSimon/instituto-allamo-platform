// Guard obrigatório: novos Reports são sempre de um projeto pertencente à empresa.
// Executado antes do módulo Report Management; não altera Reports legados automaticamente.
if(path==='report-records'&&request.method==='POST'){
  const probe=await request.clone().json().catch(()=>({}));
  if(!probe.company_id)return json({error:'Empresa é obrigatória para criar o Report'},400);
  if(probe.project_id==null||probe.project_id==='')return json({error:'Projeto é obrigatório. Todo Report deve pertencer a um projeto.'},400);
  const p=await DB.prepare('SELECT id,company_id,name FROM projects WHERE id=?').bind(probe.project_id).first();
  if(!p)return json({error:'Projeto não encontrado'},404);
  if(String(p.company_id)!==String(probe.company_id))return json({error:'O projeto selecionado não pertence à empresa do Report'},400);
  if(scope&&String(scope)!==String(probe.company_id))return json({error:'Fora do escopo da empresa'},403);
}

if(path.match(/^report-records\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  const reportId=decodeURIComponent(path.split('/')[1]);
  const current=await DB.prepare('SELECT id,company_id,project_id FROM report_records WHERE id=? AND archived_at IS NULL').bind(reportId).first();
  if(current){
    const probe=await request.clone().json().catch(()=>({}));
    const companyId=Object.prototype.hasOwnProperty.call(probe,'company_id')?probe.company_id:current.company_id;
    const projectId=Object.prototype.hasOwnProperty.call(probe,'project_id')?probe.project_id:current.project_id;
    if(projectId==null||projectId==='')return json({error:'Projeto é obrigatório. O Report não pode ficar sem projeto.'},400);
    const p=await DB.prepare('SELECT id,company_id FROM projects WHERE id=?').bind(projectId).first();
    if(!p)return json({error:'Projeto não encontrado'},404);
    if(String(p.company_id)!==String(companyId))return json({error:'O projeto selecionado não pertence à empresa do Report'},400);
    if(scope&&String(scope)!==String(companyId))return json({error:'Fora do escopo da empresa'},403);
  }
}

if(path.match(/^report-records\/[^/]+\/publish$/)&&request.method==='POST'){
  const reportId=decodeURIComponent(path.split('/')[1]);
  const current=await DB.prepare('SELECT company_id,project_id FROM report_records WHERE id=? AND archived_at IS NULL').bind(reportId).first();
  if(current&&(current.project_id==null||current.project_id===''))return json({error:'Associe este Report a um projeto antes de publicar.'},409);
}
