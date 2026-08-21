import fs from 'node:fs';
const worker='public/_worker.js',index='public/index.html';
const api=fs.readFileSync('src/work-management-api.js','utf8');
const ui=fs.readFileSync('src/work-management-ui.js','utf8');
const reportListApi=fs.readFileSync('src/report-management-list-api.js','utf8');
const reportApi=fs.readFileSync('src/report-management-api.js','utf8');
const reportUi=fs.readFileSync('src/report-management-ui.js','utf8');
const stage=fs.readFileSync('src/stage-runtime-bootstrap.js','utf8')+'\n'+fs.readFileSync('src/report-schema-bootstrap.js','utf8');
const enhancements=fs.readFileSync('src/portal-enhancements.js','utf8');
const sync=(text,start,end,content,needle,indent='')=>{
 const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
 if(text.includes(start)){
   const a=text.indexOf(start),b=text.indexOf(end,a);
   if(b<0) throw new Error('Marcador final ausente: '+end);
   return text.slice(0,a)+block+text.slice(b+end.length);
 }
 if(!text.includes(needle)) throw new Error('Ponto de injeção não encontrado: '+needle);
 return text.replace(needle,block+'\n'+needle);
};
let w=fs.readFileSync(worker,'utf8');
w=sync(w,'  // BEGIN ALLAMO STAGE RUNTIME','  // END ALLAMO STAGE RUNTIME',stage,"  try {\n    // REPORT PÚBLICO",'  ');
w=sync(w,'    // BEGIN ALLAMO WORK MANAGEMENT','    // END ALLAMO WORK MANAGEMENT',api,"    if (path === 'projects' && request.method === 'GET')",'    ');
w=sync(w,'    // BEGIN ALLAMO REPORT LIST','    // END ALLAMO REPORT LIST',reportListApi,"    if (path === 'projects' && request.method === 'GET')",'    ');
w=sync(w,'    // BEGIN ALLAMO REPORT MANAGEMENT','    // END ALLAMO REPORT MANAGEMENT',reportApi,"    if (path === 'projects' && request.method === 'GET')",'    ');
fs.writeFileSync(worker,w);
let h=fs.readFileSync(index,'utf8');
const start='<!-- BEGIN ALLAMO WORK MANAGEMENT UI -->',end='<!-- END ALLAMO WORK MANAGEMENT UI -->';
const launcher=`<script>\n${ui}\n</script>\n<script>\n${reportUi}\n</script>\n<script>\n${enhancements}\n</script>\n<script>(()=>{const add=()=>{if(!document.getElementById('awm-launcher')){const b=document.createElement('button');b.id='awm-launcher';b.textContent='Trabalho';b.title='Gestão de tarefas e demandas';b.style.cssText='position:fixed;right:20px;bottom:86px;z-index:99980;border:0;border-radius:999px;padding:11px 16px;background:#242321;color:white;font-weight:700;box-shadow:0 4px 18px #0003;cursor:pointer';b.onclick=()=>window.AllamoWork.open();document.body.appendChild(b)}if(!document.getElementById('arm-launcher')){const r=document.createElement('button');r.id='arm-launcher';r.textContent='Reports';r.title='Histórico de reports e roadmap';r.style.cssText='position:fixed;right:20px;bottom:136px;z-index:99980;border:0;border-radius:999px;padding:11px 16px;background:#8f715e;color:white;font-weight:700;box-shadow:0 4px 18px #0003;cursor:pointer';r.onclick=()=>window.AllamoReports.open();document.body.appendChild(r)}};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add()})();</script>`;
h=sync(h,start,end,launcher,'</body>');
fs.writeFileSync(index,h);
console.log('OK: Work Management, Reports/Roadmap, Stage runtime e melhorias executivas sincronizados.');
