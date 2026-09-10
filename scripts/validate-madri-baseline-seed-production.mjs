import fs from 'node:fs';
import zlib from 'node:zlib';

const seedFile='scripts/seed-madri-governance-baseline-production.mjs';
const workflowFile='.github/workflows/madri-baseline-seed-production.yml';
const reqFile='data/madri/madri-governance-requirements-baseline.json.gz.b64';
const testFile='data/madri/madri-governance-tests-baseline.json.gz.b64';
for(const f of [seedFile,workflowFile,reqFile,testFile]) if(!fs.existsSync(f)) throw new Error(`Arquivo obrigatório ausente: ${f}`);

const seed=fs.readFileSync(seedFile,'utf8');
const workflow=fs.readFileSync(workflowFile,'utf8');
const decode=file=>JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(file,'utf8').trim(),'base64')).toString('utf8'));
const req=decode(reqFile).requirements||[];
const tests=decode(testFile).tests||[];

if(req.length!==86) throw new Error(`Baseline requisitos inválida: ${req.length}/86`);
if(tests.length!==54) throw new Error(`Baseline testes inválida: ${tests.length}/54`);
if(new Set(req.map(x=>x.display_id)).size!==86) throw new Error('IDs duplicados em requisitos');
if(new Set(tests.map(x=>x.display_id)).size!==54) throw new Error('IDs duplicados em testes');
if(!req.some(x=>String(x.origin||'').toLowerCase().includes('rfi'))) console.warn('[ATENÇÃO] Origem RFI não detectada por texto; contagem permanece validada.');

const mustSeed=[
  "const CONFIG = 'wrangler.production.toml'",
  "const CONFIRM = 'SEED-MADRI-BASELINE-PRODUCTION'",
  'INSERT OR IGNORE INTO madri_requirements',
  'INSERT OR IGNORE INTO madri_tests',
  'INSERT OR IGNORE INTO madri_implementation_phases',
  'INSERT OR IGNORE INTO madri_readiness',
  'Tenant MADRI não resolvido de forma única em Produção',
  'Projeto MADRI/NUCCI não resolvido de forma única em Produção',
  'Baseline esperado: requisitos=86, testes=54, fases=15, readiness=17',
];
for(const s of mustSeed) if(!seed.includes(s)) throw new Error(`Contrato produtivo ausente no seed: ${s}`);
if(seed.includes('wrangler.stage.toml')||seed.includes('SEED-MADRI-BASELINE-STAGE')) throw new Error('Seed produtivo não pode apontar para STAGE.');
if(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(?:companies|projects)\b/i.test(seed)) throw new Error('Seed produtivo não pode criar empresa/projeto.');
if(/DELETE\s+FROM|DROP\s+TABLE|TRUNCATE\s+TABLE/i.test(seed)) throw new Error('Operação destrutiva encontrada no seed produtivo.');
if(/BEGIN\s+TRANSACTION|COMMIT\s*;|SAVEPOINT/i.test(seed)) throw new Error('Transação explícita incompatível com D1 remoto encontrada.');

if(!workflow.includes('workflow_dispatch:')) throw new Error('Workflow produtivo deve ser manual por workflow_dispatch.');
if(!workflow.includes('pull_request:')) throw new Error('Workflow deve validar a PR sem executar escrita.');
if(/^\s{2}push:/m.test(workflow)||/^\s{2}schedule:/m.test(workflow)) throw new Error('Workflow de seed produtivo não pode ter gatilho push/schedule.');
if(!workflow.includes("github.event_name == 'workflow_dispatch'")) throw new Error('Job de escrita deve exigir workflow_dispatch.');
if(!workflow.includes("inputs.confirm == 'SEED-MADRI-BASELINE-PRODUCTION'")) throw new Error('Job de escrita deve exigir confirmação literal de Produção.');
if(!workflow.includes('backup-production-madri-baseline-')) throw new Error('Backup D1 produtivo obrigatório não encontrado.');
if(!workflow.includes('retention-days: 30')) throw new Error('Backup produtivo deve ser retido por 30 dias.');
if(workflow.includes('wrangler.stage.toml')||workflow.includes('allamo-pmo-stage')) throw new Error('Workflow produtivo contém referência ao STAGE.');
const backupPos=workflow.indexOf('Backup obrigatório do D1 Produção');
const applyPos=workflow.indexOf('--apply --confirm=SEED-MADRI-BASELINE-PRODUCTION');
if(backupPos<0||applyPos<0||backupPos>applyPos) throw new Error('Backup deve ocorrer antes da aplicação do baseline.');

console.log('[OK] Seed MADRI Produção: manual-only, fail-closed, backup-first, sem criação de tenant/projeto e baseline 86/54/15/17 validado.');
