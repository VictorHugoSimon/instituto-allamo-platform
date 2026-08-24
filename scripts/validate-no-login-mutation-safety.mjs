import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const must=(needle,label)=>{if(!worker.includes(needle))throw new Error(`Ausente: ${label}`)};

must("__portal_no_login:true",'identidade sintética do Portal sem login');
must("user.__portal_no_login === true && request.method === 'DELETE'",'bloqueio de DELETE para identidade sem login');
must("code:'authenticated_session_required'",'código explícito para ação destrutiva bloqueada');
must("error:'Ação destrutiva exige sessão autenticada'",'mensagem operacional segura');

console.log('OK: modo sem login continua operacional, mas exclusões destrutivas exigem sessão autenticada.');
