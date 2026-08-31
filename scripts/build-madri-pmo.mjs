import fs from 'node:fs';

const worker='public/_worker.js';
const publicApi=fs.readFileSync('src/madri-pmo-public-api.js','utf8');
let privateApi=fs.readFileSync('src/madri-pmo-api.js','utf8');

// Correção defensiva do contrato de criação de ações MADRI.
// Os INSERTs em work_items possuem 25 colunas: 24 parâmetros + version=1.
// Qualquer forma com 25 placeholders + literal 1 gera 26 valores para 25 colunas.
const goodInsert='VALUES('+Array(24).fill('?').join(',')+',1)';
const badArityPattern=()=>/VALUES\(\s*(?:\?\s*,\s*){25}1\s*\)/g;
const normalizeInsertArity=text=>text.replace(badArityPattern(),goodInsert);

privateApi=normalizeInsertArity(privateApi);
const normalizedPrivateInserts=privateApi.split(goodInsert).length-1;
if(normalizedPrivateInserts<2){
  throw new Error(`Contrato INSERT MADRI incompleto: esperado >=2 INSERTs normalizados; encontrado ${normalizedPrivateInserts}.`);
}
if(badArityPattern().test(privateApi)){
  throw new Error('API MADRI ainda contém INSERT com 26 valores para 25 colunas.');
}

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

// Hardening final: também corrige qualquer bloco MADRI legado já presente no Worker
// e impede publicação com rotas privadas duplicadas ou SQL de aridade inválida.
w=normalizeInsertArity(w);
const privateBlocks=(w.match(/BEGIN MADRI PMO PRIVATE API/g)||[]).length;
const publicBlocks=(w.match(/BEGIN MADRI PMO PUBLIC API/g)||[]).length;
if(privateBlocks!==1)throw new Error(`Worker MADRI inválido: ${privateBlocks} blocos privados encontrados.`);
if(publicBlocks!==1)throw new Error(`Worker MADRI inválido: ${publicBlocks} blocos públicos encontrados.`);
if(badArityPattern().test(w))throw new Error('Worker final ainda contém INSERT MADRI com 26 valores para 25 colunas.');
const workerGoodInserts=w.split(goodInsert).length-1;
if(workerGoodInserts<2)throw new Error(`Worker final não contém os dois INSERTs MADRI normalizados; encontrado ${workerGoodInserts}.`);

fs.writeFileSync(worker,w);
console.log(`OK: APIs MADRI PMO injetadas uma única vez; ${workerGoodInserts} INSERTs de work_items com aridade 25×25 validados.`);
