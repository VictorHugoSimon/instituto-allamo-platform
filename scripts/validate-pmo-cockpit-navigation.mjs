import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const nav=read('src/pmo-cockpit-navigation.js');
const hardener=read('scripts/harden-pmo-cockpit-navigation.mjs');
const pkg=JSON.parse(read('package.json'));
const html=read('public/index.html');
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};

must(nav,"window.__allamoPmoCockpitNavigationLoaded",'proteção idempotente da navegação');
must(nav,"norm(button.textContent)==='visao executiva'",'âncora exclusiva na Visão Executiva');
must(nav,"link.href='/pmo-cockpit/'",'rota canônica do Cockpit');
must(nav,"link.id=NAV_ID",'identificador único do link');
must(nav,"data-allamo-pmo-nav",'marcador observável da navegação PMO');
must(nav,"MutationObserver",'remontagem resiliente após renderizações do portal');
if(nav.includes('fetch(')||nav.includes('/api/'))throw new Error('Navegação não deve gerar chamadas de API nem alterar dados.');

const start='<!-- BEGIN ALLAMO PMO COCKPIT NAVIGATION -->';
const end='<!-- END ALLAMO PMO COCKPIT NAVIGATION -->';
must(hardener,start,'marcador inicial idempotente');
must(hardener,end,'marcador final idempotente');
must(hardener,"fs.readFileSync(source,'utf8')",'hardener lê a fonte versionada');
must(hardener,"html.replace('</body>',block+'\\n</body>')",'injeção antes do fechamento do body');

const build=String(pkg.scripts?.['build:work']||'');
must(build,'node scripts/harden-pmo-cockpit-navigation.mjs','pipeline principal executa hardening PMO');

must(html,start,'artefato contém marcador inicial da navegação');
must(html,end,'artefato contém marcador final da navegação');
must(html,"link.href='/pmo-cockpit/'",'artefato contém rota canônica do Cockpit');
must(html,'Cockpit Executivo','artefato contém rótulo executivo');
const starts=html.split(start).length-1;
const ends=html.split(end).length-1;
if(starts!==1||ends!==1)throw new Error(`Navegação PMO deveria ter um único bloco; encontrei início=${starts}, fim=${ends}.`);

console.log('OK: Cockpit Executivo integrado após Visão Executiva, sem API/mutation e materializado em um único bloco no build.');
