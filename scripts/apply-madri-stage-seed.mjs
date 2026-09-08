import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WRANGLER='wrangler@4.124.0';
const DB='DB';
const CONFIG='wrangler.stage.toml';
const DATA='data/madri-governance-seed-v1.json';
const APPLY=process.argv.includes('--apply');
const envArg=(process.argv.find(a=>a.startsWith('--env='))||'').slice(6).toLowerCase();
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const CONFIRM='APPLY-MADRI-SEED-STAGE';

if(envArg!=='stage'){
  console.error('[ABORTADO] Este seed é exclusivo do STAGE. Use --env=stage.');
  process.exit(2);
}
if(APPLY && confirmArg!==CONFIRM){
  console.error(`[ABORTADO] Para aplicar use --confirm=${CONFIRM}`);
  process.exit(2);
}
if(!fs.existsSync(CONFIG)||!fs.existsSync(DATA)){
  console.error('[ABORTADO] Configuração Stage ou arquivo de seed ausente.');
  process.exit(2);
}

const seed=JSON.parse(fs.readFileSync(DATA,'utf8'));
if(seed?.policy?.production_forbidden!==true){
  throw new Error('Contrato de segurança do seed inválido: production_forbidden deve ser true.');
}
if(seed.requirements.length!==86||seed.tests.length!==54||seed.phases.length!==15||seed.readiness.length!==17){
  throw new Error(`Contagem inesperada no pacote: req=${seed.requirements.length}, tests=${seed.tests.length}, phases=${seed.phases.length}, readiness=${seed.readiness.length}`);
}
const reqIds=seed.requirements.map(x=>x.id);
const testIds=seed.tests.map(x=>x.id);
if(new Set(reqIds).size!==86||new Set(testIds).size!==54)throw new Error('IDs duplicados no pacote de seed.');

