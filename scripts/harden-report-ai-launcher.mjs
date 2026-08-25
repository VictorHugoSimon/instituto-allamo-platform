import fs from 'node:fs';

const file='public/index.html';
const runtimeFile='src/report-ai-launcher-runtime.js';
let html=fs.readFileSync(file,'utf8');
const runtime=fs.readFileSync(runtimeFile,'utf8');

// O Portal está dentro do JSON do template do bundler. Sempre decodificar, alterar e
// serializar novamente para não criar escapes inválidos no artefato final.
const open='<script type="__bundler/template">';
const a=html.indexOf(open);
if(a<0)throw new Error('Template do bundler não encontrado para o Assistente IA.');
const start=a+open.length;
const end=html.indexOf('</script>',start);
if(end<0)throw new Error('Fechamento do template do bundler não encontrado.');

let template;
try{template=JSON.parse(html.slice(start,end));}
catch(err){throw new Error('Template inválido antes do hardening do Assistente IA: '+String(err&&err.message||err));}

// Publica apenas as pontes necessárias do runtime legado. A geração, aplicação de
// sugestões, histórico e governança continuam usando a implementação já validada.
const bridgeMarker='window.__allamoLegacyReportAiGenerate';
if(!template.includes(bridgeMarker)){
  const needle='async function generateAi(d){';
  const at=template.indexOf(needle);
  if(at<0)throw new Error('generateAi não encontrado para instalar a ponte do Assistente IA.');
  const bridge="window.__allamoLegacyReportAiOpen=()=>openAi(); window.__allamoLegacyReportAiGenerate=d=>generateAi(d); window.__allamoLegacyReportAiSetQuery=q=>{if(q)S.query=q;return S.query}; window.__allamoLegacyReportAiGetQuery=()=>S.query;\n  ";
  template=template.slice(0,at)+bridge+template.slice(at);
}

const begin='<!-- BEGIN ALLAMO REPORT AI LAUNCHER RUNTIME -->';
const finish='<!-- END ALLAMO REPORT AI LAUNCHER RUNTIME -->';
const block=begin+'\n<script data-allamo-report-ai-launcher="1">\n'+runtime+'\n</script>\n'+finish;
if(template.includes(begin)){
  const x=template.indexOf(begin),y=template.indexOf(finish,x);
  if(y<0)throw new Error('Marcador final do launcher IA não encontrado.');
  template=template.slice(0,x)+block+template.slice(y+finish.length);
}else{
  const body=template.toLowerCase().lastIndexOf('</body>');
  if(body<0)throw new Error('Fechamento do body não encontrado para instalar launcher IA.');
  template=template.slice(0,body)+block+'\n'+template.slice(body);
}

for(const marker of [bridgeMarker,'window.__allamoLegacyReportAiSetQuery','window.__allamoOpenReportAi','data-allamo-ai-launcher','Assistente IA do Status Report','Analisar reunião e gerar rascunho']){
  if(!template.includes(marker))throw new Error('Hardening do Assistente IA incompleto: '+marker);
}

const serialized=JSON.stringify(template).replace(/<\//gi,'<\\u002F');
try{
  const roundTrip=JSON.parse(serialized);
  if(roundTrip!==template)throw new Error('round-trip alterou o template');
}catch(err){throw new Error('Falha ao serializar template do Assistente IA: '+String(err&&err.message||err));}
if(serialized.toLowerCase().includes('</script'))throw new Error('Serialização insegura após hardening do Assistente IA.');

html=html.slice(0,start)+serialized+html.slice(end);
fs.writeFileSync(file,html);
console.log('OK: botão do Assistente IA abre modal imediatamente, preserva rascunho e reutiliza geração/aprovação governada do Report.');
