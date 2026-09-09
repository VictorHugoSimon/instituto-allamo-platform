import fs from 'node:fs';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

const WRANGLER = 'wrangler@4.124.0';
const DB = 'DB';
const REQ_FILE = 'data/madri/madri-governance-requirements-baseline.json.gz.b64';
const TEST_FILE = 'data/madri/madri-governance-tests-baseline.json.gz.b64';
const envArg = (process.argv.find(a => a.startsWith('--env=')) || '').slice(6).toLowerCase();
const APPLY = process.argv.includes('--apply');
const confirmArg = (process.argv.find(a => a.startsWith('--confirm=')) || '').slice(10);

const ENV = {
  stage: { config: 'wrangler.stage.toml', confirm: 'SEED-MADRI-BASELINE-STAGE' },
}[envArg];

if (!ENV) {
  console.error('[ABORTADO] Este seed é deliberadamente STAGE-only. Use --env=stage.');
  process.exit(2);
}
if (APPLY && confirmArg !== ENV.confirm) {
  console.error(`[ABORTADO] Para aplicar use --confirm=${ENV.confirm}`);
  process.exit(2);
}
for (const file of [ENV.config, REQ_FILE, TEST_FILE]) {
  if (!fs.existsSync(file)) {
    console.error(`[ABORTADO] Arquivo ausente: ${file}`);
    process.exit(2);
  }
}

function decodeJson(file) {
  const b64 = fs.readFileSync(file, 'utf8').trim();
  const raw = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
  return JSON.parse(raw);
}

const reqPack = decodeJson(REQ_FILE);
const testPack = decodeJson(TEST_FILE);
const requirements = Array.isArray(reqPack.requirements) ? reqPack.requirements : [];
const tests = Array.isArray(testPack.tests) ? testPack.tests : [];
const phases = [
  'Diagnóstico e RFI','Blueprint AS IS','Blueprint TO BE','Fechamento de Gaps','Configurações',
  'Customizações','Integrações','Dados / Migração','SIT','UAT','Treinamento','Cutover','Go/No-Go','Go-live','Hypercare'
];
const readiness = [
  'Blueprint/processos','Requisitos','Gaps','Configurações','Customizações','Integrações','Dados','SIT','UAT','E2E',
  'Treinamento','Defeitos','Riscos','Cutover','Contingência','Suporte','Documentação'
];

if (requirements.length !== 86) throw new Error(`Baseline de requisitos inválida: ${requirements.length} (esperado 86).`);
if (tests.length !== 54) throw new Error(`Baseline de testes inválida: ${tests.length} (esperado 54).`);
if (new Set(requirements.map(x => x.display_id)).size !== requirements.length) throw new Error('IDs duplicados no baseline de requisitos.');
if (new Set(tests.map(x => x.display_id)).size !== tests.length) throw new Error('IDs duplicados no baseline de testes.');

const allowedCoverage = new Set(['Coberto', 'Coberto parcialmente', 'Não localizado', 'Gap', 'Novo requisito']);
for (const r of requirements) if (!allowedCoverage.has(String(r.coverage_status || ''))) throw new Error(`Cobertura inválida em ${r.display_id}`);
const allowedTypes = new Set(['SIT', 'UAT', 'E2E']);
const allowedPriorities = new Set(['P1', 'P2', 'P3']);
for (const t of tests) {
  if (!allowedTypes.has(String(t.test_type || ''))) throw new Error(`Tipo de teste inválido em ${t.display_id}`);
  if (!allowedPriorities.has(String(t.priority || ''))) throw new Error(`Prioridade inválida em ${t.display_id}`);
}

