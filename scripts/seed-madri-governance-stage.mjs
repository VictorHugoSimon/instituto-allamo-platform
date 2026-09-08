import { spawnSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const confirm = (process.argv.find(a => a.startsWith('--confirm=')) || '').slice(10);
const EXPECTED = 'SEED-MADRI-GOV-STAGE';
const CONFIG = 'wrangler.stage.toml';
const WRANGLER = 'wrangler@4.124.0';
const DB = 'DB';

if (APPLY && confirm !== EXPECTED) {
  console.error(`[ABORTADO] Para gravar no D1 Stage use --apply --confirm=${EXPECTED}`);
  process.exit(2);
}

function run(args) {
  const exe = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(exe, ['--yes', ...args], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    process.stdout.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    throw new Error(`Wrangler falhou (${r.status})`);
  }
  return String(r.stdout || '') + String(r.stderr || '');
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

function rows(value) {
  if (Array.isArray(value)) return value.flatMap(rows);
  if (value && typeof value === 'object') {
    if (Array.isArray(value.results)) return value.results;
    for (const x of Object.values(value)) {
      const r = rows(x);
      if (r.length) return r;
    }
  }
  return [];
}

function sqlQuote(v) { return `'${String(v ?? '').replace(/'/g, "''")}'`; }
function query(sql) {
  return rows(parse(run([WRANGLER, 'd1', 'execute', DB, '--remote', '--config', CONFIG, '--command', sql, '--json'])));
}
function exec(sql) {
  if (!APPLY) return;
  run([WRANGLER, 'd1', 'execute', DB, '--remote', '--config', CONFIG, '--command', sql]);
}
function norm(v) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const companies = query('SELECT id,name FROM companies ORDER BY id;');
const matches = companies.filter(r => ['madri', 'madrid'].includes(norm(r.id)) || ['madri', 'madrid'].includes(norm(r.name)));
if (matches.length !== 1) {
  const allProjects = query('SELECT id,name,company_id FROM projects ORDER BY company_id,id;');
  console.log('Empresas atualmente presentes no Stage:');
  for (const c of companies) console.log(`- ${c.name} [${c.id}]`);
  console.log('Projetos atualmente presentes no Stage:');
  for (const p of allProjects) console.log(`- ${p.name} [${p.id}] company_id=${p.company_id}`);
  throw new Error(`Tenant MADRI deve resolver de forma única; encontrado(s): ${matches.length}. Nenhuma escrita foi executada.`);
}
const company = matches[0];
const projects = query(`SELECT id,name,company_id FROM projects WHERE company_id=${sqlQuote(company.id)} ORDER BY id;`);
const project = projects.find(r => /nucci/i.test(String(r.name || ''))) || projects.find(r => /madri|madrid/i.test(String(r.name || ''))) || projects[0];
if (!project) throw new Error('Projeto MADRI/NUCCI não encontrado para o tenant resolvido.');

const requiredTables = ['madri_implementation_phases','madri_readiness'];
for (const t of requiredTables) {
  const found = query(`SELECT name FROM sqlite_master WHERE type='table' AND name=${sqlQuote(t)};`);
  if (!found.some(r => r.name === t)) throw new Error(`Tabela obrigatória ausente no Stage: ${t}`);
}

const phases = [
  'Diagnóstico e RFI','Blueprint AS IS','Blueprint TO BE','Fechamento de Gaps','Configurações','Customizações','Integrações','Dados / Migração','SIT','UAT','Treinamento','Cutover','Go/No-Go','Go-live','Hypercare'
];
const readiness = [
  'Blueprint/processos','Requisitos','Gaps','Configurações','Customizações','Integrações','Dados','SIT','UAT','E2E','Treinamento','Defeitos','Riscos','Cutover','Contingência','Suporte','Documentação'
];

const beforePhases = Number(query(`SELECT COUNT(*) n FROM madri_implementation_phases WHERE company_id=${sqlQuote(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`)[0]?.n || 0);
const beforeReadiness = Number(query(`SELECT COUNT(*) n FROM madri_readiness WHERE company_id=${sqlQuote(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`)[0]?.n || 0);

const statements = [];
for (let i = 0; i < phases.length; i++) {
  const display = `FAS-${String(i + 1).padStart(2, '0')}`;
  const id = `MADRI-${display}`;
  statements.push(`INSERT OR IGNORE INTO madri_implementation_phases(id,display_id,company_id,project_id,phase_order,name,status,owner,acceptance_criteria,evidence,created_by,updated_by) VALUES(${sqlQuote(id)},${sqlQuote(display)},${sqlQuote(company.id)},${Number(project.id)},${i + 1},${sqlQuote(phases[i])},'A confirmar','PENDENTE DE VALIDAÇÃO','A confirmar','Sem evidência suficiente','PMO_BOOTSTRAP_STAGE','PMO_BOOTSTRAP_STAGE');`);
}
for (let i = 0; i < readiness.length; i++) {
  const display = `RDY-${String(i + 1).padStart(3, '0')}`;
  const id = `MADRI-${display}`;
  statements.push(`INSERT OR IGNORE INTO madri_readiness(id,display_id,company_id,project_id,category,condition_text,owner,status,evidence,blocking,created_by,updated_by) VALUES(${sqlQuote(id)},${sqlQuote(display)},${sqlQuote(company.id)},${Number(project.id)},${sqlQuote(readiness[i])},${sqlQuote(`Validar prontidão: ${readiness[i]}`)},'PENDENTE DE VALIDAÇÃO','Pendente','Sem evidência suficiente',1,'PMO_BOOTSTRAP_STAGE','PMO_BOOTSTRAP_STAGE');`);
}

console.log(`Ambiente: STAGE`);
console.log(`Tenant resolvido: ${company.name} (${company.id})`);
console.log(`Projeto resolvido: ${project.name} (${project.id})`);
console.log(`Antes: fases=${beforePhases}; readiness=${beforeReadiness}`);

if (!APPLY) {
  console.log(`[DRY-RUN] Seriam garantidas ${phases.length} fases e ${readiness.length} critérios de readiness via INSERT OR IGNORE. Nenhuma alteração aplicada.`);
  process.exit(0);
}

exec('BEGIN; ' + statements.join(' ') + ' COMMIT;');

const afterPhases = Number(query(`SELECT COUNT(*) n FROM madri_implementation_phases WHERE company_id=${sqlQuote(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`)[0]?.n || 0);
const afterReadiness = Number(query(`SELECT COUNT(*) n FROM madri_readiness WHERE company_id=${sqlQuote(company.id)} AND project_id=${Number(project.id)} AND archived_at IS NULL;`)[0]?.n || 0);
const dupPhases = Number(query(`SELECT COUNT(*) n FROM (SELECT display_id,COUNT(*) c FROM madri_implementation_phases WHERE company_id=${sqlQuote(company.id)} AND project_id=${Number(project.id)} GROUP BY display_id HAVING c>1);`)[0]?.n || 0);
const dupReadiness = Number(query(`SELECT COUNT(*) n FROM (SELECT display_id,COUNT(*) c FROM madri_readiness WHERE company_id=${sqlQuote(company.id)} AND project_id=${Number(project.id)} GROUP BY display_id HAVING c>1);`)[0]?.n || 0);

if (afterPhases < phases.length || afterReadiness < readiness.length || dupPhases || dupReadiness) {
  throw new Error(`Bootstrap incompleto: fases=${afterPhases}/${phases.length}; readiness=${afterReadiness}/${readiness.length}; duplicidades=${dupPhases + dupReadiness}`);
}
console.log(`[OK] Bootstrap MADRI Stage concluído de forma idempotente: fases=${afterPhases}; readiness=${afterReadiness}; duplicidades=0.`);
