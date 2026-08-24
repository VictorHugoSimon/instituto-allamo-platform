import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

// Reports por projeto usam a chave p:<project_id>. O editor precisa carregar o mesmo
// rascunho que loadReport() gravou em this.reports[this.repKey()].
const oldCur="const cur = (this.reports && this.reports[cid]) ? JSON.parse(JSON.stringify(this.reports[cid])) : base;";
const newCur="const reportKey = this.repKey(); const cur = (this.reports && this.reports[reportKey]) ? JSON.parse(JSON.stringify(this.reports[reportKey])) : base;";
if(html.includes(oldCur)) html=html.split(oldCur).join(newCur);
if(!html.includes(newCur)) throw new Error('openReportEditor não está usando repKey().');

// Garante que o editor continue salvando exatamente no mesmo escopo selecionado.
if(!html.includes("await this.api('report?'+this.repQuery(), { method:'POST'")) throw new Error('submitReport não usa repQuery().');

// O bundle troca o DOM inteiro no unpack. O sc-camel-on-click pode existir no markup
// e ainda assim perder a ligação com a instância. Publicamos uma ponte a partir do
// próprio Component sempre que renderVals() roda; o fallback pós-unpack chama essa ponte.
// Atenção: o nome da função também aparece no script fallback; por isso a prova da
// instalação precisa ser o marcador da instância, e não apenas o nome da função global.
const instanceMarker='window.__allamoLegacyReportInstance=this';
const bridgeMarker='window.__allamoOpenLegacyReportEditor';
if(!html.includes(instanceMarker)){
  const renderStart=html.indexOf('renderVals() {');
  if(renderStart<0) throw new Error('renderVals não encontrado para instalar ponte do editor.');
  const stateNeedle='const st = this.state, role = st.role, accent = this.ACCENT();';
  const stateAt=html.indexOf(stateNeedle,renderStart);
  if(stateAt<0||stateAt-renderStart>1000) throw new Error('Ponto interno de renderVals não encontrado.');
  const bridge="try { window.__allamoLegacyReportInstance=this; window.__allamoOpenLegacyReportEditor=(anchor='')=>this.openReportEditor(anchor); } catch(e){}\\\n    ";
  html=html.slice(0,stateAt)+bridge+html.slice(stateAt);
}

// Os handlers nativos continuam presentes como primeira linha de defesa.
for(const marker of ['openReportEditor:()=>this.openReportEditor()','edPillars:()=>this.openReportEditor(\'sec-tap\')','edSemaf:()=>this.openReportEditor(\'sec-kpis\')','edRiscos:()=>this.openReportEditor(\'sec-riscos\')','edProx:()=>this.openReportEditor(\'sec-prox\')']){
  if(!html.includes(marker)) throw new Error('Handler nativo de edição ausente: '+marker);
}
if(!html.includes(instanceMarker)) throw new Error('Instância real do editor não foi publicada.');
if(!html.includes(bridgeMarker)) throw new Error('Ponte pós-unpack do editor não instalada.');

fs.writeFileSync(file,html);
console.log('OK: edição do Status Report usa repKey, handlers nativos e ponte pós-unpack para botão/lápis.');
