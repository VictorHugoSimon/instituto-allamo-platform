(()=>{
  if(window.__allamoDataFreshnessLoaded)return;
  window.__allamoDataFreshnessLoaded=true;

  const isApi=u=>{try{const x=new URL(String(u),location.href);return x.origin===location.origin&&x.pathname.startsWith('/api/')}catch(_){return false}};
  const methodOf=(input,init)=>String(init?.method||input?.method||'GET').toUpperCase();
  const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
  const refresh=(reason)=>{emit('allamo:data-changed',{reason});emit('allamo:reports-changed',{reason});emit('allamo:context-refresh',{reason})};
  const currentContext=()=>{const p=new URLSearchParams(location.search),pub=p.get('cliente')||'';if(pub)return `public:${pub}:${p.get('projeto')||p.get('project')||''}`;let s={};try{s=JSON.parse(localStorage.getItem('allamo_session')||'{}')}catch(_){}const c=window.__allamoReportContext||{};return `auth:${s.role||''}:${s.company_id||s.company||''}:${c.company||''}:${c.project||''}`};

  // APIs do Portal nunca usam cache HTTP/browser. Cookies futuros continuam same-origin,
  // mas identidade e tenant seguem o token/contexto explícito do Portal.
  const previousFetch=window.fetch.bind(window);
  window.fetch=function(input,init={}){
    const raw=String((input&&input.url)||input||''),api=isApi(raw),method=methodOf(input,init);
    if(!api)return previousFetch(input,init);
    const headers=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(init.headers||{}).forEach((v,k)=>headers.set(k,v));
    headers.set('cache-control','no-cache, no-store, max-age=0');
    headers.set('pragma','no-cache');
    const next={...init,headers,cache:'no-store',credentials:'same-origin'};
    return previousFetch(input,next).then(res=>{
      if(res.ok&&!['GET','HEAD','OPTIONS'].includes(method))setTimeout(()=>refresh(`write:${method}`),20);
      return res;
    });
  };

  // O localStorage é compartilhado entre abas. Alterar somente tab/company não pode
  // recarregar outras abas nem derrubar edições em andamento. Só troca real do token
  // (novo login) ou remoção da sessão (logout) exige reload entre abas.
  const sessionToken=value=>{try{return String(JSON.parse(value||'{}')?.token||'')}catch(_){return ''}};
  window.addEventListener('storage',e=>{
    if(e.key!=='allamo_session'||e.oldValue===e.newValue)return;
    const oldToken=sessionToken(e.oldValue),newToken=sessionToken(e.newValue);
    if(oldToken===newToken)return;
    try{sessionStorage.removeItem('allamo_last_context')}catch(_){}
    location.reload();
  });

  // BFCache pode restaurar uma tela inteira antiga. Mantém shell, mas força revalidação live.
  window.addEventListener('pageshow',e=>{if(e.persisted)refresh('bfcache')});

  let hiddenAt=0;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();return}
    if(hiddenAt&&Date.now()-hiddenAt>15000)refresh('visibility');
    hiddenAt=0;
  });
  window.addEventListener('focus',()=>{
    const last=Number(sessionStorage.getItem('allamo_last_focus_refresh')||0),now=Date.now();
    if(now-last>30000){sessionStorage.setItem('allamo_last_focus_refresh',String(now));refresh('focus')}
  });
  window.addEventListener('online',()=>refresh('online'));

  // Mudanças de URL/empresa/projeto invalidam a visão anterior imediatamente.
  let context=currentContext();
  const checkContext=()=>{const n=currentContext();if(n!==context){const old=context;context=n;try{sessionStorage.setItem('allamo_last_context',n)}catch(_){}emit('allamo:context-changed',{oldContext:old,newContext:n});refresh('context')}};
  for(const name of ['pushState','replaceState']){const original=history[name];history[name]=function(){const r=original.apply(this,arguments);setTimeout(checkContext,0);return r}}
  window.addEventListener('popstate',()=>setTimeout(checkContext,0));
  window.addEventListener('allamo:reports-changed',()=>setTimeout(checkContext,0));

  // Sempre procura atualização do Service Worker; sem recarregar à força no meio de uma edição.
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistration().then(r=>r?.update()).catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',()=>refresh('service-worker'));
  }

  try{sessionStorage.setItem('allamo_last_context',context)}catch(_){}
})();
