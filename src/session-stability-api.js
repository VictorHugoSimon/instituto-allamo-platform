// Sessão estável: validação dedicada, renovação deslizante e logout revogável.
// Este bloco é injetado depois de currentUser(), portanto `user` já foi autenticado.
if(path==='session-status'&&request.method==='GET'){
  const sessionToken=(request.headers.get('authorization')||'').replace('Bearer ','').trim();
  if(sessionToken){
    // Renovação deslizante: cada validação legítima estende a sessão por 7 dias.
    try{
      await DB.prepare("UPDATE sessions SET expires_at=datetime('now','+7 days') WHERE token=? AND expires_at>datetime('now')")
        .bind(sessionToken).run();
    }catch(e){ console.warn('[session-status] não foi possível renovar',String(e)); }
  }
  return json({
    ok:true,
    user:{name:user.name,role:user.role,company_id:user.company_id||null},
    renewed:true
  });
}

if(path==='logout'&&request.method==='POST'){
  const sessionToken=(request.headers.get('authorization')||'').replace('Bearer ','').trim();
  if(sessionToken){
    try{ await DB.prepare('DELETE FROM sessions WHERE token=?').bind(sessionToken).run(); }catch(e){}
  }
  await logEvent(env,user,'logout','sessão','Saiu do portal');
  return json({ok:true});
}
