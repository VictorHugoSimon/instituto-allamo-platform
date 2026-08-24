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
must(template,'[allamo-login-live-reset]','login explícito limpa contexto anterior antes de trocar identidade');
must(template,'[allamo-load-initial-continuity]','primeira hidratação preserva continuidade visual');
must(template,'if(!this.__allamoLiveBootReset)','continuidade da primeira hidratação executa uma única vez');
must(template,"screen: 'app', gmud:[]",'restoreSession abre app sem GMUD demo');
must(template,'companies = [];','empresas históricas foram removidas do bundle no build');
must(template,'projects = [];','projetos históricos foram removidos do bundle no build');
must(template,"sessionStorage.getItem('allamo_portfolio_snapshot_v2')",'primeira hidratação pode usar snapshot efêmero da aba');
must(template,"sessionStorage.setItem('allamo_portfolio_snapshot_v2'",'snapshot é atualizado após resposta live válida');
if(template.includes('[allamo-live-reset] nunca renderizar fotografia demo durante fetch'))throw new Error('Reset antigo ainda limpa a tela em todo refresh.');
if(template.includes('[allamo-load-initial-reset]'))throw new Error('Reset inicial antigo ainda pode apagar carteira/projetos durante a sincronização.');

// O template base deve nascer sem fotografia histórica. Portanto não exigimos mais
// limpeza destrutiva em restoreSession/loadData: o estado vazio vem do próprio build,
// e a continuidade visual usa apenas o último snapshot válido da aba.
const restoreStart=template.indexOf('restoreSession() {');
const restoreEnd=template.indexOf('  async onLoginSubmit(e) {',restoreStart);
if(restoreStart<0||restoreEnd<0)throw new Error('restoreSession não encontrado.');
const restore=template.slice(restoreStart,restoreEnd);
if(restore.includes("companies = [{id:'esposende'"))throw new Error('restoreSession ainda referencia fotografia histórica.');

const loadStart=template.indexOf('  async loadData() {');
const loadEnd=template.indexOf('  roleName(',loadStart);
const load=template.slice(loadStart,loadEnd);
const markerCount=(load.match(/\[allamo-load-initial-continuity\]/g)||[]).length;
if(markerCount!==1)throw new Error('loadData deve possuir exatamente um marcador de continuidade inicial.');
const markerPos=load.indexOf('[allamo-load-initial-continuity]');
const guardPos=load.indexOf('if(!this.__allamoLiveBootReset)',markerPos);
const snapshotPos=load.indexOf("sessionStorage.getItem('allamo_portfolio_snapshot_v2')",guardPos);
const queryPos=load.indexOf('const c = this.state.company;',snapshotPos);
if(markerPos<0||guardPos<0||snapshotPos<0||queryPos<0||!(markerPos<guardPos&&guardPos<snapshotPos&&snapshotPos<queryPos))throw new Error('Continuidade inicial não está protegida antes da primeira consulta live.');
if(load.includes('this.companies=[];this.projects=[]'))throw new Error('loadData ainda possui limpeza destrutiva que causa flicker vazio/cheio.');

const build=String(pkg.scripts['build:work']||'');
if(!build.includes('zero-live-state-before-fetch.mjs'))throw new Error('Build não aplica saneamento de boot live.');
if(!String(pkg.scripts['test:live']||'').includes('validate-live-bootstrap.mjs'))throw new Error('Script test:live não configurado.');
console.log('OK: boot nasce sem dados demo, mantém continuidade visual durante revalidação e o D1 continua soberano.');
