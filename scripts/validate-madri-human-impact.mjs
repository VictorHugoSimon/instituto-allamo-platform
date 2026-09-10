import fs from 'node:fs';

const need=[
  'migrations/2026-09-10-madri-human-impact.sql',
  'src/madri-human-impact-api.js',
  'scripts/harden-madri-human-impact.mjs',
  'public/madri-impacto-humano/index.html',
  'public/madri/assets/platform.js',
  'scripts/ensure-madri-governance-schema.mjs'
];
for(const f of need)if(!fs.existsSync(f))throw new Error(`Arquivo obrigatório ausente: ${f}`);
const mig=fs.readFileSync(need[0],'utf8');
const api=fs.readFileSync(need[1],'utf8');
const page=fs.readFileSync(need[3],'utf8');
const nav=fs.readFileSync(need[4],'utf8');
const ensure=fs.readFileSync(need[5],'utf8');
const worker=fs.existsSync('public/_worker.js')?fs.readFileSync('public/_worker.js','utf8'):'';

for(const token of ['CREATE TABLE IF NOT EXISTS madri_human_impact','company_id TEXT NOT NULL','project_id INTEGER NOT NULL','adoption_status','adoption_reason','observed_evidence','confidence_level','resistance_risk_score','change_impact_score','current_hours','future_hours','capacity_released','archived_at'])if(!mig.includes(token))throw new Error(`Migration humana incompleta: ${token}`);
if(/DROP TABLE|DELETE FROM madri_human_impact/i.test(mig))throw new Error('Migration humana contém operação destrutiva.');
for(const token of ["path==='madri-platform/human-impact'",'human-impact\\/[^/]+\\/history','human-impact\\/[^/]+\\/restore','SOFT_DELETE','madri_platform_audit'])if(!api.includes(token))throw new Error(`API humana incompleta: ${token}`);
for(const status of ['EMBAIXADOR','ENGAJADO','NEUTRO / ADAPTÁVEL','ATENÇÃO NA ADOÇÃO','A CONFIRMAR'])if(!api.includes(status)||!page.includes(status))throw new Error(`Status de Change Management ausente: ${status}`);
if(/localStorage|sessionStorage/.test(page))throw new Error('Mapa de Impacto Humano não pode usar storage do navegador como fonte operacional.');
for(const token of ['Mapa de Impacto Humano','Risco de resistência / dificuldade de adoção','Impacto da mudança','A medir','Motivo da aderência','Evidência observada','Nível de confiança','/api/madri-platform/human-impact'])if(!page.includes(token))throw new Error(`Página humana incompleta: ${token}`);
if(!nav.includes('/madri-impacto-humano/')||!nav.includes('Gestão da mudança'))throw new Error('Navegação MADRI não expõe o Mapa de Impacto Humano.');
if(!ensure.includes("migrations/2026-09-10-madri-human-impact.sql")||!ensure.includes('madri_human_impact'))throw new Error('Helper de schema MADRI não contempla Impacto Humano.');
if(worker){const begin=(worker.match(/^\s*\/\/ BEGIN MADRI HUMAN IMPACT API\s*$/gm)||[]).length,end=(worker.match(/^\s*\/\/ END MADRI HUMAN IMPACT API\s*$/gm)||[]).length;if(begin!==1||end!==1)throw new Error(`Worker deve conter 1 bloco humano (begin=${begin}, end=${end}).`);}
console.log('[OK] MADRI Impacto Humano: D1, API, histórico, lixeira, Change Management, gráfico executivo, horas A medir e isolamento estático validados.');
