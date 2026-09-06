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
const handleStart=worker.indexOf(handleMarker);
const handleEnd=handleStart>=0?worker.indexOf('\nasync function ',handleStart+handleMarker.length):-1;
const handleBlock=handleStart>=0?worker.slice(handleStart,handleEnd>=0?handleEnd:worker.length):'';
const userOccurrences=handleBlock.split(userNeedle).length-1;
const userPos=handleBlock.indexOf(userNeedle);
const authPos=userPos>=0?handleBlock.indexOf(authNeedle,userPos+userNeedle.length):-1;
const nextAuthPos=authPos>=0?handleBlock.indexOf(authNeedle,authPos+authNeedle.length):-1;
if(handleStart<0 || userOccurrences!==1 || authPos<0 || nextAuthPos>=0){
  throw new Error(`Contrato de autorização inesperado no handleApi (handle=${handleStart>=0}, currentUser=${userOccurrences}, authDepois=${authPos>=0}, authDuplicadoDepois=${nextAuthPos>=0}); build interrompido para evitar patch inseguro.`);
}

const guard=`${authNeedle}
    const __softSprintArchive = request.method === 'DELETE' && /^\\/api\\/sprint-documents\\/[^/]+$/.test(url.pathname);
    if (user.__portal_no_login === true && request.method === 'DELETE' && !__softSprintArchive) {
      return json({
        error:'Ação destrutiva exige sessão autenticada',
        code:'authenticated_session_required'
      },403);
    }`;

const absoluteAuthPos=handleStart+authPos;
worker=worker.slice(0,absoluteAuthPos)+guard+worker.slice(absoluteAuthPos+authNeedle.length);
if(!worker.includes(deleteGuard))throw new Error('Proteção de DELETE não foi aplicada ao guard autenticado principal.');
fs.writeFileSync(file,worker);
console.log('OK: DELETE destrutivo bloqueado no fluxo autenticado principal; blocos públicos pré-auth permanecem isolados.');
