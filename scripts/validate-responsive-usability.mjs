import fs from 'node:fs';
const responsive=fs.readFileSync('src/responsive-usability.js','utf8');
const admin=fs.readFileSync('src/report-admin-navigation.js','utf8');
const raci=fs.readFileSync('src/raci-visual.js','utf8');
const watchdog=fs.readFileSync('src/post-unpack-watchdog.js','utf8');
const build=fs.readFileSync('scripts/build-work-management.mjs','utf8');
const index=fs.readFileSync('public/index.html','utf8');
new Function(responsive);new Function(admin);new Function(raci);new Function(watchdog);
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
for(const [n,l] of [
  ['width=device-width','viewport responsivo'],['100dvh','altura móvel segura'],['allamo-report-editor','editor de report responsivo'],['allamo-responsive-modal-box','modal responsivo'],['overflow-x:auto','scroll horizontal controlado'],['@media(max-width:767px)','breakpoint mobile'],['@media(max-width:1023px)','breakpoint tablet'],['removeFloatingLaunchers','remoção defensiva dos launchers']
])must(responsive,n,l);
for(const [n,l] of [
  ['Central de Reports','central administrativa'],['acompanhar report','interceptação por projeto'],["txt==='acompanhar'",'interceptação por empresa'],['data-open-legacy-report','acesso ao report principal'],['+ Novo report','orientação para novos reports'],['role','acessibilidade por teclado']
])must(admin,n,l);
for(const [n,l] of [
  ['Visualização RACI','preview visual'],['allamo-raci-r','cor R'],['allamo-raci-a','cor A'],['allamo-raci-c','cor C'],['allamo-raci-i','cor I'],['Responsável','legenda R'],['Accountable','legenda A']
])must(raci,n,l);
for(const f of ['src/report-admin-navigation.js','src/raci-visual.js','src/responsive-usability.js'])must(build,f,'injeção '+f);
if(/launcher\('awm-launcher'|launcher\('arm-launcher'/.test(watchdog))throw new Error('Watchdog ainda recria launchers flutuantes.');
if(build.includes("b.id='awm-launcher'")||build.includes("r.id='arm-launcher'"))throw new Error('Build ainda cria launchers flutuantes.');
for(const marker of ['__allamoResponsiveUsabilityLoaded','__allamoReportAdminNavLoaded','__allamoRaciVisualLoaded'])must(index,marker,'artefato final '+marker);
if(!index.includes('Central de Reports'))throw new Error('Artefato final sem central de Reports.');
console.log('OK: responsividade desktop/mobile, scroll, Central de Reports, RACI colorido e remoção dos launchers validados no artefato final.');
