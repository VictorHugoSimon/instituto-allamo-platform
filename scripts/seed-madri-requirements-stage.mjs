import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';

const WRANGLER='wrangler@4.124.0';
const DB='DB';
const CONFIG='wrangler.stage.toml';
const SEED='data/madri/requirements-seed-v1.json.gz.b64';
const APPLY=process.argv.includes('--apply');
const VALIDATE_ONLY=process.argv.includes('--validate-only');
const VERIFY_ONLY=process.argv.includes('--verify-only');
const envArg=(process.argv.find(a=>a.startsWith('--env='))||'--env=stage').slice(6).toLowerCase();
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const REQUIRED_CONFIRM='SEED-MADRI-REQ-STAGE';

if(envArg!=='stage'){
  console.error('[ABORTADO] Este seed é deliberadamente STAGE ONLY. Produção não é suportada por este script.');
  process.exit(2);
}
if(!fs.existsSync(SEED))throw new Error('Arquivo de seed MADRI ausente: '+SEED);
if(!fs.existsSync(CONFIG)&&!VALIDATE_ONLY)throw new Error('Config Stage ausente: '+CONFIG);
if(APPLY&&confirmArg!==REQUIRED_CONFIRM){
  console.error(`[ABORTADO] Para aplicar no Stage use --confirm=${REQUIRED_CONFIRM}`);
  process.exit(2);
}

const b64=fs.readFileSync(SEED,'utf8').trim();
const payload=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
const reqs=Array.isArray(payload.requirements)?payload.requirements:[];
const meta=payload.metadata||{};
const allowedCoverage=new Set(['Coberto explícito','Coberto parcial','Lacuna / a confirmar','Lacuna','Novo requisito','Não localizado','Gap']);
const allowedPriority=new Set(['Alta','Média','Baixa','Crítica']);
const ids=reqs.map(r=>String(r.display_id||'').trim());
const unique=new Set(ids);
const reconstructed=reqs.filter(r=>r.source_kind==='RFI_RECONSTRUIDA').length;
const newCount=reqs.filter(r=>r.source_kind==='NOVO_POS_RFI').length;

if(reqs.length!==86)throw new Error(`Seed inválido: esperado 86 requisitos; encontrado ${reqs.length}.`);
if(unique.size!==reqs.length||ids.some(x=>!x))throw new Error('Seed inválido: display_id vazio ou duplicado.');
if(reconstructed!==71||newCount!==15)throw new Error(`Seed inválido: composição esperada 71+15; encontrada ${reconstructed}+${newCount}.`);
if(meta.total!==86||meta.reconstructed_rfi_count!==71||meta.new_requirement_count!==15)throw new Error('Metadados do seed não reconciliam com as linhas.');
for(const r of reqs){
  if(!allowedCoverage.has(r.coverage_status))throw new Error(`Coverage inválido em ${r.display_id}: ${r.coverage_status}`);
  if(!allowedPriority.has(r.priority)||!allowedPriority.has(r.criticality))throw new Error(`Prioridade/criticidade inválida em ${r.display_id}`);
  if(!String(r.requirement||'').trim()||!String(r.area||'').trim())throw new Error(`Requisito/área ausente em ${r.display_id}`);
  if(!['','STD','CFG','DEV','INT'].includes(String(r.classification||'')))throw new Error(`Classificação inválida em ${r.display_id}`);
}
const secretPattern=/(sk-[a-z0-9_-]{12,}|api[_-]?key\s*[:=]\s*[^\s,;]{8,}|bearer\s+[a-z0-9._-]{12,})/i;
if(secretPattern.test(JSON.stringify(payload)))throw new Error('Seed contém padrão compatível com segredo/token.');

console.log(`[OK] Seed MADRI validado: ${reqs.length} requisitos = ${reconstructed} reconstruídos + ${newCount} novos.`);
console.log(`[INFO] Caveat preservado: ${meta.important_caveat||'A confirmar'}`);
if(VALIDATE_ONLY)process.exit(0);

function run(args,{capture=true}={}){
  const exe=process.platform==='win32'?'npx.cmd':'npx';
  const r=spawnSync(exe,['--yes',...args],{encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:process.platform==='win32'});
  if(r.error)throw r.error;
  if(r.status!==0){if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}throw new Error(`Wrangler falhou (${r.status})`)}
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
function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function q(v){return `'${String(v??'').replaceAll("'","''")}'`}

