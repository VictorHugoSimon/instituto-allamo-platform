import fs from 'node:fs';

const workerFile='public/_worker.js';
const indexFile='public/index.html';
const apiSource=fs.readFileSync('src/work-import-api.js','utf8');
let uiSource=fs.readFileSync('src/work-import-ui.js','utf8');
let worker=fs.readFileSync(workerFile,'utf8');
let index=fs.readFileSync(indexFile,'utf8');
const officialHost="/(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(location.hostname||'')";

function sync(text,start,end,content,needle,indent=''){
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  const a=text.indexOf(start);
  if(a>=0){const b=text.indexOf(end,a);if(b<0)throw new Error('Marcador final ausente: '+end);return text.slice(0,a)+block+text.slice(b+end.length)}
  const at=text.indexOf(needle);if(at<0)throw new Error('Ponto de injeção não encontrado: '+needle);return text.slice(0,at)+block+'\n'+text.slice(at);
}
function replaceOnce(text,needle,replacement,label){
  const count=text.split(needle).length-1;
  if(count!==1)throw new Error(`Contrato inesperado para ${label}: ocorrências=${count}`);
  return text.replace(needle,replacement);
}

// Importador: hosts oficiais operam sem login. Mantemos Bearer apenas fora deles.
const importApiOld="const api=async(path,opt={})=>{const t=token();if(!t)throw new Error('Sessão não encontrada. Entre novamente no portal.');const r=await fetch('/api/'+path,{...opt,headers:{'content-type':'application/json','authorization':'Bearer '+t,...(opt.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'Erro '+r.status);e.payload=d;throw e}return d};";
const importApiNew=`const allamoWorkImportNoLoginHost=()=>${officialHost};const api=async(path,opt={})=>{const noLogin=allamoWorkImportNoLoginHost();const t=noLogin?'':token();if(!t&&!noLogin)throw new Error('Sessão não encontrada. Entre novamente no portal.');const headers={'content-type':'application/json',...(opt.headers||{})};if(t)headers.authorization='Bearer '+t;const r=await fetch('/api/'+path,{...opt,headers,cache:'no-store',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'Erro '+r.status);e.payload=d;throw e}return d};`;
if(uiSource.includes(importApiOld))uiSource=replaceOnce(uiSource,importApiOld,importApiNew,'API sem login do importador');
else if(!uiSource.includes('allamoWorkImportNoLoginHost'))throw new Error('API do importador não encontrada para modo sem login.');

// O botão precisa reaparecer e ser religado mesmo após re-render/reabertura do módulo.
const buttonOld="function ensureButton(){const r=root();if(!r||document.getElementById('awm-import-excel'))return;const bar=r.querySelector('.awt');if(!bar)return;const b=document.createElement('button');b.id='awm-import-excel';b.className='awb';b.textContent='⇩ Importar Excel';b.title='Copie linhas do Excel e cole para importar demandas em lote';const reload=bar.querySelector('[data-a=\"reload\"]');bar.insertBefore(b,reload||bar.lastElementChild);b.onclick=openImport}";
const buttonNew="function ensureButton(){const r=root();if(!r)return;const bar=r.querySelector('.awt');if(!bar)return;let b=document.getElementById('awm-import-excel');if(!b){b=document.createElement('button');b.id='awm-import-excel';b.className='awb';b.textContent='⇩ Importar Excel';b.title='Copie linhas do Excel e cole para importar demandas em lote';const reload=bar.querySelector('[data-a=\"reload\"]');bar.insertBefore(b,reload||bar.lastElementChild)}b.onclick=openImport;b.style.display='';b.disabled=false;b.dataset.allamoImportReady='1'}";
if(uiSource.includes(buttonOld))uiSource=replaceOnce(uiSource,buttonOld,buttonNew,'botão persistente do importador');
else if(!uiSource.includes("b.dataset.allamoImportReady='1'"))throw new Error('Contrato do botão Importar Excel não encontrado.');

const observerOld="const observer=new MutationObserver(()=>ensureButton());observer.observe(document.documentElement,{childList:true,subtree:true});ensureButton();";
const observerNew="const observer=new MutationObserver(()=>ensureButton());observer.observe(document.documentElement,{childList:true,subtree:true});ensureButton();setInterval(ensureButton,1200);";
if(uiSource.includes(observerOld))uiSource=replaceOnce(uiSource,observerOld,observerNew,'fallback de renderização do botão');
else if(!uiSource.includes('setInterval(ensureButton,1200)'))throw new Error('Fallback do botão Importar Excel não encontrado.');

worker=sync(
  worker,
  '    // BEGIN ALLAMO WORK IMPORT API',
  '    // END ALLAMO WORK IMPORT API',
  apiSource,
  '    // END ALLAMO WORK MANAGEMENT',
  '    '
);
index=sync(
  index,
  '<!-- BEGIN ALLAMO WORK IMPORT UI -->',
  '<!-- END ALLAMO WORK IMPORT UI -->',
  `<script>\n${uiSource}\n</script>`,
  '<!-- END ALLAMO WORK MANAGEMENT UI -->'
);

// Work Management principal: mesma política oficial sem login.
const workApiOld="const api=async(p,o={})=>{const t=T();if(!t)throw new Error('Sessão não encontrada. Entre novamente no portal.');const r=await fetch('/api/'+p,{...o,headers:{'content-type':'application/json','authorization':'Bearer '+t,...(o.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Erro '+r.status);return d};";
const workApiNew=`const allamoWorkNoLoginHost=()=>${officialHost};const api=async(p,o={})=>{const noLogin=allamoWorkNoLoginHost();const t=noLogin?'':T();if(!t&&!noLogin)throw new Error('Sessão não encontrada. Entre novamente no portal.');const headers={'content-type':'application/json',...(o.headers||{})};if(t)headers.authorization='Bearer '+t;const r=await fetch('/api/'+p,{...o,headers,cache:'no-store',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Erro '+r.status);return d};`;
if(index.includes(workApiOld))index=replaceOnce(index,workApiOld,workApiNew,'API sem login do Work Management');
else if(!index.includes('allamoWorkNoLoginHost'))throw new Error('API do Work Management não encontrada para modo sem login.');

for(const required of ['allamoWorkNoLoginHost','allamoWorkImportNoLoginHost','awm-import-excel','allamoImportReady','setInterval(ensureButton,1200)']){
  if(!index.includes(required))throw new Error('Hardening Work/Excel incompleto: '+required);
}

fs.writeFileSync(workerFile,worker);
fs.writeFileSync(indexFile,index);
console.log('OK: Work Management e Importar Excel funcionam nos hosts oficiais sem login; botão é persistente e importação mantém RBAC/auditoria do backend.');
