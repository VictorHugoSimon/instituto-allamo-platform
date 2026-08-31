import fs from 'node:fs';
const workerFile='public/_worker.js';
const apiFile='src/opr-pop-api.js';
const start='    // BEGIN ALLAMO OPR POP API';
const end='    // END ALLAMO OPR POP API';
const needle='    // BEGIN ALLAMO OPR PMO API';
function sync(text,start,end,content,needle,indent=''){
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  if(text.includes(start)){
    const a=text.indexOf(start),b=text.indexOf(end,a);if(b<0)throw new Error('Marcador final ausente: '+end);
    return text.slice(0,a)+block+text.slice(b+end.length);
  }
  if(!text.includes(needle))throw new Error('Ponto de injeção OPR não encontrado.');
  return text.replace(needle,block+'\n'+needle);
}
let worker=fs.readFileSync(workerFile,'utf8');const api=fs.readFileSync(apiFile,'utf8');worker=sync(worker,start,end,api,needle,'    ');
if((worker.match(/BEGIN ALLAMO OPR POP API/g)||[]).length!==1)throw new Error('Bloco POP OPR duplicado.');
if(worker.indexOf(start)>worker.indexOf(needle))throw new Error('API POP precisa executar antes da API OPR legada.');
fs.writeFileSync(workerFile,worker);
console.log('OK: API persistente do POP OPR injetada no Worker.');
