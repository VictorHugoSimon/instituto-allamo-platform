import fs from 'node:fs';
const workerFile='public/_worker.js',indexFile='public/index.html';
const api=fs.readFileSync('src/report-live-api.js','utf8');
const template=fs.readFileSync('src/report-executive-template.js','utf8');
const ui=fs.readFileSync('src/report-live-editable-ui.js','utf8');
const sync=(text,start,end,content,needle,after=false)=>{
  const block=start+'\n'+content+'\n'+end;
  if(text.includes(start)){
    const a=text.indexOf(start),b=text.indexOf(end,a);if(b<0)throw new Error('Marcador final ausente: '+end);
    return text.slice(0,a)+block+text.slice(b+end.length);
  }
  const p=text.indexOf(needle);if(p<0)throw new Error('Ponto de injeção ausente: '+needle);
  return after?text.slice(0,p+needle.length)+'\n'+block+text.slice(p+needle.length):text.slice(0,p)+block+'\n'+text.slice(p);
};
let worker=fs.readFileSync(workerFile,'utf8');
worker=sync(worker,'    // BEGIN ALLAMO LIVE EDITABLE REPORT','    // END ALLAMO LIVE EDITABLE REPORT',api,'    // BEGIN ALLAMO REPORT MANAGEMENT');
fs.writeFileSync(workerFile,worker);
let html=fs.readFileSync(indexFile,'utf8');
const runtime=`<script>\n${template}\n</script>\n<script>\n${ui}\n</script>`;
html=sync(html,'<!-- BEGIN ALLAMO LIVE EDITABLE REPORT UI -->','<!-- END ALLAMO LIVE EDITABLE REPORT UI -->',runtime,'<!-- END ALLAMO WORK MANAGEMENT UI -->');
fs.writeFileSync(indexFile,html);
console.log('OK: Report executivo editável, nova edição e quadro vivo injetados no artefato final.');
