import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const nav=read('src/pmo-cockpit-navigation.js');
const build=read('scripts/build-work-management.mjs');
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};

must(nav,"window.__allamoPmoCockpitNavigationLoaded",'proteção idempotente da navegação');
must(nav,"norm(button.textContent)==='visao executiva'",'âncora exclusiva na Visão Executiva');
must(nav,"link.href='/pmo-cockpit/'",'rota canônica do Cockpit');
must(nav,"link.id=NAV_ID",'identificador único do link');
must(nav,"data-allamo-pmo-nav",'marcador observável da navegação PMO');
must(nav,"MutationObserver",'remontagem resiliente após renderizações do portal');
if(nav.includes('fetch(')||nav.includes('/api/'))throw new Error('Navegação não deve gerar chamadas de API nem alterar dados.');

must(build,"const pmoCockpitNavigation=fs.readFileSync('src/pmo-cockpit-navigation.js','utf8');",'build carrega navegação PMO');
must(build,'${pmoCockpitNavigation}','build injeta navegação PMO no runtime final');

console.log('OK: Cockpit Executivo integrado à navegação após Visão Executiva, sem mutation/API e com montagem idempotente.');
