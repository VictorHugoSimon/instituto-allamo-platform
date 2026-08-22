import fs from 'node:fs';

const file='public/index.html';
let html=fs.readFileSync(file,'utf8');

// O bundle armazena código em diferentes blocos <script type="__bundler/...">.
// Nunca fazemos replace diretamente no JSON serializado: parseamos cada bloco,
// alteramos strings já decodificadas e reserializamos com JSON.stringify.
const prefix=String.raw`const resourceScript = '<style id="allamo-boot-guard">#allamo-boot-status-box{position:fixed;left:16px;bottom:16px;z-index:2147483000;background:#302f39;color:#fff;border-radius:999px;padding:8px 12px;font:700 12px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 28px #1018282e;display:flex;gap:8px;align-items:center;max-width:min(460px,calc(100vw - 32px))}#allamo-boot-status-box[data-state="error"]{background:#b42318;border-radius:12px}#allamo-boot-retry{border:1px solid #ffffff55;border-radius:7px;background:#fff;color:#302f39;padding:5px 8px;font-weight:800;cursor:pointer}</style><script>' +
      '(function(){' +
      'window.__allamoLegacyLoadingLabel="Carregando dados do Portal PMO";window.__allamoBootNonBlocking=true;window.__allamoApiPending=0;window.__allamoApiStarted=0;window.__allamoApiCompleted=0;window.__allamoBootSeen={companies:false,projects:false,publicClient:false};window.__allamoBootStarted=Date.now();' +
      'var of=window.fetch.bind(window);' +
      'window.fetch=function(){var a=arguments,u=String((a[0]&&a[0].url)||a[0]||""),api=u.indexOf("/api/")>=0;if(api){window.__allamoApiPending++;window.__allamoApiStarted++;}return of.apply(window,a).finally(function(){if(api){window.__allamoApiPending=Math.max(0,window.__allamoApiPending-1);window.__allamoApiCompleted++;if(/\/api\/companies(?:[?\/]|$)/.test(u))window.__allamoBootSeen.companies=true;if(/\/api\/projects(?:[?\/]|$)/.test(u))window.__allamoBootSeen.projects=true;if(/\/api\/public-client-projects(?:[?\/]|$)/.test(u))window.__allamoBootSeen.publicClient=true;}});};' +
      'window.__allamoRevealWhenReady=function(){if(window.__allamoBootGuardStarted)return;window.__allamoBootGuardStarted=true;var quietSince=0,max=Date.now()+12000;function hasSession(){try{var raw=localStorage.getItem("allamo_session");if(!raw)return false;var s=JSON.parse(raw);return !!(s&&s.token)}catch(_){return false}}function isPublic(){try{return !!new URLSearchParams(location.search).get("cliente")}catch(_){return false}}function ready(){var seen=window.__allamoBootSeen||{};if(isPublic())return !!seen.publicClient;if(hasSession())return !!seen.companies&&!!seen.projects;return true}function ensureBox(){var d=document.getElementById("allamo-boot-status-box");if(d)return d;if(!document.body)return null;d=document.createElement("div");d.id="allamo-boot-status-box";d.setAttribute("role","status");d.textContent="Sincronizando dados…";document.body.appendChild(d);return d}function done(){var d=document.getElementById("allamo-boot-status-box");if(d)d.remove();document.documentElement.classList.add("allamo-ready");window.dispatchEvent(new CustomEvent("allamo:data-ready"))}function fail(){var d=ensureBox();if(!d)return;d.dataset.state="error";d.innerHTML="<span>Não foi possível atualizar todos os dados.</span><button id=\"allamo-boot-retry\">Tentar novamente</button>";var b=document.getElementById("allamo-boot-retry");if(b)b.onclick=function(){location.reload()}}function tick(){ensureBox();var now=Date.now(),p=window.__allamoApiPending||0,r=ready();if(r&&p===0){if(!quietSince)quietSince=now}else quietSince=0;if(quietSince&&now-quietSince>=200){done();return}if(now>=max){if(!hasSession()&&!isPublic()){done();return}fail();return}setTimeout(tick,75)}tick();};' +
      'setTimeout(function(){window.__allamoRevealWhenReady()},0);' +
      '})();' +
      '</' + 'script><script>window.__resources = ' +`;

