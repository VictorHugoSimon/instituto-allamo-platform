// Guard especializado: valida todas as contas antes de persistir a rota.
// Este bloco é injetado antes da API comercial principal e intercepta somente POST /commercial-routes.
if(path==='commercial-routes'&&request.method==='POST'){
  if(!csField)return json({error:'Sem permissão'},403);
  const b=await request.json();
  const ctx=await csContext(b.company_id);if(ctx.error)return json({error:ctx.error},ctx.status);
  const name=csSafe(b.name,160).trim();if(name.length<2||!b.route_date)return json({error:'Nome e data da rota são obrigatórios'},400);
  const accountIds=Array.isArray(b.account_ids)?[...new Set(b.account_ids.map(String).filter(Boolean))]:[];
  const validated=[];
  for(const accountId of accountIds){
    const a=await csAccount(accountId);
    if(!csSameCompany(a,b.company_id))return json({error:'Conta incompatível na rota',account_id:accountId},400);
    validated.push(a.id);
  }
  const id=csId('CRT');
  await DB.prepare("INSERT INTO commercial_routes(id,company_id,owner,name,route_date,status,notes,metadata_json,created_by,updated_by) VALUES(?,?,?,?,?,'PLANNED',?,?,?,?)")
    .bind(id,b.company_id,csSafe(b.owner,160)||user.name,name,b.route_date,csSafe(b.notes,2000)||null,csJson(b.metadata,{}),user.name,user.name).run();
  for(const [idx,accountId] of validated.entries()){
    await DB.prepare("INSERT INTO commercial_route_stops(id,company_id,route_id,account_id,position,status) VALUES(?,?,?,?,?,'PLANNED')")
      .bind(csId('CRS'),b.company_id,id,accountId,idx+1).run();
  }
  await logEvent(env,user,'comercial:rota-criar',id,name);
  return json({ok:true,id,stops:validated.length},201);
}
