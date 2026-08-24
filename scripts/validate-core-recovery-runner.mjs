import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const ps=fs.readFileSync('scripts/recover-release-all.ps1','utf8');
const portable=fs.readFileSync('scripts/repair-core-tenants-portable.mjs','utf8');
const repair=fs.readFileSync('scripts/repair-core-tenants.mjs','utf8');
const smoke=fs.readFileSync('scripts/smoke-core-tenants.mjs','utf8');
const schema=fs.readFileSync('scripts/ensure-additive-schema.mjs','utf8');
const governanceMigration=fs.readFileSync('migrations/2026-08-23-governance-roadmap.sql','utf8');
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
const destructive=/\b(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE(?:\s+TABLE)?)\b/i;
if(destructive.test(ps)||destructive.test(portable)||destructive.test(smoke)||destructive.test(schema)||destructive.test(governanceMigration))throw new Error('Runner/migration contém padrão SQL destrutivo.');

must(ps,"RECOVER-AND-DEPLOY",'confirmação explícita');
must(ps,"@('worktree','add','--detach'",'worktree isolado');
must(ps,"origin/main",'fonte remota limpa');
must(ps,"origin/develop",'comparação main/develop');
must(ps,"git diff --quiet origin/main origin/develop --",'gate portátil de igualdade de árvore');
must(ps,"@('run','test:release')",'gate consolidado');
must(ps,"wrangler@4.124.0','whoami",'preflight Wrangler');
must(ps,"backup-stage-before-core-recovery",'backup Stage');
must(ps,"backup-production-before-core-recovery",'backup Produção');
must(ps,"ensure-additive-schema.mjs','--env=stage'",'dry-run schema Stage');
must(ps,"--confirm=APPLY-ADDITIVE-STAGE",'confirmação schema Stage');
must(ps,"ensure-additive-schema.mjs','--env=production'",'dry-run schema Produção');
must(ps,"--confirm=APPLY-ADDITIVE-PRODUCTION",'confirmação schema Produção');
must(ps,"--confirm=REPAIR-STAGE",'confirmação reparo Stage');
must(ps,"--confirm=REPAIR-PRODUCTION",'confirmação reparo Produção');
must(ps,"allamo-pmo-stage",'projeto Stage explícito');
must(ps,"allamo-pmo','--branch','main",'projeto Produção explícito');
must(ps,"smoke-core-tenants.mjs",'smoke após deploy');

must(schema,"ALTER TABLE gmud ADD COLUMN project TEXT NOT NULL DEFAULT ''",'evolução GMUD aditiva');
must(schema,"2026-08-23-governance-roadmap.sql",'migration idempotente de Governança');
must(schema,"--file','migrations/2026-08-23-governance-roadmap.sql",'runner aplica migration governada quando necessária');
must(schema,"--config",'ambiente D1 explícito');
must(schema,"APPLY-ADDITIVE-STAGE",'gate de Stage');
must(schema,"APPLY-ADDITIVE-PRODUCTION",'gate de Produção');
must(governanceMigration,'CREATE TABLE IF NOT EXISTS governance_events','migration cria governança de forma idempotente');
must(governanceMigration,'CREATE TABLE IF NOT EXISTS governance_event_agenda_items','migration cria itens de pauta de forma idempotente');
must(governanceMigration,'CREATE TABLE IF NOT EXISTS governance_event_stakeholders','migration cria stakeholders de forma idempotente');
must(governanceMigration,'CREATE TABLE IF NOT EXISTS governance_event_work_links','migration cria vínculos de trabalho de forma idempotente');
must(governanceMigration,'CREATE TABLE IF NOT EXISTS governance_event_decisions','migration cria decisões de forma idempotente');

must(repair,"function extractResults(node)",'normalização base do envelope results do Wrangler D1');
must(repair,"function resolveNpxCli()",'resolução explícita do npx-cli.js no Windows');
must(repair,"shell:false",'invocação do Wrangler não usa shell');
must(portable,"Wrangler retornou saída sem payload JSON D1 reconhecível",'parser tolerante a banners com contrato D1');
must(portable,"function executeSqlCommand(config,sql",'executor dedicado de query remota');
must(portable,"'--command',sql",'SELECT remoto usa --command');
must(portable,"--self-test",'self-test portátil sem acesso ao D1');

const selfTest=spawnSync(process.execPath,['scripts/repair-core-tenants-portable.mjs','--self-test'],{cwd:process.cwd(),encoding:'utf8',shell:false});
if(selfTest.error)throw selfTest.error;
if(selfTest.status!==0)throw new Error(`Self-test do wrapper portátil falhou (${selfTest.status}): ${(selfTest.stderr||selfTest.stdout||'').trim()}`);
const selfOut=String(selfTest.stdout||'');
if(!selfOut.includes('LF, CRLF e BOM+CRLF'))throw new Error('Self-test do wrapper portátil não comprovou LF/CRLF/BOM.');
if(!selfOut.includes('stdout+stderr'))throw new Error('Self-test não comprovou captura combinada dos streams do Wrangler.');
if(!selfOut.includes('--command para SELECT remoto'))throw new Error('Self-test não comprovou uso de --command nas consultas remotas.');

must(smoke,"/api/public-client-projects?company=",'validação de contexto público');
must(smoke,"Cruzamento de tenant",'gate de isolamento');
must(smoke,"Dual Clima",'Dual Clima obrigatória');
must(smoke,"Madrid",'Madrid obrigatória');
must(smoke,"OPR",'OPR obrigatória');

console.log('OK: runner preserva working tree, cria backups antes de mudanças, garante schema GMUD/Governança somente de forma aditiva, repara as três empresas, publica Stage/Produção e executa smoke multiempresa.');
