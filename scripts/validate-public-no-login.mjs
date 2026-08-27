import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const portal=read('src/public-client-portal.js');
const layer=read('src/public-client-layer-fix.js');
const portalApi=read('src/public-client-portal-api.js');
const reportsApi=read('src/public-published-reports-api.js');
const richReport=read('src/rich-report-viewer.js');
const loginGuard=read('src/login-interaction-guard.js');
const worker=read('public/_worker.js');
const pkg=JSON.parse(read('package.json'));
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(portal,"params.get('cliente')",'portal público parte da URL cliente');
must(portal,"params.get('projeto')||params.get('project')",'link público pode abrir projeto direto');
must(portal,"public-client-projects?company=",'empresa pública carregada sem sessão');
must(portal,"public-published-reports?company=",'reports públicos por empresa/projeto');
must(portal,"public-published-reports/",'detalhe do report público');
must(portal,"data-allamo-public-client-shell",'shell administrativo oculto no contexto público');
must(portal,"data-pc-report-stage",'área do Report embutido dentro do projeto');
must(portal,"AllamoRichReport.renderInto",'viewer rico reutilizado inline no portal público');
must(portal,"state.reports[0]",'Report mais recente abre automaticamente ao entrar no projeto');
must(richReport,"renderInto(container,report)",'viewer rico oferece modo inline reutilizável');
must(richReport,"arrv-inline",'layout inline preserva tabs executivas do Report');

must(layer,"data-allamo-public-no-user",'modo público não exibe identidade de usuário');
must(layer,'body[data-allamo-public-no-user="1"] > *:not(#allamo-public-client-portal)','chrome interna fica oculta no link público');
if(/localStorage\.removeItem\(['"]allamo_session['"]\)/.test(layer))throw new Error('Portal público não deve apagar a sessão administrativa do navegador.');

must(portalApi,"path==='public-client-projects'",'endpoint público de empresa/projetos');
must(portalApi,'context_locked:true','contexto público travado no tenant resolvido');
if(/currentUser\s*\(|authorization|Bearer\s/i.test(portalApi))throw new Error('API pública de empresa/projetos não pode exigir sessão/token.');

must(reportsApi,"path==='public-published-reports'",'lista pública de reports');
must(reportsApi,"status='PUBLICADO'",'somente reports publicados');
if(/currentUser\s*\(|authorization|Bearer\s/i.test(reportsApi))throw new Error('API pública de reports não pode exigir sessão/token.');

must(loginGuard,"new URLSearchParams(location.search).get('cliente')",'guard de login reconhece link público');
must(loginGuard,'window.__allamoPublicNoLogin=true','link público desativa fluxo de login');

const publicApiPos=worker.indexOf("path==='public-client-projects'");
const authPos=worker.indexOf('const user = await currentUser(request, env)');
if(publicApiPos<0||authPos<0||publicApiPos>authPos)throw new Error('Endpoints públicos precisam executar antes da barreira de autenticação do Worker.');

const build=String(pkg.scripts['build:work']||'');
must(build,'build-work-management.mjs','portal público entra no artefato final');
console.log('OK: link público Empresa/Projeto funciona sem login, sem identidade de usuário, shell interno oculto e Report executivo embutido por projeto.');
