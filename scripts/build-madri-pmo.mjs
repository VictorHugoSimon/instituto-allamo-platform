import fs from 'node:fs';

const worker='public/_worker.js';
const publicApi=fs.readFileSync('src/madri-pmo-public-api.js','utf8');
let privateApi=fs.readFileSync('src/madri-pmo-api.js','utf8');
let governanceApi=fs.readFileSync('src/madri-governance-platform-api.js','utf8');

const goodInsert='VALUES('+Array(24).fill('?').join(',')+',1)';
const badArityPattern=()=>/VALUES\(\s*(?:\?\s*,\s*){25}1\s*\)/g;
const normalizeInsertArity=text=>text.replace(badArityPattern(),goodInsert);
privateApi=normalizeInsertArity(privateApi);
const normalizedPrivateInserts=privateApi.split(goodInsert).length-1;
if(normalizedPrivateInserts<2)throw new Error(`Contrato INSERT MADRI incompleto: esperado >=2 INSERTs normalizados; encontrado ${normalizedPrivateInserts}.`);
if(badArityPattern().test(privateApi))throw new Error('API MADRI ainda contém INSERT com 26 valores para 25 colunas.');

const normalizeGovernanceApi=text=>{
  const badHistory="const [,entity,ref]=path.split('/').slice(1),cfg=mgEntities[entity];";
  const goodHistory="const p=path.split('/'),entity=p[1],ref=decodeURIComponent(p[2]),cfg=mgEntities[entity];";
  if(!text.includes(badHistory)&&!text.includes(goodHistory))throw new Error('Contrato da rota de histórico MADRI não localizado.');
  let out=text.replace(badHistory,goodHistory);
  const oldOverall="const hard=p1+criticalRisks+blockedInts,soft=Number(a.late||0)+gaps+readyBlock+pendingDec;const overall=hard?'VERMELHO':soft?'AMARELO':'VERDE';const gono=hard?'NO-GO':(!tests||approvedTests<tests||readyBlock)?'PENDENTE DE TESTES':'PRONTO PARA DECISÃO';";
  const newOverall="const readyTotal=await mgCount(`SELECT COUNT(*) n FROM madri_readiness WHERE project_id=? AND archived_at IS NULL`,ctx.project_id);const hard=p1+criticalRisks+blockedInts,soft=Number(a.late||0)+gaps+readyBlock+pendingDec+(!tests?1:0)+(!readyTotal?1:0);const overall=hard?'VERMELHO':soft?'AMARELO':'VERDE';const gono=hard?'NO-GO':(!tests||approvedTests<tests||readyBlock||!readyTotal)?'PENDENTE DE TESTES':'PRONTO PARA DECISÃO';";
  if(!out.includes(oldOverall)&&!out.includes(newOverall))throw new Error('Contrato de status/readiness MADRI não localizado.');
  return out.replace(oldOverall,newOverall);
};
governanceApi=normalizeGovernanceApi(governanceApi);

const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const stripAllBlocks=(text,start,end)=>{
  const s=escRe(start.trim()),e=escRe(end.trim());
  const re=new RegExp(`^[\\t ]*${s}[\\t ]*\\r?\\n[\\s\\S]*?^[\\t ]*${e}[\\t ]*(?:\\r?\\n|$)`,'gm');
  let out=text,prev;
  do{prev=out;out=out.replace(re,'')}while(out!==prev);
  return out;
};
const sync=(text,start,end,content,needle,indent='')=>{
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end+'\n';
  const clean=stripAllBlocks(text,start,end);
  if(!clean.includes(needle))throw new Error('Ponto de injeção MADRI não encontrado: '+needle);
  return clean.replace(needle,block+needle);
};

const PUBLIC_START='    // BEGIN MADRI PMO PUBLIC API',PUBLIC_END='    // END MADRI PMO PUBLIC API';
const PRIVATE_START='    // BEGIN MADRI PMO PRIVATE API',PRIVATE_END='    // END MADRI PMO PRIVATE API';
const GOV_START='    // BEGIN MADRI GOVERNANCE PLATFORM API',GOV_END='    // END MADRI GOVERNANCE PLATFORM API';
const PUBLIC_NEEDLE='    // REPORT PÚBLICO (sem login) — link aberto do cliente';
const PRIVATE_NEEDLE="    if (path === 'projects' && request.method === 'GET')";
let w=fs.readFileSync(worker,'utf8');
w=sync(w,PUBLIC_START,PUBLIC_END,publicApi,PUBLIC_NEEDLE,'    ');
w=sync(w,PRIVATE_START,PRIVATE_END,privateApi,PRIVATE_NEEDLE,'    ');
w=sync(w,GOV_START,GOV_END,governanceApi,PRIVATE_NEEDLE,'    ');

w=normalizeInsertArity(w);
const privateBlocks=(w.match(/^[\t ]*\/\/ BEGIN MADRI PMO PRIVATE API[\t ]*$/gm)||[]).length;
const publicBlocks=(w.match(/^[\t ]*\/\/ BEGIN MADRI PMO PUBLIC API[\t ]*$/gm)||[]).length;
const governanceBlocks=(w.match(/^[\t ]*\/\/ BEGIN MADRI GOVERNANCE PLATFORM API[\t ]*$/gm)||[]).length;
if(privateBlocks!==1)throw new Error(`Worker MADRI inválido: ${privateBlocks} blocos privados reais encontrados.`);
if(publicBlocks!==1)throw new Error(`Worker MADRI inválido: ${publicBlocks} blocos públicos reais encontrados.`);
if(governanceBlocks!==1)throw new Error(`Worker MADRI inválido: ${governanceBlocks} blocos de governança reais encontrados.`);
if(!w.includes("entity=p[1],ref=decodeURIComponent(p[2]),cfg=mgEntities[entity]"))throw new Error('Worker final sem correção da rota de histórico MADRI.');
if(!w.includes('(!tests?1:0)+(!readyTotal?1:0)'))throw new Error('Worker final pode sinalizar VERDE sem testes/readiness.');
if(badArityPattern().test(w))throw new Error('Worker final ainda contém INSERT MADRI com 26 valores para 25 colunas.');
const workerGoodInserts=w.split(goodInsert).length-1;
if(workerGoodInserts<2)throw new Error(`Worker final não contém os dois INSERTs MADRI normalizados; encontrado ${workerGoodInserts}.`);

fs.writeFileSync(worker,w);
console.log(`OK: APIs MADRI PMO + Governance Platform canônicas; marcadores reais únicos; histórico/readiness endurecidos; ${workerGoodInserts} INSERTs work_items 25×25 validados.`);
