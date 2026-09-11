import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const WRANGLER='wrangler@4.124.0';
const DB='DB';
const CONFIG='wrangler.production.toml';
const DATA_FILE='data/madri/madri-human-impact-baseline-v01.json';
const CONFIRM='SEED-MADRI-HUMAN-IMPACT-PRODUCTION';
const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);

if(APPLY&&confirmArg!==CONFIRM){console.error(`[ABORTADO] Para aplicar em Produção use --confirm=${CONFIRM}`);process.exit(2)}
for(const f of [CONFIG,DATA_FILE])if(!fs.existsSync(f)){console.error(`[ABORTADO] Arquivo ausente: ${f}`);process.exit(2)}

const pack=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
const records=Array.isArray(pack.records)?pack.records:[];
const expectedIds=Array.from({length:10},(_,i)=>`HUM-${String(i+1).padStart(3,'0')}`);
const statuses=new Set(['EMBAIXADOR','ENGAJADO','NEUTRO / ADAPTÁVEL','ATENÇÃO NA ADOÇÃO','A CONFIRMAR']);
const confidence=new Set(['Alta','Média','Baixa']);
const manuality=new Set(['Muito alta','Alta','Média','Baixa','A confirmar']);
if(pack.baseline_version!=='v0.1')throw new Error(`Versão de baseline inesperada: ${pack.baseline_version}`);
if(records.length!==10)throw new Error(`Baseline humana inválida: ${records.length} registros (esperado 10).`);
if(new Set(records.map(r=>r.display_id)).size!==10)throw new Error('IDs duplicados no baseline humano.');
if(expectedIds.some(id=>!records.some(r=>r.display_id===id)))throw new Error('Faixa HUM-001..HUM-010 incompleta.');
for(const r of records){
  if(!String(r.person_name||'').trim())throw new Error(`${r.display_id}: pessoa/grupo obrigatório.`);
  if(!statuses.has(String(r.adoption_status||'')))throw new Error(`${r.display_id}: status de aderência inválido.`);
  if(!confidence.has(String(r.confidence_level||'')))throw new Error(`${r.display_id}: confiança inválida.`);
  if(!manuality.has(String(r.manuality_current||'')))throw new Error(`${r.display_id}: manualidade inválida.`);
  for(const f of ['change_impact_score','resistance_risk_score']){const n=Number(r[f]);if(!Number.isInteger(n)||n<1||n>5)throw new Error(`${r.display_id}: ${f} deve estar entre 1 e 5.`)}
  for(const f of ['adoption_reason','observed_evidence','source_ref'])if(!String(r[f]||'').trim())throw new Error(`${r.display_id}: ${f} obrigatório para rastreabilidade.`);
  for(const f of ['current_hours','future_hours','capacity_released'])if(String(r[f]||'').trim()!=='A medir')throw new Error(`${r.display_id}: ${f} deve permanecer "A medir" até medição quantitativa.`);
}

