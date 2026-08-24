const arg = (name, fallback='') => {
  const p = process.argv.find(x => x.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : fallback;
};

const base = arg('base', 'https://allamo-pmo.pages.dev').replace(/\/$/, '');
const release = arg('release', String(Date.now()));
const url = `${base}/?ui_parity=${encodeURIComponent(release)}`;

const response = await fetch(url, {
  cache: 'no-store',
  headers: {
    'cache-control': 'no-cache, no-store, max-age=0',
    'pragma': 'no-cache'
  }
});

if (!response.ok) throw new Error(`Produção não respondeu: HTTP ${response.status}`);
const html = await response.text();

const expected = [
  'Empresas na carteira',
  'Sistema próprio',
  'Com dono definido',
  'Sem responsável',
  '+ Projeto nesta empresa',
  'Acompanhar',
  'Abrir →',
  '↓ Instalar app',
  'Visão Executiva',
  'Trabalho',
  'Reports',
  'Gestão & Ajuda'
];

for (const marker of expected) {
  if (!html.includes(marker)) throw new Error(`Produção está servindo artefato sem: ${marker}`);
}

const cacheControl = response.headers.get('cache-control') || '';
if (!/no-store/i.test(cacheControl)) {
  throw new Error(`HTML de Produção sem no-store. cache-control=${cacheControl || '(ausente)'}`);
}

console.log(`OK: Produção entrega a interface homologada e HTML sem cache persistente (${url}).`);
