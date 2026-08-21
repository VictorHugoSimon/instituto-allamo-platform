// Link público do cliente: o parâmetro ?company é a única fonte de verdade.
// Intercepta a rota legada antes dela para neutralizar qualquer nome/contexto salvo de outra empresa.
if(path==='public-report'&&request.method==='GET'){
  const cid=url.searchParams.get('company');
  if(!cid)return json({error:'Informe a empresa'},400);
  const co=await DB.prepare('SELECT * FROM companies WHERE id=?').bind(cid).first();
  if(!co)return json({error:'Empresa não encontrada'},404);
  const row=await DB.prepare('SELECT data_json,ref,updated_at FROM project_reports WHERE company_id=?').bind(cid).first();
  let data;
  try{data=row?.data_json?JSON.parse(row.data_json):defaultReport(co)}catch(_){data=defaultReport(co)}
  if(!data||typeof data!=='object')data=defaultReport(co);
  // Identidade pública sempre vem do cadastro real da empresa, nunca do JSON persistido/clonado.
  data.client=co.name;
  if(data.tap&&typeof data.tap==='object')data.tap.cliente=co.name;
  if(/^Governança da Implantação\s*·/i.test(String(data.title||'')))data.title='Governança da Implantação · '+co.name;
  const gmuds=(await DB.prepare("SELECT id,title,project,window_txt,status,description FROM gmud WHERE company_id=? AND client_visible=1 AND status IN ('Aprovada','Agendada','Implementada') ORDER BY id DESC LIMIT 20").bind(cid).all()).results||[];
  const updates=(await DB.prepare('SELECT author,message,created_at FROM project_updates WHERE company_id=? ORDER BY id DESC LIMIT 20').bind(cid).all()).results||[];
  return json({data,gmuds,updates,company:{id:co.id,name:co.name},meta:{ref:row?.ref||null,updated_at:row?.updated_at||null,context_locked:true}});
}
