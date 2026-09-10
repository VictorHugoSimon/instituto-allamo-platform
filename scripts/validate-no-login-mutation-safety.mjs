import fs from 'node:fs';

const worker=fs.readFileSync('public/_worker.js','utf8');
const migration=fs.readFileSync('migrations/2026-09-08-pmo-onboarding-idempotency.sql','utf8');
const schema=fs.readFileSync('scripts/ensure-onboarding-schema.mjs','utf8');
const stageWorkflow=fs.readFileSync('.github/workflows/deploy-stage.yml','utf8');
const prodWorkflow=fs.readFileSync('.github/workflows/deploy-production.yml','utf8');
const must=(needle,label)=>{if(!worker.includes(needle))throw new Error(`Ausente: ${label}`)};

must("__portal_no_login:true",'identidade sintética do Portal sem login');
must("user.__portal_no_login === true && request.method === 'DELETE'",'bloqueio de DELETE para identidade sem login');
must("code:'authenticated_session_required'",'código explícito para ação destrutiva bloqueada');
must("error:'Ação destrutiva exige sessão autenticada'",'mensagem operacional segura');
if(worker.includes("code:'authenticated_onboarding_required'"))throw new Error('Onboarding ainda bloqueia a identidade PMO sintética dos hosts oficiais.');
if(worker.includes('Onboarding exige sessão humana autenticada'))throw new Error('Mensagem legada de sessão humana ainda existe no onboarding.');

must('// [allamo-onboarding-company-integrity]','hardening de onboarding de empresa');
must("SELECT id FROM companies WHERE lower(trim(name)) = lower(trim(?)) LIMIT 1",'detecção de empresa duplicada por nome');
must("Já existe empresa com esse nome",'conflito explícito de empresa duplicada');
must("await logEvent(env, user, 'empresa:criar'",'auditoria de criação de empresa');

must('// [allamo-onboarding-project-integrity]','hardening de onboarding de projeto');
must("Empresa é obrigatória para criar projeto",'empresa obrigatória no projeto');
must("SELECT id FROM companies WHERE id = ? LIMIT 1",'validação de existência da empresa do projeto');
must("Empresa não encontrada",'erro explícito para empresa inexistente');
must("SELECT id FROM projects WHERE company_id = ? AND lower(trim(name)) = lower(trim(?)) LIMIT 1",'detecção de projeto duplicado por empresa');
must("Já existe projeto com esse nome nesta empresa",'conflito explícito de projeto duplicado');
must("await logEvent(env, user, 'projeto:criar'",'auditoria de criação de projeto');

must("if (!['admin','pmo'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);",'RBAC de criação de empresa');
must("if (!['admin','pmo','gestor'].includes(user.role)) return json({ error: 'Sem permissão' }, 403);",'RBAC de criação de projeto');

for(const [needle,label] of [
  ['// [allamo-onboarding-company-request-guard]','gate de request_id da empresa'],
  ['// [allamo-onboarding-project-request-guard]','gate de request_id do projeto'],
  ["request.headers.get('idempotency-key')",'Idempotency-Key aceito pela API'],
  ["code:'idempotency_key_required'",'request_id obrigatório'],
  ["code:'idempotency_conflict'",'conflito de reutilização de request_id'],
  ["code:'request_in_progress'",'reserva concorrente fail-closed'],
  ['INSERT OR IGNORE INTO onboarding_requests','reserva idempotente antes do INSERT de negócio'],
  ["status='completed',entity_id=?",'conclusão do ledger após criação'],
  ['replayed:true','replay idempotente retorna recurso já criado'],
  ["if(user.role==='gestor') b.company_id=scope",'gestor não pode escolher empresa fora do próprio escopo']
]) must(needle,label);

if(!migration.includes('CREATE TABLE IF NOT EXISTS onboarding_requests'))throw new Error('Migration do ledger de onboarding ausente.');
if(!migration.includes('request_id TEXT PRIMARY KEY'))throw new Error('request_id não é chave única persistida.');
if(!migration.includes("status TEXT NOT NULL DEFAULT 'pending'"))throw new Error('Ledger não possui estado pending fail-closed.');
if(/\b(?:DELETE|DROP|TRUNCATE)\b/i.test(migration.replace(/^--.*$/gm,'')))throw new Error('Migration de onboarding não pode conter operação destrutiva.');
for(const needle of ['onboarding_requests','2026-09-08-pmo-onboarding-idempotency.sql','APPLY-ONBOARDING-SCHEMA-STAGE','APPLY-ONBOARDING-SCHEMA-PRODUCTION']){
  if(!schema.includes(needle))throw new Error(`Gate de schema de onboarding incompleto: ${needle}`);
}
if(/\b(?:DELETE|DROP|TRUNCATE)\b/i.test(schema))throw new Error('Gate de schema de onboarding não pode executar operação destrutiva.');
for(const [workflow,env,confirm] of [[stageWorkflow,'stage','APPLY-ONBOARDING-SCHEMA-STAGE'],[prodWorkflow,'production','APPLY-ONBOARDING-SCHEMA-PRODUCTION']]){
  if(!workflow.includes(`node scripts/ensure-onboarding-schema.mjs --env=${env}`))throw new Error(`Release ${env} não faz dry-run do schema de onboarding.`);
  if(!workflow.includes(`node scripts/ensure-onboarding-schema.mjs --env=${env} --apply --confirm=${confirm}`))throw new Error(`Release ${env} não aplica ledger de onboarding antes do deploy.`);
}

const companyGuard=worker.indexOf('// [allamo-onboarding-company-request-guard]');
const companyReserve=worker.indexOf('// [allamo-onboarding-company-request-reserve]',companyGuard);
const companyInsert=worker.indexOf('INSERT INTO companies',companyReserve);
if(!(companyGuard>=0&&companyReserve>companyGuard&&companyInsert>companyReserve))throw new Error('Empresa pode ser inserida antes da reserva idempotente.');
const projectGuard=worker.indexOf('// [allamo-onboarding-project-request-guard]');
const projectReserve=worker.indexOf('// [allamo-onboarding-project-request-reserve]',projectGuard);
const projectInsert=worker.indexOf('INSERT INTO projects',projectReserve);
if(!(projectGuard>=0&&projectReserve>projectGuard&&projectInsert>projectReserve))throw new Error('Projeto pode ser inserido antes da reserva idempotente.');

await import('./validate-onboarding-ui-idempotency.mjs');
await import('./validate-work-import.mjs');

console.log('OK: onboarding e Work Management operam no modo oficial sem login com RBAC sintético PMO, idempotência/deduplicação e auditoria; DELETE destrutivo continua protegido.');
