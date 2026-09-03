// Államo Sales Intelligence — API comercial multiempresa no core D1.
const csWrite=['admin','pmo','gestor','techlead','comercial','vendedor','representante'].includes(user.role);
const csApprove=['admin','pmo','gestor','diretoria','gerente'].includes(user.role);
const csField=['admin','pmo','gestor','techlead','comercial','vendedor','representante'].includes(user.role);
const csScope=id=>!scope||String(id)===String(scope);
const csId=p=>p+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
const csSafe=(v,n=4000)=>String(v??'').slice(0,n);
const csNum=v=>v==null||v===''?null:Number(v);
const csJson=(v,fallback={})=>{try{return JSON.stringify(v??fallback)}catch(_){return JSON.stringify(fallback)}};
const csParse=(v,fallback={})=>{try{return JSON.parse(v||JSON.stringify(fallback))}catch(_){return fallback}};
const csCompany=async id=>id?DB.prepare('SELECT id,name FROM companies WHERE id=?').bind(id).first():null;
const csAccount=async id=>id?DB.prepare('SELECT * FROM commercial_accounts WHERE id=? AND archived_at IS NULL').bind(id).first():null;
const csOpp=async id=>id?DB.prepare('SELECT * FROM commercial_opportunities WHERE id=? AND archived_at IS NULL').bind(id).first():null;
const csRoute=async id=>id?DB.prepare('SELECT * FROM commercial_routes WHERE id=? AND archived_at IS NULL').bind(id).first():null;
const csContext=async companyId=>{
  if(!companyId)return {error:'Empresa é obrigatória',status:400};
  if(!csScope(companyId))return {error:'Fora do escopo',status:403};
  const company=await csCompany(companyId);if(!company)return {error:'Empresa não encontrada',status:404};
  return {company};
};
const csSameCompany=(row,companyId)=>row&&String(row.company_id)===String(companyId);
const csStages=['MAPPED','QUALIFIED','CONTACT','DIAGNOSIS','PROPOSAL','NEGOTIATION','WON','LOST'];
const csStatuses=['OPEN','WON','LOST','CANCELLED'];
const csTypes=['PROSPECT','LEAD','CUSTOMER','PARTNER','REVENDA','PRODUCER','COOPERATIVE','OTHER'];

if(path==='commercial-summary'&&request.method==='GET'){
  const company=url.searchParams.get('company');const ctx=await csContext(company);if(ctx.error)return json({error:ctx.error},ctx.status);
  const [accounts,prospects,open,qualified,pipeline,pending,visits]=await Promise.all([
    DB.prepare("SELECT COUNT(*) total FROM commercial_accounts WHERE company_id=? AND status='ACTIVE' AND archived_at IS NULL").bind(company).first(),
    DB.prepare("SELECT COUNT(*) total FROM commercial_accounts WHERE company_id=? AND account_type IN ('PROSPECT','LEAD') AND status='ACTIVE' AND archived_at IS NULL").bind(company).first(),
    DB.prepare("SELECT COUNT(*) total FROM commercial_opportunities WHERE company_id=? AND status='OPEN' AND archived_at IS NULL").bind(company).first(),
    DB.prepare("SELECT COUNT(*) total FROM commercial_opportunities WHERE company_id=? AND status='OPEN' AND stage<>'MAPPED' AND archived_at IS NULL").bind(company).first(),
    DB.prepare("SELECT COALESCE(SUM(potential_value),0) value,COALESCE(SUM(potential_hectares),0) hectares FROM commercial_opportunities WHERE company_id=? AND status='OPEN' AND archived_at IS NULL").bind(company).first(),
    DB.prepare("SELECT COUNT(*) total FROM commercial_approvals WHERE company_id=? AND status='PENDING' AND archived_at IS NULL").bind(company).first(),
    DB.prepare("SELECT COUNT(*) total FROM commercial_interactions WHERE company_id=? AND interaction_type IN ('VISIT','TECHNICAL_VISIT') AND occurred_at>=datetime('now','-30 days') AND archived_at IS NULL").bind(company).first()
  ]);
  return json({company_id:company,company_name:ctx.company.name,accounts:Number(accounts?.total||0),prospects:Number(prospects?.total||0),open_opportunities:Number(open?.total||0),qualified_opportunities:Number(qualified?.total||0),pipeline_value:Number(pipeline?.value||0),pipeline_hectares:Number(pipeline?.hectares||0),pending_approvals:Number(pending?.total||0),visits_last_30_days:Number(visits?.total||0)});
}

