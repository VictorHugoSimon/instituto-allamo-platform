import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const fail=m=>{throw new Error('[OPR PLATFORM VALIDATION] '+m)},read=f=>fs.readFileSync(f,'utf8'),has=(t,x,m)=>{if(!t.includes(x))fail(m||`Ausente: ${x}`)};
const check=f=>{const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)fail(`${f} inválido: ${r.stderr||r.stdout}`)};
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const checkFragment=f=>{try{new AsyncFunction('request','url','path','DB','user','scope','env','json','logEvent',read(f))}catch(e){fail(`${f} inválido no contexto async do Worker: ${e.message}`)}};
['src/opr-governance-platform-api.js','src/opr-permanent-report-api.js','src/opr-pop-versioning-api.js','src/opr-action-v2-api.js'].forEach(checkFragment);['scripts/harden-opr-governance-platform.mjs','scripts/harden-opr-action-v2.mjs','scripts/harden-opr-plan-v2-ui.mjs','scripts/harden-opr-pop.mjs','public/opr/assets/platform.js','public/opr/assets/entity-page.js'].forEach(check);

const migration=read('migrations/2026-09-01-opr-governance-platform.sql');for(const t of ['opr_platform_sequence','opr_platform_audit','opr_requirements','opr_risks','opr_integrations','opr_tests','opr_test_defects','opr_documents','opr_document_versions','opr_implementation_phases','opr_readiness','opr_decisions'])has(migration,`CREATE TABLE IF NOT EXISTS ${t}`,`Tabela ${t} ausente`);for(const x of ['company_id TEXT NOT NULL','project_id INTEGER NOT NULL','archived_at TEXT'])has(migration,x);
const popVersionMigration=read('migrations/2026-09-01-opr-pop-versioning.sql');for(const x of ['CREATE TABLE IF NOT EXISTS opr_pop_versions','BASELINE_MIGRATION','trg_opr_pop_version_init','trg_opr_pop_version_insert','trg_opr_pop_version_update','STATUS_CHANGE','SOFT_DELETE','RESTORE','content_json'])has(popVersionMigration,x,`Versionamento POP incompleto: ${x}`);

const api=read('src/opr-governance-platform-api.js');for(const x of ["path==='opr-platform/bootstrap'","path==='opr-platform/summary'","path==='opr-platform/status-report'","opr-platform/audit","expected_met","Teste só pode ser Aprovado","NO-GO","credential_ref"])has(api,x);for(const e of ['requirements','risks','integrations','tests','defects','documents','phases','readiness','decisions'])has(api,`${e}:{table:`,`Entidade API ausente: ${e}`);
const reportApi=read('src/opr-permanent-report-api.js');for(const x of ["path==='opr-platform/status-report'",'work_items w JOIN opr_action_meta','w.project_id=? AND w.company_id=?','source_of_truth','operational_completion_pct','NO-GO'])has(reportApi,x,`API permanente do report incompleta: ${x}`);
const popVersionApi=read('src/opr-pop-versioning-api.js');for(const x of ["path==='opr-pop-versions'",'opr_pop_versions','project_id=?','Endpoint exclusivo da OPR'])has(popVersionApi,x,`API versões POP incompleta: ${x}`);

const action=read('src/opr-action-v2-api.js');for(const x of ['PA-','display_id','subfront','supporters','criticality','risk_text','classification','acceptance_criteria','Atrasado exige prazo formal vencido','STATUS_CHANGE','SOFT_DELETE','RESTORE','w.project_id=? AND w.company_id=?'])has(action,x,`Plano v2 incompleto: ${x}`);
const schema=read('scripts/ensure-additive-schema.mjs');for(const x of ['2026-09-01-opr-governance-platform.sql','2026-09-01-opr-pop-versioning.sql','opr_pop_versions','opr_platform_sequence','display_id','acceptance_criteria','idx_opr_action_display_id'])has(schema,x);

const pkg=JSON.parse(read('package.json'));for(const x of ['harden-opr-governance-platform.mjs','harden-opr-action-v2.mjs','harden-opr-plan-v2-ui.mjs','harden-opr-pop.mjs'])has(pkg.scripts['build:work'],x);has(pkg.scripts['test:release'],'test:opr-platform');if(!pkg.scripts['smoke:opr-platform'])fail('smoke:opr-platform ausente');

