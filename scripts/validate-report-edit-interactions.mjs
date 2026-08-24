import fs from 'node:fs';

const src=fs.readFileSync('src/report-contextual-editor.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

// O teste antigo proibia exatamente o fallback necessário após o DOM replaceWith().
// Agora validamos que o fallback só assume cliques reconhecidos de edição do Report.
must(src,"document.addEventListener('click'",'Fallback delegado de clique pós-unpack');
must(src,'anchorForButton','Classificação segura do botão/lápis');
must(src,'window.__allamoOpenLegacyReportEditor','Uso da ponte real da instância');
must(src,"if(anchor===null)return",'Cliques não relacionados não são sequestrados');
must(src,"if(typeof window.__allamoOpenLegacyReportEditor!=='function')return",'Sem ponte, evento nativo continua livre');
must(src,'stopImmediatePropagation','Com ponte ativa evita dupla abertura do modal');
must(src,"sec-crono",'Editar tarefas/fases aponta para cronograma/fases');
must(src,"sec-kpis",'Lápis de situação aponta para indicadores');
must(src,"sec-riscos",'Lápis de riscos aponta para riscos');

must(html,'const reportKey = this.repKey();','Editor carrega chave real do report');
must(html,'this.reports[reportKey]','Editor lê report por empresa/projeto');
must(html,"await this.api('report?'+this.repQuery(), { method:'POST'",'Salvar respeita escopo atual');
must(html,'window.__allamoLegacyReportInstance=this','Instância do componente publicada pós-unpack');
must(html,'window.__allamoOpenLegacyReportEditor','Ponte do editor publicada pelo Component');
must(html,'openReportEditor:()=>this.openReportEditor()','Botão principal mantém handler nativo');
must(html,"edPillars:()=>this.openReportEditor('sec-tap')",'Lápis de pilares mantém handler nativo');
must(html,"edSemaf:()=>this.openReportEditor('sec-kpis')",'Lápis de situação mantém handler nativo');
must(html,"edRiscos:()=>this.openReportEditor('sec-riscos')",'Lápis de riscos mantém handler nativo');
must(html,"edProx:()=>this.openReportEditor('sec-prox')",'Lápis de próximos passos mantém handler nativo');
if(html.includes('const cur = (this.reports && this.reports[cid])')) throw new Error('Editor ainda usa chave da empresa para report de projeto.');

console.log('OK: botão/lápis possuem fallback pós-unpack, ponte real da instância e escopo correto empresa/projeto.');
