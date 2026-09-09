import fs from 'node:fs';

const workerFile='public/_worker.js';
const indexFile='public/index.html';
const apiSource=fs.readFileSync('src/work-import-api.js','utf8');
const uiSource=fs.readFileSync('src/work-import-ui.js','utf8');
let worker=fs.readFileSync(workerFile,'utf8');
let index=fs.readFileSync(indexFile,'utf8');

function sync(text,start,end,content,needle,indent=''){
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  const a=text.indexOf(start);
  if(a>=0){const b=text.indexOf(end,a);if(b<0)throw new Error('Marcador final ausente: '+end);return text.slice(0,a)+block+text.slice(b+end.length)}
  const at=text.indexOf(needle);if(at<0)throw new Error('Ponto de injeção não encontrado: '+needle);return text.slice(0,at)+block+'\n'+text.slice(at);
}

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

fs.writeFileSync(workerFile,worker);
fs.writeFileSync(indexFile,index);
console.log('OK: importador de demandas do Excel materializado de forma idempotente no Work Management.');
