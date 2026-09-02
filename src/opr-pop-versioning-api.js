// OPR POP Versioning — consulta somente do histórico documental imutável.
const opvNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const opvCanScope=companyId=>!scope||String(scope)===String(companyId);
const opvProject=async projectId=>{
  if(!projectId&&projectId!==0)return {error:'Projeto OPR é obrigatório'};
  const row=await DB.prepare(`SELECT p.id project_id,p.name project_name,p.company_id,c.name company_name FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.id=?`).bind(projectId).first();
  if(!row)return {error:'Projeto não encontrado'};
  if(!opvCanScope(row.company_id))return {error:'Projeto fora do escopo do usuário'};
  if(!opvNorm(row.company_name).includes('opr'))return {error:'Endpoint exclusivo da OPR'};
  return row;
};

if(path==='opr-pop-versions'&&request.method==='GET'){
  const ctx=await opvProject(url.searchParams.get('project'));if(ctx.error)return json({error:ctx.error},400);
  const rows=(await DB.prepare(`SELECT id,company_id,project_id,version_seq,major_version,minor_version,version_label,document_title,document_status,governance_owner,event_type,procedure_id,reason,actor,created_at FROM opr_pop_versions WHERE project_id=? ORDER BY version_seq DESC LIMIT 250`).bind(ctx.project_id).all()).results||[];
  const current=rows[0]||null;
  return json({project:{id:ctx.project_id,name:ctx.project_name},current,versions:rows});
}

const opvSnapshot=path.match(/^opr-pop-versions\/(\d+)$/);
if(opvSnapshot&&request.method==='GET'){
  const row=await DB.prepare(`SELECT * FROM opr_pop_versions WHERE id=?`).bind(Number(opvSnapshot[1])).first();
  if(!row)return json({error:'Versão não encontrada'},404);
  const ctx=await opvProject(row.project_id);if(ctx.error)return json({error:ctx.error},403);
  return json(row);
}
