import fs from 'node:fs';

const worker='public/_worker.js';
const publicApi=fs.readFileSync('src/madri-pmo-public-api.js','utf8');
let privateApi=fs.readFileSync('src/madri-pmo-api.js','utf8');

// Correção defensiva do contrato de criação de ações MADRI.
// work_items possui 25 colunas neste INSERT: 24 parâmetros + version=1.
// Mantemos o source API isolado e garantimos que o bundle publicado não use
// a forma antiga com 25 placeholders + literal 1 (26 valores / 25 colunas).
const badInsert='VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)';
const goodInsert='VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)';
if(!privateApi.includes(badInsert) && !privateApi.includes(goodInsert)){
  throw new Error('Contrato INSERT MADRI não encontrado para validação.');
}
privateApi=privateApi.replace(badInsert,goodInsert);

const sync=(text,start,end,content,needle,indent='')=>{
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  if(text.includes(start)){
    const a=text.indexOf(start),b=text.indexOf(end,a);
    if(b<0)throw new Error('Marcador final ausente: '+end);
    return text.slice(0,a)+block+text.slice(b+end.length);
  }
  if(!text.includes(needle))throw new Error('Ponto de injeção MADRI não encontrado: '+needle);
  return text.replace(needle,block+'\n'+needle);
};

let w=fs.readFileSync(worker,'utf8');
w=sync(
  w,
  '    // BEGIN MADRI PMO PUBLIC API',
  '    // END MADRI PMO PUBLIC API',
  publicApi,
  '    // REPORT PÚBLICO (sem login) — link aberto do cliente',
  '    '
);
w=sync(
  w,
  '    // BEGIN MADRI PMO PRIVATE API',
  '    // END MADRI PMO PRIVATE API',
  privateApi,
  "    if (path === 'projects' && request.method === 'GET')",
  '    '
);
fs.writeFileSync(worker,w);
console.log('OK: APIs MADRI PMO pública e autenticada injetadas de forma idempotente; INSERT de ações validado.');
