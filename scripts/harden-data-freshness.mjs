import fs from 'node:fs';

const workerFile='public/_worker.js';
let worker=fs.readFileSync(workerFile,'utf8');

const jsonOld="const json = (data, status = 200) =>\n  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });";
const jsonNew="const json = (data, status = 200) =>\n  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control':'no-store, no-cache, must-revalidate, max-age=0', 'pragma':'no-cache', 'expires':'0', 'vary':'authorization, cookie' } });";
if(worker.includes(jsonOld))worker=worker.replace(jsonOld,jsonNew);
if(!worker.includes("'cache-control':'no-store, no-cache, must-revalidate, max-age=0'"))throw new Error('Headers no-store não aplicados ao JSON das APIs.');

const assetOld="    // qualquer outra rota → serve os arquivos estáticos (o site)\n    return env.ASSETS.fetch(request);";
const assetNew=`    // HTML, manifesto e Service Worker sempre revalidam; assets restantes podem ser cacheados pelo navegador com revalidação.\n    const asset = await env.ASSETS.fetch(request);\n    const headers = new Headers(asset.headers);\n    if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {\n      headers.set('cache-control','no-store, no-cache, must-revalidate, max-age=0');\n      headers.set('pragma','no-cache');\n      headers.set('expires','0');\n    } else if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') {\n      headers.set('cache-control','no-cache, must-revalidate, max-age=0');\n    } else {\n      headers.set('cache-control','public, max-age=300, must-revalidate');\n    }\n    return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});`;
if(worker.includes(assetOld))worker=worker.replace(assetOld,assetNew);
if(!worker.includes("request.mode === 'navigate'")||!worker.includes("url.pathname === '/sw.js'"))throw new Error('Política de cache dos assets não aplicada.');
fs.writeFileSync(workerFile,worker);

const swFile='public/sw.js';
const sw=`// service worker — Portal PMO Allamo\n// Dados, HTML e navegação nunca usam cache persistente. Assets usam network-first com revalidação.\nconst CACHE='allamo-pmo-static-v3';\nself.addEventListener('install',e=>{self.skipWaiting()});\nself.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});\nself.addEventListener('fetch',e=>{\n const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;\n const sensitive=u.pathname.startsWith('/api/')||u.pathname==='/api'||e.request.mode==='navigate'||u.pathname==='/'||u.pathname.endsWith('/index.html')||u.pathname==='/manifest.webmanifest';\n if(sensitive){e.respondWith(fetch(new Request(e.request,{cache:'no-store'})));return}\n if(u.pathname==='/sw.js'){e.respondWith(fetch(new Request(e.request,{cache:'reload'})));return}\n e.respondWith((async()=>{try{const r=await fetch(new Request(e.request,{cache:'no-cache'}));if(r.ok){const c=await caches.open(CACHE);await c.put(e.request,r.clone())}return r}catch(_){return (await caches.match(e.request))||Response.error()}})());\n});\n`;
fs.writeFileSync(swFile,sw);

console.log('OK: APIs/HTML sem cache, Service Worker network-first e assets com revalidação.');
