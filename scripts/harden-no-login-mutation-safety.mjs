import fs from 'node:fs';

const file='public/_worker.js';
let worker=fs.readFileSync(file,'utf8');
let changed=false;

const handleMarker='async function handleApi(request, env, url) {';
const authNeedle="    if (!user) return json({ error: 'Não autenticado' }, 401);";
const deleteGuard="user.__portal_no_login === true && request.method === 'DELETE'";

if(!worker.includes(deleteGuard)){
  const occurrences=worker.split(authNeedle).length-1;
  if(!worker.includes(handleMarker) || occurrences!==1){
    throw new Error(`Contrato de autorização inesperado (handle=${worker.includes(handleMarker)}, ocorrencias_auth=${occurrences}); build interrompido para evitar patch inseguro.`);
  }
  const guard=`${authNeedle}
    const __softSprintArchive = request.method === 'DELETE' && /^\\/api\\/sprint-documents\\/[^/]+$/.test(url.pathname);
    if (user.__portal_no_login === true && request.method === 'DELETE' && !__softSprintArchive) {
      return json({
        error:'Ação destrutiva exige sessão autenticada',
        code:'authenticated_session_required'
      },403);
    }`;
  worker=worker.replace(authNeedle,guard);
  changed=true;
}else{
  console.log('OK: proteção de exclusões no modo sem login já aplicada.');
}

function insertBeforeInRoute({routeNeedle,beforeNeedle,block,label,maxDistance=9000}){
  const routeStart=worker.indexOf(routeNeedle);
  if(routeStart<0) throw new Error(`Rota não encontrada para ${label}; build interrompido.`);
  const before=worker.indexOf(beforeNeedle,routeStart);
  if(before<0 || before-routeStart>maxDistance) throw new Error(`Âncora não encontrada para ${label}; build interrompido.`);
  worker=worker.slice(0,before)+block+worker.slice(before);
  changed=true;
}
function insertBeforeMarker(marker,block,label){
  const at=worker.indexOf(marker);
  if(at<0) throw new Error(`Marcador não encontrado para ${label}; build interrompido.`);
  worker=worker.slice(0,at)+block+worker.slice(at);
  changed=true;
}

const companyMarker='// [allamo-onboarding-company-integrity]';
if(!worker.includes(companyMarker)){
  insertBeforeInRoute({
    routeNeedle:"if ((path === 'company-create' || path === 'companies') && request.method === 'POST')",
    beforeNeedle:"      const id = (b.id || b.name)",
    label:'criação de empresa',
    block:`      ${companyMarker}\n      b.name = String(b.name).trim();\n      if (!b.name) return json({ error: 'Nome da empresa é obrigatório' }, 400);\n      const sameCompanyName = await DB.prepare('SELECT id FROM companies WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1').bind(b.name).first();\n      if (sameCompanyName) return json({ error: 'Já existe empresa com esse nome', id: sameCompanyName.id }, 409);\n`
  });
}else{
  console.log('OK: proteção de duplicidade de empresa já aplicada.');
}

