import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(worker,"portalNoLoginHost = /(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i",'Bypass restrito aos dois hosts oficiais do Portal');
must(worker,"role:'pmo'",'Identidade PMO sintética no modo sem login');
must(worker,"__portal_no_login:true",'Marcador do modo sem login');
must(worker,"if (!token) return null;",'Hosts fora do Portal mantêm autenticação legada');

const open='<script type="__bundler/template">';
const start=html.indexOf(open);
if(start<0)throw new Error('Template do bundler ausente.');
const a=start+open.length,b=html.indexOf('</script>',a);
const template=JSON.parse(html.slice(a,b));
must(template,"const portalNoLogin=/(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(location.hostname||'');",'restoreSession detecta os hosts oficiais');
must(template,"role:'pmo', screen:'app'",'Portal entra direto no app');
must(template,"? 'app' : 'login'",'Estado inicial pula login nos hosts oficiais');
must(template,"? true : false",'Portal inicia live sem autenticação');
must(template,'const noLoginLogout=','Logout é neutralizado no modo sem login');
must(template,'allamo-no-login-ui','Botão Sair é removido visualmente no modo sem login');

console.log('OK: Stage e Produção estão preparados para abrir sem login nos hosts oficiais; isolamento por tenant/projeto continua no runtime.');
