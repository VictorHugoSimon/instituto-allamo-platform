import fs from 'node:fs';
import zlib from 'node:zlib';

const index='public/index.html';
const sourceFile='src/status-report-master-source.js';

function gzipBodyOffset(buf){
  if(buf.length<18||buf[0]!==0x1f||buf[1]!==0x8b||buf[2]!==8)throw new Error('Payload do template mestre não é gzip válido.');
  const flags=buf[3]; let p=10;
  if(flags&4){ if(p+2>buf.length)throw new Error('Header gzip FEXTRA inválido.'); const n=buf.readUInt16LE(p); p+=2+n; }
  const skipZero=()=>{ while(p<buf.length&&buf[p]!==0)p++; p++; };
  if(flags&8)skipZero();
  if(flags&16)skipZero();
  if(flags&2)p+=2;
  if(p>=buf.length-8)throw new Error('Payload gzip do template mestre está truncado.');
  return p;
}
function recoverMaster(buf){
  try{return zlib.gunzipSync(buf)}catch(gzipError){
    const start=gzipBodyOffset(buf),end=buf.length-8;
    try{
      const raw=zlib.inflateRawSync(buf.subarray(start,end));
      console.warn('[status-report-master] checksum gzip original inválido; payload recuperado e será recomposto.',gzipError.code||gzipError.message);
      return raw;
    }catch(rawError){
      throw new Error('Template mestre comprimido não pôde ser recuperado: '+(rawError.message||rawError));
    }
  }
}

let source=fs.readFileSync(sourceFile,'utf8');
const compressed=source.match(/const GZIP_B64='([^']+)'/);
if(!compressed)throw new Error('GZIP_B64 do template mestre não encontrado.');
const original=Buffer.from(compressed[1],'base64');
const masterHtml=recoverMaster(original).toString('utf8');
if(!masterHtml.includes('Visão Geral do Projeto')||!masterHtml.includes('Evolução do Escopo')||!masterHtml.includes('Evolução das Horas')||!masterHtml.includes('Próximos Passos'))throw new Error('HTML recuperado não corresponde ao template mestre esperado.');
if(masterHtml.includes('data:image/png;base64,'))throw new Error('Template mestre ainda contém logo base64 duplicada.');

// Sempre injeta um gzip novo com CRC/tamanho corretos. O arquivo fonte permanece rastreável,
// mas o artefato final nunca depende de um trailer gzip possivelmente corrompido.
const repaired=zlib.gzipSync(Buffer.from(masterHtml,'utf8'),{level:9}).toString('base64');
source=source.replace(compressed[1],repaired);

let html=fs.readFileSync(index,'utf8');
const start='<!-- BEGIN ALLAMO STATUS REPORT MASTER SOURCE -->';
const end='<!-- END ALLAMO STATUS REPORT MASTER SOURCE -->';
const block=`${start}\n<script>\n${source}\n</script>\n${end}`;
if(html.includes(start)){
  const a=html.indexOf(start),b=html.indexOf(end,a);
  if(b<0)throw new Error('Marcador final da fonte mestre ausente.');
  html=html.slice(0,a)+block+html.slice(b+end.length);
}else{
  const needle='<script>\n(()=>{\n  if(window.AllamoRichReport)return;';
  if(!html.includes(needle))throw new Error('Viewer rico não encontrado para injetar fonte mestre.');
  html=html.replace(needle,block+'\n'+needle);
}
fs.writeFileSync(index,html);
if(!html.includes('__allamoStatusReportMasterSource')||!html.includes('BEGIN ALLAMO STATUS REPORT MASTER SOURCE'))throw new Error('Fonte HTML mestre não entrou no artefato final.');
console.log('OK: HTML mestre validado, gzip reparado/recomposto e incorporado ao artefato antes do viewer.');