const companyRequestMarker='// [allamo-onboarding-company-request-guard]';
if(!worker.includes(companyRequestMarker)){
  insertBeforeMarker(companyMarker,`      ${companyRequestMarker}\n      if (user.__portal_no_login === true) return json({ error:'Onboarding exige sessão humana autenticada', code:'authenticated_onboarding_required' },403);\n      const onboardingCompanyRequestId=String(request.headers.get('idempotency-key')||b.request_id||'').trim();\n      if(!/^[A-Za-z0-9._:-]{8,120}$/.test(onboardingCompanyRequestId)) return json({ error:'Idempotency-Key/request_id é obrigatório para onboarding e deve ter 8-120 caracteres seguros', code:'idempotency_key_required' },400);\n      b.name=String(b.name||'').trim();\n      const onboardingCompanyPayload=Object.fromEntries(Object.keys(b).filter(k=>k!=='request_id').sort().map(k=>[k,b[k]]));\n      const onboardingCompanyHash=await sha(JSON.stringify(onboardingCompanyPayload));\n      const onboardingCompanyExisting=await DB.prepare('SELECT request_id,entity_type,payload_hash,status,entity_id FROM onboarding_requests WHERE request_id=? LIMIT 1').bind(onboardingCompanyRequestId).first();\n      if(onboardingCompanyExisting){\n        if(onboardingCompanyExisting.entity_type!=='company'||onboardingCompanyExisting.payload_hash!==onboardingCompanyHash) return json({ error:'request_id já utilizado com outra operação ou payload', code:'idempotency_conflict' },409);\n        if(onboardingCompanyExisting.status==='completed') return json({ ok:true,id:onboardingCompanyExisting.entity_id,request_id:onboardingCompanyRequestId,replayed:true });\n        return json({ error:'Onboarding com este request_id já está em processamento', code:'request_in_progress', request_id:onboardingCompanyRequestId },409);\n      }\n`, 'gate idempotente da empresa');

  insertBeforeInRoute({
    routeNeedle:"if ((path === 'company-create' || path === 'companies') && request.method === 'POST')",
    beforeNeedle:"      await DB.prepare('INSERT INTO companies",
    label:'reserva idempotente de empresa',
    maxDistance:12000,
    block:`      // [allamo-onboarding-company-request-reserve]\n      const onboardingCompanyReserve=await DB.prepare(\"INSERT OR IGNORE INTO onboarding_requests (request_id,entity_type,payload_hash,status,entity_id,company_id,actor_id,actor_name,actor_role,created_at) VALUES (?,'company',?,'pending',NULL,NULL,?,?,?,datetime('now'))\").bind(onboardingCompanyRequestId,onboardingCompanyHash,String(user.id||''),String(user.name||''),String(user.role||'')).run();\n      if(!(onboardingCompanyReserve.meta&&Number(onboardingCompanyReserve.meta.changes)>0)){\n        const claimed=await DB.prepare('SELECT entity_type,payload_hash,status,entity_id FROM onboarding_requests WHERE request_id=? LIMIT 1').bind(onboardingCompanyRequestId).first();\n        if(!claimed||claimed.entity_type!=='company'||claimed.payload_hash!==onboardingCompanyHash) return json({ error:'request_id já utilizado com outra operação ou payload', code:'idempotency_conflict' },409);\n        if(claimed.status==='completed') return json({ ok:true,id:claimed.entity_id,request_id:onboardingCompanyRequestId,replayed:true });\n        return json({ error:'Onboarding com este request_id já está em processamento', code:'request_in_progress', request_id:onboardingCompanyRequestId },409);\n      }\n`
  });

  insertBeforeInRoute({
    routeNeedle:"if ((path === 'company-create' || path === 'companies') && request.method === 'POST')",
    beforeNeedle:"      await logEvent(env, user, 'empresa:criar'",
    label:'conclusão idempotente de empresa',
    maxDistance:14000,
    block:`      // [allamo-onboarding-company-request-complete]\n      await DB.prepare(\"UPDATE onboarding_requests SET status='completed',entity_id=?,company_id=?,completed_at=datetime('now') WHERE request_id=? AND status='pending'\").bind(String(id),String(id),onboardingCompanyRequestId).run();\n`
  });
}else{
  console.log('OK: onboarding de empresa já exige sessão humana e request_id idempotente.');
}

const projectMarker='// [allamo-onboarding-project-integrity]';
if(!worker.includes(projectMarker)){
  insertBeforeInRoute({
    routeNeedle:"if (path === 'projects' && request.method === 'POST')",
    beforeNeedle:"      const badgeMap = { 'Em andamento':'started'",
    label:'criação de projeto',
    block:`      ${projectMarker}\n      b.name = String(b.name).trim();\n      if (!b.name) return json({ error: 'Nome do projeto é obrigatório' }, 400);\n      if (scope && !b.company_id) b.company_id = scope;\n      if (!b.company_id) return json({ error: 'Empresa é obrigatória para criar projeto' }, 400);\n      const projectCompany = await DB.prepare('SELECT id FROM companies WHERE id = ? LIMIT 1').bind(b.company_id).first();\n      if (!projectCompany) return json({ error: 'Empresa não encontrada' }, 404);\n      const sameProject = await DB.prepare('SELECT id FROM projects WHERE company_id = ? AND lower(trim(name)) = lower(trim(?)) LIMIT 1').bind(b.company_id,b.name).first();\n      if (sameProject) return json({ error: 'Já existe projeto com esse nome nesta empresa', id: sameProject.id }, 409);\n`
  });
}else{
  console.log('OK: proteção de integridade empresa→projeto já aplicada.');
}

