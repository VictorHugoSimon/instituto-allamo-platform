import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

const officialHost="/(^|\\.)(?:allamo-pmo-stage|allamo-pmo)\\.pages\\.dev$/i.test(location.hostname||'')";

// 1) Central de Reports: nos hosts oficiais o backend já fornece identidade PMO sintética.
// Não exigir token local e não enviar uma sessão antiga por acidente.
const reportOld="const api=async(p,o={})=>{const t=tok();if(!t)throw new Error('Sessão não encontrada');const r=await fetch('/api/'+p,{...o,headers:{'content-type':'application/json','authorization':'Bearer '+t,...(o.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Erro '+r.status);return d};";
const reportNew=`const allamoNoLoginReportHost=()=>${officialHost};const api=async(p,o={})=>{const t=allamoNoLoginReportHost()?'':tok();if(!t&&!allamoNoLoginReportHost())throw new Error('Sessão não encontrada');const headers={'content-type':'application/json',...(o.headers||{})};if(t)headers.authorization='Bearer '+t;const r=await fetch('/api/'+p,{...o,headers,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Erro '+r.status);return d};`;
if(html.includes(reportOld)) html=html.replace(reportOld,reportNew);
else if(!html.includes('allamoNoLoginReportHost')) throw new Error('API da Central de Reports não encontrada para modo sem login.');

// 2) Navegação/lookup da Central: mesma regra, sem abortar por ausência de token.
const navOld="const api=async p=>{const t=token();if(!t)return [];const r=await fetch('/api/'+p,{headers:{authorization:'Bearer '+t},cache:'no-store'});if(!r.ok)return [];return r.json()};";
const navNew=`const allamoNoLoginAdminHost=()=>${officialHost};const api=async p=>{const t=allamoNoLoginAdminHost()?'':token();const headers={};if(t)headers.authorization='Bearer '+t;const r=await fetch('/api/'+p,{headers,cache:'no-store'});if(!r.ok)return [];return r.json()};`;
if(html.includes(navOld)) html=html.replace(navOld,navNew);
else if(!html.includes('allamoNoLoginAdminHost')) throw new Error('API de navegação dos Reports não encontrada para modo sem login.');

// 3) Cabeçalho: o guard antigo dependia da existência do botão Sair.
// O novo guard remove perfil/cargo/avatar independentemente do botão Sair e sobrevive ao pós-unpack.
const templateOpen='<script type="__bundler/template">';
const templateClose='</script>';
const a=html.indexOf(templateOpen);
if(a<0) throw new Error('Template do bundler não encontrado.');
const js=a+templateOpen.length;
const b=html.indexOf(templateClose,js);
if(b<0) throw new Error('Fechamento do template não encontrado.');
let template=JSON.parse(html.slice(js,b));

if(!template.includes('allamo-no-login-profile-cleaner')){
  const cleaner=`<script id="allamo-no-login-profile-cleaner">(function(){if(!${officialHost})return;function interactive(el){if(!el)return false;var t=(el.tagName||'').toUpperCase();return /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t)||!!el.querySelector('button,a,input,select,textarea');}function box(el){try{return el.getBoundingClientRect()}catch(_){return {top:999,width:999,height:999}}}function roleText(s){return /Admin\\s+[ÁA]llamo|PMO\\s+[ÁA]llamo|Tech\\s*Lead|Gestor|Usu[aá]rio/i.test(String(s||''));}function hide(){document.querySelectorAll('button,a').forEach(function(el){if((el.textContent||'').trim()==='Sair'){el.style.display='none';el.setAttribute('data-allamo-hidden-auth-ui','1');}});var candidates=Array.from(document.querySelectorAll('body *')).filter(function(el){var r=box(el),txt=(el.textContent||'').trim();return r.top>=0&&r.top<140&&r.width>0&&r.width<320&&r.height>0&&r.height<100&&roleText(txt);});candidates.sort(function(x,y){return (box(x).width*box(x).height)-(box(y).width*box(y).height);});candidates.forEach(function(el){var target=el;while(target.parentElement){var p=target.parentElement,pr=box(p),pt=(p.textContent||'').trim();if(pr.top<0||pr.top>=140||pr.width>320||pr.height>100||pt.length>140||interactive(p))break;target=p;}target.style.display='none';target.setAttribute('data-allamo-hidden-profile','1');var prev=target.previousElementSibling;if(prev&&!interactive(prev)){var rr=box(prev),tx=(prev.textContent||'').trim();if(rr.top>=0&&rr.top<140&&rr.width>0&&rr.width<=72&&rr.height>0&&rr.height<=72&&tx.length<=4){prev.style.display='none';prev.setAttribute('data-allamo-hidden-avatar','1');}}});}hide();new MutationObserver(function(){hide();}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});setInterval(hide,1200);})();<\\/script>`;
  if(template.includes('</body>')) template=template.replace('</body>',cleaner+'</body>');
  else template+=cleaner;
}

const serialized=JSON.stringify(template).replace(/<\//g,'<\\u002F');
JSON.parse(serialized);
html=html.slice(0,js)+serialized+html.slice(b);

if(html.includes(reportOld)) throw new Error('Central de Reports ainda exige sessão local.');
if(html.includes(navOld)) throw new Error('Navegação dos Reports ainda exige sessão local.');
if(!html.includes('allamoNoLoginReportHost')) throw new Error('Marker do Report sem login ausente.');
if(!html.includes('allamoNoLoginAdminHost')) throw new Error('Marker da navegação sem login ausente.');
if(!html.includes('allamo-no-login-profile-cleaner')) throw new Error('Cleaner de perfil do cabeçalho ausente.');

fs.writeFileSync(file,html);
console.log('OK: Central de Reports funciona sem sessão local e cabeçalho oficial não exibe identidade de usuário.');
