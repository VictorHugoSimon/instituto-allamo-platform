import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WRANGLER = 'wrangler@4.124.0';
const DB = 'DB';
const DATA = 'data/madri-governance-baseline/requirements-v1.json';
const envArg = (process.argv.find(a => a.startsWith('--env=')) || '').slice(6).toLowerCase();
const APPLY = process.argv.includes('--apply');
const confirmArg = (process.argv.find(a => a.startsWith('--confirm=')) || '').slice(10);
const ENV = {
  stage: { config: 'wrangler.stage.toml', confirm: 'SEED-MADRI-BASELINE-STAGE' },
  production: { config: 'wrangler.production.toml', confirm: 'SEED-MADRI-BASELINE-PRODUCTION' }
}[envArg];

if (!ENV) {
  console.error('[ABORTADO] Informe --env=stage ou --env=production.');
  process.exit(2);
}
if (!fs.existsSync(ENV.config) || !fs.existsSync(DATA)) {
  console.error('[ABORTADO] Config ou baseline MADRI ausente.');
  process.exit(2);
}
if (APPLY && confirmArg !== ENV.confirm) {
  console.error(`[ABORTADO] Para aplicar use --confirm=${ENV.confirm}`);
  process.exit(2);
}

function run(args, { capture = true } = {}) {
  const exe = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(exe, ['--yes', ...args], {
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32'
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

const q = v => `'${String(v ?? '').replaceAll("'", "''")}'`;
const baseline = JSON.parse(fs.readFileSync(DATA, 'utf8'));
if (baseline?.counts?.rfi_reconstructed !== 71 || baseline?.counts?.new_post_rfi !== 15 || baseline?.counts?.total !== 86) {
  throw new Error('Baseline MADRI inválido: esperado 71 RFI + 15 novos = 86.');
}
if (!Array.isArray(baseline.rfi) || !Array.isArray(baseline.new)) throw new Error('Baseline MADRI sem coleções esperadas.');
const allIds = [...baseline.rfi.map(r => r[0]), ...baseline.new.map(r => r[0])];
if (new Set(allIds).size !== 86) throw new Error('Baseline MADRI contém IDs duplicados.');
if (allIds.some(x => !/^RFI-|^NEW-/.test(String(x)))) throw new Error('Baseline MADRI contém ID fora do contrato RFI-/NEW-.');

const companies = query("SELECT id,name FROM companies WHERE lower(replace(replace(name,'í','i'),'á','a')) LIKE '%madri%' OR lower(id) IN ('madri','madrid') ORDER BY id;");
const normalized = companies.filter(r => ['madri', 'madrid'].includes(String(r.id || '').toLowerCase()) || /madri|madrid/i.test(String(r.name || '')));
if (normalized.length !== 1) throw new Error(`Tenant MADRI não resolvido de forma única (${normalized.length}).`);
const company = normalized[0];
const projects = query(`SELECT id,name,company_id FROM projects WHERE company_id=${q(company.id)} ORDER BY id;`);
const project = projects.find(r => /nucci/i.test(String(r.name || ''))) || projects.find(r => /madri|madrid/i.test(String(r.name || ''))) || projects[0];
if (!project) throw new Error('Projeto MADRI/NUCCI não encontrado.');

const existing = query(`SELECT COUNT(*) AS n FROM madri_requirements WHERE company_id=${q(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`);
const existingN = Number(existing[0]?.n || 0);
console.log(`Ambiente: ${envArg}`);
console.log(`Tenant: ${company.name} (${company.id})`);
console.log(`Projeto: ${project.name} (${project.id})`);
console.log(`Baseline: 86 requisitos (71 RFI reconstruídos + 15 novos)`);
console.log(`Requisitos MADRI já existentes: ${existingN}`);
if (!APPLY) {
  console.log('[DRY-RUN] Nenhum dado de negócio foi alterado.');
  process.exit(0);
}

const coverage = s => ({
  'Coberto explícito': 'Coberto',
  'Coberto parcial': 'Coberto parcialmente',
  'Lacuna': 'Não localizado',
  'Lacuna / a confirmar': 'Não localizado'
}[String(s || '').trim()] || 'Não localizado');

const actor = 'baseline_seed_2026-09-08';
const sql = ['BEGIN TRANSACTION;'];
for (const [id, module, requirement, bbpStatus, bbpSection, auditReading, requiredAction, criticality] of baseline.rfi) {
  const internalId = `MADRI-REQ-${id}`;
  sql.push(`INSERT OR IGNORE INTO madri_requirements(id,display_id,company_id,project_id,origin,area,subarea,requirement,priority,criticality,eliminatory,source_document,target_document,section,coverage_status,gap,classification,owner,evidence,acceptance,created_by,updated_by) VALUES(${q(internalId)},${q(id)},${q(company.id)},${Number(project.id)},${q('RFI reconstruído · Auditoria RFI × Blueprint')},${q(module)},'',${q(requirement)},${q(criticality || 'Média')},${q(criticality || 'Média')},0,${q(baseline.source)},${q('NUCCI_BBP_Business_Blueprint_MADRI_v1.pdf')},${q(bbpSection)},${q(coverage(bbpStatus))},${q(auditReading)},'',${q('PENDENTE DE VALIDAÇÃO')},${q(bbpSection || 'Sem evidência suficiente')},${q(requiredAction || 'A confirmar')},${q(actor)},${q(actor)});`);
}
for (const [id, front, requirement, origin, whyRequired, action, criticality] of baseline.new) {
  const internalId = `MADRI-REQ-${id}`;
  const eliminatory = id === 'NEW-002' ? 1 : 0;
  sql.push(`INSERT OR IGNORE INTO madri_requirements(id,display_id,company_id,project_id,origin,area,subarea,requirement,priority,criticality,eliminatory,source_document,target_document,section,coverage_status,gap,classification,owner,evidence,acceptance,created_by,updated_by) VALUES(${q(internalId)},${q(id)},${q(company.id)},${Number(project.id)},${q(origin)},${q(front)},'',${q(requirement)},${q(criticality || 'Alta')},${q(criticality || 'Alta')},${eliminatory},${q(baseline.source)},${q('Business Blueprint MADRI / Plano de Ação / Testes')},${q(origin)},${q('Novo requisito')},${q(whyRequired)},'',${q('PENDENTE DE VALIDAÇÃO')},${q(origin || 'Sem evidência suficiente')},${q(action || 'A confirmar')},${q(actor)},${q(actor)});`);
}

const phases = ['Diagnóstico e RFI','Blueprint AS IS','Blueprint TO BE','Fechamento de Gaps','Configurações','Customizações','Integrações','Dados / Migração','SIT','UAT','Treinamento','Cutover','Go/No-Go','Go-live','Hypercare'];
phases.forEach((name, i) => {
  const displayId = `FAS-${String(i + 1).padStart(2, '0')}`;
  sql.push(`INSERT OR IGNORE INTO madri_implementation_phases(id,display_id,company_id,project_id,phase_order,name,status,owner,acceptance_criteria,evidence,created_by,updated_by) VALUES(${q(`MADRI-${displayId}`)},${q(displayId)},${q(company.id)},${Number(project.id)},${i + 1},${q(name)},${q('A confirmar')},${q('PENDENTE DE VALIDAÇÃO')},${q('A confirmar')},${q('Sem evidência suficiente')},${q(actor)},${q(actor)});`);
});
const readiness = ['Blueprint/processos','Requisitos','Gaps','Configurações','Customizações','Integrações','Dados','SIT','UAT','E2E','Treinamento','Defeitos','Riscos','Cutover','Contingência','Suporte','Documentação'];
readiness.forEach((category, i) => {
  const displayId = `RDY-${String(i + 1).padStart(3, '0')}`;
  sql.push(`INSERT OR IGNORE INTO madri_readiness(id,display_id,company_id,project_id,category,condition_text,owner,status,evidence,blocking,created_by,updated_by) VALUES(${q(`MADRI-${displayId}`)},${q(displayId)},${q(company.id)},${Number(project.id)},${q(category)},${q(`Validar prontidão: ${category}`)},${q('PENDENTE DE VALIDAÇÃO')},${q('Pendente')},${q('Sem evidência suficiente')},1,${q(actor)},${q(actor)});`);
});

sql.push(`INSERT INTO madri_platform_audit(company_id,project_id,entity_type,entity_id,action_type,actor,snapshot_json)
SELECT r.company_id,r.project_id,'requirements',r.id,'BASELINE_SEED',${q(actor)},json_object('display_id',r.display_id,'source_document',r.source_document,'coverage_status',r.coverage_status)
FROM madri_requirements r
WHERE r.company_id=${q(company.id)} AND r.project_id=${Number(project.id)} AND (r.display_id LIKE 'RFI-%' OR r.display_id LIKE 'NEW-%')
AND NOT EXISTS (SELECT 1 FROM madri_platform_audit a WHERE a.project_id=r.project_id AND a.entity_type='requirements' AND a.entity_id=r.id AND a.action_type='BASELINE_SEED');`);
sql.push('COMMIT;');

const temp = path.join(os.tmpdir(), `madri-baseline-${Date.now()}.sql`);
fs.writeFileSync(temp, sql.join('\n'));
try {
  run([WRANGLER, 'd1', 'execute', DB, '--remote', '--config', ENV.config, '--file', temp], { capture: false });
} finally {
  try { fs.unlinkSync(temp); } catch {}
}

const after = query(`SELECT COUNT(*) AS n FROM madri_requirements WHERE company_id=${q(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`);
const rfiCount = query(`SELECT COUNT(*) AS n FROM madri_requirements WHERE company_id=${q(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL AND display_id LIKE 'RFI-%';`);
const newCount = query(`SELECT COUNT(*) AS n FROM madri_requirements WHERE company_id=${q(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL AND display_id LIKE 'NEW-%';`);
const phaseCount = query(`SELECT COUNT(*) AS n FROM madri_implementation_phases WHERE company_id=${q(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`);
const readyCount = query(`SELECT COUNT(*) AS n FROM madri_readiness WHERE company_id=${q(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`);
const counts = { total: Number(after[0]?.n || 0), rfi: Number(rfiCount[0]?.n || 0), new: Number(newCount[0]?.n || 0), phases: Number(phaseCount[0]?.n || 0), readiness: Number(readyCount[0]?.n || 0) };
if (counts.rfi < 71 || counts.new < 15 || counts.phases < 15 || counts.readiness < 17) {
  throw new Error(`Seed MADRI incompleto: ${JSON.stringify(counts)}`);
}
console.log(`[OK] Baseline MADRI aplicado sem sobrescrever registros existentes: ${JSON.stringify(counts)}`);