function run(args,{capture=true}={}){
  const exe=process.platform==='win32'?'npx.cmd':'npx';
  const r=spawnSync(exe,['--yes',...args],{
    encoding:capture?'utf8':undefined,
    stdio:capture?['ignore','pipe','pipe']:'inherit',
    shell:process.platform==='win32',
    maxBuffer:20*1024*1024
  });
  if(r.error)throw r.error;
  if(r.status!==0){
    if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}
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
      try{return JSON.parse(clean.slice(i,j+1))}catch{}
    }
  }
  throw new Error('JSON D1 não reconhecido');
}
function results(v){
  if(Array.isArray(v))return v.flatMap(results);
  if(v&&typeof v==='object'){
    if(Array.isArray(v.results))return v.results;
    for(const x of Object.values(v)){const r=results(x);if(r.length)return r}
  }
  return [];
}
function query(sql){
  return results(parse(run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'])));
}
function q(v){
  if(v===null||v===undefined)return 'NULL';
  if(typeof v==='boolean')return v?'1':'0';
  if(typeof v==='number')return String(v);
  return "'"+String(v).replace(/'/g,"''")+"'";
}
function inList(values){return values.map(q).join(',')}

const companies=query(`SELECT id,name FROM companies WHERE lower(CAST(id AS TEXT)) IN ('madrid','madri') OR lower(name) IN ('madrid','madri') ORDER BY id;`);
if(companies.length!==1)throw new Error(`Contexto MADRI ambíguo/ausente: ${companies.length} empresa(s) encontrada(s).`);
const company=companies[0];
const projects=query(`SELECT id,name FROM projects WHERE company_id=${q(company.id)} AND (lower(name) LIKE '%nucci%' OR lower(name) LIKE '%madri%' OR lower(name) LIKE '%madrid%') ORDER BY CASE WHEN lower(name) LIKE '%nucci%' THEN 0 ELSE 1 END,id;`);
if(!projects.length)throw new Error('Projeto MADRI/NUCCI não encontrado no STAGE.');
const project=projects[0];
if(projects.length>1 && !String(project.name||'').toLowerCase().includes('nucci')){
  throw new Error(`Contexto de projeto ambíguo: ${projects.map(x=>`${x.id}:${x.name}`).join(', ')}`);
}

const requiredTables=['madri_platform_sequence','madri_requirements','madri_tests','madri_implementation_phases','madri_readiness'];
for(const t of requiredTables){
  if(!query(`SELECT name FROM sqlite_master WHERE type='table' AND name=${q(t)};`).some(r=>r.name===t)){
    throw new Error(`Schema MADRI incompleto: tabela ${t} ausente.`);
  }
}

const reqBefore=Number(query(`SELECT COUNT(*) n FROM madri_requirements WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(reqIds)});`)[0]?.n||0);
const testBefore=Number(query(`SELECT COUNT(*) n FROM madri_tests WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(testIds)});`)[0]?.n||0);
const phaseIds=seed.phases.map((_,i)=>`FAS-${String(i+1).padStart(2,'0')}`);
const readyIds=seed.readiness.map((_,i)=>`RDY-${String(i+1).padStart(3,'0')}`);
const phaseBefore=Number(query(`SELECT COUNT(*) n FROM madri_implementation_phases WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(phaseIds)});`)[0]?.n||0);
const readyBefore=Number(query(`SELECT COUNT(*) n FROM madri_readiness WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(readyIds)});`)[0]?.n||0);

console.log(JSON.stringify({
  mode: APPLY?'apply':'dry-run',
  environment:'stage',
  seed_version:seed.version,
  company:{id:company.id,name:company.name},
  project:{id:project.id,name:project.name},
  package:{requirements:86,tests:54,phases:15,readiness:17},
  already_present:{requirements:reqBefore,tests:testBefore,phases:phaseBefore,readiness:readyBefore},
  policy:'INSERT OR IGNORE; registros existentes nunca são sobrescritos'
},null,2));

if(!APPLY){
  console.log('[DRY-RUN] Nenhum dado alterado.');
  process.exit(0);
}

const actor='PMO Seed MADRI 2026-09-08';
const sql=[];

for(const r of seed.requirements){
  sql.push(`INSERT OR IGNORE INTO madri_requirements(
id,display_id,company_id,project_id,origin,area,subarea,requirement,priority,criticality,eliminatory,
source_document,target_document,section,coverage_status,gap,classification,owner,evidence,acceptance,created_by,updated_by
) VALUES(
${q('MADRI-SEED-'+r.id)},${q(r.id)},${q(company.id)},${q(project.id)},${q(r.origin)},${q(r.area)},'',${q(r.requirement)},'Média',${q(r.criticality)},${q(r.eliminatory)},
'Matriz_Auditoria_RFI_x_Blueprint_MADRI_v1.xlsx','Business Blueprint MADRI v1.0',${q(r.section)},${q(r.coverage)},${q(r.gap)},'','PENDENTE DE VALIDAÇÃO',${q(r.evidence)},${q(r.acceptance)},${q(actor)},${q(actor)}
);`);
}
for(const t of seed.tests){
  sql.push(`INSERT OR IGNORE INTO madri_tests(
id,display_id,company_id,project_id,test_type,front,process,scenario,priority,owner,precondition,steps,
expected_result,actual_result,expected_met,status,evidence,defect_id,origin,requirement_id,action_id,block_reason,
executed_at,executor,approver,created_by,updated_by
) VALUES(
${q('MADRI-SEED-'+t.id)},${q(t.id)},${q(company.id)},${q(project.id)},${q(t.type)},${q(t.front)},'',${q(t.scenario)},${q(t.priority)},${q(t.owner)},${q(t.precondition)},'',
${q(t.expected)},'',0,'Planejado','Sem evidência suficiente',NULL,${q(t.origin)},NULL,NULL,'',
NULL,'','PENDENTE DE VALIDAÇÃO',${q(actor)},${q(actor)}
);`);
}
for(let i=0;i<seed.phases.length;i++){
  const n=i+1,did=`FAS-${String(n).padStart(2,'0')}`;
  sql.push(`INSERT OR IGNORE INTO madri_implementation_phases(
id,display_id,company_id,project_id,phase_order,name,status,owner,acceptance_criteria,evidence,created_by,updated_by
) VALUES(${q('MADRI-'+did)},${q(did)},${q(company.id)},${q(project.id)},${n},${q(seed.phases[i])},'A confirmar','PENDENTE DE VALIDAÇÃO','A confirmar','Sem evidência suficiente',${q(actor)},${q(actor)});`);
}
for(let i=0;i<seed.readiness.length;i++){
  const n=i+1,did=`RDY-${String(n).padStart(3,'0')}`;
  sql.push(`INSERT OR IGNORE INTO madri_readiness(
id,display_id,company_id,project_id,category,condition_text,owner,status,evidence,blocking,created_by,updated_by
) VALUES(${q('MADRI-'+did)},${q(did)},${q(company.id)},${q(project.id)},${q(seed.readiness[i])},${q('Validar prontidão: '+seed.readiness[i])},'PENDENTE DE VALIDAÇÃO','Pendente','Sem evidência suficiente',1,${q(actor)},${q(actor)});`);
}
for(const [entity,next] of [['tests',55],['phases',16],['readiness',18]]){
  sql.push(`INSERT INTO madri_platform_sequence(project_id,company_id,entity,next_value,updated_at)
VALUES(${q(project.id)},${q(company.id)},${q(entity)},${next},datetime('now'))
ON CONFLICT(project_id,entity) DO UPDATE SET
company_id=excluded.company_id,
next_value=CASE WHEN madri_platform_sequence.next_value<excluded.next_value THEN excluded.next_value ELSE madri_platform_sequence.next_value END,
updated_at=datetime('now');`);
}

const tmp=path.join(os.tmpdir(),`madri-seed-${Date.now()}.sql`);
fs.writeFileSync(tmp,sql.join('\n')+'\n','utf8');
try{
  run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--file',tmp],{capture:false});
}finally{
  try{fs.unlinkSync(tmp)}catch{}
}

const reqAfter=Number(query(`SELECT COUNT(*) n FROM madri_requirements WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(reqIds)});`)[0]?.n||0);
const testAfter=Number(query(`SELECT COUNT(*) n FROM madri_tests WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(testIds)});`)[0]?.n||0);
const phaseAfter=Number(query(`SELECT COUNT(*) n FROM madri_implementation_phases WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(phaseIds)});`)[0]?.n||0);
const readyAfter=Number(query(`SELECT COUNT(*) n FROM madri_readiness WHERE company_id=${q(company.id)} AND project_id=${q(project.id)} AND display_id IN (${inList(readyIds)});`)[0]?.n||0);
const seq=Object.fromEntries(query(`SELECT entity,next_value FROM madri_platform_sequence WHERE project_id=${q(project.id)} AND entity IN ('tests','phases','readiness');`).map(x=>[x.entity,Number(x.next_value)]));

if(reqAfter!==86)throw new Error(`Seed de requisitos incompleto: ${reqAfter}/86`);
if(testAfter!==54)throw new Error(`Seed de testes incompleto: ${testAfter}/54`);
if(phaseAfter!==15)throw new Error(`Seed de fases incompleto: ${phaseAfter}/15`);
if(readyAfter!==17)throw new Error(`Seed de readiness incompleto: ${readyAfter}/17`);
if((seq.tests||0)<55||(seq.phases||0)<16||(seq.readiness||0)<18)throw new Error(`Sequências inválidas: ${JSON.stringify(seq)}`);

console.log(JSON.stringify({
  ok:true,
  environment:'stage',
  seed_version:seed.version,
  verified:{requirements:reqAfter,tests:testAfter,phases:phaseAfter,readiness:readyAfter,sequences:seq},
  inserted_this_run:{
    requirements:reqAfter-reqBefore,
    tests:testAfter-testBefore,
    phases:phaseAfter-phaseBefore,
    readiness:readyAfter-readyBefore
  },
  note:'Somente registros ausentes foram inseridos; nenhum registro existente foi sobrescrito.'
},null,2));
