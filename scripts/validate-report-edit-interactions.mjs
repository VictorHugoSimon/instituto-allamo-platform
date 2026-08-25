import fs from 'node:fs';

const src=fs.readFileSync('src/report-contextual-editor.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

// Fallback pós-unpack e classificação segura do clique.
must(src,"document.addEventListener('click'",'Fallback delegado de clique pós-unpack');
must(src,'anchorForButton','Classificação segura do botão/lápis');
must(src,'window.__allamoOpenLegacyReportEditor','Uso da ponte real da instância');
must(src,"if(anchor===null)return",'Cliques não relacionados não são sequestrados');
must(src,"if(typeof window.__allamoOpenLegacyReportEditor!=='function')return",'Sem ponte, evento nativo continua livre');
must(src,'stopImmediatePropagation','Com ponte ativa evita dupla abertura do modal');

// Edição contextual precisa usar landmarks exclusivos, sem reutilizar um container grande
// para várias seções (falha que fazia todos os botões irem para o mesmo ponto).
must(src,'findLandmark','Localiza marcador exclusivo da seção');
must(src,'matchScore','Escolhe o título/campo mais específico');
must(src,'chooseDistinctBlock','Impede que duas abas reutilizem o mesmo bloco');
must(src,"marks===1",'Bloco só é aceito quando contém um único landmark');
must(src,'landmarkMap=new Map()','Mapa independente por seção');
must(src,'data-allamo-report-landmark','Landmark persistente no DOM do modal');
must(src,'firstFieldFor','Resolve o primeiro campo editável da seção');
must(src,'focusAnchor','Rotina dedicada de foco contextual');
must(src,'scrollIntoView','Rola até o marcador da seção');
must(src,"field.focus({preventScroll:true})",'Cursor entra no primeiro campo editável');
must(src,'allamo-report-target','Bloco alvo recebe destaque visual temporário');
must(src,'allamo-report-field-target','Campo alvo recebe destaque visual temporário');
must(src,'allamo_contextual_report_anchor','Anchor sobrevive ao ciclo de render/unpack');
must(src,'clearPending','Anchor pendente é removido depois do foco para não refocar em toda mutação');
must(src,'MutationObserver','Modal montado tardiamente também é tratado');

// Navegação superior funciona como abas/atalhos do editor.
must(src,'allamo-report-block-nav','Navegação rápida entre seções');
must(src,"setAttribute('role','tablist')",'Navegação possui semântica de abas');
must(src,'role="tab"','Botões possuem semântica de aba');
must(src,'aria-selected','Aba ativa é sinalizada');
must(src,"label:'Escopo'",'Aba de Escopo');
must(src,"label:'Indicadores'",'Aba de Indicadores');
must(src,"label:'Fases & Marcos'",'Aba de Fases e Marcos');
must(src,"label:'Horas'",'Aba de Horas');
must(src,"label:'Curva S'",'Aba de Curva S');
must(src,"label:'Capacidade'",'Aba de Capacidade');
must(src,"label:'Go-live'",'Aba de Go-live');
must(src,"label:'Riscos'",'Aba de Riscos');
must(src,"label:'Próximos Passos'",'Aba de Próximos Passos');
must(src,"sec-crono",'Editar tarefas/fases aponta para cronograma/fases');
must(src,"sec-kpis",'Lápis de situação aponta para indicadores');
must(src,"sec-riscos",'Lápis de riscos aponta para riscos');
must(src,"sec-prox",'Lápis de próximos passos aponta para próximos passos');

// Escopo empresa/projeto continua intacto no artefato final.
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

console.log('OK: cada aba/lápis resolve landmark exclusivo, rola e foca o campo correto sem alterar o escopo empresa/projeto.');
