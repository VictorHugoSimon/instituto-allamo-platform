// Gestão autenticada de convites. Admin/PMO gerenciam clientes; gestor somente o próprio tenant.
const aiManage=['admin','pmo','gestor'].includes(user.role);
const aiScope=id=>!scope||String(id)===String(scope);
const aiSafe=(v,n=500)=>String(v??'').slice(0,n);
const aiId=()=> 'AIN-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,8).toUpperCase();

if(path==='access-invitations'&&request.method==='GET'){
  if(!aiManage)return json({error:'Sem permissão'},403);
  const company=url.searchParams.get('company');
  if(!company)return json({error:'Empresa é obrigatória'},400);
  if(!aiScope(company))return json({error:'Fora do escopo'},403);
  const co=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(company).first();if(!co)return json({error:'Empresa não encontrada'},404);
  const rows=(await DB.prepare("SELECT id,company_id,email,role,status,invited_by,expires_at,accepted_at,cancelled_at,created_at FROM access_invitations WHERE company_id=? ORDER BY CASE status WHEN 'PENDING' THEN 0 ELSE 1 END,created_at DESC LIMIT 250").bind(company).all()).results||[];
  return json(rows);
}

if(path==='access-invitations'&&request.method==='POST'){
  if(!aiManage)return json({error:'Sem permissão'},403);
  const b=await request.json();
  let companyId=String(b.company_id||'').trim();
  if(user.role==='gestor')companyId=String(scope||'');
  if(!companyId)return json({error:'Empresa é obrigatória'},400);
  if(!aiScope(companyId))return json({error:'Fora do escopo'},403);
  const company=await DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(companyId).first();if(!company)return json({error:'Empresa não encontrada'},404);
  const email=aiSafe(b.email,254).trim().toLowerCase();if(!email.includes('@'))return json({error:'E-mail inválido'},400);
  let role=aiSafe(b.role||'usuario',30).trim().toLowerCase();
  if(user.role==='gestor')role='usuario';
  if(!['gestor','usuario'].includes(role))return json({error:'Perfil permitido: gestor ou usuario'},400);
  const existing=await DB.prepare('SELECT id,company_id FROM users WHERE lower(email)=lower(?)').bind(email).first();
  if(existing){
    if(String(existing.company_id||'')===companyId)return json({error:'Este e-mail já possui acesso ao tenant'},409);
    return json({error:'Este e-mail já pertence a outro tenant'},409);
  }
  await DB.prepare("UPDATE access_invitations SET status='CANCELLED',cancelled_at=datetime('now'),updated_at=datetime('now') WHERE company_id=? AND lower(email)=lower(?) AND status='PENDING'").bind(companyId,email).run();
  const token=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');
  const tokenHash=await sha(token+':allamo-access-invite');
  const id=aiId();
  const expiresHours=Math.max(1,Math.min(720,Number(b.expires_hours||168)));
  await DB.prepare("INSERT INTO access_invitations(id,company_id,email,role,token_hash,status,invited_by,expires_at) VALUES(?,?,?,?,?,'PENDING',?,datetime('now','+' || ? || ' hours'))")
    .bind(id,companyId,email,role,tokenHash,user.name,String(expiresHours)).run();
  const row=await DB.prepare('SELECT expires_at FROM access_invitations WHERE id=?').bind(id).first();
  const inviteUrl=url.origin+'/?convite='+encodeURIComponent(token);
  let email_sent=false;
  if(b.send_email!==false){
    try{
      await sendEmail(env,email,'Convite de acesso — '+company.name,'Você recebeu um convite para acessar '+company.name+' na plataforma Államo.\n\nAbra o link abaixo para definir sua própria senha:\n'+inviteUrl+'\n\nO convite expira em '+expiresHours+' horas. Se você não esperava este convite, ignore esta mensagem.');
      email_sent=true;
    }catch(e){ email_sent=false; }
  }
  await logEvent(env,user,'acesso:convite-criar',email,company.name+' · '+role);
  return json({ok:true,id,email,role,company_id:companyId,company_name:company.name,expires_at:row?.expires_at||null,invite_url:inviteUrl,email_sent},201);
}

if(path.match(/^access-invitations\/[^/]+\/cancel$/)&&request.method==='POST'){
  if(!aiManage)return json({error:'Sem permissão'},403);
  const id=decodeURIComponent(path.split('/')[1]);
  const invite=await DB.prepare('SELECT id,company_id,email,status FROM access_invitations WHERE id=?').bind(id).first();
  if(!invite)return json({error:'Convite não encontrado'},404);
  if(!aiScope(invite.company_id))return json({error:'Fora do escopo'},403);
  if(invite.status!=='PENDING')return json({ok:true,id,status:invite.status});
  await DB.prepare("UPDATE access_invitations SET status='CANCELLED',cancelled_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(id).run();
  await logEvent(env,user,'acesso:convite-cancelar',invite.email,invite.company_id);
  return json({ok:true,id,status:'CANCELLED'});
}
