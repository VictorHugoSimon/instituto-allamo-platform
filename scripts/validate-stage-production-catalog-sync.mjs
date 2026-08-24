import fs from 'node:fs';

const sync=fs.readFileSync('scripts/sync-stage-catalog-to-production.mjs','utf8');
const portable=fs.readFileSync('scripts/sync-stage-catalog-to-production-portable.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy-production.yml','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};

must(sync,"const STAGE_CONFIG='wrangler.stage.toml'",'config exclusiva de Stage');
must(sync,"const PRODUCTION_CONFIG='wrangler.production.toml'",'config exclusiva de Produção');
must(sync,"const SYNC_KEY='stage-catalog-sync-2026-08-24-v1'",'marcador de migração única');
must(sync,"const REQUIRED_CONFIRM='SYNC-STAGE-CATALOG-PRODUCTION'",'confirmação explícita');
must(sync,'function backupProduction()','backup obrigatório');
must(sync,'function markerExists()','idempotência por marcador');
must(sync,'checkDuplicateNormalizedCompanies','bloqueio de empresa ambígua');
must(sync,'checkDuplicateProjectNames','bloqueio de projeto ambíguo');
must(sync,'Conflito de company.id','bloqueio de colisão de tenant');
must(sync,"if(projectIdIsInteger){omit.add('id');newId='AUTO'}",'ID de projeto autoincremental não é forçado entre ambientes');
must(sync,"companyMap.set",'mapeamento Stage company_id para ID canônico produtivo');
must(sync,'validateParity(plan)','pós-validação de empresas e projetos');
must(sync,'Produção-only é preservado','preservação de registros exclusivos de Produção');

must(portable,"'--command',sql",'SELECT remoto usa endpoint de query do D1');
must(portable,"const query=(config,sql)=>executeSqlCommand",'query não usa mais --file');
must(portable,"'--file',temp",'canal de escrita controlada do sincronizador original é preservado');
must(portable,"--self-test",'executor possui self-test estático');
must(portable,'stdout+(stderr?','parser tolera saída Wrangler em stdout/stderr');
must(portable,'extractD1Json','parser tolerante de envelope JSON D1');
if(portable.includes("const query=(config,sql)=>executeSqlFile"))throw new Error('Executor portátil ainda mantém SELECT via --file.');

for(const [label,text] of [['sincronizador',sync],['executor portátil',portable]]){
  if(/\bDELETE\s+FROM\b/i.test(text))throw new Error(`${label} contém DELETE FROM.`);
  if(/\bDROP\s+TABLE\b/i.test(text))throw new Error(`${label} contém DROP TABLE.`);
  if(/\bTRUNCATE\s+TABLE\b/i.test(text))throw new Error(`${label} contém TRUNCATE TABLE.`);
}

must(workflow,'Validar executor portátil da sincronização de catálogo','self-test está na esteira produtiva');
must(workflow,'Dry-run da sincronização de empresas e projetos Stage → Produção','dry-run está na esteira produtiva');
must(workflow,'node scripts/sync-stage-catalog-to-production-portable.mjs','executor corrigido é executado pela esteira');
must(workflow,'--apply --confirm=SYNC-STAGE-CATALOG-PRODUCTION','aplicação exige confirmação explícita');
must(workflow,'--backup="backup-production-${GITHUB_SHA}.sql"','sincronização reutiliza backup obrigatório da release');
must(workflow,'--verify','pós-validação roda antes do deploy');

if(pkg.scripts['test:catalog-sync']!=='node scripts/validate-stage-production-catalog-sync.mjs')throw new Error('Script test:catalog-sync ausente ou incorreto.');
if(!String(pkg.scripts['test:release']||'').includes('test:catalog-sync'))throw new Error('Gate de catálogo não faz parte de test:release.');

console.log('OK: sincronização Stage → Produção usa --command nas leituras D1, permanece aditiva/idempotente, exige backup e confirmação e não possui exclusões.');
