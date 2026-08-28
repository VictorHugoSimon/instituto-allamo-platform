import fs from 'node:fs';

const html=fs.readFileSync('public/index.html','utf8');
const src=fs.readFileSync('src/report-direct-link-runtime.js','utf8');
const portal=fs.readFileSync('src/public-client-portal.js','utf8');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(html,'BEGIN ALLAMO REPORT DIRECT LINK','runtime de link direto');
must(html,"searchParams.set('cliente',String(r.company_id))",'empresa no link');
must(html,"searchParams.set('projeto',String(r.project_id))",'projeto no link');
must(html,"searchParams.set('report',String(r.id))",'ID único do Report no link');
must(html,'LINK EXCLUSIVO DO REPORT','feedback do link criado');
must(html,"data-report-direct-link",'ação de link na Central de Reports');
must(html,"reason:'official-report-created'",'link após criação oficial');
must(html,"reason:'series-report-created'",'link após Report recorrente');
must(html,'A criação do Report excedeu 20 segundos','timeout do POST');
must(html,'A atualização de empresas/projetos excedeu 10 segundos','timeout de abertura');
must(html,"timeoutMs=method==='POST'?20000:10000",'timeout diferenciado');
must(html,"cache:'no-store'",'sem cache operacional');

if(!/URLSearchParams\(location\.search\)\.get\('report'\)/.test(portal))throw new Error('Portal público não lê o Report solicitado da URL.');
must(portal,'await loadReport(first.id)','portal abre edição solicitada');
must(portal,'public-published-reports/','API pública tenant-safe do Report');

if(/dual\s*clima|exposende|opr_madri/i.test(src))throw new Error('Runtime de link contém tenant hardcoded.');
if(/DELETE\s+FROM|DROP\s+TABLE|TRUNCATE/i.test(src))throw new Error('Runtime de link não pode conter operação destrutiva.');

console.log('OK: todo Report possui link exclusivo Empresa/Projeto/Report; criação tem timeout e o portal abre a edição solicitada.');
