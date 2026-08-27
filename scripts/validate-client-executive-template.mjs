import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const tpl=read('src/client-executive-report-template.js');
const raci=read('src/client-report-template-raci-enhancement.js');
const aiBridge=read('src/client-report-ai-template-bridge.js');
const bridge=read('src/client-status-report-bridge.js');
const build=read('scripts/build-work-management.mjs');
const portal=read('src/public-client-portal.js');
const series=read('src/report-series-ui.js');
const seriesApi=read('src/report-series-api.js');
const ai=read('src/legacy-report-ai-api.js')+'\n'+read('src/legacy-report-ai-cloudflare.js');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
[
 '01 · Executive Overview','02 · Escopo & Plano de Ação','03 · Caminho Crítico & Riscos',
 '04 · Cadência & Governança','05 · Matriz RACI','06 · Indicadores & Próximos Passos',
 'Cockpit Executivo','Roadmap Executivo · Cronograma Pai','Evolução das Entregas · Fonte única: Plano de Ação',
 'Principais Atenções','Apoio necessário do Cliente','Plano de Ação · Base única de acompanhamento',
 'Caminho Crítico · Somente o que pode comprometer entrega ou Go-live','Riscos Prioritários',
 'Cadência de Agendas · Governança do Ciclo','Decisões e Governança','Responsabilidade Executiva',
 'Governança do Projeto','Matriz RACI','Indicadores Específicos','Próximos Passos','VISÃO CLIENTE'
].forEach(x=>must(tpl,x,'estrutura do template executivo'));
if(/Dual Clima|TOTVS Protheus|Carlão · Dual|Luiz \+ Produção/.test(tpl+raci+aiBridge))throw new Error('Template global contém dados hardcoded do exemplo do cliente.');
must(tpl,'Pendente de validação','governança de dado não confirmado');
['Distribuição de Ownership','Pontos de Governança','Todos os responsáveis','Todos os tipos RACI','Responsabilidade definida','Conflito de ownership'].forEach(x=>must(raci,x,'RACI executiva do template'));
must(raci,'d.raci','fallback da RACI atual do projeto');
must(raci,'d.phases','fallback do plano de ação a partir das fases atuais');
['client_template','attentions','client_dependencies','decisions','critical_path','sources','validation_note','ALLAMO_EXECUTIVE_CLIENT_V1'].forEach(x=>must(aiBridge,x,'ponte IA -> template'));
must(aiBridge,"path==='/api/report-ai'",'captura estruturada do resultado da IA');
must(aiBridge,"String(payload?.source||'').toUpperCase()==='AI'",'enriquecimento somente após save aprovado da IA');
must(bridge,'AllamoClientExecutiveReport','bridge usa template executivo oficial');
must(bridge,"ALLAMO_EXECUTIVE_CLIENT_V1",'identificador do template oficial');
must(build,"src/client-executive-report-template.js",'template entra no artefato final');
must(build,"src/client-report-template-raci-enhancement.js",'RACI executiva entra no artefato final');
must(build,"src/client-report-ai-template-bridge.js",'ponte IA entra no artefato final');
const posAiBridge=build.indexOf('${clientReportAiTemplateBridge}'),posAiUi=build.indexOf('${legacyReportAiUi}');
if(posAiBridge<0||posAiUi<0||posAiBridge>posAiUi)throw new Error('Ponte IA precisa ser injetada antes do editor IA para capturar geração/aplicação.');
const posOfficial=build.indexOf('${clientExecutiveReportTemplate}'),posRaci=build.indexOf('${clientReportTemplateRaciEnhancement}'),posFallback=build.indexOf('${clientStatusReportLayout}');
if(posOfficial<0||posRaci<0||posFallback<0||posOfficial>posRaci||posRaci>posFallback)throw new Error('Ordem do template oficial/RACI/fallback está incorreta.');
must(portal,'Histórico de Reports','link do cliente mantém lista/histórico');
must(portal,'public-published-reports','link do cliente carrega somente reports publicados');
must(series,'Preparar próximo com IA','série recorrente possui assistente de IA');
must(series,'Fechar ciclo / criar Report','série cria nova edição por ciclo');
must(seriesApi,"srCadences=['WEEKLY','BIWEEKLY','MONTHLY']",'recorrência semanal/quinzenal/mensal');
must(seriesApi,"const no=Number(last?.cycle_no||0)+1",'cada ciclo gera novo número');
must(seriesApi,"const rid=srNew('RPT')",'cada ciclo gera novo report');
must(ai,'approval_required:true','IA exige aprovação humana');
console.log('OK: template oficial, RACI executiva, histórico recorrente e ponte IA sob aprovação PMO preservados no link do cliente.');
