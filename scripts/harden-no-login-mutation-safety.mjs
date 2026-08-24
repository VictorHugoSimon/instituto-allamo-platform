import fs from 'node:fs';

const file='public/_worker.js';
let worker=fs.readFileSync(file,'utf8');
const marker="code:'authenticated_session_required'";
if(worker.includes(marker)){
  console.log('OK: proteção de exclusões no modo sem login já aplicada.');
  process.exit(0);
}

const needle=`    const user = await currentUser(request, env);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    const scope = scopeCompany(user, url.searchParams.get('company'));`;
const replacement=`    const user = await currentUser(request, env);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    if (user.__portal_no_login === true && request.method === 'DELETE') {
      return json({
        error:'Ação destrutiva exige sessão autenticada',
        code:'authenticated_session_required'
      },403);
    }
    const scope = scopeCompany(user, url.searchParams.get('company'));`;

if(!worker.includes(needle)){
  throw new Error('Ponto de autorização pós-currentUser não encontrado; build interrompido para evitar patch inseguro.');
}
worker=worker.replace(needle,replacement);
fs.writeFileSync(file,worker);
console.log('OK: DELETE bloqueado para identidade PMO sintética; operações destrutivas exigem sessão autenticada.');
