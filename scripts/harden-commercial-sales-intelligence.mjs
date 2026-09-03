import fs from 'node:fs';

const worker='public/_worker.js';
const index='public/index.html';
const api=fs.readFileSync('src/commercial-sales-intelligence-api.js','utf8');
const routeGuard=fs.readFileSync('src/commercial-sales-intelligence-route-guard.js','utf8');
const ui=fs.readFileSync('src/commercial-sales-intelligence-ui.js','utf8');
const accessPublicApi=fs.readFileSync('src/access-invitation-public-api.js','utf8');
const accessApi=fs.readFileSync('src/access-invitation-api.js','utf8');
const accessUi=fs.readFileSync('src/access-invitation-ui.js','utf8');

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
w=sync(
  w,
  '    // BEGIN ALLAMO ACCESS INVITATION PUBLIC API',
  '    // END ALLAMO ACCESS INVITATION PUBLIC API',
  accessPublicApi,
  "    if (path === 'login' && request.method === 'POST') {",
  '    '
);
w=sync(
  w,
  '    // BEGIN ALLAMO ACCESS INVITATION API',
  '    // END ALLAMO ACCESS INVITATION API',
  accessApi,
  '    // EMPRESAS: criar (rota dedicada)',
  '    '
);
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

function syncHtml(text,start,end,scriptAttr,content){
  const block=start+'\n<script '+scriptAttr+'>\n'+content+'\n</script>\n'+end;
  if(text.includes(start)){
    const a=text.indexOf(start),b=text.indexOf(end,a);
    if(b<0)throw new Error('Marcador final ausente: '+end);
    return text.slice(0,a)+block+text.slice(b+end.length);
  }
  const body=text.toLowerCase().lastIndexOf('</body>');
  if(body<0)throw new Error('Fechamento </body> não encontrado.');
  return text.slice(0,body)+block+'\n'+text.slice(body);
}

let h=fs.readFileSync(index,'utf8');
h=syncHtml(
  h,
  '<!-- BEGIN ALLAMO SALES INTELLIGENCE UI -->',
  '<!-- END ALLAMO SALES INTELLIGENCE UI -->',
  'data-allamo-sales-intelligence="1"',
  ui
);
h=syncHtml(
  h,
  '<!-- BEGIN ALLAMO ACCESS INVITATION UI -->',
  '<!-- END ALLAMO ACCESS INVITATION UI -->',
  'data-allamo-access-invitation="1"',
  accessUi
);
fs.writeFileSync(index,h);

const combined=fs.readFileSync(worker,'utf8')+'\n'+fs.readFileSync(index,'utf8');
for(const marker of [
  'BEGIN ALLAMO SALES INTELLIGENCE API',
  "path==='commercial-summary'",
  'Conta não pertence à empresa',
  'Conta incompatível na rota',
  'data-allamo-sales-intelligence',
  'Semeali · Sales Intelligence',
  'BEGIN ALLAMO ACCESS INVITATION PUBLIC API',
  "path==='access-invite-accept'",
  'BEGIN ALLAMO ACCESS INVITATION API',
  "path==='access-invitations'",
  'data-allamo-access-invitation',
  'Compartilhar acesso'
]){
  if(!combined.includes(marker))throw new Error('Sales Intelligence/Acessos incompleto no artefato: '+marker);
}
console.log('OK: Sales Intelligence D1 e convite seguro de acesso sincronizados no Worker e portal canônicos.');
