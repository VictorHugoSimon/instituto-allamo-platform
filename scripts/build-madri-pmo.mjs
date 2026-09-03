import fs from 'node:fs';

const worker='public/_worker.js';
const publicApi=fs.readFileSync('src/madri-pmo-public-api.js','utf8');
let privateApi=fs.readFileSync('src/madri-pmo-api.js','utf8');
let governanceApi=fs.readFileSync('src/madri-governance-platform-api.js','utf8');

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

// Hardening defensivo da Governance Platform antes de injetar no Worker.
// 1) Corrige parsing da rota /entity/:id/history.
// 2) Zero testes/readiness nunca pode resultar em status VERDE.
const normalizeGovernanceApi=text=>{
  const badHistory="const [,entity,ref]=path.split('/').slice(1),cfg=mgEntities[entity];";
  const goodHistory="const p=path.split('/'),entity=p[1],ref=decodeURIComponent(p[2]),cfg=mgEntities[entity];";
  if(!text.includes(badHistory)&&!text.includes(goodHistory))throw new Error('Contrato da rota de histórico MADRI não localizado.');
  let out=text.replace(badHistory,goodHistory);
  const oldOverall="const hard=p1+criticalRisks+blockedInts,soft=Number(a.late||0)+gaps+readyBlock+pendingDec;const overall=hard?'VERMELHO':soft?'AMARELO':'VERDE';const gono=hard?'NO-GO':(!tests||approvedTests<tests||readyBlock)?'PENDENTE DE TESTES':'PRONTO PARA DECISÃO';";
  const newOverall="const readyTotal=await mgCount(`SELECT COUNT(*) n FROM madri_readiness WHERE project_id=? AND archived_at IS NULL`,ctx.project_id);const hard=p1+criticalRisks+blockedInts,soft=Number(a.late||0)+gaps+readyBlock+pendingDec+(!tests?1:0)+(!readyTotal?1:0);const overall=hard?'VERMELHO':soft?'AMARELO':'VERDE';const gono=hard?'NO-GO':(!tests||approvedTests<tests||readyBlock||!readyTotal)?'PENDENTE DE TESTES':'PRONTO PARA DECISÃO';";
  if(!out.includes(oldOverall)&&!out.includes(newOverall))throw new Error('Contrato de status/readiness MADRI não localizado.');
  out=out.replace(oldOverall,newOverall);
  return out;
};
governanceApi=normalizeGovernanceApi(governanceApi);

const stripAllBlocks=(text,start,end)=>{
  let out=text,count=0;
  while(out.includes(start)){
    const a=out.indexOf(start),b=out.indexOf(end,a);
    if(b<0)throw new Error('Marcador final ausente: '+end);
    out=out.slice(0,a)+out.slice(b+end.length);
    count++;
    if(count>20)throw new Error('Quantidade anormal de blocos duplicados: '+start);
  }
  return out;
};
const sync=(text,start,end,content,needle,indent='')=>{
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end;
  const clean=stripAllBlocks(text,start,end);
  if(!clean.includes(needle))throw new Error('Ponto de injeção MADRI não encontrado: '+needle);
  return clean.replace(needle,block+'\n'+needle);
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
w=sync(
  w,
  '    // BEGIN MADRI GOVERNANCE PLATFORM API',
  '    // END MADRI GOVERNANCE PLATFORM API',
  governanceApi,
  "    if (path === 'projects' && request.method === 'GET')",
  '    '
);

// Hardening final: corrige qualquer bloco MADRI legado já presente no Worker,
// garante exatamente uma cópia canônica e impede SQL de aridade inválida.
w=normalizeInsertArity(w);
const privateBlocks=(w.match(/BEGIN MADRI PMO PRIVATE API/g)||[]).length;
const publicBlocks=(w.match(/BEGIN MADRI PMO PUBLIC API/g)||[]).length;
const governanceBlocks=(w.match(/BEGIN MADRI GOVERNANCE PLATFORM API/g)||[]).length;
if(privateBlocks!==1)throw new Error(`Worker MADRI inválido: ${privateBlocks} blocos privados encontrados.`);
if(publicBlocks!==1)throw new Error(`Worker MADRI inválido: ${publicBlocks} blocos públicos encontrados.`);
if(governanceBlocks!==1)throw new Error(`Worker MADRI inválido: ${governanceBlocks} blocos de governança encontrados.`);
if(!w.includes("entity=p[1],ref=decodeURIComponent(p[2]),cfg=mgEntities[entity]"))throw new Error('Worker final sem correção da rota de histórico MADRI.');
if(!w.includes('(!tests?1:0)+(!readyTotal?1:0)'))throw new Error('Worker final pode sinalizar VERDE sem testes/readiness.');
if(badArityPattern().test(w))throw new Error('Worker final ainda contém INSERT MADRI com 26 valores para 25 colunas.');
const workerGoodInserts=w.split(goodInsert).length-1;
if(workerGoodInserts<2)throw new Error(`Worker final não contém os dois INSERTs MADRI normalizados; encontrado ${workerGoodInserts}.`);

fs.writeFileSync(worker,w);
console.log(`OK: APIs MADRI PMO + Governance Platform canônicas; blocos legados deduplicados; histórico/readiness endurecidos; ${workerGoodInserts} INSERTs work_items 25×25 validados.`);
