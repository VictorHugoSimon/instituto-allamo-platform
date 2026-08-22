import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

// O portal principal fica serializado como uma string JSON dentro de
// <script type="__bundler/template">. Alterar essa string crua com replace
// pode produzir escapes JSON inválidos. Toda alteração abaixo acontece no
// template JÁ decodificado e depois é reserializada com JSON.stringify.
const open='<script type="__bundler/template">';
const close='</script>';

const prefix=String.raw`const resourceScript = '<style id="allamo-boot-guard">#allamo-boot-status-box{position:fixed;left:16px;bottom:16px;z-index:2147483000;background:#302f39;color:#fff;border-radius:999px;padding:8px 12px;font:700 12px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 28px #1018282e;display:flex;gap:8px;align-items:center;max-width:min(460px,calc(100vw - 32px))}#allamo-boot-status-box[data-state="error"]{background:#b42318;border-radius:12px}#allamo-boot-retry{border:1px solid #ffffff55;border-radius:7px;background:#fff;color:#302f39;padding:5px 8px;font-weight:800;cursor:pointer}</style><script>' +
      '(function(){' +
      'window.__allamoLegacyLoadingLabel="Carregando dados do Portal PMO";window.__allamoBootNonBlocking=true;window.__allamoApiPending=0;window.__allamoApiStarted=0;window.__allamoApiCompleted=0;window.__allamoBootSeen={companies:false,projects:false,publicClient:false};window.__allamoBootStarted=Date.now();' +
      'var of=window.fetch.bind(window);' +
      'window.fetch=function(){var a=arguments,u=String((a[0]&&a[0].url)||a[0]||""),api=u.indexOf("/api/")>=0;if(api){window.__allamoApiPending++;window.__allamoApiStarted++;}return of.apply(window,a).finally(function(){if(api){window.__allamoApiPending=Math.max(0,window.__allamoApiPending-1);window.__allamoApiCompleted++;if(/\/api\/companies(?:[?\/]|$)/.test(u))window.__allamoBootSeen.companies=true;if(/\/api\/projects(?:[?\/]|$)/.test(u))window.__allamoBootSeen.projects=true;if(/\/api\/public-client-projects(?:[?\/]|$)/.test(u))window.__allamoBootSeen.publicClient=true;}});};' +
      'window.__allamoRevealWhenReady=function(){if(window.__allamoBootGuardStarted)return;window.__allamoBootGuardStarted=true;var quietSince=0,max=Date.now()+12000;function hasSession(){try{var raw=localStorage.getItem("allamo_session");if(!raw)return false;var s=JSON.parse(raw);return !!(s&&s.token)}catch(_){return false}}function isPublic(){try{return !!new URLSearchParams(location.search).get("cliente")}catch(_){return false}}function ready(){var seen=window.__allamoBootSeen||{};if(isPublic())return !!seen.publicClient;if(hasSession())return !!seen.companies&&!!seen.projects;return true}function ensureBox(){var d=document.getElementById("allamo-boot-status-box");if(d)return d;if(!document.body)return null;d=document.createElement("div");d.id="allamo-boot-status-box";d.setAttribute("role","status");d.textContent="Sincronizando dados…";document.body.appendChild(d);return d}function done(){var d=document.getElementById("allamo-boot-status-box");if(d)d.remove();document.documentElement.classList.add("allamo-ready");window.dispatchEvent(new CustomEvent("allamo:data-ready"))}function fail(){var d=ensureBox();if(!d)return;d.dataset.state="error";d.innerHTML="<span>Não foi possível atualizar todos os dados.</span><button id=\"allamo-boot-retry\">Tentar novamente</button>";var b=document.getElementById("allamo-boot-retry");if(b)b.onclick=function(){location.reload()}}function tick(){ensureBox();var now=Date.now(),p=window.__allamoApiPending||0,r=ready();if(r&&p===0){if(!quietSince)quietSince=now}else quietSince=0;if(quietSince&&now-quietSince>=200){done();return}if(now>=max){if(!hasSession()&&!isPublic()){done();return}fail();return}setTimeout(tick,75)}tick();};' +
      'setTimeout(function(){window.__allamoRevealWhenReady()},0);' +
      '})();' +
      '</' + 'script><script>window.__resources = ' +`;

