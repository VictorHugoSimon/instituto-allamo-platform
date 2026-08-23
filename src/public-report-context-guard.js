// Link público do cliente: o parâmetro ?company é a única fonte de verdade.
// Intercepta a rota legada antes dela para neutralizar qualquer nome/contexto salvo de outra empresa.
if(path==='public-report'&&request.method==='GET'){
  const requested=url.searchParams.get('company');
  const cid=String(requested||'').trim();
  if(!cid)return json({error:'Informe a empresa'},400);
  const prToken=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  let co=await DB.prepare('SELECT * FROM companies WHERE CAST(id AS TEXT)=? OR lower(CAST(id AS TEXT))=lower(?) LIMIT 1').bind(cid,cid).first();
  let resolvedBy='id';
  if(!co){
    const wanted=prToken(cid);
    const all=(await DB.prepare('SELECT * FROM companies').all()).results||[];
    const matches=all.filter(row=>[row.public_slug,row.slug,row.client_slug,row.name,row.company_name,row.nome_fantasia].some(v=>v!=null&&prToken(v)===wanted));
    if(matches.length>1)return json({error:'Link público ambíguo. Gere um novo link para esta empresa.'},409);
    co=matches[0]||null;
    resolvedBy=co?'slug':'none';
  }
  if(!co)return json({error:'Empresa não encontrada'},404);
  const canonicalId=String(co.id);
  const companyName=co.name||co.company_name||co.nome_fantasia||canonicalId;
  const row=await DB.prepare('SELECT data_json,ref,updated_at FROM project_reports WHERE company_id=?').bind(canonicalId).first();
  let data;
  try{data=row?.data_json?JSON.parse(row.data_json):defaultReport(co)}catch(_){data=defaultReport(co)}
  if(!data||typeof data!=='object')data=defaultReport(co);
  // Identidade pública sempre vem do cadastro real da empresa, nunca do JSON persistido/clonado.
  data.client=companyName;
  if(data.tap&&typeof data.tap==='object')data.tap.cliente=companyName;
  if(/^Governança da Implantação\s*·/i.test(String(data.title||'')))data.title='Governança da Implantação · '+companyName;
  const gmuds=(await DB.prepare("SELECT id,title,project,window_txt,status,description FROM gmud WHERE company_id=? AND client_visible=1 AND status IN ('Aprovada','Agendada','Implementada') ORDER BY id DESC LIMIT 20").bind(canonicalId).all()).results||[];
  const updates=(await DB.prepare('SELECT author,message,created_at FROM project_updates WHERE company_id=? ORDER BY id DESC LIMIT 20').bind(canonicalId).all()).results||[];
  return json({data,gmuds,updates,company:{id:canonicalId,name:companyName},meta:{requested_company:cid,resolved_by:resolvedBy,ref:row?.ref||null,updated_at:row?.updated_at||null,context_locked:true}});
}
