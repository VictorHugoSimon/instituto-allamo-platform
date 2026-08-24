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

// Os handlers nativos são a fonte de verdade: botão principal e lápis por seção.
for(const marker of ['openReportEditor:()=>this.openReportEditor()','edPillars:()=>this.openReportEditor(\'sec-tap\')','edSemaf:()=>this.openReportEditor(\'sec-kpis\')','edRiscos:()=>this.openReportEditor(\'sec-riscos\')','edProx:()=>this.openReportEditor(\'sec-prox\')']){
  if(!html.includes(marker)) throw new Error('Handler nativo de edição ausente: '+marker);
}

fs.writeFileSync(file,html);
console.log('OK: edição do Status Report usa handlers nativos e carrega o rascunho pelo escopo empresa/projeto correto.');
