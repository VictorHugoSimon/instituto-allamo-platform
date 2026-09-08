import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WRANGLER='wrangler@4.124.0';
const DB='DB';
const DATA_DIR='data/madri/rfi-requirements';
const MANIFEST=`${DATA_DIR}/manifest.json`;

const envArg=(process.argv.find(a=>a.startsWith('--env='))||'').slice(6).toLowerCase();
const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);

if(envArg!=='stage'){
  console.error('[ABORTADO] Este seed é deliberadamente STAGE-only. Use --env=stage.');
  process.exit(2);
}
const CONFIG='wrangler.stage.toml';
const REQUIRED_CONFIRM='SEED-MADRI-RFI-STAGE';
if(APPLY && confirmArg!==REQUIRED_CONFIRM){
  console.error(`[ABORTADO] Para aplicar use --confirm=${REQUIRED_CONFIRM}`);
  process.exit(2);
}
if(!fs.existsSync(CONFIG)||!fs.existsSync(MANIFEST)){
  console.error('[ABORTADO] wrangler.stage.toml ou manifesto MADRI ausente.');
  process.exit(2);
}

const dataset=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
const chunkFiles=Array.isArray(dataset.files)?dataset.files:[];
if(!chunkFiles.length){console.error('[ABORTADO] Manifesto MADRI sem chunks.');process.exit(2);}
const records=chunkFiles.flatMap(name=>{
  const file=path.join(DATA_DIR,name);
  if(!fs.existsSync(file))throw new Error(`Chunk ausente: ${file}`);
  const rows=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(rows))throw new Error(`Chunk inválido: ${file}`);
  return rows;
});
if(records.length!==86 || dataset?.counts?.rfi_reconstructed!==71 || dataset?.counts?.new_requirements!==15){
  console.error(`[ABORTADO] Dataset inesperado: total=${records.length}, RFI=${dataset?.counts?.rfi_reconstructed}, novos=${dataset?.counts?.new_requirements}.`);
  process.exit(2);
}
const ids=records.map(r=>String(r.display_id||'').trim());
if(new Set(ids).size!==records.length || ids.some(x=>!x)){
  console.error('[ABORTADO] display_id vazio ou duplicado no dataset.');
  process.exit(2);
}

