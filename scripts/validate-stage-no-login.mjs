import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const html=fs.readFileSync('public/index.html','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(worker,"stageNoLoginHost = /(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i",'Bypass restrito ao hostname de Stage');
must(worker,"role:'pmo'",'Identidade PMO sintética no Stage');
must(worker,"__stage_no_login:true",'Marcador de no-login do Stage');
must(worker,"if (!token) return null;",'Produção continua exigindo token');
if(worker.includes("stageNoLoginHost = /(^|\\.)allamo-pmo\\.pages\\.dev$/i")) throw new Error('Produção foi incluída no bypass de autenticação.');

const open='<script type="__bundler/template">';
const start=html.indexOf(open);
if(start<0)throw new Error('Template do bundler ausente.');
const a=start+open.length,b=html.indexOf('</script>',a);
const template=JSON.parse(html.slice(a,b));
must(template,"const stageNoLogin=/(^|\\.)allamo-pmo-stage\\.pages\\.dev$/i.test(location.hostname||'');",'restoreSession detecta Stage');
must(template,"role:'pmo', screen:'app'",'Stage entra direto no app');
must(template,"? 'app' : 'login'",'Estado inicial pula login somente no Stage');
must(template,"? true : false",'Stage inicia live');
if(template.includes("/(^|\\.)allamo-pmo\\.pages\\.dev$/i.test(location.hostname")) throw new Error('Frontend aplicou bypass ao domínio de Produção.');

console.log('OK: Stage abre sem login e Produção permanece autenticada.');
