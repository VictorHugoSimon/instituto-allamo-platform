import fs from 'node:fs';
const workerFile='public/_worker.js',apiFile='src/opr-action-v2-api.js';
const start='    // BEGIN ALLAMO OPR ACTION V2',end='    // END ALLAMO OPR ACTION V2',needle='    // BEGIN ALLAMO OPR GOVERNANCE PLATFORM';
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const line=m=>new RegExp(`^[\\t ]*${esc(m.trim())}[\\t ]*$`,'gm');
const count=(t,m)=>(t.match(line(m))||[]).length;
function stripAll(t){const re=new RegExp(`^[\\t ]*${esc(start.trim())}[\\t ]*\\r?\\n[\\s\\S]*?^[\\t ]*${esc(end.trim())}[\\t ]*(?:\\r?\\n)?`,'gm'),o=t.replace(re,'');if(count(o,start)||count(o,end))throw new Error('Wrapper OPR ACTION V2 órfão');return o}
function inject(t,c){if(!t.includes(needle))throw new Error('Ponto de injeção Governance Platform ausente');const b=start+'\n'+c.split('\n').map(x=>'    '+x).join('\n')+'\n'+end+'\n';return t.replace(needle,b+needle)}
let worker=fs.readFileSync(workerFile,'utf8'),content=fs.readFileSync(apiFile,'utf8');
if(count(worker,start)!==count(worker,end))throw new Error('Wrappers OPR ACTION V2 inconsistentes');if(count(worker,start))worker=stripAll(worker);if(count(content,start)||count(content,end))content=stripAll(content);
worker=inject(worker,content);const a=count(worker,start),b=count(worker,end);if(a!==1||b!==1)throw new Error(`Plano OPR v2 inválido start=${a} end=${b}`);if(worker.indexOf(start)>worker.indexOf(needle))throw new Error('Plano OPR v2 deve executar antes das demais APIs OPR');fs.writeFileSync(workerFile,worker);console.log('OK: Plano Mestre OPR v2 injetado de forma idempotente antes das rotas legadas.');