const official=[
  ['public/opr-plano-de-acao/index.html','/opr-plano-de-acao/'],
  ['public/opr-status-report/index.html','/opr-status-report/'],
  ['public/opr-pop/index.html','/opr-pop/'],
  ['public/opr-mapa-implantacao/index.html','/opr-mapa-implantacao/']
];for(const [f] of official)if(!fs.existsSync(f))fail(`Link oficial sem página: ${f}`);
const pages=['public/opr/index.html','public/opr-mapa-implantacao/index.html','public/opr-requisitos/index.html','public/opr-plano-testes/index.html','public/opr-status-report/index.html','public/opr-riscos/index.html','public/opr-integracoes/index.html','public/opr-documentos/index.html'];for(const f of pages){if(!fs.existsSync(f))fail(`Página ausente: ${f}`);const t=read(f);has(t,'/opr/assets/platform.css');has(t,'/opr/assets/platform.js');if(/localStorage|sessionStorage/.test(t))fail(`${f} usa storage de navegador como dado`)}for(const f of ['public/opr/assets/platform.js','public/opr/assets/entity-page.js'])if(/localStorage|sessionStorage/.test(read(f)))fail(`${f} usa storage de navegador`);

const shared=read('public/opr/assets/platform.js');for(const u of ['/opr-plano-de-acao/','/opr-status-report/','/opr-pop/','/opr-mapa-implantacao/'])has(shared,u,`URL oficial permanente ausente da navegação: ${u}`);has(shared,'Links oficiais permanentes');if(/opr-(?:status|plano|pop|mapa)[^'"\s]*\d{2}[-_/]\d{2}/i.test(shared))fail('Navegação contém URL oficial datada/versionada');

const tests=read('public/opr-plano-testes/index.html');for(const x of ['SIT','UAT','E2E','P1','Aprovado','Defeitos','Go/No-Go'])has(tests,x);
const map=read('public/opr-mapa-implantacao/index.html');for(const x of ['Stage-Gate','Swimlane','REQUISITO','STD / CFG / DEV / INT','ACEITE'])has(map,x);
const report=read('public/opr-status-report/index.html');has(report,'api/opr-platform/status-report');for(const x of ['1 · Executivo','2 · Atenções & Decisões','3 · Próximos Marcos','4 · Cadência & Governança','Total de ações','Planejado','Em andamento','Atrasado','Concluído'])has(report,x,`Status Report oficial incompleto: ${x}`);if((report.match(/class="report-tab/g)||[]).length!==4)fail('Status Report deve possuir exatamente quatro abas executivas');if(/localStorage|sessionStorage/.test(report))fail('Status Report usa storage do navegador como fonte');
const integrations=read('public/opr-integracoes/index.html');for(const x of ['Sucesso','Reprocessamento','Duplicidade','Timeout','Retorno inválido','Contingência'])has(integrations,x);

const hardPlan=read('scripts/harden-opr-plan-v2-ui.mjs');for(const x of ['PA sequencial','Kanban','Histórico','Lixeira','fAcceptance','fEvidence'])has(hardPlan,x);
const hardGov=read('scripts/harden-opr-governance-platform.mjs'),hardAction=read('scripts/harden-opr-action-v2.mjs'),hardPop=read('scripts/harden-opr-pop.mjs');has(hardGov,'BEGIN ALLAMO OPR PERMANENT REPORT API');has(hardGov,'BEGIN ALLAMO OPR GOVERNANCE PLATFORM');has(hardGov,'BEGIN ALLAMO OPR PMO API');has(hardAction,'BEGIN ALLAMO OPR ACTION V2');for(const x of ['BEGIN ALLAMO OPR POP VERSIONING API','opr-pop-versions','Versões','data-opr-pop-current-version','/opr-plano-de-acao/','/opr-status-report/','/opr-mapa-implantacao/'])has(hardPop,x);

const banned=['Dual Clima','MADRI · Implantação','MADRI × NUCCI'];for(const f of pages.concat(['public/opr/assets/platform.js'])){const t=read(f);for(const b of banned)if(t.includes(b))fail(`${f} contém referência operacional de outro projeto: ${b}`)}
console.log('[OK] OPR: quatro URLs permanentes, Plano fonte da verdade, Status Report em 4 abas, POP versionado, Mapa Mestre, APIs, histórico, segurança e isolamento estático validados.');