function run(args,{capture=true}={}){
  const exe=process.platform==='win32'?'npx.cmd':'npx';
  const r=spawnSync(exe,['--yes',...args],{encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:process.platform==='win32'});
  if(r.error)throw r.error;
  if(r.status!==0){if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}throw new Error(`Wrangler falhou (${r.status})`)}
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}
function parse(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  for(let i=0;i<clean.length;i++){if(clean[i]!=='['&&clean[i]!=='{')continue;for(let j=clean.length-1;j>i;j--){if(clean[j]!==']'&&clean[j]!=='}')continue;try{return JSON.parse(clean.slice(i,j+1))}catch{}}}
  throw new Error('JSON D1 não reconhecido');
}
function results(v){if(Array.isArray(v))return v.flatMap(results);if(v&&typeof v==='object'){if(Array.isArray(v.results))return v.results;for(const x of Object.values(v)){const r=results(x);if(r.length)return r}}return []}
function query(sql){return results(parse(run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'])))}
function lit(v){if(v===null||v===undefined)return 'NULL';if(typeof v==='number')return Number.isFinite(v)?String(v):'NULL';if(typeof v==='boolean')return v?'1':'0';return `'${String(v).replaceAll("'","''")}'`}
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');

const companies=query('SELECT id,name FROM companies;');
const companyMatches=companies.filter(r=>['madri','madrid'].includes(norm(r.id))||['madri','madrid'].includes(norm(r.name)));
if(companyMatches.length!==1)throw new Error(`Tenant MADRI não resolvido de forma única (matches=${companyMatches.length}).`);
const company=companyMatches[0];
const projects=query(`SELECT id,name,company_id FROM projects WHERE company_id=${lit(company.id)} ORDER BY id;`);
const exact=projects.filter(r=>norm(r.name)==='implantacaonuccierp');
const nucci=projects.filter(r=>/nucci/i.test(String(r.name||'')));
const project=exact.length===1?exact[0]:nucci.length===1?nucci[0]:null;
if(!project)throw new Error(`Projeto Implantação NUCCI ERP não resolvido de forma única (projects=${projects.length}, exact=${exact.length}, nucci=${nucci.length}).`);
const scopeCheck=Number(query(`SELECT COUNT(*) n FROM work_items WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND pmo_scope='MADRI_NUCCI' AND archived_at IS NULL;`)[0]?.n||0);
if(scopeCheck<1)throw new Error('Contexto PMO MADRI_NUCCI não comprovado em Produção; seed abortado.');

const cols=['id','display_id','company_id','project_id','person_name','person_group','area','role','process','manuality_current','as_is','to_be','automated','decreases','continues','new_responsibility','change_impact','change_impact_score','adoption_status','adoption_reason','observed_evidence','confidence_level','resistance_risk','resistance_risk_score','current_hours','future_hours','capacity_released','source_ref','owner','created_by','updated_by'];
function insertSql(r){
  const id=`MADRI-HUM-BASE-${r.display_id}`;
  const vals=[id,r.display_id,company.id,project.id,r.person_name,r.person_group,r.area,r.role,r.process,r.manuality_current,r.as_is,r.to_be,r.automated,r.decreases,r.continues,r.new_responsibility,r.change_impact,r.change_impact_score,r.adoption_status,r.adoption_reason,r.observed_evidence,r.confidence_level,r.resistance_risk,r.resistance_risk_score,r.current_hours,r.future_hours,r.capacity_released,r.source_ref,r.owner,'human-impact-seed-production','human-impact-seed-production'];
  const snapshot=JSON.stringify({...r,baseline_version:pack.baseline_version,method_note:pack.method_note,hours_policy:pack.hours_policy});
  return [
    `INSERT OR IGNORE INTO madri_human_impact(${cols.join(',')}) VALUES(${vals.map(lit).join(',')});`,
    `INSERT INTO madri_platform_audit(company_id,project_id,entity_type,entity_id,action_type,actor,snapshot_json) SELECT ${lit(company.id)},${lit(project.id)},'human-impact',h.id,'HUMAN_IMPACT_BASELINE_SEED_PRODUCTION','human-impact-seed-production',${lit(snapshot)} FROM madri_human_impact h WHERE h.company_id=${lit(company.id)} AND h.project_id=${lit(project.id)} AND h.display_id=${lit(r.display_id)} AND h.created_by='human-impact-seed-production' AND NOT EXISTS(SELECT 1 FROM madri_platform_audit a WHERE a.company_id=h.company_id AND a.project_id=h.project_id AND a.entity_type='human-impact' AND a.entity_id=h.id AND a.action_type='HUMAN_IMPACT_BASELINE_SEED_PRODUCTION');`
  ].join('\n');
}
const idsSql=expectedIds.map(lit).join(',');
const currentRows=()=>query(`SELECT display_id,created_by FROM madri_human_impact WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${idsSql}) AND archived_at IS NULL ORDER BY display_id;`);
const count=()=>currentRows().length;
const owned=()=>currentRows().filter(r=>r.created_by==='human-impact-seed-production').length;
const audits=()=>Number(query(`SELECT COUNT(DISTINCT entity_id) n FROM madri_platform_audit WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND entity_type='human-impact' AND action_type='HUMAN_IMPACT_BASELINE_SEED_PRODUCTION';`)[0]?.n||0);
const before=currentRows();
const foreignBefore=before.filter(r=>r.created_by!=='human-impact-seed-production');
if(foreignBefore.length)throw new Error(`Produção já contém IDs HUM-001..010 fora deste seed (${foreignBefore.map(r=>r.display_id).join(', ')}). Nenhum dado será sobrescrito.`);

console.log('Ambiente: production');
console.log(`Contexto: ${company.name} / ${project.name} / MADRI_NUCCI`);
console.log('Baseline esperado: impacto_humano=10, auditorias_seed=10, sequência>=11');
console.log(`Já presentes: impacto_humano=${count()}, seed_owned=${owned()}, auditorias_seed=${audits()}`);
if(!APPLY){console.log('[DRY-RUN] Nenhuma alteração aplicada.');process.exit(0)}

const sql=[
  'PRAGMA foreign_keys = ON;',
  ...records.map(insertSql),
  `INSERT INTO madri_platform_sequence(project_id,company_id,entity,next_value,updated_at) VALUES(${lit(project.id)},${lit(company.id)},'human-impact',11,datetime('now')) ON CONFLICT(project_id,entity) DO UPDATE SET company_id=excluded.company_id,next_value=MAX(madri_platform_sequence.next_value,11),updated_at=datetime('now');`
].join('\n');
if(/DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE|BEGIN\s+TRANSACTION|COMMIT\s*;|SAVEPOINT/i.test(sql))throw new Error('SQL humano contém operação proibida para o seed remoto.');
const tmp=`.tmp-madri-human-impact-production-${process.pid}.sql`;
fs.writeFileSync(tmp,sql,'utf8');
try{run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--file',tmp],{capture:false})}finally{try{fs.unlinkSync(tmp)}catch{}}

const after=count(),afterOwned=owned(),afterAudit=audits();
const seq=Number(query(`SELECT next_value FROM madri_platform_sequence WHERE project_id=${lit(project.id)} AND company_id=${lit(company.id)} AND entity='human-impact';`)[0]?.next_value||0);
const exactAfter=currentRows().map(r=>r.display_id);
if(after!==10||afterOwned!==10||afterAudit<10||seq<11||expectedIds.some((id,i)=>exactAfter[i]!==id))throw new Error(`Seed humano incompleto: registros=${after}/10, seed_owned=${afterOwned}/10, auditorias=${afterAudit}/10, sequência=${seq}/11.`);
console.log(`[OK] Baseline de Impacto Humano MADRI persistido no D1 Produção: registros=${after}, auditorias>=${afterAudit}, sequência=${seq}.`);
