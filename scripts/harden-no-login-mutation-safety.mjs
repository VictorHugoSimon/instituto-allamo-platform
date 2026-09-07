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

const companyMarker='// [allamo-onboarding-company-integrity]';
if(!worker.includes(companyMarker)){
  const companyNeedle=`    // EMPRESAS: criar (rota dedicada)
    if ((path === 'company-create' || path === 'companies') && request.method === 'POST') {
      if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name) return json({ error: 'Nome da empresa é obrigatório' }, 400);`;
  if(worker.split(companyNeedle).length-1!==1) throw new Error('Contrato de criação de empresa inesperado; build interrompido para evitar patch inseguro.');
  const companyGuard=`${companyNeedle}
      ${companyMarker}
      b.name = String(b.name).trim();
      if (!b.name) return json({ error: 'Nome da empresa é obrigatório' }, 400);
      const sameCompanyName = await DB.prepare('SELECT id FROM companies WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1').bind(b.name).first();
      if (sameCompanyName) return json({ error: 'Já existe empresa com esse nome', id: sameCompanyName.id }, 409);`;
  worker=worker.replace(companyNeedle,companyGuard);
  changed=true;
}else{
  console.log('OK: proteção de duplicidade de empresa já aplicada.');
}

const projectMarker='// [allamo-onboarding-project-integrity]';
if(!worker.includes(projectMarker)){
  const projectNeedle=`    // PROJETOS: criar
    if (path === 'projects' && request.method === 'POST') {
      if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);
      const b = await request.json();
      if (!b.name) return json({ error: 'Nome do projeto é obrigatório' }, 400);
      if (scope && b.company_id && b.company_id !== scope) return json({ error: 'Fora do escopo' }, 403);
      if (user.role === 'gestor') b.company_id = scope;`;
  if(worker.split(projectNeedle).length-1!==1) throw new Error('Contrato de criação de projeto inesperado; build interrompido para evitar patch inseguro.');
  const projectGuard=`${projectNeedle}
      ${projectMarker}
      b.name = String(b.name).trim();
      if (!b.name) return json({ error: 'Nome do projeto é obrigatório' }, 400);
      if (scope && !b.company_id) b.company_id = scope;
      if (!b.company_id) return json({ error: 'Empresa é obrigatória para criar projeto' }, 400);
      const projectCompany = await DB.prepare('SELECT id FROM companies WHERE id = ? LIMIT 1').bind(b.company_id).first();
      if (!projectCompany) return json({ error: 'Empresa não encontrada' }, 404);
      const sameProject = await DB.prepare('SELECT id FROM projects WHERE company_id = ? AND lower(trim(name)) = lower(trim(?)) LIMIT 1').bind(b.company_id,b.name).first();
      if (sameProject) return json({ error: 'Já existe projeto com esse nome nesta empresa', id: sameProject.id }, 409);`;
  worker=worker.replace(projectNeedle,projectGuard);
  changed=true;
}else{
  console.log('OK: proteção de integridade empresa→projeto já aplicada.');
}

if(changed){
  fs.writeFileSync(file,worker);
  console.log('OK: hardening de mutações/onboarding aplicado ao Worker.');
}else{
  console.log('OK: hardening de mutações/onboarding já estava materializado.');
}
