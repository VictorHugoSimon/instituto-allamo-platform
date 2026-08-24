import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

// Trabalha no JSON decodificado do template. Alterar diretamente a string serializada
// pode produzir escapes inválidos e quebrar todo o bundle após o unpack.
const open='<script type="__bundler/template">';
const a=html.indexOf(open);
if(a<0) throw new Error('Template do bundler não encontrado.');
const start=a+open.length;
const end=html.indexOf('</script>',start);
if(end<0) throw new Error('Fechamento do template do bundler não encontrado.');

let template;
try{ template=JSON.parse(html.slice(start,end)); }
catch(err){ throw new Error('Template do bundler contém JSON inválido antes do hardening de Report: '+String(err&&err.message||err)); }

// Reports por projeto usam a chave p:<project_id>. O editor precisa carregar o mesmo
// rascunho que loadReport() gravou em this.reports[this.repKey()].
const oldCur="const cur = (this.reports && this.reports[cid]) ? JSON.parse(JSON.stringify(this.reports[cid])) : base;";
const newCur="const reportKey = this.repKey(); const cur = (this.reports && this.reports[reportKey]) ? JSON.parse(JSON.stringify(this.reports[reportKey])) : base;";
if(template.includes(oldCur)) template=template.split(oldCur).join(newCur);
if(!template.includes(newCur)) throw new Error('openReportEditor não está usando repKey().');

// Garante que o editor continue salvando exatamente no mesmo escopo selecionado.
if(!template.includes("await this.api('report?'+this.repQuery(), { method:'POST'")) throw new Error('submitReport não usa repQuery().');

// O bundle troca o DOM inteiro no unpack. Mesmo com sc-camel-on-click presente,
// a ligação do evento com a instância pode desaparecer. A instância publica uma ponte
// real a cada renderVals(); o fallback pós-unpack chama essa ponte diretamente.
const instanceMarker='window.__allamoLegacyReportInstance=this';
const bridgeMarker='window.__allamoOpenLegacyReportEditor';
if(!template.includes(instanceMarker)){
  const renderStart=template.indexOf('renderVals() {');
  if(renderStart<0) throw new Error('renderVals não encontrado para instalar ponte do editor.');
  const stateNeedle='const st = this.state, role = st.role, accent = this.ACCENT();';
  const stateAt=template.indexOf(stateNeedle,renderStart);
  if(stateAt<0||stateAt-renderStart>1000) throw new Error('Ponto interno de renderVals não encontrado.');
  const bridge="try { window.__allamoLegacyReportInstance=this; window.__allamoOpenLegacyReportEditor=(anchor='')=>this.openReportEditor(anchor); } catch(e){}\n    ";
  template=template.slice(0,stateAt)+bridge+template.slice(stateAt);
}

// Os handlers nativos continuam presentes como primeira linha de defesa.
for(const marker of ['openReportEditor:()=>this.openReportEditor()','edPillars:()=>this.openReportEditor(\'sec-tap\')','edSemaf:()=>this.openReportEditor(\'sec-kpis\')','edRiscos:()=>this.openReportEditor(\'sec-riscos\')','edProx:()=>this.openReportEditor(\'sec-prox\')']){
  if(!template.includes(marker)) throw new Error('Handler nativo de edição ausente: '+marker);
}
if(!template.includes(instanceMarker)) throw new Error('Instância real do editor não foi publicada.');
if(!template.includes(bridgeMarker)) throw new Error('Ponte pós-unpack do editor não instalada.');

// Serialização segura: evita </script> literal dentro do JSON do template.
const serialized=JSON.stringify(template).replace(/<\//gi,'<\\u002F');
try{
  const roundTrip=JSON.parse(serialized);
  if(roundTrip!==template) throw new Error('round-trip alterou o template');
}catch(err){
  throw new Error('Falha ao serializar template do editor de Report: '+String(err&&err.message||err));
}
if(serialized.toLowerCase().includes('</script')) throw new Error('Serialização insegura no template do editor de Report.');

html=html.slice(0,start)+serialized+html.slice(end);
fs.writeFileSync(file,html);
console.log('OK: edição do Status Report usa repKey, handlers nativos e ponte pós-unpack com JSON íntegro.');
