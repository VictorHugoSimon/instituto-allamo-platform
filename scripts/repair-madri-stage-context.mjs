import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const CONFIRM='REPAIR-MADRI-STAGE-CONTEXT';
const CONFIG='wrangler.stage.toml';
const DB='DB';
const WRANGLER='wrangler@4.124.0';
const EXPECTED_DB_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';

if(APPLY&&confirmArg!==CONFIRM){console.error(`[ABORTADO] Para aplicar use --apply --confirm=${CONFIRM}`);process.exit(2)}
const configText=fs.readFileSync(CONFIG,'utf8');
if(!configText.includes('name = "allamo-pmo-stage"')||!configText.includes(`database_id = "${EXPECTED_DB_ID}"`))throw new Error('Guard de ambiente falhou: este script aceita somente o D1 STAGE canônico.');

function run(args,{capture=true}={}){
  const exe=process.platform==='win32'?'npx.cmd':'npx';
  const r=spawnSync(exe,['--yes',...args],{encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:process.platform==='win32'});
  if(r.error)throw r.error;
  if(r.status!==0){if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}throw new Error(`Wrangler falhou (${r.status})`)}
  return capture?String(r.stdout||''):'';
}
function extractResults(node){
  if(Array.isArray(node)){for(const item of node){const r=extractResults(item);if(r)return r}return null}
  if(node&&typeof node==='object'){if(Array.isArray(node.results))return node.results;for(const v of Object.values(node)){const r=extractResults(v);if(r)return r}}
  return null;
}
function query(sql){
  const tmp=path.join(os.tmpdir(),`madri-stage-read-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);fs.writeFileSync(tmp,sql+'\n','utf8');
  try{const out=run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--file',tmp,'--json']);return extractResults(JSON.parse(out))||[]}finally{try{fs.unlinkSync(tmp)}catch{}}
}
function execute(sql){
  if(!APPLY)return;
  const tmp=path.join(os.tmpdir(),`madri-stage-write-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);fs.writeFileSync(tmp,sql+'\n','utf8');
  try{run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--file',tmp],{capture:false})}finally{try{fs.unlinkSync(tmp)}catch{}}
}
const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const q=v=>`'${String(v??'').replace(/'/g,"''")}'`;
const qi=v=>`"${String(v).replace(/"/g,'""')}"`;
const aliases=['madrid','madri','madrie'];

function schema(table){return query(`PRAGMA table_info(${qi(table)});`)}
function buildSchemaAwareInsert(table,values,{explicitId=null}={}){
  const cols=schema(table);const names=cols.map(c=>String(c.name||''));
  const v={...values};if(explicitId!==null&&names.includes('id'))v.id=explicitId;
  const unknown=cols.filter(c=>Number(c.notnull)===1&&!c.dflt_value&&Number(c.pk)!==1&&!Object.prototype.hasOwnProperty.call(v,String(c.name)));
  if(unknown.length)throw new Error(`${table}: campos obrigatórios desconhecidos: ${unknown.map(c=>c.name).join(', ')}`);
  const use=names.filter(n=>Object.prototype.hasOwnProperty.call(v,n));
  const vals=use.map(n=>typeof v[n]==='number'?String(v[n]):q(v[n]));
  return `INSERT INTO ${qi(table)} (${use.map(qi).join(',')}) VALUES (${vals.join(',')});`;
}

const companies=query('SELECT id,name FROM companies ORDER BY id;');
let companyMatches=companies.filter(c=>aliases.includes(norm(c.id))||aliases.includes(norm(c.name)));
if(companyMatches.length>1)throw new Error(`MADRI ambígua no Stage: ${companyMatches.map(c=>`${c.name}[${c.id}]`).join(', ')}`);

let company=companyMatches[0]||null;
let companyPlan='manter';
if(!company){
  const tables=query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").map(r=>String(r.name||'')).filter(Boolean).filter(n=>!n.startsWith('d1_')&&!n.startsWith('_cf_'));
  const orphanIds=new Set();
  for(const table of tables){
    if(table==='companies')continue;
    let cols=[];try{cols=schema(table).map(c=>String(c.name||''))}catch{continue}
    if(!cols.includes('company_id'))continue;
    try{for(const r of query(`SELECT DISTINCT CAST(company_id AS TEXT) company_id FROM ${qi(table)} WHERE company_id IS NOT NULL AND trim(CAST(company_id AS TEXT))<>'';`)){if(aliases.includes(norm(r.company_id)))orphanIds.add(String(r.company_id))}}catch{}
  }
  if(orphanIds.size>1)throw new Error(`Múltiplos IDs órfãos MADRI encontrados: ${[...orphanIds].join(', ')}`);
  const id=[...orphanIds][0]||'madrid';
  company={id,name:'Madrid'};companyPlan=`criar [${id}]`;
}

const companyId=String(company.id);
let projects=query(`SELECT id,name,company_id FROM projects WHERE CAST(company_id AS TEXT)=${q(companyId)} ORDER BY id;`);
let project=projects.find(p=>/nucci/i.test(String(p.name||'')))||projects.find(p=>/madri|madrid/i.test(String(p.name||'')))||projects[0]||null;
if(projects.length>1&&!project)throw new Error('Há múltiplos projetos MADRI sem critério seguro de escolha.');
let projectPlan=project?`manter [${project.id}]`:'criar projeto NUCCI';
let preferredProjectId=null;
if(!project){
  try{
    const refs=query(`SELECT DISTINCT project_id FROM work_items WHERE pmo_scope='MADRI_NUCCI' AND project_id IS NOT NULL AND CAST(company_id AS TEXT)=${q(companyId)};`).map(r=>r.project_id).filter(v=>v!==null&&v!==undefined&&String(v)!=='');
    if(refs.length>1)throw new Error(`Múltiplos project_id órfãos MADRI_NUCCI: ${refs.join(', ')}`);
    if(refs.length===1&&Number.isFinite(Number(refs[0])))preferredProjectId=Number(refs[0]);
  }catch(e){if(/Múltiplos project_id/.test(e.message))throw e}
}

console.log('=== MADRI STAGE CONTEXT REPAIR ===');
console.log(`Empresas atuais: ${companies.length}`);
companies.forEach(c=>console.log(`- ${c.name} [${c.id}]`));
console.log(`Plano empresa MADRI: ${companyPlan}`);
console.log(`Plano projeto: ${projectPlan}${preferredProjectId!==null?` preservando id=${preferredProjectId}`:''}`);

if(!APPLY){console.log('[DRY-RUN] Nenhuma alteração aplicada.');process.exit(0)}

const writes=[];
if(!companyMatches[0]){
  writes.push(buildSchemaAwareInsert('companies',{
    id:companyId,name:'Madrid',city:'',system:'NUCCI ERP/TMS',own_system:0,lead:'A definir',start_date:'2026-08-24',status:'s',status_text:'Em implantação',pmo_mode:'PMO Direto',progress:0,summary:'Implantação NUCCI ERP/TMS — MADRI',email:'',owner_email:'',grupo:'',billing_to:'',billing_email:'',billing_amount:'',billing_day:'',stakeholders:''
  }));
}
if(!project){
  writes.push(buildSchemaAwareInsert('projects',{
    name:'Implantação NUCCI ERP',company_id:companyId,status:'Em andamento',badge:'started',urgency:'Alta',summary:'Implantação do NUCCI ERP/TMS na MADRI',lead:'A definir',start_date:'2026-08-24',meta_date:'',pmo_read:1,note:'Contexto recuperado de forma aditiva para governança MADRI no Stage.',linear_url:''
  },{explicitId:preferredProjectId}));
}
if(writes.length)execute('BEGIN; '+writes.join(' ')+' COMMIT;');

companyMatches=query('SELECT id,name FROM companies ORDER BY id;').filter(c=>aliases.includes(norm(c.id))||aliases.includes(norm(c.name)));
if(companyMatches.length!==1)throw new Error(`Pós-validação: MADRI deveria resolver exatamente 1 empresa; encontrou ${companyMatches.length}.`);
company=companyMatches[0];projects=query(`SELECT id,name,company_id FROM projects WHERE CAST(company_id AS TEXT)=${q(company.id)} ORDER BY id;`);
project=projects.find(p=>/nucci/i.test(String(p.name||'')))||projects.find(p=>/madri|madrid/i.test(String(p.name||'')))||projects[0]||null;
if(!project)throw new Error('Pós-validação: projeto NUCCI/MADRI não foi resolvido.');
console.log(`[OK] Contexto MADRI recuperado somente no Stage: empresa=${company.name}[${company.id}] projeto=${project.name}[${project.id}].`);
