import fs from 'node:fs';

const file='public/_worker.js';
let worker=fs.readFileSync(file,'utf8');
const deleteGuard="user.__portal_no_login === true && request.method === 'DELETE'";
if(worker.includes(deleteGuard)){
  console.log('OK: proteção de exclusões no modo sem login já aplicada.');
  process.exit(0);
}

const handleMarker='async function handleApi(request, env, url) {';
const userNeedle='    const user = await currentUser(request, env);';
const authNeedle="    if (!user) return json({ error: 'Não autenticado' }, 401);";
const scopeNeedle="    const scope = scopeCompany(user, url.searchParams.get('company'));";
const handleStart=worker.indexOf(handleMarker);
const scopeOccurrences=worker.split(scopeNeedle).length-1;
const scopePos=worker.indexOf(scopeNeedle,Math.max(0,handleStart));
const authPos=scopePos>=0?worker.lastIndexOf(authNeedle,scopePos):-1;
const userPos=authPos>=0?worker.lastIndexOf(userNeedle,authPos):-1;
if(handleStart<0 || scopeOccurrences!==1 || scopePos<0 || authPos<=handleStart || userPos<=handleStart || !(userPos<authPos && authPos<scopePos)){
  throw new Error(`Contrato de autorização principal inesperado (handle=${handleStart>=0}, scopes=${scopeOccurrences}, user=${userPos>handleStart}, auth=${authPos>handleStart}); build interrompido para evitar patch inseguro.`);
}

const guard=`${authNeedle}
    const __softSprintArchive = request.method === 'DELETE' && /^\\/api\\/sprint-documents\\/[^/]+$/.test(url.pathname);
    if (user.__portal_no_login === true && request.method === 'DELETE' && !__softSprintArchive) {
      return json({
        error:'Ação destrutiva exige sessão autenticada',
        code:'authenticated_session_required'
      },403);
    }`;

worker=worker.slice(0,authPos)+guard+worker.slice(authPos+authNeedle.length);
if(!worker.includes(deleteGuard))throw new Error('Proteção de DELETE não foi aplicada ao guard autenticado principal.');
if(worker.split(scopeNeedle).length-1!==1)throw new Error('Scope principal foi alterado durante o hardening.');
fs.writeFileSync(file,worker);
console.log('OK: DELETE destrutivo bloqueado no fluxo currentUser → auth → scope principal; extensões públicas permanecem isoladas.');
