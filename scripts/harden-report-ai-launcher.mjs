import fs from 'node:fs';

const file='public/index.html';
const runtimeFile='src/report-ai-launcher-runtime.js';
let html=fs.readFileSync(file,'utf8');
const runtime=fs.readFileSync(runtimeFile,'utf8');

// Os módulos de extensão do Portal são scripts externos ao template do bundler e
// sobrevivem à troca de DOM por manterem listeners/estado em window. O launcher IA
// deve seguir exatamente o mesmo padrão; não altera o JSON interno do template.
const begin='<!-- BEGIN ALLAMO REPORT AI LAUNCHER RUNTIME -->';
const finish='<!-- END ALLAMO REPORT AI LAUNCHER RUNTIME -->';
const block=begin+'\n<script data-allamo-report-ai-launcher="1">\n'+runtime+'\n</script>\n'+finish;

if(html.includes(begin)){
  const a=html.indexOf(begin),b=html.indexOf(finish,a);
  if(b<0)throw new Error('Marcador final do launcher IA não encontrado.');
  html=html.slice(0,a)+block+html.slice(b+finish.length);
}else{
  const workEnd='<!-- END ALLAMO WORK MANAGEMENT UI -->';
  const at=html.indexOf(workEnd);
  if(at>=0){
    const pos=at+workEnd.length;
    html=html.slice(0,pos)+'\n'+block+html.slice(pos);
  }else{
    const body=html.toLowerCase().lastIndexOf('</body>');
    if(body<0)throw new Error('Ponto de injeção do launcher IA não encontrado.');
    html=html.slice(0,body)+block+'\n'+html.slice(body);
  }
}

for(const marker of ['window.__allamoOpenReportAi','data-allamo-ai-launcher','Assistente IA do Status Report','Analisar reunião e gerar rascunho','GOVERNANÇA: o Report só é gravado']){
  if(!html.includes(marker))throw new Error('Hardening do Assistente IA incompleto: '+marker);
}

fs.writeFileSync(file,html);
console.log('OK: launcher IA autônomo instalado no runtime externo, com abertura imediata e aprovação explícita antes de gravar Report.');