const projectRequestMarker='// [allamo-onboarding-project-request-guard]';
if(!worker.includes(projectRequestMarker)){
  insertBeforeMarker(projectMarker,`      ${projectRequestMarker}\n      if (user.__portal_no_login === true) return json({ error:'Onboarding exige sessão humana autenticada', code:'authenticated_onboarding_required' },403);\n      const onboardingProjectRequestId=String(request.headers.get('idempotency-key')||b.request_id||'').trim();\n      if(!/^[A-Za-z0-9._:-]{8,120}$/.test(onboardingProjectRequestId)) return json({ error:'Idempotency-Key/request_id é obrigatório para onboarding e deve ter 8-120 caracteres seguros', code:'idempotency_key_required' },400);\n      b.name=String(b.name||'').trim();\n      if(user.role==='gestor') b.company_id=scope; else if(scope&&!b.company_id) b.company_id=scope;\n      const onboardingProjectPayload=Object.fromEntries(Object.keys(b).filter(k=>k!=='request_id').sort().map(k=>[k,b[k]]));\n      const onboardingProjectHash=await sha(JSON.stringify(onboardingProjectPayload));\n      const onboardingProjectExisting=await DB.prepare('SELECT request_id,entity_type,payload_hash,status,entity_id FROM onboarding_requests WHERE request_id=? LIMIT 1').bind(onboardingProjectRequestId).first();\n      if(onboardingProjectExisting){\n        if(onboardingProjectExisting.entity_type!=='project'||onboardingProjectExisting.payload_hash!==onboardingProjectHash) return json({ error:'request_id já utilizado com outra operação ou payload', code:'idempotency_conflict' },409);\n        if(onboardingProjectExisting.status==='completed') return json({ ok:true,id:onboardingProjectExisting.entity_id,request_id:onboardingProjectRequestId,replayed:true });\n        return json({ error:'Onboarding com este request_id já está em processamento', code:'request_in_progress', request_id:onboardingProjectRequestId },409);\n      }\n`, 'gate idempotente do projeto');

  insertBeforeInRoute({
    routeNeedle:"if (path === 'projects' && request.method === 'POST')",
    beforeNeedle:"      const badgeMap = { 'Em andamento':'started'",
    label:'reserva idempotente de projeto',
    maxDistance:12000,
    block:`      // [allamo-onboarding-project-request-reserve]\n      const onboardingProjectReserve=await DB.prepare(\"INSERT OR IGNORE INTO onboarding_requests (request_id,entity_type,payload_hash,status,entity_id,company_id,actor_id,actor_name,actor_role,created_at) VALUES (?,'project',?,'pending',NULL,?,?,?, ?,datetime('now'))\").bind(onboardingProjectRequestId,onboardingProjectHash,String(b.company_id||''),String(user.id||''),String(user.name||''),String(user.role||'')).run();\n      if(!(onboardingProjectReserve.meta&&Number(onboardingProjectReserve.meta.changes)>0)){\n        const claimed=await DB.prepare('SELECT entity_type,payload_hash,status,entity_id FROM onboarding_requests WHERE request_id=? LIMIT 1').bind(onboardingProjectRequestId).first();\n        if(!claimed||claimed.entity_type!=='project'||claimed.payload_hash!==onboardingProjectHash) return json({ error:'request_id já utilizado com outra operação ou payload', code:'idempotency_conflict' },409);\n        if(claimed.status==='completed') return json({ ok:true,id:claimed.entity_id,request_id:onboardingProjectRequestId,replayed:true });\n        return json({ error:'Onboarding com este request_id já está em processamento', code:'request_in_progress', request_id:onboardingProjectRequestId },409);\n      }\n`
  });

  insertBeforeInRoute({
    routeNeedle:"if (path === 'projects' && request.method === 'POST')",
    beforeNeedle:"      await logEvent(env, user, 'projeto:criar'",
    label:'conclusão idempotente de projeto',
    maxDistance:16000,
    block:`      // [allamo-onboarding-project-request-complete]\n      const onboardingProjectEntityId=String((r.meta&&r.meta.last_row_id)||'');\n      await DB.prepare(\"UPDATE onboarding_requests SET status='completed',entity_id=?,company_id=?,completed_at=datetime('now') WHERE request_id=? AND status='pending'\").bind(onboardingProjectEntityId,String(b.company_id||''),onboardingProjectRequestId).run();\n`
  });
}else{
  console.log('OK: onboarding de projeto já exige sessão humana e request_id idempotente.');
}

if(changed){
  fs.writeFileSync(file,worker);
  console.log('OK: hardening de mutações/onboarding aplicado ao Worker.');
}else{
  console.log('OK: hardening de mutações/onboarding já estava materializado.');
}

await import('./harden-onboarding-ui-idempotency.mjs');
