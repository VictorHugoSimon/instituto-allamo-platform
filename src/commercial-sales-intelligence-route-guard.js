// Guard especializado: valida todas as contas antes de persistir a rota.
// Este bloco é injetado antes da API comercial principal e intercepta somente POST /commercial-routes.
if(path==='commercial-routes'&&request.method==='POST'){
  const csrField=['admin','pmo','gestor','techlead','comercial','vendedor','representante'].includes(user.role);
  const csrScope=id=>!scope||String(id)===String(scope);
  const csrSafe=(v,n=4000)=>String(v??'').slice(0,n);
  const csrId=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const csrJson=(v,fallback={})=>{try{return JSON.stringify(v??fallback)}catch(_){return JSON.stringify(fallback)}};
  if(!csrField)return json({error:'Sem permissão'},403);
  const b=await request.json();
  if(!b.company_id)return json({error:'Empresa é obrigatória'},400);
  if(!csrScope(b.company_id))return json({error:'Fora do escopo'},403);
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(b.company_id).first();
  if(!company)return json({error:'Empresa não encontrada'},404);
  const name=csrSafe(b.name,160).trim();if(name.length<2||!b.route_date)return json({error:'Nome e data da rota são obrigatórios'},400);
  const accountIds=Array.isArray(b.account_ids)?[...new Set(b.account_ids.map(String).filter(Boolean))]:[];
  const validated=[];
  for(const accountId of accountIds){
    const account=await DB.prepare('SELECT id,company_id FROM commercial_accounts WHERE id=? AND archived_at IS NULL').bind(accountId).first();
    if(!account||String(account.company_id)!==String(b.company_id))return json({error:'Conta incompatível na rota',account_id:accountId},400);
    validated.push(account.id);
  }
  const id=csrId('CRT');
  await DB.prepare("INSERT INTO commercial_routes(id,company_id,owner,name,route_date,status,notes,metadata_json,created_by,updated_by) VALUES(?,?,?,?,?,'PLANNED',?,?,?,?)")
    .bind(id,b.company_id,csrSafe(b.owner,160)||user.name,name,b.route_date,csrSafe(b.notes,2000)||null,csrJson(b.metadata,{}),user.name,user.name).run();
  for(const [idx,accountId] of validated.entries()){
    await DB.prepare("INSERT INTO commercial_route_stops(id,company_id,route_id,account_id,position,status) VALUES(?,?,?,?,?,'PLANNED')")
      .bind(csrId('CRS'),b.company_id,id,accountId,idx+1).run();
  }
  await logEvent(env,user,'comercial:rota-criar',id,name);
  return json({ok:true,id,stops:validated.length},201);
}