function mutateText(text){
  const guardedStart="const resourceScript = '<style id=\"allamo-boot-guard\">";
  const tail="<script>window.__resources = ' +";
  const original="const resourceScript = '<script>window.__resources = ' +";
  const s=text.indexOf(guardedStart);

  if(s>=0){
    const e=text.indexOf(tail,s);
    if(e<0)throw new Error('Boot guard existente sem final reconhecível.');
    return {value:text.slice(0,s)+prefix+text.slice(e+tail.length),changed:true};
  }
  if(text.includes(original))return {value:text.replace(original,prefix),changed:true};
  return {value:text,changed:false};
}

function walk(value){
  if(typeof value==='string')return mutateText(value);
  if(Array.isArray(value)){
    let changed=false;
    const out=value.map(v=>{const r=walk(v);changed=changed||r.changed;return r.value});
    return {value:out,changed};
  }
  if(value&&typeof value==='object'){
    let changed=false;const out={};
    for(const [k,v] of Object.entries(value)){const r=walk(v);changed=changed||r.changed;out[k]=r.value}
    return {value:out,changed};
  }
  return {value,changed:false};
}

const tagRe=/<script type="(__bundler\/[^"]+)">/g;
let cursor=0,rebuilt='',changedCount=0,blockCount=0,m;

while((m=tagRe.exec(html))){
  const tagStart=m.index;
  const jsonStart=tagRe.lastIndex;
  const jsonEnd=html.indexOf('</script>',jsonStart);
  if(jsonEnd<0)throw new Error(`Fechamento de ${m[1]} não encontrado.`);

  // Conteúdo fora de blocos JSON pode conter o runtime como JS normal.
  const outside=html.slice(cursor,tagStart);
  const outsideResult=mutateText(outside);
  if(outsideResult.changed)changedCount++;
  rebuilt+=outsideResult.value+html.slice(tagStart,jsonStart);

  const raw=html.slice(jsonStart,jsonEnd);
  let parsed;
  try{parsed=JSON.parse(raw)}
  catch(err){throw new Error(`${m[1]} já chegou inválido antes do first paint: ${String(err&&err.message||err)}`)}

  const result=walk(parsed);
  if(result.changed)changedCount++;
  const serialized=JSON.stringify(result.value).replace(/<\//g,'<\\u002F');
  JSON.parse(serialized);
  rebuilt+=serialized;

  cursor=jsonEnd;
  tagRe.lastIndex=jsonEnd+'</script>'.length;
  blockCount++;
}

const outsideTail=html.slice(cursor);
const tailResult=mutateText(outsideTail);
if(tailResult.changed)changedCount++;
rebuilt+=tailResult.value;
html=rebuilt;

if(!blockCount)throw new Error('Nenhum bloco __bundler/* encontrado.');
if(!changedCount&&!html.includes('window.__allamoBootNonBlocking=true'))throw new Error('Runtime de first paint não foi localizado.');

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

// Segunda passagem: todo bloco JSON do bundler precisa continuar parseável.
tagRe.lastIndex=0;
while((m=tagRe.exec(html))){
  const a=tagRe.lastIndex,b=html.indexOf('</script>',a);
  if(b<0)throw new Error(`Fechamento final de ${m[1]} não encontrado.`);
  try{JSON.parse(html.slice(a,b))}
  catch(err){throw new Error(`${m[1]} ficou inválido após first paint: ${String(err&&err.message||err)}`)}
  tagRe.lastIndex=b+'</script>'.length;
}

fs.writeFileSync(file,html);
console.log('OK: first paint aplicado sem editar JSON serializado diretamente; integridade do bundle preservada.');
