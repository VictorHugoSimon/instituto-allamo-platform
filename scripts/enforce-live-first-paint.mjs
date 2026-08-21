import fs from 'node:fs';
const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

const prefix=`const resourceScript = '<style id="allamo-boot-guard">body{visibility:hidden!important}body:before{visibility:visible!important;content:"Carregando dados do Portal PMO…";position:fixed;inset:0;display:grid;place-items:center;background:#faf9f5;color:#52514e;font:700 14px -apple-system,BlinkMacSystemFont,sans-serif;z-index:2147483000}html.allamo-boot-error body:before{content:"Não foi possível carregar os dados reais. Atualize a página.";color:#b42318}</style><script>' +
      '(function(){' +
      'window.__allamoApiPending=0;window.__allamoApiStarted=0;window.__allamoApiCompleted=0;window.__allamoBootSeen={companies:false,projects:false,publicClient:false};window.__allamoBootStarted=Date.now();' +
      'var of=window.fetch.bind(window);' +
      'window.fetch=function(){var a=arguments,u=String((a[0]&&a[0].url)||a[0]||""),api=u.indexOf("/api/")>=0;if(api){window.__allamoApiPending++;window.__allamoApiStarted++;}return of.apply(window,a).finally(function(){if(api){window.__allamoApiPending=Math.max(0,window.__allamoApiPending-1);window.__allamoApiCompleted++;if(/\\/api\\/companies(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.companies=true;if(/\\/api\\/projects(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.projects=true;if(/\\/api\\/public-client-projects(?:[?\\/]|$)/.test(u))window.__allamoBootSeen.publicClient=true;}});};' +
      'window.__allamoRevealWhenReady=function(){var quietSince=0,max=Date.now()+10000;function hasSession(){try{return !!localStorage.getItem("allamo_session")}catch(_){return false}}function isPublic(){try{return !!new URLSearchParams(location.search).get("cliente")}catch(_){return false}}function ready(){var seen=window.__allamoBootSeen||{};if(isPublic())return !!seen.publicClient;if(hasSession())return !!seen.companies&&!!seen.projects;return true}function reveal(){var s=document.getElementById("allamo-boot-guard");if(s)s.remove();if(document.body)document.body.style.visibility="visible";document.documentElement.classList.add("allamo-ready")}function tick(){var now=Date.now(),p=window.__allamoApiPending||0,r=ready();if(r&&p===0){if(!quietSince)quietSince=now}else quietSince=0;if(quietSince&&now-quietSince>=250){reveal();return}if(now>=max){if(!hasSession()&&!isPublic()){reveal();return}document.documentElement.classList.add("allamo-boot-error");return}setTimeout(tick,75)}tick();};' +
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

const babel=`if (window.Babel && typeof window.Babel.transformScriptTags === 'function') {\n      window.Babel.transformScriptTags();\n    }`;
if(html.includes(babel)&&!html.includes("typeof window.__allamoRevealWhenReady === 'function'"))html=html.replace(babel,babel+`\n    if (typeof window.__allamoRevealWhenReady === 'function') window.__allamoRevealWhenReady();`);

if(!html.includes('window.__allamoBootSeen={companies:false,projects:false,publicClient:false}'))throw new Error('Boot guard não rastreia APIs críticas.');
if(!html.includes('seen.companies&&!!seen.projects'))throw new Error('Sessão autenticada pode revelar antes de companies/projects.');
if(!html.includes('return !!seen.publicClient'))throw new Error('Link público pode revelar antes do contexto público da empresa.');
if(!html.includes('public-client-projects'))throw new Error('Portal público não participa do first paint.');
if(!html.includes('Carregando dados do Portal PMO'))throw new Error('Estado neutro de carregamento ausente.');
fs.writeFileSync(file,html);
console.log('OK: primeiro paint autenticado e público só revela dados reais do tenant/projeto.');
