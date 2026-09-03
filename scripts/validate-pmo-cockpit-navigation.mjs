import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const nav=read('src/pmo-cockpit-navigation.js');
const hardener=read('scripts/harden-pmo-cockpit-navigation.mjs');
const pkg=JSON.parse(read('package.json'));
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};

must(nav,"window.__allamoPmoCockpitNavigationLoaded",'proteção idempotente da navegação');
must(nav,"norm(button.textContent)==='visao executiva'",'âncora exclusiva na Visão Executiva');
must(nav,"link.href='/pmo-cockpit/'",'rota canônica do Cockpit');
must(nav,"link.id=NAV_ID",'identificador único do link');
must(nav,"data-allamo-pmo-nav",'marcador observável da navegação PMO');
must(nav,"MutationObserver",'remontagem resiliente após renderizações do portal');
if(nav.includes('fetch(')||nav.includes('/api/'))throw new Error('Navegação não deve gerar chamadas de API nem alterar dados.');

must(hardener,'<!-- BEGIN ALLAMO PMO COCKPIT NAVIGATION -->','marcador inicial idempotente');
must(hardener,'<!-- END ALLAMO PMO COCKPIT NAVIGATION -->','marcador final idempotente');
must(hardener,"fs.readFileSync(source,'utf8')",'hardener lê a fonte versionada');
must(hardener,"html.replace('</body>',block+'\\n</body>')",'injeção antes do fechamento do body');

const build=String(pkg.scripts?.['build:work']||'');
must(build,'node scripts/harden-pmo-cockpit-navigation.mjs','pipeline principal executa hardening PMO');
console.log('OK: Cockpit Executivo integrado à navegação após Visão Executiva, sem API/mutation e persistente no build.');
