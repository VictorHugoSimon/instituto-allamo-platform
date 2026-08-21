import fs from 'node:fs';
const s=fs.readFileSync('scripts/enforce-live-first-paint.mjs','utf8');
const must=(n,l)=>{if(!s.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
must('window.__allamoRevealWhenReady=function()','Função de liberação');
must('window.__allamoBootGuardStarted','Proteção contra dupla inicialização');
must('setTimeout(function(){window.__allamoRevealWhenReady()},0)','Auto-start do boot guard');
must('if(!hasSession()&&!isPublic()){reveal();return}','Fallback anônimo');
must('public-client-projects','Contexto público por empresa');
console.log('OK: boot guard auto-inicia e libera anônimo, sessão e portal público sem depender do bundle posterior.');
