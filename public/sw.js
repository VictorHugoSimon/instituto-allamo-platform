// service worker — Portal PMO Allamo
// Regra: nunca cachear API nem navegacoes HTML para evitar flash de shell/dados antigos.
const CACHE = 'allamo-pmo-v2';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Dados e documentos de navegacao sempre vem da rede.
  if (url.pathname.startsWith('/api') || e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    e.respondWith(fetch(new Request(e.request, { cache: 'no-store' })));
    return;
  }

  // Apenas assets estaticos podem usar cache como fallback.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
