import fs from 'node:fs';
const workerFile='public/_worker.js';
const apiFile='src/opr-governance-platform-api.js';
const reportApiFile='src/opr-permanent-report-api.js';
const start='    // BEGIN ALLAMO OPR GOVERNANCE PLATFORM';
const end='    // END ALLAMO OPR GOVERNANCE PLATFORM';
const reportStart='    // BEGIN ALLAMO OPR PERMANENT REPORT API';
const reportEnd='    // END ALLAMO OPR PERMANENT REPORT API';
const needle='    // BEGIN ALLAMO OPR POP VERSIONING API';
function sync(text,start,end,content,needle,indent=''){
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  if(text.includes(start)){const a=text.indexOf(start),b=text.indexOf(end,a);if(b<0)throw new Error('Marcador final ausente: '+end);return text.slice(0,a)+block+text.slice(b+end.length)}
  if(!text.includes(needle))throw new Error('Ponto de injeção OPR não encontrado: '+needle);
  return text.replace(needle,block+'\n'+needle);
}
let worker=fs.readFileSync(workerFile,'utf8');
worker=sync(worker,start,end,fs.readFileSync(apiFile,'utf8'),needle,'    ');
worker=sync(worker,reportStart,reportEnd,fs.readFileSync(reportApiFile,'utf8'),start,'    ');
if((worker.match(/BEGIN ALLAMO OPR GOVERNANCE PLATFORM/g)||[]).length!==1)throw new Error('Bloco OPR Governance Platform duplicado.');
if((worker.match(/BEGIN ALLAMO OPR PERMANENT REPORT API/g)||[]).length!==1)throw new Error('Bloco Status Report permanente duplicado.');
if(worker.indexOf(reportStart)>worker.indexOf(start)||worker.indexOf(start)>worker.indexOf(needle))throw new Error('Ordem das APIs OPR inválida.');
fs.writeFileSync(workerFile,worker);
console.log('OK: API OPR Governance Platform v2 e Status Report permanente injetados no Worker.');