if(path==='commercial-accounts'&&request.method==='GET'){
  const company=url.searchParams.get('company');const ctx=await csContext(company);if(ctx.error)return json({error:ctx.error},ctx.status);
  const cond=['company_id=?','archived_at IS NULL'],args=[company];const q=csSafe(url.searchParams.get('q')||'',120).trim(),status=csSafe(url.searchParams.get('status')||'',30).toUpperCase(),type=csSafe(url.searchParams.get('type')||'',30).toUpperCase();
  if(status){cond.push('status=?');args.push(status)}if(type){cond.push('account_type=?');args.push(type)}if(q){cond.push('(name LIKE ? OR city LIKE ? OR state LIKE ? OR document_number LIKE ?)');args.push('%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%')}
  const rows=(await DB.prepare('SELECT * FROM commercial_accounts WHERE '+cond.join(' AND ')+' ORDER BY score DESC,updated_at DESC LIMIT 250').bind(...args).all()).results||[];
  return json(rows.map(r=>({...r,crops:csParse(r.crops_json,[]),metadata:csParse(r.metadata_json,{})})));
}

if(path==='commercial-accounts'&&request.method==='POST'){
  if(!csWrite)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await csContext(b.company_id);if(ctx.error)return json({error:ctx.error},ctx.status);
  const name=csSafe(b.name,180).trim();if(name.length<2)return json({error:'Nome da conta é obrigatório'},400);const type=csSafe(b.account_type||'PROSPECT',30).toUpperCase();if(!csTypes.includes(type))return json({error:'Tipo de conta inválido'},400);const score=Math.max(0,Math.min(100,Number(b.score||0)));
  const id=csId('CAC');await DB.prepare("INSERT INTO commercial_accounts(id,company_id,name,legal_name,document_number,account_type,status,city,state,country,latitude,longitude,segment,crops_json,hectares,annual_potential_value,score,source,owner,last_contact_at,next_action_at,metadata_json,created_by,updated_by) VALUES(?,?,?,?,?,?, 'ACTIVE',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,b.company_id,name,csSafe(b.legal_name,180)||null,csSafe(b.document_number,40)||null,type,csSafe(b.city,120)||null,csSafe(b.state,10)||null,csSafe(b.country||'BR',5),csNum(b.latitude),csNum(b.longitude),csSafe(b.segment,120)||null,csJson(b.crops,[]),csNum(b.hectares),csNum(b.annual_potential_value),score,csSafe(b.source,120)||null,csSafe(b.owner,160)||user.name,b.last_contact_at||null,b.next_action_at||null,csJson(b.metadata,{}),user.name,user.name).run();
  await logEvent(env,user,'comercial:conta-criar',id,name);return json({ok:true,id},201);
}

if(path.match(/^commercial-accounts\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!csWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await csAccount(id);if(!old)return json({error:'Conta não encontrada'},404);if(!csScope(old.company_id))return json({error:'Fora do escopo'},403);const b=await request.json(),sets=[],args=[];
  const fields=['name','legal_name','document_number','city','state','country','latitude','longitude','segment','hectares','annual_potential_value','score','source','owner','last_contact_at','next_action_at','status'];
  for(const f of fields)if(Object.prototype.hasOwnProperty.call(b,f)){let v=b[f];if(['latitude','longitude','hectares','annual_potential_value'].includes(f))v=csNum(v);if(f==='score')v=Math.max(0,Math.min(100,Number(v||0)));if(['name','legal_name','document_number','city','state','country','segment','source','owner','status'].includes(f))v=csSafe(v,f==='name'||f==='legal_name'?180:160);sets.push(f+'=?');args.push(v)}
  if(Object.prototype.hasOwnProperty.call(b,'account_type')){const t=csSafe(b.account_type,30).toUpperCase();if(!csTypes.includes(t))return json({error:'Tipo inválido'},400);sets.push('account_type=?');args.push(t)}
  if(Object.prototype.hasOwnProperty.call(b,'crops')){sets.push('crops_json=?');args.push(csJson(b.crops,[]))}if(Object.prototype.hasOwnProperty.call(b,'metadata')){sets.push('metadata_json=?');args.push(csJson(b.metadata,{}))}
  if(!sets.length)return json({ok:true,id});sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE commercial_accounts SET '+sets.join(',')+' WHERE id=?').bind(...args).run();await logEvent(env,user,'comercial:conta-editar',id,Object.keys(b).join(','));return json({ok:true,id});
}

if(path.match(/^commercial-accounts\/[^/]+$/)&&request.method==='DELETE'){
  if(!csWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await csAccount(id);if(!old)return json({error:'Conta não encontrada'},404);if(!csScope(old.company_id))return json({error:'Fora do escopo'},403);await DB.prepare("UPDATE commercial_accounts SET archived_at=COALESCE(archived_at,datetime('now')),updated_at=datetime('now'),updated_by=? WHERE id=?").bind(user.name,id).run();await logEvent(env,user,'comercial:conta-arquivar',id,old.name);return json({ok:true,archived:true});
}

if(path==='commercial-opportunities'&&request.method==='GET'){
  const company=url.searchParams.get('company');const ctx=await csContext(company);if(ctx.error)return json({error:ctx.error},ctx.status);const cond=['o.company_id=?','o.archived_at IS NULL','a.archived_at IS NULL'],args=[company];
  const q=csSafe(url.searchParams.get('q')||'',120).trim(),stage=csSafe(url.searchParams.get('stage')||'',30).toUpperCase(),crop=csSafe(url.searchParams.get('crop')||'',80),status=csSafe(url.searchParams.get('status')||'',30).toUpperCase();if(stage){cond.push('o.stage=?');args.push(stage)}if(crop){cond.push('o.crop=?');args.push(crop)}if(status){cond.push('o.status=?');args.push(status)}if(q){cond.push('(a.name LIKE ? OR o.title LIKE ? OR a.city LIKE ? OR a.state LIKE ?)');args.push('%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%')}
  const rows=(await DB.prepare('SELECT o.*,a.name account_name,a.city,a.state FROM commercial_opportunities o JOIN commercial_accounts a ON a.id=o.account_id AND a.company_id=o.company_id WHERE '+cond.join(' AND ')+' ORDER BY o.score DESC,o.updated_at DESC LIMIT 250').bind(...args).all()).results||[];return json(rows.map(r=>({...r,metadata:csParse(r.metadata_json,{})})));
}

if(path==='commercial-opportunities'&&request.method==='POST'){
  if(!csWrite)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await csContext(b.company_id);if(ctx.error)return json({error:ctx.error},ctx.status);const account=await csAccount(b.account_id);if(!csSameCompany(account,b.company_id))return json({error:'Conta não pertence à empresa'},400);const title=csSafe(b.title,200).trim();if(title.length<2)return json({error:'Título é obrigatório'},400);const stage=csSafe(b.stage||'MAPPED',30).toUpperCase();if(!csStages.includes(stage))return json({error:'Estágio inválido'},400);const status=stage==='WON'?'WON':stage==='LOST'?'LOST':csSafe(b.status||'OPEN',30).toUpperCase();if(!csStatuses.includes(status))return json({error:'Status inválido'},400);const id=csId('COP');
  await DB.prepare('INSERT INTO commercial_opportunities(id,company_id,account_id,title,crop,stage,status,score,potential_value,potential_hectares,probability,expected_close_date,owner,loss_reason,notes,metadata_json,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,b.company_id,b.account_id,title,csSafe(b.crop,80)||null,stage,status,Math.max(0,Math.min(100,Number(b.score||0))),csNum(b.potential_value),csNum(b.potential_hectares),Math.max(0,Math.min(100,Number(b.probability||0))),b.expected_close_date||null,csSafe(b.owner,160)||user.name,csSafe(b.loss_reason,300)||null,csSafe(b.notes,4000)||null,csJson(b.metadata,{}),user.name,user.name).run();await logEvent(env,user,'comercial:oportunidade-criar',id,title);return json({ok:true,id},201);
}

if(path.match(/^commercial-opportunities\/[^/]+$/)&&(request.method==='PATCH'||request.method==='PUT')){
  if(!csWrite)return json({error:'Sem permissão'},403);const id=decodeURIComponent(path.split('/')[1]),old=await csOpp(id);if(!old)return json({error:'Oportunidade não encontrada'},404);if(!csScope(old.company_id))return json({error:'Fora do escopo'},403);const b=await request.json(),sets=[],args=[];
  if(Object.prototype.hasOwnProperty.call(b,'account_id')){const a=await csAccount(b.account_id);if(!csSameCompany(a,old.company_id))return json({error:'Conta não pertence à empresa'},400);sets.push('account_id=?');args.push(b.account_id)}
  for(const f of ['title','crop','potential_value','potential_hectares','probability','expected_close_date','owner','loss_reason','notes'])if(Object.prototype.hasOwnProperty.call(b,f)){let v=b[f];if(['potential_value','potential_hectares'].includes(f))v=csNum(v);if(f==='probability')v=Math.max(0,Math.min(100,Number(v||0)));if(['title','crop','owner','loss_reason','notes'].includes(f))v=csSafe(v,f==='notes'?4000:300);sets.push(f+'=?');args.push(v)}
  if(Object.prototype.hasOwnProperty.call(b,'score')){sets.push('score=?');args.push(Math.max(0,Math.min(100,Number(b.score||0))))}if(Object.prototype.hasOwnProperty.call(b,'stage')){const s=csSafe(b.stage,30).toUpperCase();if(!csStages.includes(s))return json({error:'Estágio inválido'},400);sets.push('stage=?');args.push(s);if(s==='WON'){sets.push("status='WON'")}if(s==='LOST'){sets.push("status='LOST'")}}if(Object.prototype.hasOwnProperty.call(b,'status')){const s=csSafe(b.status,30).toUpperCase();if(!csStatuses.includes(s))return json({error:'Status inválido'},400);sets.push('status=?');args.push(s)}if(Object.prototype.hasOwnProperty.call(b,'metadata')){sets.push('metadata_json=?');args.push(csJson(b.metadata,{}))}
  if(!sets.length)return json({ok:true,id});sets.push("updated_at=datetime('now')","updated_by=?");args.push(user.name,id);await DB.prepare('UPDATE commercial_opportunities SET '+sets.join(',')+' WHERE id=?').bind(...args).run();await logEvent(env,user,'comercial:oportunidade-editar',id,Object.keys(b).join(','));return json({ok:true,id});
}

if(path==='commercial-interactions'&&request.method==='GET'){
  const company=url.searchParams.get('company');const ctx=await csContext(company);if(ctx.error)return json({error:ctx.error},ctx.status);const account=url.searchParams.get('account'),cond=['i.company_id=?','i.archived_at IS NULL'],args=[company];if(account){cond.push('i.account_id=?');args.push(account)}const rows=(await DB.prepare('SELECT i.*,a.name account_name,o.title opportunity_title FROM commercial_interactions i JOIN commercial_accounts a ON a.id=i.account_id AND a.company_id=i.company_id LEFT JOIN commercial_opportunities o ON o.id=i.opportunity_id AND o.company_id=i.company_id WHERE '+cond.join(' AND ')+' ORDER BY i.occurred_at DESC LIMIT 250').bind(...args).all()).results||[];return json(rows.map(r=>({...r,evidence:csParse(r.evidence_json,[]),metadata:csParse(r.metadata_json,{})})));
}

if(path==='commercial-interactions'&&request.method==='POST'){
  if(!csField)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await csContext(b.company_id);if(ctx.error)return json({error:ctx.error},ctx.status);const account=await csAccount(b.account_id);if(!csSameCompany(account,b.company_id))return json({error:'Conta não pertence à empresa'},400);if(b.opportunity_id){const o=await csOpp(b.opportunity_id);if(!csSameCompany(o,b.company_id)||String(o.account_id)!==String(b.account_id))return json({error:'Oportunidade incompatível'},400)}const summary=csSafe(b.summary,4000).trim();if(summary.length<2)return json({error:'Resumo é obrigatório'},400);const id=csId('CIN');await DB.prepare('INSERT INTO commercial_interactions(id,company_id,account_id,opportunity_id,actor,interaction_type,occurred_at,summary,next_action,next_action_at,latitude,longitude,evidence_json,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,b.company_id,b.account_id,b.opportunity_id||null,user.name,csSafe(b.interaction_type||'VISIT',40).toUpperCase(),b.occurred_at||new Date().toISOString(),summary,csSafe(b.next_action,1000)||null,b.next_action_at||null,csNum(b.latitude),csNum(b.longitude),csJson(b.evidence,[]),csJson(b.metadata,{})).run();await DB.prepare("UPDATE commercial_accounts SET last_contact_at=?,next_action_at=COALESCE(?,next_action_at),updated_at=datetime('now'),updated_by=? WHERE id=? AND company_id=?").bind(b.occurred_at||new Date().toISOString(),b.next_action_at||null,user.name,b.account_id,b.company_id).run();await logEvent(env,user,'comercial:interacao-criar',id,summary.slice(0,120));return json({ok:true,id},201);
}

if(path==='commercial-approvals'&&request.method==='GET'){
  const company=url.searchParams.get('company');const ctx=await csContext(company);if(ctx.error)return json({error:ctx.error},ctx.status);const status=csSafe(url.searchParams.get('status')||'',30).toUpperCase(),cond=['ap.company_id=?','ap.archived_at IS NULL'],args=[company];if(status){cond.push('ap.status=?');args.push(status)}const rows=(await DB.prepare('SELECT ap.*,a.name account_name,o.title opportunity_title FROM commercial_approvals ap LEFT JOIN commercial_accounts a ON a.id=ap.account_id AND a.company_id=ap.company_id LEFT JOIN commercial_opportunities o ON o.id=ap.opportunity_id AND o.company_id=ap.company_id WHERE '+cond.join(' AND ')+' ORDER BY CASE ap.status WHEN \'PENDING\' THEN 0 ELSE 1 END,ap.created_at DESC LIMIT 250').bind(...args).all()).results||[];return json(rows.map(r=>({...r,metadata:csParse(r.metadata_json,{})})));
}

if(path==='commercial-approvals'&&request.method==='POST'){
  if(!csField)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await csContext(b.company_id);if(ctx.error)return json({error:ctx.error},ctx.status);if(b.account_id){const a=await csAccount(b.account_id);if(!csSameCompany(a,b.company_id))return json({error:'Conta não pertence à empresa'},400)}if(b.opportunity_id){const o=await csOpp(b.opportunity_id);if(!csSameCompany(o,b.company_id))return json({error:'Oportunidade não pertence à empresa'},400)}const justification=csSafe(b.justification,4000).trim();if(justification.length<2)return json({error:'Justificativa é obrigatória'},400);const id=csId('CAP');await DB.prepare("INSERT INTO commercial_approvals(id,company_id,opportunity_id,account_id,approval_type,status,requested_by,assigned_to,requested_discount_percent,requested_value,justification,metadata_json) VALUES(?,?,?,?,?,'PENDING',?,?,?,?,?,?)").bind(id,b.company_id,b.opportunity_id||null,b.account_id||null,csSafe(b.approval_type||'OTHER',40).toUpperCase(),user.name,csSafe(b.assigned_to,160)||null,csNum(b.requested_discount_percent),csNum(b.requested_value),justification,csJson(b.metadata,{})).run();await logEvent(env,user,'comercial:aprovacao-solicitar',id,csSafe(b.approval_type||'OTHER',40));return json({ok:true,id},201);
}

if(path.match(/^commercial-approvals\/[^/]+\/decision$/)&&request.method==='POST'){
  if(!csApprove)return json({error:'Sem permissão para aprovar'},403);const id=decodeURIComponent(path.split('/')[1]),ap=await DB.prepare('SELECT * FROM commercial_approvals WHERE id=? AND archived_at IS NULL').bind(id).first();if(!ap)return json({error:'Solicitação não encontrada'},404);if(!csScope(ap.company_id))return json({error:'Fora do escopo'},403);if(ap.status!=='PENDING')return json({error:'Solicitação já decidida'},409);const b=await request.json(),decision=csSafe(b.status,20).toUpperCase();if(!['APPROVED','REJECTED'].includes(decision))return json({error:'Decisão inválida'},400);await DB.prepare("UPDATE commercial_approvals SET status=?,decided_by=?,decision_notes=?,decided_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(decision,user.name,csSafe(b.decision_notes,4000)||null,id).run();await logEvent(env,user,'comercial:aprovacao-decidir',id,decision);return json({ok:true,id,status:decision});
}

if(path==='commercial-routes'&&request.method==='GET'){
  const company=url.searchParams.get('company');const ctx=await csContext(company);if(ctx.error)return json({error:ctx.error},ctx.status);const rows=(await DB.prepare("SELECT r.*,(SELECT COUNT(*) FROM commercial_route_stops s WHERE s.route_id=r.id AND s.company_id=r.company_id AND s.archived_at IS NULL) stops FROM commercial_routes r WHERE r.company_id=? AND r.archived_at IS NULL ORDER BY r.route_date DESC,r.created_at DESC LIMIT 120").bind(company).all()).results||[];return json(rows.map(r=>({...r,metadata:csParse(r.metadata_json,{})})));
}

if(path==='commercial-routes'&&request.method==='POST'){
  if(!csField)return json({error:'Sem permissão'},403);const b=await request.json();const ctx=await csContext(b.company_id);if(ctx.error)return json({error:ctx.error},ctx.status);const name=csSafe(b.name,160).trim();if(name.length<2||!b.route_date)return json({error:'Nome e data da rota são obrigatórios'},400);const id=csId('CRT');await DB.prepare("INSERT INTO commercial_routes(id,company_id,owner,name,route_date,status,notes,metadata_json,created_by,updated_by) VALUES(?,?,?,?,?,'PLANNED',?,?,?,?)").bind(id,b.company_id,csSafe(b.owner,160)||user.name,name,b.route_date,csSafe(b.notes,2000)||null,csJson(b.metadata,{}),user.name,user.name).run();for(const [idx,accountId] of (Array.isArray(b.account_ids)?b.account_ids:[]).entries()){const a=await csAccount(accountId);if(!csSameCompany(a,b.company_id))return json({error:'Conta incompatível na rota'},400);await DB.prepare("INSERT INTO commercial_route_stops(id,company_id,route_id,account_id,position,status) VALUES(?,?,?,?,?,'PLANNED')").bind(csId('CRS'),b.company_id,id,accountId,idx+1).run()}await logEvent(env,user,'comercial:rota-criar',id,name);return json({ok:true,id},201);
}