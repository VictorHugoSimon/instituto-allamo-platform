import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const hardener=read('scripts/harden-governance-roadmap.mjs');
const stage=read('src/stage-runtime-bootstrap.js');
const migration=read('migrations/2026-08-23-governance-roadmap.sql');
const prod=read('.github/workflows/deploy-production.yml');
const stageWorkflow=read('.github/workflows/deploy-stage.yml');
const canonicalVerifier=read('scripts/verify-stage-canonical-release.mjs');
const workSchema=read('scripts/ensure-work-management-schema.mjs');
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};

must(hardener,"'    // Health-check público APENAS no hostname de homologação.'",'injeção do schema antes do health');
must(hardener,'schemaPos>healthPos','gate de ordem schema/health');
for(const table of ['governance_events','governance_event_agenda_items','governance_event_stakeholders','governance_event_work_links','governance_event_decisions'])must(stage,`stageCount('${table}')`,`health conta ${table}`);
if(/\b(?:DELETE\s+FROM|DROP\s+TABLE|TRUNCATE|DROP\s+DATABASE)\b/i.test(migration))throw new Error('Migration de governança contém SQL destrutivo.');
for(const table of ['governance_events','governance_event_agenda_items','governance_event_stakeholders','governance_event_work_links','governance_event_decisions'])must(migration,`CREATE TABLE IF NOT EXISTS ${table}`,`migration aditiva ${table}`);

must(prod,'push:','Produção possui gatilho automático');
must(prod,'branches: [main]','Produção automática somente em main');
must(prod,'workflow_dispatch:','Produção mantém fallback manual');
must(prod,"github.ref == 'refs/heads/main'",'Produção bloqueia branch diferente de main');
must(prod,"inputs.confirm == 'DEPLOY-PRODUCTION'",'Fallback manual exige confirmação explícita');
must(prod,'prepare-cloudflare-auth.mjs','Produção usa preparação/verificação de autenticação Cloudflare');
must(prod,'Backup obrigatório do D1 produtivo','Backup obrigatório');
must(prod,'Dry-run do schema base, aditivo e tenants essenciais em Produção','Dry-run antes de mudanças');
must(prod,'ensure-work-management-schema.mjs --env=production','Dry-run valida Work Management antes da alteração');
must(prod,'ensure-work-management-schema.mjs --env=production --apply --confirm=APPLY-WORK-SCHEMA-PRODUCTION','Work Management produtivo idempotente e confirmado');
must(prod,'ensure-additive-schema.mjs --env=production --apply --confirm=APPLY-ADDITIVE-PRODUCTION','Schema produtivo somente aditivo e confirmado');
must(prod,'repair-core-tenants-portable.mjs --env=production --apply --confirm=REPAIR-PRODUCTION','Reparo idempotente de tenants essenciais');
must(prod,'Gate final antes do deploy produtivo','Gate reexecutado depois da preparação do D1');
must(prod,'Publicar exatamente o artefato validado em PRODUÇÃO','Deploy produtivo');
must(prod,'smoke-core-tenants.mjs --base=https://allamo-pmo.pages.dev --env=production','Smoke dos tenants em Produção');
must(prod,'smoke-governance-environment.mjs --base=https://allamo-pmo.pages.dev --env=production','Smoke de governança em Produção');
for(const table of ['work_items','work_sprints','work_comments','work_checklist','work_links','work_events'])must(workSchema,`'${table}'`,`guard contempla ${table}`);
must(workSchema,'migrations/2026-08-21-work-management.sql','guard usa migration base idempotente');
if(/\b(?:DELETE\s+FROM|DROP\s+TABLE|TRUNCATE|DROP\s+DATABASE)\b/i.test(workSchema))throw new Error('Guard de Work Management contém operação destrutiva.');
const backup=prod.indexOf('Backup obrigatório do D1 produtivo');
const dryRun=prod.indexOf('Dry-run do schema base, aditivo e tenants essenciais em Produção');
const workApply=prod.indexOf('Garantir schema base de Work Management em Produção');
const schemaApply=prod.indexOf('Aplicar somente schema aditivo em Produção');
const finalGate=prod.indexOf('Gate final antes do deploy produtivo');
const deploy=prod.indexOf('Publicar exatamente o artefato validado em PRODUÇÃO');
const smoke=prod.indexOf('Smoke dos tenants essenciais em Produção');
if(!(backup>=0&&backup<dryRun&&dryRun<workApply&&workApply<schemaApply&&schemaApply<finalGate&&finalGate<deploy&&deploy<smoke))throw new Error('Ordem segura de Produção inválida: backup → dry-run → Work Management → schema aditivo → gate → deploy → smoke.');

must(stageWorkflow,'push:','Stage deve publicar automaticamente após develop');
must(stageWorkflow,'branches: [develop]','Auto deploy Stage somente em develop');
must(stageWorkflow,'npm run test:release','Stage executa gate consolidado');
must(stageWorkflow,'Backup obrigatório do D1 Stage','Stage possui backup antes da preparação do schema');
must(stageWorkflow,'ensure-additive-schema.mjs --env=stage --apply --confirm=APPLY-ADDITIVE-STAGE','Stage aplica somente schema aditivo');
must(stageWorkflow,'verify-stage-canonical-release.mjs','Stage confirma fingerprint na URL canônica');
must(stageWorkflow,'npm run smoke:governance','Stage executa smoke de governança pós-deploy');
must(stageWorkflow,'smoke-core-tenants.mjs --base=https://allamo-pmo-stage.pages.dev --env=stage','Stage executa smoke dos tenants essenciais');
if(stageWorkflow.includes('--project-name allamo-pmo --branch main'))throw new Error('Workflow de Stage aponta para Produção.');

// O Pages pode devolver temporariamente HTML/artefato antigo logo após o upload.
// O gate canônico deve RETENTAR a resposta transitória, mas nunca relaxar o SHA exigido.
must(canonicalVerifier,'async function fetchUntil','verificador canônico possui retry orientado a conteúdo');
must(canonicalVerifier,'attempts=12','verificador possui janela de propagação');
must(canonicalVerifier,"cache:'no-store'",'fingerprint ignora cache do browser/CDN');
must(canonicalVerifier,"'accept':'application/json'",'fingerprint pede JSON explicitamente');
must(canonicalVerifier,'JSON.parse(text)','fingerprint valida JSON dentro do retry');
must(canonicalVerifier,'String(data?.sha)!==sha','fingerprint exige exatamente o SHA esperado');
must(canonicalVerifier,'fingerprint ainda não é JSON','HTML transitório não encerra o retry na primeira resposta 200');
must(canonicalVerifier,'/api/companies ainda não é JSON','API live também aguarda propagação de JSON');
if(/if\(res\.ok\)\s*return\s*\{res,text\}/.test(canonicalVerifier))throw new Error('Verificador canônico voltou a aceitar qualquer HTTP 200 antes de validar conteúdo/SHA.');

console.log('OK: release governado — Stage automático em develop e Produção automática em main, com backup, Work Management base, evolução aditiva, gates, fingerprint canônico estrito com retry e smoke pós-deploy.');
