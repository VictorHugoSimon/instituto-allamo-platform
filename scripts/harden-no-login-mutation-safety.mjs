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
const authAnchor=`${userNeedle}\n${authNeedle}`;
const handleStart=worker.indexOf(handleMarker);
const handleEnd=handleStart>=0?worker.indexOf('\nasync function ',handleStart+handleMarker.length):-1;
const handleBlock=handleStart>=0?worker.slice(handleStart,handleEnd>=0?handleEnd:worker.length):'';
const anchorOccurrences=handleBlock.split(authAnchor).length-1;
if(handleStart<0 || anchorOccurrences!==1){
  throw new Error(`Contrato de autorização inesperado no handleApi (handle=${handleStart>=0}, ocorrencias_anchor=${anchorOccurrences}); build interrompido para evitar patch inseguro.`);
}

const guard=`${authNeedle}
    const __softSprintArchive = request.method === 'DELETE' && /^\\/api\\/sprint-documents\\/[^/]+$/.test(url.pathname);
    if (user.__portal_no_login === true && request.method === 'DELETE' && !__softSprintArchive) {
      return json({
        error:'Ação destrutiva exige sessão autenticada',
        code:'authenticated_session_required'
      },403);
    }`;

const protectedAnchor=`${userNeedle}\n${guard}`;
worker=worker.replace(authAnchor,protectedAnchor);
if(!worker.includes(deleteGuard))throw new Error('Proteção de DELETE não foi aplicada ao guard autenticado principal.');
fs.writeFileSync(file,worker);
console.log('OK: DELETE destrutivo bloqueado no guard autenticado principal; APIs públicas adicionais não alteram a proteção.');
