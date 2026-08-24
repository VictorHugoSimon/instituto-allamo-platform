import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const must=(needle,label)=>{if(!worker.includes(needle))throw new Error(`Ausente: ${label}`)};

must("const DB = env?.DB;",'acesso seguro ao binding DB');
must("code:'db_unavailable'",'código explícito de indisponibilidade do D1');
must("retryable:true",'sinalização retryable para clientes/smokes');
must("'retry-after':'1'",'header Retry-After para propagação pós-deploy');
must("status:503",'HTTP 503 em vez de 500 por binding ausente');

if(worker.includes("const DB = env.DB;\n  try {")){
  throw new Error('handleApi ainda entra no try com DB possivelmente indefinido.');
}

console.log('OK: indisponibilidade transitória do binding D1 é tratada como 503 retryable, sem TypeError/500.');
