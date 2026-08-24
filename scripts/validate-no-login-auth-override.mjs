import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const must=(needle,label)=>{if(!worker.includes(needle))throw new Error(`Ausente: ${label}`)};

must("const token = (request.headers.get('authorization') || '').replace('Bearer ', '');",'leitura do Bearer token');
must("if (!token && portalNoLoginHost) return { id:'portal-no-login'",'fallback PMO sintético apenas sem token');
must("if (!token) return null;",'hosts fora do Portal continuam fail-closed');
if(worker.includes("if (portalNoLoginHost) return { id:'portal-no-login'")){
  throw new Error('Identidade sintética ainda ignora Bearer token em host oficial.');
}
console.log('OK: sem token abre como PMO; com Bearer token o backend valida a sessão real.');
