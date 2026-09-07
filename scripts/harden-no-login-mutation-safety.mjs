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

function insertBeforeInRoute({routeNeedle,beforeNeedle,block,label}){
  const routeStart=worker.indexOf(routeNeedle);
  if(routeStart<0) throw new Error(`Rota não encontrada para ${label}; build interrompido.`);
  const before=worker.indexOf(beforeNeedle,routeStart);
  if(before<0 || before-routeStart>5000) throw new Error(`Âncora não encontrada para ${label}; build interrompido.`);
  worker=worker.slice(0,before)+block+worker.slice(before);
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

if(changed){
  fs.writeFileSync(file,worker);
  console.log('OK: hardening de mutações/onboarding aplicado ao Worker.');
}else{
  console.log('OK: hardening de mutações/onboarding já estava materializado.');
}
