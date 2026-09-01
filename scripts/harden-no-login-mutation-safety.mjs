import fs from 'node:fs';

const file='public/_worker.js';
let worker=fs.readFileSync(file,'utf8');
const marker="code:'authenticated_session_required'";
if(worker.includes(marker)){
  console.log('OK: proteção de exclusões no modo sem login já aplicada.');
  process.exit(0);
}

const handleMarker='async function handleApi(request, env, url) {';
const authNeedle="    if (!user) return json({ error: 'Não autenticado' }, 401);";
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
fs.writeFileSync(file,worker);
console.log('OK: DELETE destrutivo bloqueado para identidade PMO sintética; soft archive DoR/DoD permanece permitido.');
