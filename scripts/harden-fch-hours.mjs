import fs from 'node:fs';

const worker='public/_worker.js';
const index='public/index.html';
const ingest=fs.readFileSync('src/fch-hours-ingest-api.js','utf8');
const api=fs.readFileSync('src/fch-hours-api.js','utf8');
const ui=fs.readFileSync('src/fch-hours-ui.js','utf8');

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
// Ingestão técnica fica antes do login, mas exige token próprio HOURS_INGEST_TOKEN.
w=sync(
  w,
  '    // BEGIN ALLAMO FCH HOURS INGEST',
  '    // END ALLAMO FCH HOURS INGEST',
  ingest,
  '    // REPORT PÚBLICO (sem login) — link aberto do cliente',
  '    '
);
// Consultas e Curva S ficam depois da autenticação do usuário.
w=sync(
  w,
  '    // BEGIN ALLAMO FCH HOURS API',
  '    // END ALLAMO FCH HOURS API',
  api,
  '    // EMPRESAS: criar (rota dedicada)',
  '    '
);
fs.writeFileSync(worker,w);

let h=fs.readFileSync(index,'utf8');
const start='<!-- BEGIN ALLAMO FCH HOURS UI -->',end='<!-- END ALLAMO FCH HOURS UI -->';
const block=start+'\n<script data-allamo-fch-hours="1">\n'+ui+'\n</script>\n'+end;
if(h.includes(start)){
  const a=h.indexOf(start),b=h.indexOf(end,a);if(b<0)throw new Error('Marcador final da UI FCH ausente.');
  h=h.slice(0,a)+block+h.slice(b+end.length);
}else{
  const body=h.toLowerCase().lastIndexOf('</body>');if(body<0)throw new Error('Fechamento </body> não encontrado.');
  h=h.slice(0,body)+block+'\n'+h.slice(body);
}
fs.writeFileSync(index,h);

for(const marker of ['fch-hours-ingest','fch-hours-status','fch-curve','allamo-fch-curve-card','OPR_Madri']){
  const combined=fs.readFileSync(worker,'utf8')+'\n'+fs.readFileSync(index,'utf8');
  if(!combined.includes(marker))throw new Error('Integração FCH incompleta: '+marker);
}
console.log('OK: integração FCH read-only, ingestão segura e Curva S automática instaladas no Portal.');
