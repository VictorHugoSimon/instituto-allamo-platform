import fs from 'node:fs';

const dataFile='data/madri/madri-human-impact-baseline-v01.json';
const seedFile='scripts/seed-madri-human-impact-baseline.mjs';
const workflowFile='.github/workflows/madri-human-impact-seed-stage.yml';
const markerFile='ops/stage/madri-human-impact-seed-authorized-2026-09-10.json';
for(const f of [dataFile,seedFile,workflowFile,markerFile])if(!fs.existsSync(f))throw new Error(`Arquivo obrigatório ausente: ${f}`);
const pack=JSON.parse(fs.readFileSync(dataFile,'utf8'));
const rows=Array.isArray(pack.records)?pack.records:[];
const ids=Array.from({length:10},(_,i)=>`HUM-${String(i+1).padStart(3,'0')}`);
const statuses=new Set(['EMBAIXADOR','ENGAJADO','NEUTRO / ADAPTÁVEL','ATENÇÃO NA ADOÇÃO','A CONFIRMAR']);
const confidence=new Set(['Alta','Média','Baixa']);
if(pack.baseline_version!=='v0.1'||rows.length!==10)throw new Error('Contrato do baseline humano v0.1 inválido.');
if(new Set(rows.map(x=>x.display_id)).size!==10||ids.some(id=>!rows.some(x=>x.display_id===id)))throw new Error('IDs HUM-001..HUM-010 inválidos ou duplicados.');
for(const r of rows){
  if(!statuses.has(r.adoption_status))throw new Error(`${r.display_id}: aderência inválida.`);
  if(!confidence.has(r.confidence_level))throw new Error(`${r.display_id}: confiança inválida.`);
  for(const f of ['change_impact_score','resistance_risk_score'])if(!Number.isInteger(r[f])||r[f]<1||r[f]>5)throw new Error(`${r.display_id}: score inválido em ${f}.`);
  for(const f of ['current_hours','future_hours','capacity_released'])if(r[f]!=='A medir')throw new Error(`${r.display_id}: ${f} não pode ser inferido.`);
  for(const f of ['adoption_reason','observed_evidence','source_ref'])if(!String(r[f]||'').trim())throw new Error(`${r.display_id}: rastreabilidade incompleta em ${f}.`);
}
const seed=fs.readFileSync(seedFile,'utf8'),wf=fs.readFileSync(workflowFile,'utf8'),marker=JSON.parse(fs.readFileSync(markerFile,'utf8'));
for(const token of ['STAGE-only','SEED-MADRI-HUMAN-IMPACT-STAGE','INSERT OR IGNORE INTO madri_human_impact','HUMAN_IMPACT_BASELINE_SEED','human-impact-seed','madri_platform_sequence','--config',"'wrangler.stage.toml'"])if(!seed.includes(token))throw new Error(`Contrato do seed humano ausente: ${token}`);
if(/wrangler\.production\.toml|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE|BEGIN\s+TRANSACTION|COMMIT\s*;|SAVEPOINT/i.test(seed))throw new Error('Seed humano contém referência/operação proibida.');
for(const token of ['branches: [develop]','secure-d1-export.mjs','ensure-madri-governance-schema.mjs --env=stage','SEED-MADRI-HUMAN-IMPACT-STAGE','d1-stage-human-impact-backup','madri-human-impact-seed-authorized-2026-09-10.json'])if(!wf.includes(token))throw new Error(`Workflow humano incompleto: ${token}`);
if(/production/i.test(wf))throw new Error('Workflow humano one-shot não pode tocar Produção.');
if(marker.environment!=='stage'||marker.scope!=='MADRI_NUCCI'||marker.baseline!=='madri-human-impact-v0.1'||marker.record_count!==10||marker.authorized!==true)throw new Error('Marcador one-shot humano inválido.');
console.log('[OK] Baseline humano MADRI v0.1: 10 registros, rastreabilidade, horas A medir, seed idempotente STAGE-only e workflow com backup validados.');