function run(args, { capture = true } = {}) {
  const exe = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(exe, ['--yes', ...args], {
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    if (capture) {
      process.stdout.write(r.stdout || '');
      process.stderr.write(r.stderr || '');
    }
    throw new Error(`Wrangler falhou (${r.status})`);
  }
  return capture ? String(r.stdout || '') + String(r.stderr || '') : '';
}

function parse(text) {
  const clean = String(text || '').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, '').trim();
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] !== '[' && clean[i] !== '{') continue;
    for (let j = clean.length - 1; j > i; j--) {
      if (clean[j] !== ']' && clean[j] !== '}') continue;
      try { return JSON.parse(clean.slice(i, j + 1)); } catch {}
    }
  }
  throw new Error('JSON D1 não reconhecido');
}
function results(v) {
  if (Array.isArray(v)) return v.flatMap(results);
  if (v && typeof v === 'object') {
    if (Array.isArray(v.results)) return v.results;
    for (const x of Object.values(v)) {
      const r = results(x);
      if (r.length) return r;
    }
  }
  return [];
}
function query(sql) {
  return results(parse(run([WRANGLER, 'd1', 'execute', DB, '--remote', '--config', ENV.config, '--command', sql, '--json'])));
}
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const companies = query('SELECT id,name FROM companies;');
const matches = companies.filter(r => ['madrid', 'madri'].includes(norm(r.id)) || ['madrid', 'madri'].includes(norm(r.name)));
if (matches.length !== 1) throw new Error(`Tenant MADRI não resolvido de forma única (matches=${matches.length}).`);
const company = matches[0];
const projects = query(`SELECT id,name,company_id FROM projects WHERE company_id=${lit(company.id)} ORDER BY id;`);
const project = projects.find(r => /nucci/i.test(String(r.name || ''))) || projects.find(r => /madri|madrid/i.test(String(r.name || ''))) || projects[0];
if (!project) throw new Error('Projeto MADRI/NUCCI não encontrado no tenant MADRI.');

function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replaceAll("'", "''")}'`;
}
function reqSql(r) {
  const id = `MADRI-BASE-REQ-${r.display_id}`;
  const cols = ['id','display_id','company_id','project_id','origin','area','subarea','requirement','priority','criticality','eliminatory','source_document','target_document','section','coverage_status','gap','classification','owner','action_id','test_id','evidence','acceptance','created_by','updated_by'];
  const vals = [id,r.display_id,company.id,project.id,r.origin,r.area,r.subarea,r.requirement,r.priority,r.criticality,!!r.eliminatory,r.source_document,r.target_document,r.section,r.coverage_status,r.gap,r.classification,r.owner,r.action_id,r.test_id,r.evidence,r.acceptance,'baseline-seed','baseline-seed'];
  return `INSERT OR IGNORE INTO madri_requirements(${cols.join(',')}) VALUES(${vals.map(lit).join(',')});`;
}
function testSql(t) {
  const id = `MADRI-BASE-${t.display_id}`;
  const cols = ['id','display_id','company_id','project_id','test_type','front','process','scenario','priority','owner','precondition','steps','expected_result','actual_result','expected_met','status','evidence','defect_id','origin','requirement_id','action_id','block_reason','executed_at','executor','approver','created_by','updated_by'];
  const vals = [id,t.display_id,company.id,project.id,t.test_type,t.front,t.process,t.scenario,t.priority,t.owner,t.precondition,t.steps,t.expected_result,t.actual_result,!!t.expected_met,t.status,t.evidence,t.defect_id,t.origin,t.requirement_id,t.action_id,t.block_reason,t.executed_at,t.executor,t.approver,'baseline-seed','baseline-seed'];
  return `INSERT OR IGNORE INTO madri_tests(${cols.join(',')}) VALUES(${vals.map(lit).join(',')});`;
}

function phaseSql(name, index) {
  const display = `FAS-${String(index + 1).padStart(2, '0')}`;
  const id = `MADRI-${display}`;
  const cols = ['id','display_id','company_id','project_id','phase_order','name','owner','status','acceptance_criteria','evidence','created_by','updated_by'];
  const vals = [id,display,company.id,project.id,index+1,name,'PENDENTE DE VALIDAÇÃO','A confirmar','A confirmar','Sem evidência suficiente','baseline-seed','baseline-seed'];
  return `INSERT OR IGNORE INTO madri_implementation_phases(${cols.join(',')}) VALUES(${vals.map(lit).join(',')});`;
}
function readinessSql(category, index) {
  const display = `RDY-${String(index + 1).padStart(3, '0')}`;
  const id = `MADRI-${display}`;
  const cols = ['id','display_id','company_id','project_id','category','condition_text','owner','status','evidence','blocking','created_by','updated_by'];
  const vals = [id,display,company.id,project.id,category,`Validar prontidão: ${category}`,'PENDENTE DE VALIDAÇÃO','Pendente','Sem evidência suficiente',true,'baseline-seed','baseline-seed'];
  return `INSERT OR IGNORE INTO madri_readiness(${cols.join(',')}) VALUES(${vals.map(lit).join(',')});`;
}

