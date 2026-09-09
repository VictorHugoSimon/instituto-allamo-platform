import fs from 'node:fs';

const worker='public/_worker.js';
let publicApi=fs.readFileSync('src/madri-pmo-public-api.js','utf8');
let privateApi=fs.readFileSync('src/madri-pmo-api.js','utf8');
let governanceApi=fs.readFileSync('src/madri-governance-platform-api.js','utf8');
let pageApi=fs.readFileSync('src/madri-page-persistence-api.js','utf8');

const PUBLIC_START='    // BEGIN MADRI PMO PUBLIC API';
const PUBLIC_END='    // END MADRI PMO PUBLIC API';
const PRIVATE_START='    // BEGIN MADRI PMO PRIVATE API';
const PRIVATE_END='    // END MADRI PMO PRIVATE API';
const LEGACY_GOV=[
  ['    // BEGIN MADRI GOVERNANCE PLATFORM API','    // END MADRI GOVERNANCE PLATFORM API'],
  ['    // BEGIN MADRI GOVERNANCE API','    // END MADRI GOVERNANCE API']
];
const PUBLIC_ANCHOR='    // REPORT PÚBLICO (sem login) — link aberto do cliente';
const PRIVATE_ANCHOR="    if (path === 'projects' && request.method === 'GET')";

const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const markerLineRe=marker=>new RegExp(`^[\\t ]*${escRe(marker.trim())}[\\t ]*$`,'gm');
const countMarkerLines=(text,marker)=>(text.match(markerLineRe(marker))||[]).length;
const markerLineNumbers=(text,marker)=>{const re=markerLineRe(marker),out=[];let m;while((m=re.exec(text)))out.push(text.slice(0,m.index).split(/\r?\n/).length);return out};
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
const cleanInjectedWrappers=(text,label)=>{
  let out=text;
  for(const [s,e] of [[PUBLIC_START,PUBLIC_END],[PRIVATE_START,PRIVATE_END],...LEGACY_GOV]){
    const starts=countMarkerLines(out,s),ends=countMarkerLines(out,e);
    if(starts||ends){
      if(starts!==ends)throw new Error(`${label}: wrappers MADRI inconsistentes (${s.trim()} start=${starts}, end=${ends}).`);
      out=stripAllBlocks(out,s,e);
    }
  }
  return out;
};
const injectOnce=(text,start,end,content,needle,indent='')=>{
  if(!text.includes(needle))throw new Error('Ponto de injeção MADRI não encontrado: '+needle);
  const block=start+'\n'+content.split('\n').map(x=>indent+x).join('\n')+'\n'+end+'\n';
  // IMPORTANTE: callback evita expansão dos tokens especiais $&, $`, $' etc.
  // A Governance API contém uma regex em template literal terminando em "$`";
  // usando string de replacement, o JS injetava o prefixo inteiro do Worker e corrompia o bundle.
  return text.replace(needle,()=>block+needle);
};

// Outros hardeners do build podem materializar wrappers em artefatos intermediários.
// Sanitizamos também os arquivos-fonte lidos neste processo para impedir encapsulamento duplicado.
publicApi=cleanInjectedWrappers(publicApi,'src/madri-pmo-public-api.js');
privateApi=cleanInjectedWrappers(privateApi,'src/madri-pmo-api.js');
governanceApi=cleanInjectedWrappers(governanceApi,'src/madri-governance-platform-api.js');
pageApi=cleanInjectedWrappers(pageApi,'src/madri-page-persistence-api.js');

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
if(badArityPattern().test(privateApi))throw new Error('API MADRI ainda contém INSERT com 26 valores para 25 colunas.');

// PMO privado + Governance Platform + persistência documental compartilham um único bloco autenticado.
const privateBundle=privateApi+'\n\n// MADRI GOVERNANCE PLATFORM API\n'+governanceApi+'\n\n// MADRI PAGE PERSISTENCE API\n'+pageApi;

let w=fs.readFileSync(worker,'utf8');

// O artefato public/_worker.js pode vir de um build anterior ou de hardeners anteriores.
// Removemos TODOS os wrappers canônicos/legados antes de reinjetar.
w=cleanInjectedWrappers(w,'public/_worker.js');

w=injectOnce(w,PUBLIC_START,PUBLIC_END,publicApi,PUBLIC_ANCHOR,'    ');
w=injectOnce(w,PRIVATE_START,PRIVATE_END,privateBundle,PRIVATE_ANCHOR,'    ');

// Canonicalização final do endpoint PÚBLICO.
w=stripAllBlocks(w,PUBLIC_START,PUBLIC_END);
w=injectOnce(w,PUBLIC_START,PUBLIC_END,publicApi,PUBLIC_ANCHOR,'    ');

// Hardening final: contamos apenas MARCADORES REAIS EM LINHA.
w=normalizeInsertArity(w);
const privateBlocks=countMarkerLines(w,PRIVATE_START),privateEnds=countMarkerLines(w,PRIVATE_END);
const publicBlocks=countMarkerLines(w,PUBLIC_START),publicEnds=countMarkerLines(w,PUBLIC_END);
const governanceRoutes=(w.match(/path==='madri-platform\/context'/g)||[]).length;
const pageRoutes=(w.match(/const mpagCurrent=path\.match/g)||[]).length;
if(privateBlocks!==1||privateEnds!==1)throw new Error(`Worker MADRI inválido: bloco privado start=${privateBlocks}, end=${privateEnds}; linhas start=${markerLineNumbers(w,PRIVATE_START).join(',')}, end=${markerLineNumbers(w,PRIVATE_END).join(',')}.`);
if(publicBlocks!==1||publicEnds!==1)throw new Error(`Worker MADRI inválido: bloco público start=${publicBlocks}, end=${publicEnds}; linhas start=${markerLineNumbers(w,PUBLIC_START).join(',')}, end=${markerLineNumbers(w,PUBLIC_END).join(',')}.`);
if(governanceRoutes!==1)throw new Error(`Worker MADRI inválido: esperado 1 contrato de governança; encontrado ${governanceRoutes}.`);
if(pageRoutes!==1)throw new Error(`Worker MADRI inválido: esperado 1 contrato de persistência de páginas; encontrado ${pageRoutes}.`);
if(badArityPattern().test(w))throw new Error('Worker final ainda contém INSERT MADRI com 26 valores para 25 colunas.');
const workerGoodInserts=w.split(goodInsert).length-1;
if(workerGoodInserts<2)throw new Error(`Worker final não contém os dois INSERTs MADRI normalizados; encontrado ${workerGoodInserts}.`);

fs.writeFileSync(worker,w);
await import('./harden-madri-page-persistence.mjs');
console.log(`OK: MADRI canônico — 1 bloco público, 1 bloco privado (PMO + Governance + páginas D1) e ${workerGoodInserts} INSERTs work_items validados.`);
