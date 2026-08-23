import fs from 'node:fs';
const workerFile='public/_worker.js',indexFile='public/index.html';
const schema=fs.readFileSync('src/governance-schema-bootstrap.js','utf8');
const api=fs.readFileSync('src/governance-roadmap-api.js','utf8');
const publicApi=fs.readFileSync('src/public-governance-roadmap-api.js','utf8');
const ui=fs.readFileSync('src/governance-roadmap-ui.js','utf8');
const publicUi=fs.readFileSync('src/public-governance-roadmap-ui.js','utf8');
const sync=(text,start,end,content,needle,where='before')=>{
 const block=start+'\n'+content+'\n'+end;
 if(text.includes(start)){
  const a=text.indexOf(start),b=text.indexOf(end,a);if(b<0)throw new Error('Marcador final ausente: '+end);
  return text.slice(0,a)+block+text.slice(b+end.length);
 }
 if(!text.includes(needle))throw new Error('Ponto de injeção ausente: '+needle);
 return where==='after'?text.replace(needle,needle+'\n'+block):text.replace(needle,block+'\n'+needle);
};
let w=fs.readFileSync(workerFile,'utf8');
w=sync(w,'  // BEGIN ALLAMO GOVERNANCE SCHEMA','  // END ALLAMO GOVERNANCE SCHEMA',schema,'  // END ALLAMO STAGE RUNTIME','after');
w=sync(w,'    // BEGIN ALLAMO PUBLIC GOVERNANCE','    // END ALLAMO PUBLIC GOVERNANCE',publicApi,'    // BEGIN ALLAMO PUBLIC CLIENT PORTAL');
w=sync(w,'    // BEGIN ALLAMO GOVERNANCE ROADMAP','    // END ALLAMO GOVERNANCE ROADMAP',api,'    // BEGIN ALLAMO REPORT MANAGEMENT');
fs.writeFileSync(workerFile,w);
let h=fs.readFileSync(indexFile,'utf8');
const uiStart='<!-- BEGIN ALLAMO GOVERNANCE ROADMAP UI -->',uiEnd='<!-- END ALLAMO GOVERNANCE ROADMAP UI -->';
const runtime=`<script>\n${ui}\n</script>\n<script>\n${publicUi}\n</script>`;
h=sync(h,uiStart,uiEnd,runtime,'<!-- END ALLAMO WORK MANAGEMENT UI -->');
fs.writeFileSync(indexFile,h);
console.log('OK: governança do Roadmap injetada — agendas, reuniões, áreas, stakeholders, decisões, demandas e visão pública tenant-safe.');