function mutateTemplate(template){
  const guardedStart="const resourceScript = '<style id=\"allamo-boot-guard\">";
  const tail="<script>window.__resources = ' +";
  const original="const resourceScript = '<script>window.__resources = ' +";
  const s=template.indexOf(guardedStart);

  if(s>=0){
    const e=template.indexOf(tail,s);
    if(e<0)throw new Error('Boot guard existente sem final reconhecível.');
    template=template.slice(0,s)+prefix+template.slice(e+tail.length);
  }else if(template.includes(original)){
    template=template.replace(original,prefix);
  }else if(!template.includes('window.__allamoBootSeen')){
    return {template,changed:false};
  }

  const blocking='body{visibility:'+'hidden!important}';
  if(!template.includes('window.__allamoBootNonBlocking=true'))throw new Error('First paint ainda não está em modo não bloqueante.');
  if(template.includes(blocking))throw new Error('Bloqueio global do body ainda presente.');
  if(!template.includes('window.__allamoBootSeen={companies:false,projects:false,publicClient:false}'))throw new Error('Sincronização não rastreia APIs críticas.');
  if(!template.includes('seen.companies&&!!seen.projects'))throw new Error('Sessão autenticada não rastreia companies/projects.');
  if(!template.includes('return !!seen.publicClient'))throw new Error('Link público não rastreia o contexto da empresa.');
  if(!template.includes('public-client-projects'))throw new Error('Portal público não participa da sincronização inicial.');
  if(!template.includes('window.__allamoBootGuardStarted'))throw new Error('Sincronização não possui proteção contra dupla inicialização.');
  if(!template.includes('setTimeout(function(){window.__allamoRevealWhenReady()},0)'))throw new Error('Sincronização não inicia de forma autônoma.');
  if(!template.includes('allamo-boot-retry'))throw new Error('Fallback recuperável de conectividade ausente.');
  if(!template.includes('Sincronizando dados'))throw new Error('Indicador não bloqueante de sincronização ausente.');
  return {template,changed:true};
}

let cursor=0;
let rebuilt='';
let changed=0;
let blocks=0;

while(true){
  const tagStart=html.indexOf(open,cursor);
  if(tagStart<0){rebuilt+=html.slice(cursor);break;}
  const jsonStart=tagStart+open.length;
  const jsonEnd=html.indexOf(close,jsonStart);
  if(jsonEnd<0)throw new Error('Fechamento de __bundler/template não encontrado.');

  rebuilt+=html.slice(cursor,jsonStart);
  const encoded=html.slice(jsonStart,jsonEnd);
  let template;
  try{template=JSON.parse(encoded)}
  catch(err){throw new Error(`__bundler/template #${blocks+1} já chegou inválido antes do first paint: ${String(err&&err.message||err)}`)}
  if(typeof template!=='string')throw new Error(`__bundler/template #${blocks+1} não é string JSON.`);

  const result=mutateTemplate(template);
  if(result.changed)changed++;
  const serialized=JSON.stringify(result.template).replace(/<\//g,'<\\u002F');
  JSON.parse(serialized);
  rebuilt+=serialized;
  cursor=jsonEnd;
  blocks++;
}

if(!blocks)throw new Error('Nenhum __bundler/template encontrado.');
if(!changed)throw new Error('Template principal do first paint não foi localizado.');
html=rebuilt;

// Validação final de todos os templates antes de gravar.
let checkPos=0,checked=0;
while(true){
  const a=html.indexOf(open,checkPos);if(a<0)break;
  const b=a+open.length,c=html.indexOf(close,b);if(c<0)throw new Error('Template final sem fechamento.');
  JSON.parse(html.slice(b,c));
  checked++;checkPos=c+close.length;
}
if(checked!==blocks)throw new Error('Quantidade de templates mudou durante o first paint.');

fs.writeFileSync(file,html);
console.log('OK: first paint não bloqueante aplicado com integridade JSON preservada.');
