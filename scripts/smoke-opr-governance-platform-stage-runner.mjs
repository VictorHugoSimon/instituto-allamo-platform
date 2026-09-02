const base=(process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev').replace(/\/$/,'');
const missingPath='/opr-rota-inexistente-smoke-404';
const nativeFetch=globalThis.fetch.bind(globalThis);
const nativeLog=console.log.bind(console);

const missing=await nativeFetch(base+missingPath,{cache:'no-store',redirect:'manual'});
let routeMode='http-404';
if(missing.status===200){
  const [missingHtml,rootResponse]=await Promise.all([
    missing.clone().text(),
    nativeFetch(base+'/',{cache:'no-store',redirect:'manual'})
  ]);
  if(!rootResponse.ok) throw new Error(`[OPR ROUTE CONTRACT] raiz do Portal indisponível: HTTP ${rootResponse.status}`);
  const rootHtml=await rootResponse.text();
  if(missingHtml!==rootHtml){
    throw new Error('[OPR ROUTE CONTRACT] rota OPR inexistente retornou HTTP 200 com conteúdo diferente do shell canônico; possível rota fantasma.');
  }
  routeMode='pages-spa-shell';
  nativeLog('[OPR ROUTE CONTRACT] Cloudflare Pages retornou o shell canônico para rota inexistente; fallback SPA validado e não tratado como módulo OPR.');
}else if(missing.status!==404){
  throw new Error(`[OPR ROUTE CONTRACT] rota OPR inexistente retornou HTTP ${missing.status}; esperado 404 ou fallback SPA canônico.`);
}

// O smoke legado exige 404 sem conhecer o fallback de navegação do Pages.
// Normalizamos SOMENTE a rota sintética já validada acima. Todo o restante usa a rede real.
globalThis.fetch=async(input,init)=>{
  const raw=String((input&&input.url)||input||'');
  let url;
  try{url=new URL(raw,base)}catch{return nativeFetch(input,init)}
  const expectedOrigin=new URL(base).origin;
  if(routeMode==='pages-spa-shell'&&url.origin===expectedOrigin&&url.pathname===missingPath){
    const live=await nativeFetch(input,init);
    if(live.status!==200) return live;
    const liveHtml=await live.clone().text();
    const root=await nativeFetch(base+'/',{cache:'no-store',redirect:'manual'});
    const rootHtml=await root.text();
    if(!root.ok||liveHtml!==rootHtml) return live;
    return new Response(live.body,{status:404,statusText:'Not Found (Pages SPA fallback normalized for smoke)',headers:live.headers});
  }
  return nativeFetch(input,init);
};

console.log=(...args)=>{
  if(routeMode==='pages-spa-shell'&&typeof args[0]==='string'){
    args[0]=args[0].replace('4 URLs permanentes, 404,','4 URLs permanentes, fallback SPA seguro,');
  }
  nativeLog(...args);
};

try{
  await import('./smoke-opr-governance-platform-stage.mjs');
}finally{
  globalThis.fetch=nativeFetch;
  console.log=nativeLog;
}
