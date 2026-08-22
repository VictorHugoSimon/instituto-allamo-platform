import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');
const open='<script type="__bundler/template">';
const a=html.indexOf(open);
if(a<0)throw new Error('Template do bundler não encontrado para saneamento live.');
const start=a+open.length;
const end=html.indexOf('</script>',start);
if(end<0)throw new Error('Fechamento do template do bundler não encontrado.');
let template;
try{template=JSON.parse(html.slice(start,end));}
catch(err){throw new Error('Template inválido antes do saneamento live: '+String(err&&err.message||err));}

const clear="this.companies=[];this.projects=[];this.issues=[];this.viradas=[];this.docs=[];this.users=[];this.reports={};this.plan=[];this.updates={};";

// Login novo: nunca abrir o app com a fotografia histórica que veio embutida no protótipo.
const loginStart=template.indexOf('  async onLoginSubmit(e) {');
const loadStart=template.indexOf('  async loadData() {',loginStart);
if(loginStart<0||loadStart<0)throw new Error('Métodos de login/loadData não encontrados.');
let login=template.slice(loginStart,loadStart);
if(!login.includes('[allamo-login-live-reset]')){
  const loginNeedle="const res = await this.api('login', { method: 'POST', body: JSON.stringify({ email, password }) });";
  if(!login.includes(loginNeedle))throw new Error('Resposta de login não encontrada para reset live.');
  login=login.replace(loginNeedle,loginNeedle+"\n      /* [allamo-login-live-reset] */ "+clear);
  template=template.slice(0,loginStart)+login+template.slice(loadStart);
}

// Primeira hidratação: zera somente uma vez. Atualizações posteriores mantêm os dados reais
// atuais visíveis enquanto a nova resposta do D1 chega, evitando flicker vazio/cheio.
const newLoadStart=template.indexOf('  async loadData() {');
const roleStart=template.indexOf('  roleName(',newLoadStart);
if(newLoadStart<0||roleStart<0)throw new Error('Limites de loadData não encontrados.');
let load=template.slice(newLoadStart,roleStart);
if(!load.includes('[allamo-load-initial-reset]')){
  const companyNeedle='const c = this.state.company;';
  if(!load.includes(companyNeedle))throw new Error('Início de loadData não encontrado para reset inicial.');
  const initial="/* [allamo-load-initial-reset] */ if(!this.__allamoLiveBootReset){this.__allamoLiveBootReset=true;"+clear+"this.setState({gmud:[]});} ";
  load=load.replace(companyNeedle,initial+companyNeedle);
  template=template.slice(0,newLoadStart)+load+template.slice(roleStart);
}

if(!template.includes('[allamo-login-live-reset]'))throw new Error('Reset live no login não aplicado.');
if(!template.includes('[allamo-load-initial-reset]'))throw new Error('Reset live inicial não aplicado.');
if(template.includes('[allamo-live-reset] nunca renderizar fotografia demo durante fetch'))throw new Error('Reset antigo ainda zera a tela em todo refresh.');

const serialized=JSON.stringify(template).replace(/<\//gi,'<\\u002F');
JSON.parse(serialized);
html=html.slice(0,start)+serialized+html.slice(end);
fs.writeFileSync(file,html);
console.log('OK: estado demo é removido antes da primeira tela live e refreshs posteriores preservam os dados reais atuais.');
