import fs from 'node:fs';
const workerFile='public/_worker.js';
const apiFile='src/opr-governance-platform-api.js';
const reportApiFile='src/opr-permanent-report-api.js';
const start='    // BEGIN ALLAMO OPR GOVERNANCE PLATFORM';
const end='    // END ALLAMO OPR GOVERNANCE PLATFORM';
const reportStart='    // BEGIN ALLAMO OPR PERMANENT REPORT API';
const reportEnd='    // END ALLAMO OPR PERMANENT REPORT API';
const needle='    // BEGIN ALLAMO OPR PMO API';
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const lineRe=m=>new RegExp(`^[\\t ]*${escRe(m.trim())}[\\t ]*$`,'gm');
const count=(text,m)=>(text.match(lineRe(m))||[]).length;
function stripAll(text,s,e){
  const re=new RegExp(`^[\\t ]*${escRe(s.trim())}[\\t ]*\\r?\\n[\\s\\S]*?^[\\t ]*${escRe(e.trim())}[\\t ]*(?:\\r?\\n)?`,'gm');
  const out=text.replace(re,'');
  const a=count(out,s),b=count(out,e);if(a||b)throw new Error(`Wrapper OPR órfão após limpeza: ${s.trim()} start=${a} end=${b}`);
  return out;
}
function inject(text,s,e,content,anchor,indent=''){
  if(!text.includes(anchor))throw new Error('Ponto de injeção OPR não encontrado: '+anchor);
  const block=s+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+e+'\n';
  return text.replace(anchor,block+anchor);
}
let worker=fs.readFileSync(workerFile,'utf8');
let api=fs.readFileSync(apiFile,'utf8'),reportApi=fs.readFileSync(reportApiFile,'utf8');
// Build repetido pode receber Worker já materializado. Canonicalizamos os wrappers
// da infraestrutura OPR sem alterar dados, regras de negócio ou tabelas do projeto.
for(const [s,e] of [[reportStart,reportEnd],[start,end]]){
  const a=count(worker,s),b=count(worker,e);if(a!==b)throw new Error(`Wrappers OPR inconsistentes: ${s.trim()} start=${a} end=${b}`);
  if(a)worker=stripAll(worker,s,e);
  if(count(api,s)||count(api,e))api=stripAll(api,s,e);
  if(count(reportApi,s)||count(reportApi,e))reportApi=stripAll(reportApi,s,e);
}
worker=inject(worker,start,end,api,needle,'    ');
worker=inject(worker,reportStart,reportEnd,reportApi,start,'    ');
const govStarts=count(worker,start),govEnds=count(worker,end),repStarts=count(worker,reportStart),repEnds=count(worker,reportEnd);
if(govStarts!==1||govEnds!==1)throw new Error(`Bloco OPR Governance Platform inválido: start=${govStarts} end=${govEnds}.`);
if(repStarts!==1||repEnds!==1)throw new Error(`Bloco Status Report permanente inválido: start=${repStarts} end=${repEnds}.`);
if(worker.indexOf(reportStart)>worker.indexOf(start)||worker.indexOf(start)>worker.indexOf(needle))throw new Error('Ordem das APIs OPR inválida.');
fs.writeFileSync(workerFile,worker);

// Plano e POP possuem submenus próprios. Mantemos esses submenus e adicionamos a navegação
// global numerada do portal, evitando que o usuário perca contexto ao entrar nesses módulos.
const bridge='<script src="/opr/assets/legacy-global-nav.js"></script>';
for(const page of ['public/opr-plano-de-acao/index.html','public/opr-pop/index.html']){
  if(!fs.existsSync(page))throw new Error('Página OPR ausente para menu global: '+page);
  let html=fs.readFileSync(page,'utf8');
  if(!html.includes('/opr/assets/legacy-global-nav.js')){
    if(!html.includes('</body>'))throw new Error('Fechamento body ausente: '+page);
    html=html.replace('</body>',bridge+'</body>');
    fs.writeFileSync(page,html);
  }
}
console.log('OK: API OPR Governance Platform v2, Status Report permanente e menu global Plano/POP preparados de forma idempotente.');
