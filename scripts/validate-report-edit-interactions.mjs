import fs from 'node:fs';

const src=fs.readFileSync('src/report-contextual-editor.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

if(src.includes("stopImmediatePropagation()")) throw new Error('Editor contextual ainda sequestra cliques nativos.');
if(src.includes("document.addEventListener('click'")) throw new Error('Editor contextual ainda possui captura global de clique.');
must(src,'b.click();','Ponte contextual delega ao controle nativo');
must(html,'const reportKey = this.repKey();','Editor carrega chave real do report');
must(html,'this.reports[reportKey]','Editor lê report por empresa/projeto');
must(html,"await this.api('report?'+this.repQuery(), { method:'POST'",'Salvar respeita escopo atual');
must(html,'openReportEditor:()=>this.openReportEditor()','Botão principal possui handler nativo');
must(html,"edPillars:()=>this.openReportEditor('sec-tap')",'Lápis de pilares possui handler nativo');
must(html,"edSemaf:()=>this.openReportEditor('sec-kpis')",'Lápis de situação possui handler nativo');
must(html,"edRiscos:()=>this.openReportEditor('sec-riscos')",'Lápis de riscos possui handler nativo');
must(html,"edProx:()=>this.openReportEditor('sec-prox')",'Lápis de próximos passos possui handler nativo');
if(html.includes('const cur = (this.reports && this.reports[cid])')) throw new Error('Editor ainda usa chave da empresa para report de projeto.');

console.log('OK: botão Editar Report e lápis usam o editor nativo sem colisão e com escopo correto.');
