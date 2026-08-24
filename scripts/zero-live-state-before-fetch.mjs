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
const SNAPSHOT_KEY='allamo_portfolio_snapshot_v2';

// Remove a fotografia histórica do protótipo NO BUILD, e não durante a primeira
// renderização. Assim o bundle nunca exibe dados demo e também não precisa zerar
// empresas/projetos enquanto a API real está chegando.
function sanitizeArrayField(text,name){
  const marker='\n  '+name+' = [';
  const markerPos=text.indexOf(marker);
  if(markerPos<0)return {text,changed:false};
  const arrStart=text.indexOf('[',markerPos);
  if(arrStart<0)throw new Error('Array '+name+' sem abertura.');
  let depth=0,quote='',escape=false,arrEnd=-1;
  for(let i=arrStart;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escape){escape=false;continue;}
      if(ch==='\\'){escape=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='[')depth++;
    else if(ch===']'){
      depth--;
      if(depth===0){arrEnd=i;break;}
    }
  }
  if(arrEnd<0)throw new Error('Array '+name+' sem fechamento.');
  return {text:text.slice(0,arrStart)+'[]'+text.slice(arrEnd+1),changed:true};
}

for(const field of ['companies','projects','issues','viradas','docs','users']){
  const r=sanitizeArrayField(template,field);
  template=r.text;
}

// Login explícito pode trocar identidade/tenant. Nesse caso limpamos o estado e
// descartamos o snapshot da sessão anterior para impedir contexto cruzado.
const loginStart=template.indexOf('  async onLoginSubmit(e) {');
const loadStart=template.indexOf('  async loadData() {',loginStart);
if(loginStart<0||loadStart<0)throw new Error('Métodos de login/loadData não encontrados.');
let login=template.slice(loginStart,loadStart);
if(!login.includes('[allamo-login-live-reset]')){
  const loginNeedle="const res = await this.api('login', { method: 'POST', body: JSON.stringify({ email, password }) });";
  if(!login.includes(loginNeedle))throw new Error('Resposta de login não encontrada para reset live.');
  login=login.replace(loginNeedle,loginNeedle+"\n      /* [allamo-login-live-reset] */ try{sessionStorage.removeItem('"+SNAPSHOT_KEY+"')}catch(_){ } "+clear);
  template=template.slice(0,loginStart)+login+template.slice(loadStart);
}

// Primeira hidratação: restaura SOMENTE a última carteira válida desta aba por
// até 15 minutos. Ela é continuidade visual, nunca fonte de verdade: o fetch
// no-store continua sendo executado imediatamente e substitui o snapshot assim
// que companies + projects chegam juntos e válidos.
const newLoadStart=template.indexOf('  async loadData() {');
const roleStart=template.indexOf('  roleName(',newLoadStart);
if(newLoadStart<0||roleStart<0)throw new Error('Limites de loadData não encontrados.');
let load=template.slice(newLoadStart,roleStart);
const companyNeedle='const c = this.state.company;';
const initialMarker='[allamo-load-initial-continuity]';
if(!load.includes(initialMarker)){
  if(!load.includes(companyNeedle))throw new Error('Início de loadData não encontrado para continuidade inicial.');
  const initial="/* "+initialMarker+" */ if(!this.__allamoLiveBootReset){this.__allamoLiveBootReset=true;try{const __snap=JSON.parse(sessionStorage.getItem('"+SNAPSHOT_KEY+"')||'null');const __age=__snap?Date.now()-Number(__snap.ts||0):Infinity;if(__snap&&__age>=0&&__age<900000){if(Array.isArray(__snap.companies))this.companies=__snap.companies;if(Array.isArray(__snap.projects))this.projects=__snap.projects;}}catch(_){}} ";
  load=load.replace(companyNeedle,initial+companyNeedle);
}

const snapshotSave="try{if(Array.isArray(companies)&&Array.isArray(projects)){sessionStorage.setItem('"+SNAPSHOT_KEY+"',JSON.stringify({ts:Date.now(),companies:this.companies||[],projects:this.projects||[]}));}}catch(_){ } ";
if(!load.includes("sessionStorage.setItem('"+SNAPSHOT_KEY+"'")){
  const catchPos=load.indexOf('} catch (e) {');
  const forcePos=load.lastIndexOf('this.forceUpdate();',catchPos>=0?catchPos:load.length);
  if(forcePos<0)throw new Error('forceUpdate final de loadData não encontrado para snapshot.');
  load=load.slice(0,forcePos)+snapshotSave+load.slice(forcePos);
}

template=template.slice(0,newLoadStart)+load+template.slice(roleStart);

if(!template.includes('[allamo-login-live-reset]'))throw new Error('Reset live no login não aplicado.');
if(!template.includes(initialMarker))throw new Error('Continuidade inicial da carteira não aplicada.');
if(!template.includes("sessionStorage.setItem('"+SNAPSHOT_KEY+"'"))throw new Error('Snapshot live da carteira não é salvo.');
if(!template.includes('companies = [];')||!template.includes('projects = [];'))throw new Error('Dados demo de empresas/projetos ainda permanecem no bundle.');
if(template.includes('[allamo-load-initial-reset]'))throw new Error('Reset inicial antigo ainda pode apagar a carteira durante o fetch.');
if(template.includes('[allamo-live-reset] nunca renderizar fotografia demo durante fetch'))throw new Error('Reset antigo ainda zera a tela em todo refresh.');

const serialized=JSON.stringify(template).replace(/<\//gi,'<\\u002F');
JSON.parse(serialized);
html=html.slice(0,start)+serialized+html.slice(end);
fs.writeFileSync(file,html);
console.log('OK: demo removida no build; carteira/projetos preservam continuidade visual e o D1 continua sendo a fonte live.');
