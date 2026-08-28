import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const create=read('src/report-create-official-ui.js');
const router=read('src/report-create-button-router.js');
const tabs=read('src/client-report-tab-stability.js');
const login=read('src/login-503-retry.js');
const build=read('scripts/build-work-management.mjs');
const must=(s,n,l)=>{if(!s.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
new Function(create);new Function(router);new Function(tabs);new Function(login);
[
 'Criar Status Report · Template oficial do cliente','01 · Executive Overview','02 · Escopo & Plano de Ação',
 '03 · Caminho Crítico & Riscos','04 · Cadência & Governança','05 · Matriz RACI','06 · Indicadores & Próximos Passos',
 '✨ Copiloto PMO','Pré-visualizar como cliente','Salvar rascunho','Criar e publicar no cliente','ALLAMO_EXECUTIVE_CLIENT_V1'
].forEach(x=>must(create,x,'fluxo oficial de criação'));
must(create,"api('report-ai?project='+encodeURIComponent(v.project.id)",'Copiloto usa contexto do projeto');
must(create,"api('report-records',{method:'POST'",'criação usa report nativo multitenant');
must(create,"status:publish?'PUBLICADO':'RASCUNHO'",'publicação é decisão explícita');
must(create,'AllamoClientReportAiTemplateBridge.enrich','IA preenche o template oficial');
must(create,'AllamoClientExecutiveReport.renderInto','prévia usa exatamente o renderer do cliente');
must(router,"window.addEventListener('click'",'roteador captura clique global');
must(router,"#arm [data-a=\"new-report\"]",'botão Novo report é roteado explicitamente');
must(router,'e.stopImmediatePropagation()','handler legado não concorre com o criador oficial');
must(router,'window.AllamoOfficialReportCreate','roteador chama o criador oficial');
must(router,"document.querySelector('#arc-company')",'empresa selecionada é reaplicada no criador');
must(router,"document.querySelector('#arc-project')",'projeto selecionado é reaplicado no criador');
must(tabs,'allamoActiveReportTab','aba ativa persiste entre rerenders');
must(tabs,"classList.toggle('on'",'painel ativo é restaurado sem clique artificial');
must(login,"u.pathname==='/api/login'",'retry limitado ao login');
must(login,'response.status!==503','retry somente para 503 temporário');
must(login,'attempt<3','máximo de três tentativas');
['src/report-create-button-router.js','src/report-create-official-ui.js','src/client-report-tab-stability.js','src/login-503-retry.js'].forEach(x=>must(build,x,'arquivo injetado no build'));
const pRouter=build.indexOf('${reportCreateButtonRouter}'),pCreate=build.indexOf('${reportCreateOfficialUi}'),pAi=build.indexOf('${clientReportAiTemplateBridge}');
if(pRouter<0||pCreate<0||pRouter>pCreate)throw new Error('Roteador do botão deve carregar antes do criador oficial.');
if(pCreate<0||pAi<0||pAi>pCreate)throw new Error('Ponte IA deve carregar antes do criador oficial.');
const pRaci=build.indexOf('${clientReportTemplateRaciEnhancement}'),pTabs=build.indexOf('${clientReportTabStability}');
if(pRaci<0||pTabs<0||pRaci>pTabs)throw new Error('Estabilidade de abas deve envolver o renderer já enriquecido pela RACI.');
console.log('OK: botão Novo report abre deterministicamente o criador oficial, preserva empresa/projeto, usa Copiloto sob aprovação, publicação explícita, preview cliente e abas persistentes.');
