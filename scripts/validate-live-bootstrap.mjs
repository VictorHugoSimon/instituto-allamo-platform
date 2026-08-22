import fs from 'node:fs';
const html=fs.readFileSync('public/index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const open='<script type="__bundler/template">';
const a=html.indexOf(open);
if(a<0)throw new Error('Template do bundler ausente.');
const start=a+open.length,end=html.indexOf('</script>',start);
if(end<0)throw new Error('Fechamento do template ausente.');
let template;
try{template=JSON.parse(html.slice(start,end));}catch(e){throw new Error('Template final inválido: '+e.message);}

const must=(s,n,l)=>{if(!s.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
must(template,'[allamo-login-live-reset]','login limpa fotografia histórica antes de abrir o app');
must(template,'[allamo-load-initial-reset]','primeira hidratação possui reset defensivo');
must(template,'if(!this.__allamoLiveBootReset)','reset do loadData acontece somente na primeira hidratação');
must(template,"screen: 'app', gmud:[]",'restoreSession abre app sem GMUD demo');
must(template,'this.companies=[];this.projects=[];this.issues=[];this.viradas=[];this.docs=[];this.users=[];','coleções live são limpas antes do primeiro render autenticado');
if(template.includes('[allamo-live-reset] nunca renderizar fotografia demo durante fetch'))throw new Error('Reset antigo ainda limpa a tela em todo refresh.');

const restore=template.slice(template.indexOf('restoreSession() {'),template.indexOf('  async onLoginSubmit(e) {'));
const clearPos=restore.indexOf('this.companies=[];this.projects=[]');
const appPos=restore.indexOf("screen: 'app'");
if(clearPos<0||appPos<0||clearPos>appPos)throw new Error('restoreSession ainda pode renderizar a carteira demo antes da limpeza.');

const loadStart=template.indexOf('  async loadData() {');
const loadEnd=template.indexOf('  roleName(',loadStart);
const load=template.slice(loadStart,loadEnd);
const markerCount=(load.match(/\[allamo-load-initial-reset\]/g)||[]).length;
if(markerCount!==1)throw new Error('loadData deve possuir exatamente um marcador de reset inicial.');
const markerPos=load.indexOf('[allamo-load-initial-reset]');
const guardPos=load.indexOf('if(!this.__allamoLiveBootReset)',markerPos);
const initialClearPos=load.indexOf('this.companies=[];this.projects=[]',guardPos);
const queryPos=load.indexOf('const c = this.state.company;',initialClearPos);
if(markerPos<0||guardPos<0||initialClearPos<0||queryPos<0||!(markerPos<guardPos&&guardPos<initialClearPos&&initialClearPos<queryPos))throw new Error('Reset inicial não está protegido antes da primeira consulta live.');

const build=String(pkg.scripts['build:work']||'');
if(!build.includes('zero-live-state-before-fetch.mjs'))throw new Error('Build não aplica saneamento de boot live.');
if(!String(pkg.scripts['test:live']||'').includes('validate-live-bootstrap.mjs'))throw new Error('Script test:live não configurado.');
console.log('OK: boot autenticado não exibe carteira demo e refreshs mantêm os dados reais atuais durante a sincronização.');
