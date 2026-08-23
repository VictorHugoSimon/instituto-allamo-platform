import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const ps=fs.readFileSync('scripts/recover-release-all.ps1','utf8');
const portable=fs.readFileSync('scripts/repair-core-tenants-portable.mjs','utf8');
const smoke=fs.readFileSync('scripts/smoke-core-tenants.mjs','utf8');
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
const destructive=/\b(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE(?:\s+TABLE)?)\b/i;
if(destructive.test(ps)||destructive.test(portable)||destructive.test(smoke))throw new Error('Runner portátil contém padrão SQL destrutivo.');

must(ps,"RECOVER-AND-DEPLOY",'confirmação explícita');
must(ps,"@('worktree','add','--detach'",'worktree isolado');
must(ps,"origin/main",'fonte remota limpa');
must(ps,"origin/develop",'comparação main/develop');
must(ps,"git diff --quiet origin/main origin/develop --",'gate portátil de igualdade de árvore');
must(ps,"$treeDiffExit = $LASTEXITCODE",'captura imediata do exit code do diff');
must(ps,"$treeDiffExit -eq 1",'diferença entre árvores bloqueia release');
must(ps,"$treeDiffExit -ne 0",'erro real do Git bloqueia release');
if(/return\s+String\s*\(/i.test(ps))throw new Error('Conversão inválida String(...) reapareceu no runner PowerShell.');
if(/rev-parse[^\r\n]*\^\{tree\}/i.test(ps))throw new Error('Comando rev-parse com sufixo de tree reapareceu no runner PowerShell.');
if(/--format=%T/i.test(ps))throw new Error('Captura de tree SHA via --format=%T reapareceu; use git diff --quiet para evitar instabilidade no PowerShell.');
must(ps,"@('run','test:release')",'gate consolidado');
must(ps,"wrangler@4.124.0','whoami",'preflight Wrangler');
must(ps,"backup-stage-before-core-recovery",'backup Stage');
must(ps,"backup-production-before-core-recovery",'backup Produção');
must(ps,"--confirm=REPAIR-STAGE",'confirmação Stage');
must(ps,"--confirm=REPAIR-PRODUCTION",'confirmação Produção');
must(ps,"allamo-pmo-stage",'projeto Stage explícito');
must(ps,"allamo-pmo','--branch','main",'projeto Produção explícito');
must(ps,"smoke-core-tenants.mjs",'smoke após deploy');
must(portable,"Wrangler retornou saída sem payload JSON reconhecível",'parser tolerante a banners');
must(portable,"repair-core-tenants.mjs",'reuso da lógica governada original');
must(portable,"replace(/\\r\\n?/g,'\\n')",'normalização CRLF do fonte no Windows');
must(portable,"--self-test",'self-test portátil sem acesso ao D1');

const selfTest=spawnSync(process.execPath,['scripts/repair-core-tenants-portable.mjs','--self-test'],{
  cwd:process.cwd(), encoding:'utf8', shell:false
});
if(selfTest.error)throw selfTest.error;
if(selfTest.status!==0)throw new Error(`Self-test do wrapper portátil falhou (${selfTest.status}): ${(selfTest.stderr||selfTest.stdout||'').trim()}`);
if(!String(selfTest.stdout||'').includes('LF, CRLF e BOM+CRLF'))throw new Error('Self-test do wrapper portátil não comprovou LF/CRLF/BOM.');

must(smoke,"/api/public-client-projects?company=",'validação de contexto público');
must(smoke,"Cruzamento de tenant",'gate de isolamento');
must(smoke,"Dual Clima",'Dual Clima obrigatória');
must(smoke,"Madrid",'Madrid obrigatória');
must(smoke,"OPR",'OPR obrigatória');

console.log('OK: runner local preserva working tree, usa worktree limpo, gate main/develop via git diff --quiet, backups, gates, reparo aditivo, wrapper LF/CRLF/BOM, Stage/Produção e smoke multiempresa.');
