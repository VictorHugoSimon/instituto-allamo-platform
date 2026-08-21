import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

const prefix=`const resourceScript = '<style id="allamo-boot-guard">body{visibility:hidden!important}body:before{visibility:visible!important;content:"Carregando dados do Portal PMO…";position:fixed;inset:0;display:grid;place-items:center;background:#faf9f5;color:#52514e;font:700 14px -apple-system,BlinkMacSystemFont,sans-serif;z-index:2147483000}</style><script>' +
      '(function(){' +
      'window.__allamoApiPending=0;window.__allamoApiStarted=0;window.__allamoApiCompleted=0;window.__allamoBootSeen={companies:false,projects:false,publicClient:false};window.__allamoBootStarted=Date.now();' +
      'var of=window.fetch.bind(window);' +
      'window.fetch=function(){var a=arguments,u=String((a[0]&&a[0].url)||a[0]||""),api=u.indexOf("/api/")>=0;if(api){window.__allamoApiPending++;window.__allamoApiStarted++;}return of.apply(window,a).finally(function(){if(api){window.__allamoApiPending=Math.max(0,window.__allamoApiPending-1);window.__allamoApiCompleted++;if(/\\/api\\/companies(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.companies=true;if(/\\/api\\/projects(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.projects=true;if(/\\/api\\/public-client-projects(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.publicClient=true;}});};' +
      'window.__allamoRevealWhenReady=function(){if(window.__allamoBootGuardStarted)return;window.__allamoBootGuardStarted=true;var quietSince=0,max=Date.now()+12000;function hasSession(){try{var raw=localStorage.getItem("allamo_session");if(!raw)return false;var s=JSON.parse(raw);return !!(s&&s.token)}catch(_){return false}}function isPublic(){try{return !!new URLSearchParams(location.search).get("cliente")}catch(_){return false}}function ready(){var seen=window.__allamoBootSeen||{};if(isPublic())return !!seen.publicClient;if(hasSession())return !!seen.companies&&!!seen.projects;return true}function reveal(){var s=document.getElementById("allamo-boot-guard");if(s)s.remove();var er=document.getElementById("allamo-boot-error-box");if(er)er.remove();if(document.body)document.body.style.visibility="visible";document.documentElement.classList.add("allamo-ready")}function fail(){if(document.getElementById("allamo-boot-error-box"))return;var d=document.createElement("div");d.id="allamo-boot-error-box";d.style.cssText="visibility:visible!important;position:fixed;inset:0;z-index:2147483647;background:#faf9f5;display:grid;place-items:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif";d.innerHTML="<div style=\\"max-width:520px;background:#fff;border:1px solid #f0d5d2;border-radius:14px;padding:22px;text-align:center;box-shadow:0 12px 40px #10182818\\"><b style=\\"color:#b42318\\">Não foi possível carregar os dados atuais.</b><div style=\\"margin:8px 0 14px;color:#667085;font-size:13px\\">Nenhum dado antigo foi exibido. Verifique sua conexão e tente novamente.</div><button id=\\"allamo-boot-retry\\" style=\\"border:0;border-radius:9px;background:#302f39;color:#fff;padding:10px 14px;font-weight:800;cursor:pointer\\">Tentar novamente</button></div>";(document.body||document.documentElement).appendChild(d);var b=document.getElementById("allamo-boot-retry");if(b)b.onclick=function(){location.reload()}}function tick(){var now=Date.now(),p=window.__allamoApiPending||0,r=ready();if(r&&p===0){if(!quietSince)quietSince=now}else quietSince=0;if(quietSince&&now-quietSince>=200){reveal();return}if(now>=max){if(!hasSession()&&!isPublic()){reveal();return}fail();return}setTimeout(tick,75)}tick();};' +
      'setTimeout(function(){window.__allamoRevealWhenReady()},0);' +
      '})();' +
      '</' + 'script><script>window.__resources = ' +`;

const guardedStart="const resourceScript = '<style id=\"allamo-boot-guard\">";
const tail="<script>window.__resources = ' +";
const original="const resourceScript = '<script>window.__resources = ' +";
const s=html.indexOf(guardedStart);
if(s>=0){
  const e=html.indexOf(tail,s);
  if(e<0)throw new Error('Boot guard existente sem final reconhecível.');
  html=html.slice(0,s)+prefix+html.slice(e+tail.length);
}else if(html.includes(original)){
  html=html.replace(original,prefix);
}else if(!html.includes('window.__allamoBootSeen')){
  throw new Error('Ponto do boot guard não encontrado.');
}

if(!html.includes('window.__allamoBootSeen={companies:false,projects:false,publicClient:false}'))throw new Error('Boot guard não rastreia APIs críticas.');
if(!html.includes('seen.companies&&!!seen.projects'))throw new Error('Sessão autenticada pode revelar antes de companies/projects.');
if(!html.includes('return !!seen.publicClient'))throw new Error('Link público pode revelar antes do contexto público da empresa.');
if(!html.includes('public-client-projects'))throw new Error('Portal público não participa do first paint.');
if(!html.includes('window.__allamoBootGuardStarted'))throw new Error('Boot guard não possui proteção contra dupla inicialização.');
if(!html.includes('setTimeout(function(){window.__allamoRevealWhenReady()},0)'))throw new Error('Boot guard não inicia de forma autônoma.');
if(!html.includes('allamo-boot-retry'))throw new Error('Fallback recuperável do boot guard ausente.');
if(!html.includes('Carregando dados do Portal PMO'))throw new Error('Estado neutro de carregamento ausente.');
fs.writeFileSync(file,html);
console.log('OK: first paint auto-inicia, bloqueia dados antigos e possui retry seguro.');
