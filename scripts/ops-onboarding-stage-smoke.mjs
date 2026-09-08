import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const CONFIG='wrangler.stage.toml';
const DB='DB';
const WRANGLER='wrangler@4.124.0';
const MODE=(process.argv.find(a=>a.startsWith('--mode='))||'').slice(7);
const BACKUP_FILE=process.env.STAGE_ONBOARDING_SMOKE_BACKUP||'';
const BASE=process.env.ALLAMO_STAGE_URL||'https://allamo-pmo-stage.pages.dev';
const COMPANY_ID='pmoonboardingsmoke20260908';
const COMPANY_NAME='PMO Onboarding Smoke 2026-09-08';
const PROJECT_NAME='PMO Onboarding Smoke Project 2026-09-08';

const sqlString=v=>`'${String(v).replace(/'/g,"''")}'`;
const sqlIdent=v=>`"${String(v).replace(/"/g,'""')}"`;
const fail=m=>{throw new Error(m)};

function runWrangler(args,{capture=true}={}){
  const r=spawnSync('npx',['--yes',WRANGLER,...args],{
    cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false
  });
  if(r.error)throw r.error;
  if(r.status!==0){
    if(capture){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr)}
    fail(`Wrangler falhou (${r.status}) em ${args.join(' ')}`);
  }
  return capture?(r.stdout||''):'';
}
function extractResults(node){
  if(Array.isArray(node)){for(const item of node){const r=extractResults(item);if(r)return r}return null}
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results))return node.results;
    for(const v of Object.values(node)){const r=extractResults(v);if(r)return r}
  }
  return null;
}
function executeSql(sql,{json=true,capture=true}={}){
  const tmp=path.join(os.tmpdir(),`allamo-onboarding-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  fs.writeFileSync(tmp,sql.endsWith('\n')?sql:sql+'\n','utf8');
  try{
    const args=['d1','execute',DB,'--remote','--config',CONFIG,'--file',tmp];
    if(json)args.push('--json');
    const out=runWrangler(args,{capture});
    if(!json)return [];
    let parsed;try{parsed=JSON.parse(out)}catch{fail('Saída D1 não-JSON')}
    return extractResults(parsed)||[];
  }finally{try{fs.unlinkSync(tmp)}catch{}}
}
const query=sql=>executeSql(sql,{json:true,capture:true});

function ensureStageOnly(){
  if(!fs.existsSync(CONFIG))fail(`${CONFIG} ausente`);
  const cfg=fs.readFileSync(CONFIG,'utf8');
  if(!cfg.includes('name = "allamo-pmo-stage"'))fail('Config não aponta para allamo-pmo-stage');
  if(!cfg.includes('database_name = "allamo-pmo-stage"'))fail('D1 não é allamo-pmo-stage');
  if(/name\s*=\s*"allamo-pmo"\s*$/m.test(cfg))fail('Proteção acionada: config aparenta ser Produção');
}
function requireBackup(){
  if(!BACKUP_FILE)fail('STAGE_ONBOARDING_SMOKE_BACKUP não informado');
  const p=path.resolve(BACKUP_FILE);
  if(!fs.existsSync(p)||fs.statSync(p).size===0)fail('Backup obrigatório ausente ou vazio');
  console.log(`[OK] Backup obrigatório validado: ${path.basename(p)}`);
}
function tableInfo(table){return query(`PRAGMA table_info(${sqlIdent(table)});`)}
function validateRequired(cols,known,table){
  const unknown=cols.filter(c=>Number(c.notnull)===1&&!c.dflt_value&&!known.has(String(c.name))&&Number(c.pk)!==1);
  if(unknown.length)fail(`${table} ganhou campos obrigatórios não tratados: ${unknown.map(c=>c.name).join(', ')}`);
}
function buildInsert(table,values,{omitPrimaryAuto=false}={}){
  const cols=tableInfo(table);
  const names=cols.map(c=>String(c.name));
  const known=new Set(Object.keys(values));
  validateRequired(cols,known,table);
  const selected=names.filter(n=>Object.prototype.hasOwnProperty.call(values,n)&&!(omitPrimaryAuto&&cols.find(c=>String(c.name)===n&&Number(c.pk)===1&&/INT/i.test(String(c.type||'')))));
  if(!selected.length)fail(`Nenhuma coluna compatível para ${table}`);
  const vals=selected.map(n=>typeof values[n]==='number'?String(values[n]):sqlString(values[n]));
  return `INSERT INTO ${sqlIdent(table)} (${selected.map(sqlIdent).join(',')}) VALUES (${vals.join(',')});`;
}
function baseline(){
  return {
    companies:query('SELECT id,name FROM companies ORDER BY id;'),
    projects:query('SELECT id,name,company_id FROM projects ORDER BY id;')
  };
}
function assertCleanBaseline(label='baseline'){
  const b=baseline();
  if(b.companies.length||b.projects.length)fail(`${label}: esperado 0/0; encontrado companies=${b.companies.length}, projects=${b.projects.length}`);
  return b;
}
function getFixture(){
  const companies=query(`SELECT id,name FROM companies WHERE id=${sqlString(COMPANY_ID)} OR name=${sqlString(COMPANY_NAME)};`);
  const projects=query(`SELECT id,name,company_id FROM projects WHERE company_id=${sqlString(COMPANY_ID)} OR name=${sqlString(PROJECT_NAME)};`);
  return {companies,projects};
}
async function api(p){
  const r=await fetch(BASE+p,{headers:{'cache-control':'no-cache','pragma':'no-cache'},cache:'no-store'});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
  if(!r.ok)fail(`${p}: HTTP ${r.status} ${typeof data==='string'?data.slice(0,160):JSON.stringify(data).slice(0,300)}`);
  return data;
}
async function prepare(){
  ensureStageOnly();requireBackup();assertCleanBaseline('preflight');
  const companyValues={
    id:COMPANY_ID,name:COMPANY_NAME,city:'',system:'',own_system:0,lead:'PMO Smoke',start_date:'',status:'s',status_text:'Homologação controlada',pmo_mode:'PMO Direto',progress:0,summary:'Fixture efêmero do smoke de onboarding; não é cliente real.',email:'',owner_email:'',grupo:'',billing_to:'',billing_email:'',billing_amount:'',billing_day:'',stakeholders:''
  };
  const projectValues={
    name:PROJECT_NAME,company_id:COMPANY_ID,status:'Backlog',badge:'backlog',urgency:'Média',summary:'Fixture efêmero do smoke de onboarding; não é projeto real.',lead:'PMO Smoke',start_date:'',meta_date:'',pmo_read:'Atenção',note:'SMOKE_ONLY_20260908',linear_url:''
  };
  const sql=[
    buildInsert('companies',companyValues),
    buildInsert('projects',projectValues,{omitPrimaryAuto:true}),
    "SELECT 'PMO_ONBOARDING_STAGE_FIXTURE_CREATED' AS status;"
  ].join('\n');
  executeSql(sql,{json:false,capture:false});
  const f=getFixture();
  if(f.companies.length!==1||f.projects.length!==1)fail(`Fixture incompleto após INSERT: ${JSON.stringify(f)}`);
  if(String(f.projects[0].company_id)!==COMPANY_ID)fail('Projeto fixture não pertence à empresa fixture');
  console.log(`[OK] Fixture criado: company=${COMPANY_ID}; project_id=${f.projects[0].id}`);
}
async function validate(){
  ensureStageOnly();
  const b=baseline();
  if(b.companies.length!==1||b.projects.length!==1)fail(`STAGE deveria conter somente o fixture: companies=${b.companies.length}, projects=${b.projects.length}`);
  if(String(b.companies[0].id)!==COMPANY_ID||String(b.projects[0].company_id)!==COMPANY_ID||String(b.projects[0].name)!==PROJECT_NAME)fail('Conteúdo inesperado no STAGE durante smoke');
  const orphans=query('SELECT COUNT(*) AS total FROM projects p LEFT JOIN companies c ON c.id=p.company_id WHERE c.id IS NULL;');
  if(Number(orphans[0]?.total||0)!==0)fail(`Projeto órfão detectado: ${orphans[0]?.total}`);

  const companies=await api('/api/companies');
  const projects=await api('/api/projects');
  const cockpit=await api('/api/pmo-cockpit');
  if(!Array.isArray(companies)||companies.length!==1||String(companies[0]?.id)!==COMPANY_ID)fail('API companies não refletiu exatamente o fixture');
  if(!Array.isArray(projects)||projects.length!==1||String(projects[0]?.company_id)!==COMPANY_ID)fail('API projects não refletiu exatamente o fixture');
  if(cockpit?.source!=='D1')fail('Cockpit não declarou D1 como fonte');
  if(Number(cockpit?.portfolio?.companies)!==1||Number(cockpit?.portfolio?.projects)!==1)fail(`Cockpit não transitou 0→1/1: ${JSON.stringify(cockpit?.portfolio)}`);
  const detail=(cockpit?.projects||[]).find(p=>String(p.company_id)===COMPANY_ID&&String(p.name)===PROJECT_NAME);
  if(!detail)fail('Cockpit não expôs o projeto fixture');
  const unavailableChecks=[
    ['capacity.actual_hours',cockpit?.capacity?.actual_hours],
    ['capacity.utilization',cockpit?.capacity?.utilization],
    ['management.structured_critical_risks',cockpit?.management?.structured_critical_risks],
    ['adoption.heatmap',cockpit?.adoption?.heatmap],
    ['governance.latest_report_at',cockpit?.governance?.latest_report_at]
  ];
  for(const [name,m] of unavailableChecks){
    if(!m||m.available!==false||m.value!==null)fail(`${name} deveria permanecer indisponível/null sem fonte real: ${JSON.stringify(m)}`);
  }
  if(cockpit?.governance?.projects_without_report?.available!==true||Number(cockpit.governance.projects_without_report.value)!==1)fail('Cockpit deveria identificar 1 projeto sem Status Report');
  console.log(JSON.stringify({ok:true,stage_transition:'0→1 empresa / 1 projeto',source:cockpit.source,portfolio:cockpit.portfolio,unavailable_metrics_preserved:true,orphan_projects:0},null,2));
  console.log('[OK] Cockpit, integridade e ausência de KPI fictício validados com fixture efêmero.');
}
function cleanup(){
  ensureStageOnly();
  const f=getFixture();
  if(!f.companies.length&&!f.projects.length){
    console.log('[OK] Nenhum fixture encontrado; cleanup sem efeito.');
    return;
  }
  const projectIds=f.projects.map(p=>String(p.id));
  const idList=projectIds.length?projectIds.map(sqlString).join(','):"''";
  const statements=['PRAGMA foreign_keys=OFF;'];
  const tables=query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").map(r=>String(r.name||'')).filter(Boolean);
  for(const table of tables){
    if(['companies','projects','users','sessions'].includes(table))continue;
    let cols=[];try{cols=tableInfo(table).map(c=>String(c.name))}catch{continue}
    const filters=[];
    if(cols.includes('company_id'))filters.push(`company_id=${sqlString(COMPANY_ID)}`);
    if(cols.includes('tenant_id'))filters.push(`tenant_id=${sqlString(COMPANY_ID)}`);
    if(cols.includes('project_id')&&projectIds.length)filters.push(`CAST(project_id AS TEXT) IN (${idList})`);
    if(filters.length)statements.push(`DELETE FROM ${sqlIdent(table)} WHERE ${filters.join(' OR ')};`);
  }
  statements.push(`DELETE FROM projects WHERE company_id=${sqlString(COMPANY_ID)} AND name=${sqlString(PROJECT_NAME)};`);
  statements.push(`DELETE FROM companies WHERE id=${sqlString(COMPANY_ID)} AND name=${sqlString(COMPANY_NAME)};`);
  statements.push('PRAGMA foreign_keys=ON;');
  statements.push("SELECT 'PMO_ONBOARDING_STAGE_FIXTURE_CLEANED' AS status;");
  executeSql(statements.join('\n'),{json:false,capture:false});
  const remaining=getFixture();
  if(remaining.companies.length||remaining.projects.length)fail(`Cleanup deixou fixture: ${JSON.stringify(remaining)}`);
  const b=baseline();
  if(b.companies.length||b.projects.length)fail(`Cleanup encontrou dados inesperados não pertencentes ao fixture: companies=${b.companies.length}, projects=${b.projects.length}`);
  console.log('[OK] Fixture removido; STAGE retornou a 0 empresas / 0 projetos. Usuários e sessões não foram tocados.');
}
async function finalCheck(){
  ensureStageOnly();assertCleanBaseline('final');
  const companies=await api('/api/companies');
  const projects=await api('/api/projects');
  const cockpit=await api('/api/pmo-cockpit');
  if(!Array.isArray(companies)||companies.length||!Array.isArray(projects)||projects.length)fail('APIs não retornaram ao baseline 0/0');
  if(Number(cockpit?.portfolio?.companies)!==0||Number(cockpit?.portfolio?.projects)!==0)fail('Cockpit não retornou ao zero-state');
  console.log('[OK] Pós-cleanup: APIs e Cockpit novamente em zero-state.');
}

try{
  if(MODE==='prepare')await prepare();
  else if(MODE==='validate')await validate();
  else if(MODE==='cleanup')cleanup();
  else if(MODE==='final')await finalCheck();
  else fail('Use --mode=prepare|validate|cleanup|final');
}catch(e){console.error('[ERRO] '+(e?.message||e));process.exit(1)}
