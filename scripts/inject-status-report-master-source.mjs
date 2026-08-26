import fs from 'node:fs';
const index='public/index.html';
const source=fs.readFileSync('src/status-report-master-source.js','utf8');
let html=fs.readFileSync(index,'utf8');
const start='<!-- BEGIN ALLAMO STATUS REPORT MASTER SOURCE -->';
const end='<!-- END ALLAMO STATUS REPORT MASTER SOURCE -->';
const block=`${start}\n<script>\n${source}\n</script>\n${end}`;
if(html.includes(start)){
  const a=html.indexOf(start),b=html.indexOf(end,a);
  if(b<0)throw new Error('Marcador final da fonte mestre ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  const needle='<script>\n(()=>{\n  if(window.AllamoRichReport)return;';
  if(!html.includes(needle))throw new Error('Viewer rico não encontrado para injetar fonte mestre.');
  html=html.replace(needle,block+'\n'+needle);
}
fs.writeFileSync(index,html);
if(!html.includes('__allamoStatusReportMasterSource')||!html.includes('BEGIN ALLAMO STATUS REPORT MASTER SOURCE'))throw new Error('Fonte HTML mestre não entrou no artefato final.');
console.log('OK: HTML mestre literal do Status Report incorporado ao artefato antes do viewer.');
