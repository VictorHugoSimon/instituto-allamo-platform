import fs from 'node:fs';

const repair=fs.readFileSync('scripts/repair-core-tenants.mjs','utf8');
const stage=fs.readFileSync('wrangler.stage.toml','utf8');
const prod=fs.readFileSync('wrangler.production.toml','utf8');

const must=(text,needle,label)=>{ if(!text.includes(needle)) throw new Error(`Ausente: ${label} (${needle})`); };
const destructive=/\b(DELETE\s+FROM|DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE(?:\s+TABLE)?)\b/i;
if(destructive.test(repair)) throw new Error('A rotina de recuperação contém SQL destrutivo.');

must(repair,"const APPLY=process.argv.includes('--apply')",'modo dry-run por padrão');
must(repair,"--confirm=",'confirmação explícita');
must(repair,"confirm:'REPAIR-STAGE'",'confirmação exclusiva de Stage');
must(repair,"confirm:'REPAIR-PRODUCTION'",'confirmação exclusiva de Produção');
must(repair,"d1','export'",'backup D1 obrigatório');
must(repair,"INSERT INTO companies",'recriação aditiva de empresa');
must(repair,"UPDATE companies SET name",'canonicalização sem troca de ID');
must(repair,"WHERE NOT EXISTS",'inserção idempotente');
must(repair,"collectEvidence",'descoberta de IDs referenciados');
must(repair,"company_id",'preservação de referências multitenant');
must(repair,"aliases:['dualclima','dual']",'aliases Dual Clima');
must(repair,"aliases:['madrid','madri','madrie']",'aliases Madrid');
must(repair,"aliases:['opr']",'alias OPR restrito');
if(/aliases:\s*\[[^\]]*['"]pr['"]/i.test(repair)) throw new Error('Alias ambíguo PR não pode ser tratado automaticamente como OPR.');

must(stage,'name = "allamo-pmo-stage"','projeto Stage');
must(stage,'database_name = "allamo-pmo-stage"','D1 Stage');
must(stage,'database_id = "72e2f6a0-3d22-4d65-a820-4a9b9ea88321"','ID D1 Stage');
must(prod,'name = "allamo-pmo"','projeto Produção');
must(prod,'database_name = "allamo-pmo"','D1 Produção');
must(prod,'database_id = "361c63ba-b9f8-409d-9a46-9609914da8b7"','ID D1 Produção');
must(repair,"databaseId:'72e2f6a0-3d22-4d65-a820-4a9b9ea88321'",'guard D1 Stage no reparo');
must(repair,"databaseId:'361c63ba-b9f8-409d-9a46-9609914da8b7'",'guard D1 Produção no reparo');

const backupPos=repair.indexOf('const backupFile=backup');
const writePos=repair.indexOf('Aplicando somente INSERT/UPDATE');
if(backupPos<0||writePos<0||backupPos>writePos) throw new Error('Backup precisa ocorrer antes da primeira escrita remota.');

console.log('OK: recuperação de Dual Clima, Madrid e OPR é dry-run-first, idempotente, com backup, isolamento D1 e sem SQL destrutivo.');
