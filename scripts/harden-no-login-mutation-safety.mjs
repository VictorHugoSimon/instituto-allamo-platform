import fs from 'node:fs';

const file='public/_worker.js';
let worker=fs.readFileSync(file,'utf8');
const deleteGuard="user.__portal_no_login === true && request.method === 'DELETE'";
if(worker.includes(deleteGuard)){
  console.log('OK: proteção de exclusões no modo sem login já aplicada.');
  process.exit(0);
}

const handleMarker='async function handleApi(request, env, url) {';
const authNeedle="    if (!user) return json({ error: 'Não autenticado' }, 401);";
const scopeNeedle="    const scope = scopeCompany(user, url.searchParams.get('company'));";
const authScopeAnchor=`${authNeedle}\n${scopeNeedle}`;
const anchorOccurrences=worker.split(authScopeAnchor).length-1;
if(!worker.includes(handleMarker) || anchorOccurrences!==1){
  throw new Error(`Contrato de autorização principal inesperado (handle=${worker.includes(handleMarker)}, auth_scope=${anchorOccurrences}); build interrompido para evitar patch inseguro.`);
}

const guard=`${authNeedle}
    const __softSprintArchive = request.method === 'DELETE' && /^\\/api\\/sprint-documents\\/[^/]+$/.test(url.pathname);
    if (user.__portal_no_login === true && request.method === 'DELETE' && !__softSprintArchive) {
      return json({
        error:'Ação destrutiva exige sessão autenticada',
        code:'authenticated_session_required'
      },403);
    }
    ${scopeNeedle.trim()}`;

worker=worker.replace(authScopeAnchor,guard);
if(!worker.includes(deleteGuard))throw new Error('Proteção de DELETE não foi aplicada ao guard autenticado principal.');
if(worker.split(scopeNeedle).length-1!==1)throw new Error('Scope principal foi duplicado durante o hardening.');
fs.writeFileSync(file,worker);
console.log('OK: DELETE destrutivo bloqueado no guard auth+scope principal; APIs públicas pré-auth permanecem isoladas.');
