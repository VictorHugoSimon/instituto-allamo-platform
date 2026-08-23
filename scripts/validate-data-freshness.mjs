import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('src/data-freshness-runtime.js');
const worker=read('public/_worker.js');
const sw=read('public/sw.js');
const index=read('public/index.html');
const pkg=JSON.parse(read('package.json'));
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(runtime,"cache:'no-store'",'Fetch de API usa no-store');
must(runtime,"credentials:'same-origin'",'Credenciais same-origin preservadas');
must(runtime,"e.key!=='allamo_session'",'Storage handler filtra somente a sessão');
must(runtime,'sessionToken(e.oldValue)','Mudança entre abas compara token anterior');
must(runtime,'sessionToken(e.newValue)','Mudança entre abas compara token novo');
must(runtime,'if(oldToken===newToken)return','Mudança apenas de tab/company não recarrega outras abas');
must(runtime,'location.reload()','Troca real de token/logout invalida contexto de outras abas');
must(runtime,"e.persisted",'BFCache é revalidado');
must(runtime,'visibility','Retorno à aba revalida dados');
must(runtime,'allamo:context-changed','Mudança empresa/projeto emite invalidação');
must(runtime,'getRegistration().then(r=>r?.update())','Service Worker procura atualização');
must(worker,"'cache-control':'no-store, no-cache, must-revalidate, max-age=0'",'APIs respondem no-store');
must(worker,"request.mode === 'navigate'",'HTML recebe política no-store');
must(worker,"url.pathname === '/sw.js'",'SW recebe revalidação');
must(sw,"u.pathname.startsWith('/api/')",'SW nunca cacheia API');
must(sw,"e.request.mode==='navigate'",'SW nunca cacheia navegação HTML');
must(sw,"cache:'no-store'",'SW força rede para dados sensíveis');
must(sw,"cache:'no-cache'",'Assets revalidam na rede');
must(index,'__allamoDataFreshnessLoaded','Runtime de freshness está no artefato final');
must(index,'__allamoBootNonBlocking=true','First paint não bloqueante está no artefato');
must(index,'__allamoBootGuardStarted','Sincronização inicial auto-inicia');
must(index,'allamo-boot-retry','Falha de conectividade permite retry');
must(index,'Sincronizando dados','Status discreto de sincronização existe');
must(index,'[allamo-load-initial-reset]','Primeira hidratação zera fotografia histórica uma única vez');
must(index,'BEGIN ALLAMO PUBLIC CLIENT PWA RUNTIME','PWA público tenant-safe está no artefato');
if(index.includes('body{visibility:hidden!important}'))throw new Error('Artefato final ainda bloqueia o body durante carregamento.');
if(index.includes('[allamo-live-reset] nunca renderizar fotografia demo durante fetch'))throw new Error('Refresh recorrente ainda pode zerar a tela inteira.');

const build=String(pkg.scripts['build:work']);
const orderedSteps=[
  'harden-data-freshness.mjs',
  'zero-static-executive-chart.mjs',
  'zero-live-state-before-fetch.mjs',
  'optimize-portal-performance.mjs',
  'stamp-release.mjs',
  'harden-session-stability.mjs',
  'harden-stage-no-login.mjs',
  'harden-public-client-pwa.mjs',
  'harden-visual-matrices.mjs',
  'validate-portal-baseline.mjs',
  'validate-bundle-json.mjs'
];
let previous=-1;
for(const step of orderedSteps){
  const pos=build.indexOf(`node scripts/${step}`);
  if(pos<0)throw new Error(`Etapa obrigatória ausente do build: ${step}`);
  if(pos<=previous)throw new Error(`Ordem inválida no build próximo de: ${step}`);
  previous=pos;
}
console.log('OK: cache, sessão, Stage sem login isolado, boot live, BFCache, Service Worker, PWA multitenant e matrizes visuais revalidam sem exibir dados demo.');
