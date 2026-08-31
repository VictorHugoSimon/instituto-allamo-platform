import fs from 'node:fs';

const workerFile='public/_worker.js';
const indexFile='public/index.html';
const apiFile='src/opr-governance-master-api.js';
const routeFile='src/opr-dedicated-route.js';
const apiStart='    // BEGIN ALLAMO OPR GOVERNANCE MASTER API';
const apiEnd='    // END ALLAMO OPR GOVERNANCE MASTER API';
const apiNeedle='    // BEGIN ALLAMO OPR PMO API';
const uiStart='<!-- BEGIN ALLAMO OPR DEDICATED ROUTE -->';
const uiEnd='<!-- END ALLAMO OPR DEDICATED ROUTE -->';

function sync(text,start,end,content,needle,indent=''){
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  if(text.includes(start)){
    const a=text.indexOf(start),b=text.indexOf(end,a);
    if(b<0)throw new Error('Marcador final ausente: '+end);
    return text.slice(0,a)+block+text.slice(b+end.length);
  }
  if(!text.includes(needle))throw new Error('Ponto de injeção não encontrado: '+needle);
  return text.replace(needle,block+'\n'+needle);
}

let worker=fs.readFileSync(workerFile,'utf8');
const api=fs.readFileSync(apiFile,'utf8');
worker=sync(worker,apiStart,apiEnd,api,apiNeedle,'    ');
if((worker.match(/BEGIN ALLAMO OPR GOVERNANCE MASTER API/g)||[]).length!==1)throw new Error('Bloco OPR Governance Master duplicado no Worker.');
if(worker.indexOf(apiStart)>worker.indexOf(apiNeedle))throw new Error('Governança Mestre precisa executar antes da API OPR legada.');
fs.writeFileSync(workerFile,worker);

let html=fs.readFileSync(indexFile,'utf8');
const route=fs.readFileSync(routeFile,'utf8');
const script='<script>\n'+route+'\n</script>';
html=sync(html,uiStart,uiEnd,script,'</body>');
if((html.match(/BEGIN ALLAMO OPR DEDICATED ROUTE/g)||[]).length!==1)throw new Error('Roteador dedicado OPR duplicado.');
fs.writeFileSync(indexFile,html);

console.log('OK: Governança Mestre OPR injetada antes da API legada e acesso do portal direcionado ao Plano dedicado.');
