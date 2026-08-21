import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

const prefix=`const resourceScript = '<style id="allamo-boot-guard">#allamo-boot-status-box{position:fixed;left:16px;bottom:16px;z-index:2147483000;background:#302f39;color:#fff;border-radius:999px;padding:8px 12px;font:700 12px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 28px #1018282e;display:flex;gap:8px;align-items:center;max-width:min(460px,calc(100vw - 32px))}#allamo-boot-status-box[data-state="error"]{background:#b42318;border-radius:12px}#allamo-boot-retry{border:1px solid #ffffff55;border-radius:7px;background:#fff;color:#302f39;padding:5px 8px;font-weight:800;cursor:pointer}</style><script>' +
      '(function(){' +
      'window.__allamoLegacyLoadingLabel="Carregando dados do Portal PMO";window.__allamoBootNonBlocking=true;window.__allamoApiPending=0;window.__allamoApiStarted=0;window.__allamoApiCompleted=0;window.__allamoBootSeen={companies:false,projects:false,publicClient:false};window.__allamoBootStarted=Date.now();' +
      'var of=window.fetch.bind(window);' +
      'window.fetch=function(){var a=arguments,u=String((a[0]&&a[0].url)||a[0]||""),api=u.indexOf("/api/")>=0;if(api){window.__allamoApiPending++;window.__allamoApiStarted++;}return of.apply(window,a).finally(function(){if(api){window.__allamoApiPending=Math.max(0,window.__allamoApiPending-1);window.__allamoApiCompleted++;if(/\\/api\\/companies(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.companies=true;if(/\\/api\\/projects(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.projects=true;if(/\\/api\\/public-client-projects(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.publicClient=true;}});};' +
      'window.__allamoRevealWhenReady=function(){if(window.__allamoBootGuardStarted)return;window.__allamoBootGuardStarted=true;var quietSince=0,max=Date.now()+12000;function hasSession(){try{var raw=localStorage.getItem("allamo_session");if(!raw)return false;var s=JSON.parse(raw);return !!(s&&s.token)}catch(_){return false}}function isPublic(){try{return !!new URLSearchParams(location.search).get("cliente")}catch(_){return false}}function ready(){var seen=window.__allamoBootSeen||{};if(isPublic())return !!seen.publicClient;if(hasSession())return !!seen.companies&&!!seen.projects;return true}function ensureBox(){var d=document.getElementById("allamo-boot-status-box");if(d)return d;if(!document.body)return null;d=document.createElement("div");d.id="allamo-boot-status-box";d.setAttribute("role","status");d.textContent="Sincronizando dados…";document.body.appendChild(d);return d}function done(){var d=document.getElementById("allamo-boot-status-box");if(d)d.remove();document.documentElement.classList.add("allamo-ready");window.dispatchEvent(new CustomEvent("allamo:data-ready"))}function fail(){var d=ensureBox();if(!d)return;d.dataset.state="error";d.innerHTML="<span>Não foi possível atualizar todos os dados.</span><button id=\\"allamo-boot-retry\\">Tentar novamente</button>";var b=document.getElementById("allamo-boot-retry");if(b)b.onclick=function(){location.reload()}}function tick(){ensureBox();var now=Date.now(),p=window.__allamoApiPending||0,r=ready();if(r&&p===0){if(!quietSince)quietSince=now}else quietSince=0;if(quietSince&&now-quietSince>=200){done();return}if(now>=max){if(!hasSession()&&!isPublic()){done();return}fail();return}setTimeout(tick,75)}tick();};' +
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
  throw new Error('Ponto do status de sincronização não encontrado.');
}

const blocking='body{visibility:'+'hidden!important}';
if(!html.includes('window.__allamoBootNonBlocking=true'))throw new Error('First paint ainda não está em modo não bloqueante.');
if(html.includes(blocking))throw new Error('Bloqueio global do body ainda presente.');
if(!html.includes('window.__allamoBootSeen={companies:false,projects:false,publicClient:false}'))throw new Error('Sincronização não rastreia APIs críticas.');
if(!html.includes('seen.companies&&!!seen.projects'))throw new Error('Sessão autenticada não rastreia companies/projects.');
if(!html.includes('return !!seen.publicClient'))throw new Error('Link público não rastreia o contexto da empresa.');
if(!html.includes('public-client-projects'))throw new Error('Portal público não participa da sincronização inicial.');
if(!html.includes('window.__allamoBootGuardStarted'))throw new Error('Sincronização não possui proteção contra dupla inicialização.');
if(!html.includes('setTimeout(function(){window.__allamoRevealWhenReady()},0)'))throw new Error('Sincronização não inicia de forma autônoma.');
if(!html.includes('allamo-boot-retry'))throw new Error('Fallback recuperável de conectividade ausente.');
if(!html.includes('Sincronizando dados'))throw new Error('Indicador não bloqueante de sincronização ausente.');
fs.writeFileSync(file,html);
console.log('OK: first paint não bloqueia a interface; dados reais sincronizam com status e retry seguro.');
