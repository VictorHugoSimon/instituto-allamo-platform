import fs from 'node:fs';
const responsive=fs.readFileSync('src/responsive-usability.js','utf8');
const admin=fs.readFileSync('src/report-admin-navigation.js','utf8');
const raci=fs.readFileSync('src/raci-visual.js','utf8');
const watchdog=fs.readFileSync('src/post-unpack-watchdog.js','utf8');
const clientReports=fs.readFileSync('src/client-published-reports.js','utf8');
const releases=fs.readFileSync('src/release-history-ui.js','utf8');
const feedback=fs.readFileSync('src/interaction-feedback.js','utf8');
const clientApi=fs.readFileSync('src/report-client-api-guard.js','utf8');
const publicApi=fs.readFileSync('src/public-published-reports-api.js','utf8');
const build=fs.readFileSync('scripts/build-work-management.mjs','utf8');
const index=fs.readFileSync('public/index.html','utf8');
new Function(responsive);new Function(admin);new Function(raci);new Function(watchdog);new Function(clientReports);new Function(releases);new Function(feedback);
// Os arquivos API são fragmentos injetados dentro de handleApi (async), não scripts standalone.
new Function('return async function(){'+clientApi+'}');
new Function('return async function(){'+publicApi+'}');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
for(const [n,l] of [
  ['width=device-width','viewport responsivo'],['100dvh','altura móvel segura'],['allamo-report-editor','editor de report responsivo'],['allamo-responsive-modal-box','modal responsivo'],['overflow-x:auto','scroll horizontal controlado'],['@media(max-width:767px)','breakpoint mobile'],['@media(max-width:1023px)','breakpoint tablet'],['removeFloatingLaunchers','remoção defensiva dos launchers'],['allamo-raci-r','cor R'],['allamo-raci-a','cor A'],['allamo-raci-c','cor C'],['allamo-raci-i','cor I'],['#awm','Work Management responsivo'],['#arm','Central de Reports responsiva']
])must(responsive,n,l);
for(const [n,l] of [
  ['Central de Reports','central administrativa'],['acompanhar report','interceptação por projeto'],["txt==='acompanhar'",'interceptação por empresa'],['data-open-legacy-report','acesso ao report principal'],['+ Novo report','orientação para novos reports'],['Abrindo a Central de Reports','feedback imediato'],['window.__allamoReportContext','contexto para painel publicado'],['projects.find','clique direto no projeto']
])must(admin,n,l);
for(const [n,l] of [
  ['Visualização RACI','preview visual'],['allamo-raci-chip','chips RACI'],['Responsável','legenda R'],['Accountable','legenda A'],["['R','A','C','I']",'papéis RACI'],['allamo-raci-table','matriz colorida']
])must(raci,n,l);
for(const [n,l] of [['REPORTS PUBLICADOS','painel do cliente'],['published-reports','endpoint autenticado'],['public-published-reports','endpoint público'],['Nenhum Report publicado ainda','estado vazio'],['REPORT PUBLICADO','visualização somente leitura'],["get('cliente')",'contexto do link público']])must(clientReports,n,l);
for(const [n,l] of [['HISTÓRICO COMPLETO','histórico de viradas'],['Viradas, versões e entregas','linha do tempo'],['Todas as empresas','filtro empresa'],['releases/','ações de histórico']])must(releases,n,l);
for(const [n,l] of [['__allamoInteractionFeedbackLoaded','feedback carregado'],['Publicando Report','feedback publicação'],['Report publicado. Já está disponível no painel da empresa.','confirmação publicação'],['Registrando Virada / versão','feedback virada'],['Salvando Report','feedback salvamento']])must(feedback,n,l);
for(const [n,l] of [["status='PUBLICADO'",'somente publicados autenticados'],["user.role==='usuario'",'proteção cliente'],['published-reports','API publicada']])must(clientApi,n,l);
for(const [n,l] of [['public-published-reports','API pública'],["status='PUBLICADO'",'somente publicados no link aberto'],['company_id=?','isolamento por empresa']])must(publicApi,n,l);
for(const f of ['src/public-published-reports-api.js','src/report-client-api-guard.js','src/report-admin-navigation.js','src/client-published-reports.js','src/release-history-ui.js','src/interaction-feedback.js','src/raci-visual.js','src/responsive-usability.js'])must(build,f,'injeção '+f);
if(/launcher\('awm-launcher'|launcher\('arm-launcher'/.test(watchdog))throw new Error('Watchdog ainda recria launchers flutuantes.');
if(build.includes("b.id='awm-launcher'")||build.includes("r.id='arm-launcher'"))throw new Error('Build ainda cria launchers flutuantes.');
if(admin.includes('setInterval(tick,500)')||raci.includes('setInterval(tick,650)')||responsive.includes('setInterval(tick,700)'))throw new Error('Polling agressivo de UI voltou a ser introduzido.');
must(watchdog,'setInterval(tick,2000)','watchdog com frequência reduzida');
for(const marker of ['__allamoResponsiveUsabilityLoaded','__allamoReportAdminNavLoaded','__allamoRaciVisualLoaded','__allamoClientPublishedReportsLoaded','__allamoReleaseHistoryLoaded','__allamoInteractionFeedbackLoaded'])must(index,marker,'artefato final '+marker);
if(!index.includes('Central de Reports'))throw new Error('Artefato final sem central de Reports.');
console.log('OK: publicação autenticada/pública, Central por projeto, Viradas/Versões, responsividade, RACI, feedback e performance validados.');