const companies=query('SELECT id,name FROM companies ORDER BY id;');
const matches=companies.filter(r=>['madrid','madri'].includes(norm(r.id))||['madrid','madri'].includes(norm(r.name)));
if(matches.length!==1)throw new Error(`Contexto MADRI ambíguo/ausente: ${matches.length} empresas candidatas.`);
const company=matches[0];
const projects=query(`SELECT id,name,company_id FROM projects WHERE company_id=${q(company.id)} ORDER BY id;`);
const project=projects.find(p=>/nucci/i.test(String(p.name||'')))||projects.find(p=>/madri|madrid/i.test(String(p.name||'')))||(projects.length===1?projects[0]:null);
if(!project)throw new Error(`Projeto MADRI/NUCCI não resolvido de forma única; encontrados ${projects.length}.`);
const projectId=Number(project.id);
if(!Number.isFinite(projectId))throw new Error('project_id MADRI não é numérico: '+project.id);

const inList=ids.map(q).join(',');
const countRows=()=>Number(query(`SELECT COUNT(*) AS c FROM madri_requirements WHERE company_id=${q(company.id)} AND project_id=${projectId} AND display_id IN (${inList});`)[0]?.c||0);
const before=countRows();
console.log(`[INFO] Contexto: empresa=${company.name} (${company.id}) · projeto=${project.name} (${projectId}) · seed já presente=${before}/86.`);
if(VERIFY_ONLY){if(before!==86)throw new Error(`Verificação falhou: esperado 86/86, encontrado ${before}/86.`);console.log('[OK] Seed MADRI já está 86/86 no D1 Stage.');process.exit(0)}
if(!APPLY){console.log('[DRY-RUN] Nenhuma alteração aplicada no D1.');process.exit(0)}

const actor='MADRI PMO seed RFI x Blueprint v1';
const cols=['id','display_id','company_id','project_id','origin','area','subarea','requirement','priority','criticality','eliminatory','source_document','target_document','section','coverage_status','gap','classification','owner','evidence','acceptance','version','created_by','updated_by'];
const statements=[];
for(const r of reqs){
  const internalId='seed:req:'+r.display_id.toLowerCase();
  const vals=[internalId,r.display_id,company.id,projectId,r.origin,r.area,r.subarea,r.requirement,r.priority,r.criticality,r.eliminatory?1:0,r.source_document,r.target_document,r.section,r.coverage_status,r.gap,r.classification,r.owner,r.evidence,r.acceptance,1,actor,actor];
  statements.push(`INSERT OR IGNORE INTO madri_requirements(${cols.join(',')}) VALUES(${vals.map((v,i)=>[3,10,20].includes(i)?String(v):q(v)).join(',')});`);
}
const auditSnapshot=JSON.stringify({seed:'requirements-seed-v1',total:86,reconstructed:71,new_requirements:15,caveat:meta.important_caveat||''});
statements.push(`INSERT INTO madri_platform_audit(company_id,project_id,entity_type,entity_id,action_type,actor,snapshot_json) SELECT ${q(company.id)},${projectId},'requirement_seed','requirements-seed-v1','IMPORT',${q(actor)},${q(auditSnapshot)} WHERE NOT EXISTS (SELECT 1 FROM madri_platform_audit WHERE project_id=${projectId} AND entity_type='requirement_seed' AND entity_id='requirements-seed-v1' AND action_type='IMPORT');`);
const sql='PRAGMA foreign_keys = ON;\n'+statements.join('\n')+'\n';
const tmp=path.join(os.tmpdir(),`madri-requirements-seed-${Date.now()}.sql`);
fs.writeFileSync(tmp,sql,'utf8');
try{run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--file',tmp],{capture:false})}finally{try{fs.unlinkSync(tmp)}catch{}}
const after=countRows();
if(after!==86)throw new Error(`Seed incompleto após aplicação: ${after}/86.`);
console.log(`[OK] Seed MADRI Stage aplicado de forma aditiva/idempotente: antes=${before}/86, depois=${after}/86. Nenhum requisito existente foi sobrescrito.`);
