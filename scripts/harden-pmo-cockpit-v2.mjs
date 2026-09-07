import fs from 'node:fs';

const workerFile='public/_worker.js';
const apiFile='src/pmo-cockpit-api.js';
const pageFile='public/pmo-cockpit/index.html';
const operationalScript='/pmo-cockpit/operational-blocks.js';
const operationalTag=`<script src="${operationalScript}"></script>`;
const start='    // BEGIN ALLAMO PMO COCKPIT V2';
const end='    // END ALLAMO PMO COCKPIT V2';
// Ponto-base estável do Worker bruto, usado também pela montagem das APIs do portal.
// O hardener precisa funcionar tanto antes quanto depois dos demais blocos serem injetados.
const needle="if (path === 'projects' && request.method === 'GET')";

const api=fs.readFileSync(apiFile,'utf8');
let worker=fs.readFileSync(workerFile,'utf8');
const block=start+'\n'+api+'\n'+end;

if(worker.includes(start)){
  const a=worker.indexOf(start),b=worker.indexOf(end,a);
  if(b<0)throw new Error('Marcador final do PMO Cockpit v2 ausente.');
  worker=worker.slice(0,a)+block+worker.slice(b+end.length);
}else{
  const p=worker.indexOf(needle);
  if(p<0)throw new Error('Ponto-base projects GET não encontrado no Worker.');
  worker=worker.slice(0,p)+block+'\n    '+worker.slice(p);
}

if(!worker.includes("path==='pmo-cockpit'"))throw new Error('Endpoint pmo-cockpit não foi injetado.');
fs.writeFileSync(workerFile,worker);

if(!fs.existsSync(pageFile))throw new Error('Página do PMO Cockpit não encontrada.');
let page=fs.readFileSync(pageFile,'utf8');
if(!page.includes(operationalTag)){
  if(!page.includes('</body>'))throw new Error('PMO Cockpit sem fechamento </body> para extensão operacional.');
  page=page.replace('</body>',operationalTag+'\n</body>');
  fs.writeFileSync(pageFile,page);
}
if((page.split(operationalTag).length-1)!==1)throw new Error('Extensão operacional do PMO Cockpit deve aparecer exatamente uma vez.');
if(!fs.existsSync('public'+operationalScript))throw new Error('Script operacional do PMO Cockpit não encontrado.');

console.log('OK: PMO Cockpit Executivo 2.0 injetado no Worker e extensão operacional materializada.');
