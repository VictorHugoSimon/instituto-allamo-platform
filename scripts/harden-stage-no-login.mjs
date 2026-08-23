import fs from 'node:fs';

const indexFile='public/index.html';
const workerFile='public/_worker.js';

// Regra funcional aprovada: o Portal PMO abre sem e-mail/senha nos dois ambientes oficiais.
// Hosts fora dos dois projetos oficiais continuam usando o fluxo autenticado legado.
const PORTAL_HOST_SOURCE='(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$';

// Backend: nos hosts oficiais do Portal, todas as APIs internas recebem uma identidade PMO sintética.
let worker=fs.readFileSync(workerFile,'utf8');
const userNeedle="async function currentUser(request, env) {\n  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');";
const userReplacement="async function currentUser(request, env) {\n  const portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(new URL(request.url).hostname || '');\n  if (portalNoLoginHost) return { id:'portal-no-login', name:'PMO Államo', email:'portal-no-login@allamo.local', role:'pmo', company_id:null, status:'Ativo', __portal_no_login:true };\n  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');";

if(worker.includes('__stage_no_login')){
  worker=worker
    .replace(/const stageNoLoginHost = \/\(\^\|\\\.\)allamo-pmo-stage\\\.pages\\\.dev\$\/i\.test\(new URL\(request\.url\)\.hostname \|\| ''\);/,"const portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(new URL(request.url).hostname || '');")
    .replace(/if \(stageNoLoginHost\) return \{ id:'stage-no-login', name:'PMO Stage', email:'stage-no-login@allamo\.local', role:'pmo', company_id:null, status:'Ativo', __stage_no_login:true \};/,"if (portalNoLoginHost) return { id:'portal-no-login', name:'PMO Államo', email:'portal-no-login@allamo.local', role:'pmo', company_id:null, status:'Ativo', __portal_no_login:true };");
}else if(!worker.includes('__portal_no_login')){
  if(!worker.includes(userNeedle)) throw new Error('currentUser não encontrado para habilitar Portal sem login.');
  worker=worker.replace(userNeedle,userReplacement);
}

if(!worker.includes("portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i")) throw new Error('Bypass sem login não foi aplicado aos hosts oficiais do Portal.');
if(!worker.includes("__portal_no_login:true")) throw new Error('Identidade sintética do Portal sem login ausente.');
if(!worker.includes("if (!token) return null;")) throw new Error('Fallback autenticado para hosts não oficiais foi removido indevidamente.');
fs.writeFileSync(workerFile,worker);

// Frontend: edita o template interno do bundler para abrir direto como PMO nos hosts oficiais.
let html=fs.readFileSync(indexFile,'utf8');
const templateOpen='<script type="__bundler/template">';
const templateClose='</script>';
const tagStart=html.indexOf(templateOpen);
if(tagStart<0) throw new Error('Template do bundler não encontrado.');
const jsonStart=tagStart+templateOpen.length;
const jsonEnd=html.indexOf(templateClose,jsonStart);
if(jsonEnd<0) throw new Error('Fechamento do template do bundler não encontrado.');
let template=JSON.parse(html.slice(jsonStart,jsonEnd));

const portalExpr="/(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(location.hostname||'')";
const oldStageExpr="/(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i.test(location.hostname||'')";
template=template.split(oldStageExpr).join(portalExpr);

const stateLine="    screen: 'login', role: null, company: 'all', tab: 'exec', q: '',";
const statePortal=`    screen: (${portalExpr} ? 'app' : 'login'), role: (${portalExpr} ? 'pmo' : null), company: 'all', tab: 'exec', q: '',`;
if(template.includes(stateLine)) template=template.replace(stateLine,statePortal);

const liveLine="    email: '', password: '', loginError: '', loggingIn: false, token: null, live: false,";
const livePortal=`    email: '', password: '', loginError: '', loggingIn: false, token: null, live: (${portalExpr} ? true : false),`;
if(template.includes(liveLine)) template=template.replace(liveLine,livePortal);

const restoreNeedle='restoreSession() {\n';
const portalRestore=[
  'restoreSession() {',
  `    const portalNoLogin=${portalExpr};`,
  '    if(portalNoLogin){',
  "      try { localStorage.removeItem('allamo_session'); } catch(e){}",
  '      this.companies=[];this.projects=[];this.issues=[];this.viradas=[];this.docs=[];this.users=[];this.reports={};this.plan=[];this.updates={};',
  "      this.setState({ token:null, live:true, role:'pmo', screen:'app', company:'all', tab:'exec', reportProject:null, gmud:[], sessionWarning:'' }, () => {",
  "        this.loadData().then(()=>{ try{ this.loadDashCurve(); }catch(e){} }).catch(()=>{});",
  '      });',
  '      return;',
  '    }',
  ''
].join('\n');

if(template.includes('const stageNoLogin=')){
  template=template.replace(/const stageNoLogin=[^;]+;/,"const portalNoLogin="+portalExpr+";");
  template=template.replace(/if\(stageNoLogin\)\{/g,'if(portalNoLogin){');
}else if(!template.includes('const portalNoLogin=')){
  if(!template.includes(restoreNeedle)) throw new Error('restoreSession não encontrado no template.');
  template=template.replace(restoreNeedle,portalRestore);
}

// No modo sem login, "Sair" nunca pode levar o usuário para a tela de autenticação.
const logoutNeedle='logout() {';
if(!template.includes('const noLoginLogout=')){
  const logoutGuard=`logout() {\n    const noLoginLogout=${portalExpr};\n    if(noLoginLogout){ this.setState({ screen:'app', role:'pmo', live:true, token:null, company:'all', tab:'exec', menuOpen:false }); return; }`;
  if(!template.includes(logoutNeedle)) throw new Error('Método logout não encontrado no template.');
  template=template.replace(logoutNeedle,logoutGuard);
}

// Remove visualmente o botão Sair nos hosts sem login, inclusive após re-render do componente.
if(!template.includes('allamo-no-login-ui')){
  const uiGuard=`<script id="allamo-no-login-ui">(function(){if(!/(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(location.hostname||''))return;function hide(){document.querySelectorAll('button,a').forEach(function(el){if((el.textContent||'').trim()==='Sair')el.style.display='none';});}hide();new MutationObserver(hide).observe(document.documentElement,{subtree:true,childList:true});})();<\\/script>`;
  if(template.includes('</body>')) template=template.replace('</body>',uiGuard+'</body>');
  else template+=uiGuard;
}

if(!template.includes("role:'pmo', screen:'app'")) throw new Error('Frontend ainda não abre direto como PMO.');
if(!template.includes("? 'app' : 'login'")) throw new Error('Estado inicial ainda pode apontar para login nos hosts oficiais.');
if(!template.includes("? true : false")) throw new Error('Modo live sem login não foi ativado.');
if(!template.includes('const noLoginLogout=')) throw new Error('Logout ainda pode levar para autenticação.');
if(!template.includes('allamo-no-login-ui')) throw new Error('Botão Sair não foi neutralizado visualmente.');

const serialized=JSON.stringify(template).replace(/<\//g,'<\\u002F');
JSON.parse(serialized);
html=html.slice(0,jsonStart)+serialized+html.slice(jsonEnd);
fs.writeFileSync(indexFile,html);

console.log('OK: login desativado nos hosts oficiais do Portal PMO; abertura direta como PMO e logout neutralizado.');
