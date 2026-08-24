import fs from 'node:fs';

const file='public/_worker.js';
let worker=fs.readFileSync(file,'utf8');
const marker="if (!token && portalNoLoginHost) return { id:'portal-no-login'";
if(worker.includes(marker)){
  console.log('OK: sessão autenticada já tem prioridade sobre o modo sem login.');
  process.exit(0);
}

const needle=`async function currentUser(request, env) {
  const portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(new URL(request.url).hostname || '');
  if (portalNoLoginHost) return { id:'portal-no-login', name:'PMO Államo', email:'portal-no-login@allamo.local', role:'pmo', company_id:null, status:'Ativo', __portal_no_login:true };
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;`;

const replacement=`async function currentUser(request, env) {
  const portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(new URL(request.url).hostname || '');
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token && portalNoLoginHost) return { id:'portal-no-login', name:'PMO Államo', email:'portal-no-login@allamo.local', role:'pmo', company_id:null, status:'Ativo', __portal_no_login:true };
  if (!token) return null;`;

if(!worker.includes(needle)){
  throw new Error('currentUser no modo sem login mudou; não é seguro reordenar autenticação automaticamente.');
}
worker=worker.replace(needle,replacement);
fs.writeFileSync(file,worker);
console.log('OK: Portal continua sem login quando não há token; Bearer token válido passa a usar sessão real e permite controles administrativos protegidos.');
