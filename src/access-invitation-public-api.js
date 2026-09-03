// Convite público: somente consulta do convite e criação inicial do acesso.
// O token bruto nunca é persistido; a busca usa o mesmo SHA-256 do fluxo de autenticação.
if(path==='access-invite-info'&&request.method==='GET'){
  const token=String(url.searchParams.get('token')||'').trim();
  if(token.length<20)return json({error:'Convite inválido'},400);
  const hash=await sha(token+':allamo-access-invite');
  const invite=await DB.prepare("SELECT ai.id,ai.company_id,ai.email,ai.role,ai.status,ai.expires_at,c.name company_name FROM access_invitations ai JOIN companies c ON c.id=ai.company_id WHERE ai.token_hash=? LIMIT 1").bind(hash).first();
  if(!invite)return json({error:'Convite não encontrado'},404);
  if(invite.status!=='PENDING')return json({error:'Convite não está mais disponível',status:invite.status},409);
  const expired=await DB.prepare("SELECT CASE WHEN datetime(?)<=datetime('now') THEN 1 ELSE 0 END expired").bind(invite.expires_at).first();
  if(Number(expired?.expired||0)){
    await DB.prepare("UPDATE access_invitations SET status='EXPIRED',updated_at=datetime('now') WHERE id=? AND status='PENDING'").bind(invite.id).run();
    return json({error:'Convite expirado'},410);
  }
  const [local,domain]=String(invite.email).split('@');
  const masked=(local?local.slice(0,2)+'***':'***')+(domain?'@'+domain:'');
  return json({ok:true,company_id:invite.company_id,company_name:invite.company_name,email_masked:masked,role:invite.role,expires_at:invite.expires_at});
}

if(path==='access-invite-accept'&&request.method==='POST'){
  const b=await request.json();
  const token=String(b.token||'').trim(),name=String(b.name||'').trim(),password=String(b.password||'');
  if(token.length<20)return json({error:'Convite inválido'},400);
  if(name.length<2)return json({error:'Informe seu nome'},400);
  if(password.length<8)return json({error:'A senha deve ter pelo menos 8 caracteres'},400);
  const hash=await sha(token+':allamo-access-invite');
  const invite=await DB.prepare("SELECT ai.*,c.name company_name FROM access_invitations ai JOIN companies c ON c.id=ai.company_id WHERE ai.token_hash=? LIMIT 1").bind(hash).first();
  if(!invite)return json({error:'Convite não encontrado'},404);
  if(invite.status!=='PENDING')return json({error:'Convite não está mais disponível',status:invite.status},409);
  const expired=await DB.prepare("SELECT CASE WHEN datetime(?)<=datetime('now') THEN 1 ELSE 0 END expired").bind(invite.expires_at).first();
  if(Number(expired?.expired||0)){
    await DB.prepare("UPDATE access_invitations SET status='EXPIRED',updated_at=datetime('now') WHERE id=? AND status='PENDING'").bind(invite.id).run();
    return json({error:'Convite expirado'},410);
  }
  const email=String(invite.email||'').trim().toLowerCase();
  const existing=await DB.prepare('SELECT id,company_id,status FROM users WHERE lower(email)=lower(?)').bind(email).first();
  if(existing){
    if(String(existing.company_id||'')===String(invite.company_id))return json({error:'Este e-mail já possui acesso. Use a tela de login.'},409);
    return json({error:'Este e-mail já está associado a outro tenant. Solicite suporte da Államo.'},409);
  }
  if(!['gestor','usuario'].includes(String(invite.role)))return json({error:'Perfil do convite inválido'},400);
  const passwordHash=await sha(password+':'+email);
  await DB.prepare('INSERT INTO users (name,email,password_hash,role,company_id,status) VALUES (?,?,?,?,?,?)')
    .bind(name,email,passwordHash,invite.role,invite.company_id,'Ativo').run();
  await DB.prepare("UPDATE access_invitations SET status='ACCEPTED',accepted_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='PENDING'").bind(invite.id).run();
  return json({ok:true,company_id:invite.company_id,company_name:invite.company_name,email,login_required:true},201);
}
