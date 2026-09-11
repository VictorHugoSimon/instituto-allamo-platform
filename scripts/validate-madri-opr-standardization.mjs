import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.resolve(root,p),'utf8');
const exists=p=>fs.existsSync(path.resolve(root,p));
const fail=m=>{console.error('[MADRI × OPR STANDARD] '+m);process.exitCode=1};
const ok=m=>console.log('[OK] '+m);
const must=(cond,m)=>cond?ok(m):fail(m);

const routes=[
  ['01','/madri/','public/madri/index.html'],['02','/madri-blueprint/','public/madri-blueprint/index.html'],['03','/madri-plano-de-acao/','public/madri-plano-de-acao/index.html'],['04','/madri-requisitos/','public/madri-requisitos/index.html'],['05','/madri-integracoes/','public/madri-integracoes/index.html'],['06','/madri-riscos/','public/madri-riscos/index.html'],['07','/madri-mapa-implantacao/','public/madri-mapa-implantacao/index.html'],['08','/madri-plano-testes/','public/madri-plano-testes/index.html'],['09','/madri-defeitos/','public/madri-defeitos/index.html'],['10','/madri-readiness/','public/madri-readiness/index.html'],['11','/madri-decisoes/','public/madri-decisoes/index.html'],['12','/madri-status-report/','public/madri-status-report/index.html'],['13','/madri-pop/','public/madri-pop/index.html'],['14','/madri-documentos/','public/madri-documentos/index.html'],['15','/madri-biblioteca/','public/madri-biblioteca/index.html']
];
for(const [n,url,file] of routes)must(exists(file),`${n} ${url} possui arquivo permanente`);

const platform=read('public/madri/assets/platform.js');
for(const [n,url] of routes)must(platform.includes(url),`menu MADRI contém ${n} ${url}`);
for(const label of ['Início','Entender e planejar','Executar e controlar','Validar e decidir','Governança e conhecimento'])must(platform.includes(label),`grupo de navegação presente: ${label}`);
must(platform.includes('Portal único de Governança'),'branding MADRI usa Portal único');
must(!platform.includes('/api/opr-')&&!platform.includes('/api/opr/'),'runtime MADRI não chama API OPR');
must(platform.includes('/api/madri-platform/status-report'),'runtime prioriza Status Report MADRI D1');

const css=read('public/madri/assets/platform.css');
for(const token of ['--char:#302f39','--copper:#b88b78','grid-template-columns:272px 1fr','scroll-behavior:smooth'])must(css.includes(token),`Design System corporativo contém ${token}`);

const portal=read('public/madri/index.html');
must(portal.includes('Portal Único de Governança'),'Portal MADRI segue composição executiva OPR');
must(portal.includes('Dados MADRI ≠ dados OPR'),'Portal explicita isolamento de conteúdo');
must(!portal.includes('/api/opr-')&&!portal.includes('opr_requirements'),'Portal MADRI não depende de dados OPR');
must(portal.includes('summary')&&portal.includes('requirements')&&portal.includes('integrations')&&portal.includes('tests'),'Portal consome resumo operacional D1');

const blueprint=read('public/madri-blueprint/index.html');
must(blueprint.includes('Business Blueprint MADRI × NUCCI'),'Blueprint MADRI é conteúdo próprio');
must(blueprint.includes('19sL6D6CdJC53wUMenHZGw2aJi8N1argH'),'Blueprint aponta para documento MADRI localizado');

const controlled=['public/madri-requisitos/index.html','public/madri-integracoes/index.html','public/madri-riscos/index.html','public/madri-plano-testes/index.html','public/madri-defeitos/index.html','public/madri-readiness/index.html','public/madri-decisoes/index.html','public/madri-documentos/index.html'];
for(const file of controlled){const s=read(file);must(!/localStorage|sessionStorage/.test(s),`${file} não usa storage local como fonte`);must(!/\/api\/opr-|opr_requirements|opr_risks|opr_integrations/i.test(s),`${file} não referencia backend OPR`);must(s.includes('/madri/assets/entity-page.js'),`${file} usa runtime CRUD MADRI compartilhado`)}
const entity=read('public/madri/assets/entity-page.js');
must(entity.includes('/api/madri-platform/'),'CRUD compartilhado usa API MADRI dedicada');
must(!/localStorage|sessionStorage/.test(entity),'CRUD compartilhado não persiste no navegador');

const report=read('public/madri-status-report/index.html');
for(const tab of ['1 · Executivo','2 · Atenções & Decisões','3 · Próximos Marcos','4 · Cadência & Governança'])must(report.includes(tab),`Status Report contém aba ${tab}`);
must(report.includes('/api/madri-platform/status-report'),'Status Report deriva da API MADRI D1');
must(report.includes('/api/madri-platform/phases')&&report.includes('/api/madri-platform/readiness'),'Status Report usa marcos/readiness MADRI');
must(!report.includes('http-equiv="refresh"'),'Status Report permanente não redireciona para artefato legado');

const migration=read('migrations/2026-09-08-madri-governance-platform.sql');
const govApi=read('src/madri-governance-platform-api.js');
const ensureMadri=read('scripts/ensure-madri-governance-schema.mjs');
for(const table of ['madri_requirements','madri_risks','madri_integrations','madri_tests','madri_test_defects','madri_documents','madri_document_versions','madri_implementation_phases','madri_readiness','madri_decisions','madri_platform_audit'])must(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`schema dedicado contém ${table}`);
for(const route of ['madri-platform/context','madri-platform/status-report','madri-platform/bootstrap'])must(govApi.includes(route),`API Governance contém ${route}`);
must(govApi.includes("pmo_scope='MADRI_NUCCI'"),'Status Report D1 isola ações pelo escopo MADRI_NUCCI');
must(govApi.includes('Teste só pode ser Aprovado'),'API aplica regra de aceite de teste com evidência');
must(govApi.includes('Não armazene segredo'),'API impede armazenamento explícito de segredo em integrações');
must(ensureMadri.includes('2026-09-08-madri-governance-platform.sql'),'ensure MADRI aponta para a migration vigente');

const builder=read('scripts/build-madri-pmo.mjs');
must(builder.includes('stripAllBlocks'),'Builder remove todos os blocos MADRI antigos antes de injetar');
must(builder.includes('privateBundle'),'PMO privado + Governance usam bloco canônico único');

const library=read('public/madri-biblioteca/index.html');
must(library.includes('NUCCI')||library.includes('MADRI'),'Biblioteca contém contexto MADRI');
must(library.includes('118d2JXc_GG5Yhj1rVHAH1MkC-BpXjSbj'),'Biblioteca aponta para o repositório mestre verificado no Drive');
must(library.includes('1wFwqNfuak-jv6ZYVzxL6JBnJwbz4Ldlc'),'Biblioteca preserva a pasta específica RFP / 01. Madri');
must(/repositório[^<]{0,80}compartilhado|compartilhado[^<]{0,80}repositório/i.test(library),'Biblioteca identifica explicitamente o repositório compartilhado MADRI/OPR');
must(library.includes('Documentos OPR não devem ser apresentados como MADRI'),'Biblioteca impede uso de documentos OPR como evidência MADRI');
must(library.includes('Implantação NUCCI ERP'),'Biblioteca mantém vínculo explícito com o projeto MADRI/NUCCI');

if(process.exitCode)process.exit(process.exitCode);
console.log('MADRI × padrão OPR: rotas, Design System, D1, CRUD, testes, Status Report, Biblioteca e isolamento validados.');