function run(args,{capture=true}={}){
  const exe=process.platform==='win32'?'npx.cmd':'npx';
  const r=spawnSync(exe,['--yes',...args],{
    encoding:capture?'utf8':undefined,
    stdio:capture?['ignore','pipe','pipe']:'inherit',
    shell:process.platform==='win32'
  });
  if(r.error) throw r.error;
  if(r.status!==0){
    if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');}
    throw new Error(`Wrangler falhou (${r.status})`);
  }
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}
function parse(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  for(let i=0;i<clean.length;i++){
    if(clean[i]!=='['&&clean[i]!=='{')continue;
    for(let j=clean.length-1;j>i;j--){
      if(clean[j]!==']'&&clean[j]!=='}')continue;
      try{return JSON.parse(clean.slice(i,j+1));}catch{}
    }
  }
  throw new Error('JSON D1 não reconhecido');
}
function results(v){
  if(Array.isArray(v))return v.flatMap(results);
  if(v&&typeof v==='object'){
    if(Array.isArray(v.results))return v.results;
    for(const x of Object.values(v)){
      const r=results(x); if(r.length)return r;
    }
  }
  return [];
}
function query(sql){
  return results(parse(run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'])));
}
const q=s=>`'${String(s??'').replace(/'/g,"''")}'`;
const tableOk=query("SELECT name FROM sqlite_master WHERE type='table' AND name='madri_requirements';").some(r=>r.name==='madri_requirements');
if(!tableOk){console.error('[ABORTADO] madri_requirements não existe no D1 Stage.');process.exit(2);}

const ctx=query("SELECT company_id, project_id FROM work_items WHERE pmo_scope='MADRI_NUCCI' AND archived_at IS NULL GROUP BY company_id,project_id;");
if(ctx.length!==1){
  console.error(`[ABORTADO] Esperado exatamente 1 contexto MADRI_NUCCI no Stage; encontrado ${ctx.length}.`);
  process.exit(2);
}
const companyId=String(ctx[0].company_id);
const projectId=Number(ctx[0].project_id);
if(!companyId || !Number.isFinite(projectId)){
  console.error('[ABORTADO] Contexto MADRI inválido.');
  process.exit(2);
}

const inList=ids.map(q).join(',');
const existing=Number(query(`SELECT COUNT(*) AS n FROM madri_requirements WHERE company_id=${q(companyId)} AND project_id=${projectId} AND display_id IN (${inList});`)[0]?.n||0);
console.log(`Ambiente: stage`);
console.log(`Contexto MADRI: company_id=${companyId} project_id=${projectId}`);
console.log(`Dataset: ${records.length} requisitos (${dataset.counts.rfi_reconstructed} RFI reconstruídos + ${dataset.counts.new_requirements} novos)`);
console.log(`Já existentes por display_id: ${existing}`);
console.log(`Fonte SHA256: ${dataset.source_sha256}`);

if(!APPLY){
  console.log(`[DRY-RUN] Serão inseridos no máximo ${records.length-existing} registros; nenhum existente será sobrescrito.`);
  process.exit(0);
}

const actor='seed:rfi-blueprint:2026-09-08';
const lines=[
  'PRAGMA foreign_keys = ON;',
  '-- Seed controlado MADRI RFI × Blueprint — INSERT OR IGNORE, sem sobrescrever edição humana.'
];
for(const r of records){
  const internalId=`MADRI-SRC-${String(r.display_id).replace(/[^A-Za-z0-9_-]/g,'-')}`;
  const cols=[
    'id','display_id','company_id','project_id','origin','area','subarea','requirement',
    'priority','criticality','source_document','target_document','section','coverage_status',
    'gap','classification','owner','action_id','test_id','evidence','acceptance','created_by','updated_by'
  ];
  const vals=[
    internalId,r.display_id,companyId,projectId,r.origin,r.area,r.subarea,r.requirement,
    r.priority,r.criticality,r.source_document,r.target_document,r.section,r.coverage_status,
    r.gap,r.classification,r.owner,r.action_id,r.test_id,r.evidence,r.acceptance,actor,actor
  ];
  lines.push(`INSERT OR IGNORE INTO madri_requirements(${cols.join(',')}) VALUES(${vals.map(v=>v===null?'NULL':q(v)).join(',')});`);
  lines.push(
    `INSERT INTO madri_platform_audit(company_id,project_id,entity_type,entity_id,action_type,actor,snapshot_json) `+
    `SELECT ${q(companyId)},${projectId},'requirements',${q(internalId)},'IMPORT_BASELINE',${q(actor)},`+
    `json_object('display_id',${q(r.display_id)},'requirement',${q(r.requirement)},'source_document',${q(r.source_document)},'source_status_raw',${q(r.source_status_raw)}) `+
    `WHERE EXISTS(SELECT 1 FROM madri_requirements WHERE company_id=${q(companyId)} AND project_id=${projectId} AND id=${q(internalId)}) `+
    `AND NOT EXISTS(SELECT 1 FROM madri_platform_audit WHERE company_id=${q(companyId)} AND project_id=${projectId} AND entity_type='requirements' AND entity_id=${q(internalId)} AND action_type='IMPORT_BASELINE');`
  );
}
const tmp=path.join(os.tmpdir(),`madri-rfi-seed-${process.pid}.sql`);
fs.writeFileSync(tmp,lines.join('\n')+'\n','utf8');
try{
  run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--file',tmp],{capture:false});
}finally{
  try{fs.unlinkSync(tmp);}catch{}
}

const after=Number(query(`SELECT COUNT(*) AS n FROM madri_requirements WHERE company_id=${q(companyId)} AND project_id=${projectId} AND display_id IN (${inList});`)[0]?.n||0);
const auditCount=Number(query(`SELECT COUNT(*) AS n FROM madri_platform_audit WHERE company_id=${q(companyId)} AND project_id=${projectId} AND entity_type='requirements' AND action_type='IMPORT_BASELINE';`)[0]?.n||0);
if(after!==records.length){
  console.error(`[FALHA] Esperados ${records.length} requisitos do dataset no Stage; encontrados ${after}.`);
  process.exit(1);
}
console.log(`[OK] Baseline MADRI carregado: ${after}/${records.length} requisitos presentes; ${auditCount} eventos IMPORT_BASELINE acumulados.`);
console.log('[OK] Nenhum registro existente foi atualizado ou removido.');
