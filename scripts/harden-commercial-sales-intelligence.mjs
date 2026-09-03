import fs from 'node:fs';

const worker='public/_worker.js';
const index='public/index.html';
const api=fs.readFileSync('src/commercial-sales-intelligence-api.js','utf8');
const routeGuard=fs.readFileSync('src/commercial-sales-intelligence-route-guard.js','utf8');
const ui=fs.readFileSync('src/commercial-sales-intelligence-ui.js','utf8');

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

let w=fs.readFileSync(worker,'utf8');
const apiContent=routeGuard+'\n\n'+api;
w=sync(
  w,
  '    // BEGIN ALLAMO SALES INTELLIGENCE API',
  '    // END ALLAMO SALES INTELLIGENCE API',
  apiContent,
  '    // EMPRESAS: criar (rota dedicada)',
  '    '
);
fs.writeFileSync(worker,w);

let h=fs.readFileSync(index,'utf8');
const start='<!-- BEGIN ALLAMO SALES INTELLIGENCE UI -->';
const end='<!-- END ALLAMO SALES INTELLIGENCE UI -->';
const block=start+'\n<script data-allamo-sales-intelligence="1">\n'+ui+'\n</script>\n'+end;
if(h.includes(start)){
  const a=h.indexOf(start),b=h.indexOf(end,a);
  if(b<0)throw new Error('Marcador final da UI Sales Intelligence ausente.');
  h=h.slice(0,a)+block+h.slice(b+end.length);
}else{
  const body=h.toLowerCase().lastIndexOf('</body>');
  if(body<0)throw new Error('Fechamento </body> não encontrado.');
  h=h.slice(0,body)+block+'\n'+h.slice(body);
}
fs.writeFileSync(index,h);

const combined=fs.readFileSync(worker,'utf8')+'\n'+fs.readFileSync(index,'utf8');
for(const marker of [
  'BEGIN ALLAMO SALES INTELLIGENCE API',
  "path==='commercial-summary'",
  'Conta não pertence à empresa',
  'Conta incompatível na rota',
  'data-allamo-sales-intelligence',
  'Semeali · Sales Intelligence'
]){
  if(!combined.includes(marker))throw new Error('Sales Intelligence incompleto no artefato: '+marker);
}
console.log('OK: Sales Intelligence D1 multiempresa sincronizado no Worker e portal canônicos.');
