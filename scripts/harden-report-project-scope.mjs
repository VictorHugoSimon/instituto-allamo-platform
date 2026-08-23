import fs from 'node:fs';

const workerFile='public/_worker.js';
const indexFile='public/index.html';
const api=fs.readFileSync('src/report-project-scope-api.js','utf8');
const ui=fs.readFileSync('src/report-project-scope-ui.js','utf8');

let worker=fs.readFileSync(workerFile,'utf8');
const aStart='    // BEGIN ALLAMO REPORT PROJECT SCOPE';
const aEnd='    // END ALLAMO REPORT PROJECT SCOPE';
const apiBlock=aStart+'\n'+api.split('\n').map(x=>'    '+x).join('\n')+'\n'+aEnd+'\n';
const apiNeedle='    // BEGIN ALLAMO REPORT MANAGEMENT';
if(worker.includes(aStart)){
  const a=worker.indexOf(aStart),b=worker.indexOf(aEnd,a);
  if(b<0)throw new Error('Marcador final do guard de projeto/report ausente.');
  worker=worker.slice(0,a)+apiBlock+worker.slice(b+aEnd.length+1);
}else{
  if(!worker.includes(apiNeedle))throw new Error('Ponto de injeção Report Management não encontrado.');
  worker=worker.replace(apiNeedle,apiBlock+apiNeedle);
}
if(!worker.includes('Todo Report deve pertencer a um projeto'))throw new Error('Guard obrigatório empresa/projeto/report não foi injetado.');
fs.writeFileSync(workerFile,worker);

let html=fs.readFileSync(indexFile,'utf8');
const uStart='<!-- BEGIN ALLAMO REPORT PROJECT SCOPE UI -->';
const uEnd='<!-- END ALLAMO REPORT PROJECT SCOPE UI -->';
const uiBlock=uStart+'\n<script>\n'+ui+'\n</script>\n'+uEnd;
if(html.includes(uStart)){
  const a=html.indexOf(uStart),b=html.indexOf(uEnd,a);
  if(b<0)throw new Error('Marcador final do guard UI de projeto/report ausente.');
  html=html.slice(0,a)+uiBlock+html.slice(b+uEnd.length);
}else{
  if(!html.includes('</body>'))throw new Error('Body não encontrado para guard UI de Reports.');
  html=html.replace('</body>',uiBlock+'\n</body>');
}
if(!html.includes('Cada Report precisa estar ligado a um projeto'))throw new Error('Guard UI empresa/projeto/report não foi injetado.');
fs.writeFileSync(indexFile,html);
console.log('OK: Reports nativos exigem empresa + projeto e validam pertencimento do projeto ao tenant.');
