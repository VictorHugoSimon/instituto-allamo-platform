import fs from 'node:fs';

const worker='public/_worker.js';
const publicApi=fs.readFileSync('src/madri-pmo-public-api.js','utf8');
let privateApi=fs.readFileSync('src/madri-pmo-api.js','utf8');
const governanceApi=fs.readFileSync('src/madri-governance-platform-api.js','utf8');

// Correção defensiva do contrato de criação de ações MADRI.
// Os INSERTs em work_items possuem 25 colunas: 24 parâmetros + version=1.
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

// PMO privado + Governance Platform compartilham um único bloco autenticado.
const privateBundle=privateApi+'\n\n// MADRI GOVERNANCE PLATFORM API\n'+governanceApi;

const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const markerLineRe=marker=>new RegExp(`^[\\t ]*${escRe(marker.trim())}[\\t ]*$`,'gm');
const countMarkerLines=(text,marker)=>(text.match(markerLineRe(marker))||[]).length;
const stripAllBlocks=(text,start,end)=>{
  const s=escRe(start.trim()),e=escRe(end.trim());
  const re=new RegExp(`^[\\t ]*${s}[\\t ]*\\r?\\n[\\s\\S]*?^[\\t ]*${e}[\\t ]*(?:\\r?\\n)?`,'gm');
  const cleaned=text.replace(re,'');
  const orphanStarts=countMarkerLines(cleaned,start),orphanEnds=countMarkerLines(cleaned,end);
  if(orphanStarts||orphanEnds){
    throw new Error(`Marcador MADRI órfão após limpeza: start=${orphanStarts}, end=${orphanEnds} (${start.trim()})`);
  }
  return cleaned;
};
const injectOnce=(text,start,end,content,needle,indent='')=>{
  if(!text.includes(needle))throw new Error('Ponto de injeção MADRI não encontrado: '+needle);
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end+'\n';
  return text.replace(needle,block+needle);
};

const PUBLIC_START='    // BEGIN MADRI PMO PUBLIC API';
const PUBLIC_END='    // END MADRI PMO PUBLIC API';
const PRIVATE_START='    // BEGIN MADRI PMO PRIVATE API';
const PRIVATE_END='    // END MADRI PMO PRIVATE API';

let w=fs.readFileSync(worker,'utf8');

// O artefato public/_worker.js pode vir de um build anterior. Removemos TODAS as
// cópias canônicas antes de reinjetar para tornar o build realmente idempotente.
w=stripAllBlocks(w,PUBLIC_START,PUBLIC_END);
w=stripAllBlocks(w,PRIVATE_START,PRIVATE_END);

// Remove também marcador legado da Governance caso tenha sido gerado por branch antiga.
for(const [s,e] of [
  ['    // BEGIN MADRI GOVERNANCE PLATFORM API','    // END MADRI GOVERNANCE PLATFORM API'],
  ['    // BEGIN MADRI GOVERNANCE API','    // END MADRI GOVERNANCE API']
]){
  if(countMarkerLines(w,s)||countMarkerLines(w,e))w=stripAllBlocks(w,s,e);
}

w=injectOnce(
  w,
  PUBLIC_START,
  PUBLIC_END,
  publicApi,
  '    // REPORT PÚBLICO (sem login) — link aberto do cliente',
  '    '
);
w=injectOnce(
  w,
  PRIVATE_START,
  PRIVATE_END,
  privateBundle,
  "    if (path === 'projects' && request.method === 'GET')",
  '    '
);

// Hardening final: contamos MARCADORES REAIS EM LINHA, e não qualquer ocorrência
// textual da frase em comentários/strings gerados por outros hardeners.
w=normalizeInsertArity(w);
const privateBlocks=countMarkerLines(w,PRIVATE_START);
const publicBlocks=countMarkerLines(w,PUBLIC_START);
const privateEnds=countMarkerLines(w,PRIVATE_END);
const publicEnds=countMarkerLines(w,PUBLIC_END);
const governanceRoutes=(w.match(/path==='madri-platform\/context'/g)||[]).length;
if(privateBlocks!==1||privateEnds!==1)throw new Error(`Worker MADRI inválido: bloco privado start=${privateBlocks}, end=${privateEnds}.`);
if(publicBlocks!==1||publicEnds!==1)throw new Error(`Worker MADRI inválido: bloco público start=${publicBlocks}, end=${publicEnds}.`);
if(governanceRoutes!==1)throw new Error(`Worker MADRI inválido: esperado 1 contrato de governança; encontrado ${governanceRoutes}.`);
if(badArityPattern().test(w))throw new Error('Worker final ainda contém INSERT MADRI com 26 valores para 25 colunas.');
const workerGoodInserts=w.split(goodInsert).length-1;
if(workerGoodInserts<2)throw new Error(`Worker final não contém os dois INSERTs MADRI normalizados; encontrado ${workerGoodInserts}.`);

fs.writeFileSync(worker,w);
console.log(`OK: MADRI canônico — 1 bloco público, 1 bloco privado (PMO + Governance) e ${workerGoodInserts} INSERTs work_items validados.`);
