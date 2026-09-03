import fs from 'node:fs';

const indexFile='public/index.html';
const workerFile='public/_worker.js';

// Regra funcional aprovada: o Portal PMO abre sem e-mail/senha nos dois ambientes oficiais.
// Hosts fora dos dois projetos oficiais continuam usando o fluxo autenticado legado.
const PORTAL_HOST_SOURCE='(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$';

// Backend: nos hosts oficiais do Portal, todas as APIs internas recebem uma identidade PMO sintética.
let worker=fs.readFileSync(workerFile,'utf8');
const userNeedle="async function currentUser(request, env) {\n  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');";
const portalUserMarker="portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i";
const userReplacement="async function currentUser(request, env) {\n  const portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(new URL(request.url).hostname || '');\n  if (portalNoLoginHost) return { id:'portal-no-login', name:'PMO Államo', email:'portal-no-login@allamo.local', role:'pmo', company_id:null, status:'Ativo', __portal_no_login:true };\n  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');";

if(worker.includes('__stage_no_login')){
  worker=worker
    .replace(/const stageNoLoginHost = \/\(\^\|\\\.\)allamo-pmo-stage\\\.pages\\\.dev\$\/i\.test\(new URL\(request\.url\)\.hostname \|\| ''\);/,"const portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(new URL(request.url).hostname || '');")
    .replace(/if \(stageNoLoginHost\) return \{ id:'stage-no-login', name:'PMO Stage', email:'stage-no-login@allamo\.local', role:'pmo', company_id:null, status:'Ativo', __stage_no_login:true \};/,"if (portalNoLoginHost) return { id:'portal-no-login', name:'PMO Államo', email:'portal-no-login@allamo.local', role:'pmo', company_id:null, status:'Ativo', __portal_no_login:true };");
}else if(!worker.includes(portalUserMarker)){
  if(!worker.includes(userNeedle)) throw new Error('currentUser não encontrado para habilitar Portal sem login.');
  worker=worker.replace(userNeedle,userReplacement);
}

if(!worker.includes(portalUserMarker)) throw new Error('Bypass sem login não foi aplicado aos hosts oficiais do Portal.');
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

// Remove visualmente o conjunto de autenticação nos hosts sem login:
// botão Sair + bloco imediatamente anterior de nome/função/avatar. Mantém sino,
// seletor de empresa e botão de instalação. A heurística atua somente ao redor
// do botão Sair e evita esconder controles interativos vizinhos.
const oldUiMarker='allamo-no-login-ui';
if(!template.includes('allamo-no-login-identity-ui')){
  const identityGuard=`<script id="allamo-no-login-identity-ui">(function(){if(!/(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(location.hostname||''))return;function interactive(el){if(!el)return true;var t=(el.tagName||'').toUpperCase();return /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t)||!!el.querySelector('button,a,input,select,textarea');}function hide(){document.querySelectorAll('button,a').forEach(function(el){if((el.textContent||'').trim()!=='Sair')return;var prev=el.previousElementSibling;el.style.display='none';var hidden=0;while(prev&&hidden<2){var candidate=prev;prev=prev.previousElementSibling;if(interactive(candidate))continue;var txt=(candidate.textContent||'').trim();var hasText=txt.length>0;var rect=candidate.getBoundingClientRect?candidate.getBoundingClientRect():{width:0,height:0};var avatarLike=!hasText&&rect.width>0&&rect.width<=64&&rect.height>0&&rect.height<=64;if(hasText||avatarLike){candidate.style.display='none';candidate.setAttribute('data-allamo-hidden-identity','1');hidden++;}}});}hide();new MutationObserver(hide).observe(document.documentElement,{subtree:true,childList:true});})();<\\/script>`;
  if(template.includes('</body>')) template=template.replace('</body>',identityGuard+'</body>');
  else template+=identityGuard;
}
// Remove o guard antigo, se ainda estiver embutido, para evitar observers duplicados.
if(template.includes(`<script id="${oldUiMarker}">`)){
  template=template.replace(new RegExp(`<script id="${oldUiMarker}">[\\s\\S]*?<\\\\/script>`,'g'),'');
}

if(!template.includes("role:'pmo', screen:'app'")) throw new Error('Frontend ainda não abre direto como PMO.');
if(!template.includes("? 'app' : 'login'")) throw new Error('Estado inicial ainda pode apontar para login nos hosts oficiais.');
if(!template.includes("? true : false")) throw new Error('Modo live sem login não foi ativado.');
if(!template.includes('const noLoginLogout=')) throw new Error('Logout ainda pode levar para autenticação.');
if(!template.includes('allamo-no-login-identity-ui')) throw new Error('Identidade visual do usuário ainda não foi neutralizada.');
if(!template.includes('data-allamo-hidden-identity')) throw new Error('Guard de nome/avatar não foi aplicado.');

const serialized=JSON.stringify(template).replace(/<\//g,'<\\u002F');
JSON.parse(serialized);
html=html.slice(0,jsonStart)+serialized+html.slice(jsonEnd);
fs.writeFileSync(indexFile,html);

console.log('OK: login desativado nos hosts oficiais; abertura direta como PMO e cabeçalho sem Sair/nome/avatar.');