const phaseIds = phases.map((_,i)=>`FAS-${String(i+1).padStart(2,'0')}`);
const readyIds = readiness.map((_,i)=>`RDY-${String(i+1).padStart(3,'0')}`);
const currentReq = Number(query(`SELECT COUNT(*) n FROM madri_requirements WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${requirements.map(r => lit(r.display_id)).join(',')});`)[0]?.n || 0);
const currentTests = Number(query(`SELECT COUNT(*) n FROM madri_tests WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${tests.map(t => lit(t.display_id)).join(',')});`)[0]?.n || 0);
const currentPhases = Number(query(`SELECT COUNT(*) n FROM madri_implementation_phases WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${phaseIds.map(lit).join(',')});`)[0]?.n || 0);
const currentReady = Number(query(`SELECT COUNT(*) n FROM madri_readiness WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${readyIds.map(lit).join(',')});`)[0]?.n || 0);
console.log(`Ambiente: ${envArg}`);
console.log(`Contexto: ${company.name} / ${project.name}`);
console.log(`Baseline esperado: requisitos=86, testes=54, fases=15, readiness=17`);
console.log(`Já presentes: requisitos=${currentReq}, testes=${currentTests}, fases=${currentPhases}, readiness=${currentReady}`);
if (!APPLY) {
  console.log('[DRY-RUN] Nenhuma alteração aplicada.');
  process.exit(0);
}

const sql = [
  'PRAGMA foreign_keys = ON;',
  'BEGIN TRANSACTION;',
  ...requirements.map(reqSql),
  ...tests.map(testSql),
  ...phases.map(phaseSql),
  ...readiness.map(readinessSql),
  `INSERT INTO madri_platform_sequence(project_id,company_id,entity,next_value,updated_at) VALUES(${lit(project.id)},${lit(company.id)},'tests',55,datetime('now')) ON CONFLICT(project_id,entity) DO UPDATE SET company_id=excluded.company_id,next_value=MAX(madri_platform_sequence.next_value,55),updated_at=datetime('now');`,
  `INSERT INTO madri_platform_sequence(project_id,company_id,entity,next_value,updated_at) VALUES(${lit(project.id)},${lit(company.id)},'phases',16,datetime('now')) ON CONFLICT(project_id,entity) DO UPDATE SET company_id=excluded.company_id,next_value=MAX(madri_platform_sequence.next_value,16),updated_at=datetime('now');`,
  `INSERT INTO madri_platform_sequence(project_id,company_id,entity,next_value,updated_at) VALUES(${lit(project.id)},${lit(company.id)},'readiness',18,datetime('now')) ON CONFLICT(project_id,entity) DO UPDATE SET company_id=excluded.company_id,next_value=MAX(madri_platform_sequence.next_value,18),updated_at=datetime('now');`,
  'COMMIT;',
].join('\n');
const tmp = `.tmp-madri-baseline-${process.pid}.sql`;
fs.writeFileSync(tmp, sql, 'utf8');
try {
  run([WRANGLER, 'd1', 'execute', DB, '--remote', '--config', ENV.config, '--file', tmp], { capture: false });
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}
const afterReq = Number(query(`SELECT COUNT(*) n FROM madri_requirements WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${requirements.map(r => lit(r.display_id)).join(',')});`)[0]?.n || 0);
const afterTests = Number(query(`SELECT COUNT(*) n FROM madri_tests WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${tests.map(t => lit(t.display_id)).join(',')});`)[0]?.n || 0);
const afterPhases = Number(query(`SELECT COUNT(*) n FROM madri_implementation_phases WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${phaseIds.map(lit).join(',')});`)[0]?.n || 0);
const afterReady = Number(query(`SELECT COUNT(*) n FROM madri_readiness WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND display_id IN (${readyIds.map(lit).join(',')});`)[0]?.n || 0);
if (afterReq !== 86 || afterTests !== 54 || afterPhases !== 15 || afterReady !== 17) throw new Error(`Seed incompleto: requisitos=${afterReq}/86, testes=${afterTests}/54, fases=${afterPhases}/15, readiness=${afterReady}/17.`);
console.log(`[OK] Baseline MADRI persistido no D1 Stage: requisitos=${afterReq}, testes=${afterTests}, fases=${afterPhases}, readiness=${afterReady}.`);
