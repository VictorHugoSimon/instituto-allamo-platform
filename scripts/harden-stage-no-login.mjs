import fs from 'node:fs';

const indexFile='public/index.html';
const workerFile='public/_worker.js';
const STAGE_HOST_RE="/(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i";

// Backend: no Stage, todas as APIs internas recebem uma identidade PMO sintética.
// Produção continua exigindo token normalmente.
let worker=fs.readFileSync(workerFile,'utf8');
const userNeedle="async function currentUser(request, env) {\n  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');";
const userReplacement="async function currentUser(request, env) {\n  const stageNoLoginHost = /(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i.test(new URL(request.url).hostname || '');\n  if (stageNoLoginHost) return { id:'stage-no-login', name:'PMO Stage', email:'stage-no-login@allamo.local', role:'pmo', company_id:null, status:'Ativo', __stage_no_login:true };\n  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');";
if(!worker.includes('__stage_no_login')){
  if(!worker.includes(userNeedle)) throw new Error('currentUser não encontrado para habilitar Stage sem login.');
  worker=worker.replace(userNeedle,userReplacement);
}
if(!worker.includes("stageNoLoginHost = /(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i")) throw new Error('Bypass Stage não aplicado ao backend.');
if(!worker.includes("if (!token) return null;")) throw new Error('Proteção por token fora do Stage foi removida indevidamente.');
fs.writeFileSync(workerFile,worker);

// Frontend: edita o template interno do bundler para abrir direto como PMO no Stage.
let html=fs.readFileSync(indexFile,'utf8');
const templateOpen='<script type="__bundler/template">';
const templateClose='</script>';
const tagStart=html.indexOf(templateOpen);
if(tagStart<0) throw new Error('Template do bundler não encontrado.');
const jsonStart=tagStart+templateOpen.length;
const jsonEnd=html.indexOf(templateClose,jsonStart);
if(jsonEnd<0) throw new Error('Fechamento do template do bundler não encontrado.');
let template=JSON.parse(html.slice(jsonStart,jsonEnd));

const stageExpr="/(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i.test(location.hostname||'')";
const stateLine="    screen: 'login', role: null, company: 'all', tab: 'exec', q: '',";
const stateStage=`    screen: (${stageExpr} ? 'app' : 'login'), role: (${stageExpr} ? 'pmo' : null), company: 'all', tab: 'exec', q: '',`;
if(template.includes(stateLine)) template=template.replace(stateLine,stateStage);

const liveLine="    email: '', password: '', loginError: '', loggingIn: false, token: null, live: false,";
const liveStage=`    email: '', password: '', loginError: '', loggingIn: false, token: null, live: (${stageExpr} ? true : false),`;
if(template.includes(liveLine)) template=template.replace(liveLine,liveStage);

const restoreNeedle='restoreSession() {\n';
const stageRestore=[
  'restoreSession() {',
  `    const stageNoLogin=${stageExpr};`,
  '    if(stageNoLogin){',
  "      try { localStorage.removeItem('allamo_session'); } catch(e){}",
  '      this.companies=[];this.projects=[];this.issues=[];this.viradas=[];this.docs=[];this.users=[];this.reports={};this.plan=[];this.updates={};',
  "      this.setState({ token:null, live:true, role:'pmo', screen:'app', company:'all', tab:'exec', reportProject:null, gmud:[], sessionWarning:'' }, () => {",
  "        this.loadData().then(()=>{ try{ this.loadDashCurve(); }catch(e){} }).catch(()=>{});",
  '      });',
  '      return;',
  '    }',
  ''
].join('\n');
if(!template.includes('const stageNoLogin=/(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i.test(location.hostname||\'\');')){
  if(!template.includes(restoreNeedle)) throw new Error('restoreSession não encontrado no template.');
  template=template.replace(restoreNeedle,stageRestore);
}

if(!template.includes("role:'pmo', screen:'app'")) throw new Error('Frontend Stage ainda não abre direto como PMO.');
if(!template.includes("? 'app' : 'login'")) throw new Error('Tela inicial Stage ainda aponta para login.');
if(!template.includes("? true : false")) throw new Error('Modo live do Stage sem login não foi ativado.');
if(template.includes("/(^|\\.)allamo-pmo\\.pages\\.dev$/i.test(location.hostname")) throw new Error('Bypass foi aplicado ao domínio de Produção por engano.');

const serialized=JSON.stringify(template).replace(/<\//g,'<\\u002F');
JSON.parse(serialized);
html=html.slice(0,jsonStart)+serialized+html.slice(jsonEnd);
fs.writeFileSync(indexFile,html);

console.log('OK: login desativado exclusivamente no Stage; Produção continua autenticada.');
