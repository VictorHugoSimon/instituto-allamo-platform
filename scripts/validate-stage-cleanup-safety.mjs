import fs from 'node:fs';

const cleanup=fs.readFileSync('scripts/cleanup-stage-tenants.mjs','utf8');
const stageDeploy=fs.readFileSync('scripts/deploy-stage-safe.cmd','utf8');
const stageWorkflow=fs.readFileSync('.github/workflows/deploy-stage.yml','utf8');
const prodDeploy=fs.readFileSync('scripts/deploy-production-safe.cmd','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const must=(c,n,l)=>{if(!c.includes(n))throw new Error(`Ausente: ${l} (${n})`)};
const forbid=(c,n,l)=>{if(c.includes(n))throw new Error(`Proibido: ${l} (${n})`)};

must(cleanup,"{ slug:'dualclima', label:'Dual Clima' }",'allowlist Dual Clima');
must(cleanup,"{ slug:'madrid', label:'Madrid' }",'allowlist Madrid');
must(cleanup,"{ slug:'opr', label:'OPR' }",'allowlist OPR');
must(cleanup,"process.argv.includes('--apply')",'modo destrutivo exige --apply');
must(cleanup,'DRY-RUN concluído','dry-run padrão');
must(cleanup,'Backup obrigatório','backup antes da limpeza');
must(cleanup,"d1','export'",'export D1 obrigatório');
must(cleanup,'arr.length!==1','cada empresa permitida precisa resolver exatamente uma vez');
must(cleanup,'Nenhum dado foi alterado','aborto seguro quando allowlist não resolve');
must(cleanup,'Pós-validação inconsistente','pós-validação após limpeza');
must(cleanup,"--config',CONFIG",'operações D1 usam config explícita de Stage');

forbid(stageDeploy,'cleanup-stage-tenants','deploy local de Stage nunca executa saneamento');
forbid(prodDeploy,'cleanup-stage-tenants','deploy de Produção nunca executa saneamento');
forbid(stageWorkflow,'cleanup-stage-tenants','release Stage nunca executa saneamento destrutivo');
forbid(stageWorkflow,'repair-core-tenants-portable.mjs --env=stage --apply','release Stage não recria empresas-base automaticamente');
forbid(stageWorkflow,'ensure-semeali-tenant.mjs --apply','release Stage não provisiona Semeali automaticamente');
must(stageWorkflow,'smoke-stage-data-integrity.mjs','release Stage usa smoke genérico compatível com estado zero');
if(String(pkg.scripts['test:env-isolation']||'').includes('cleanup-stage-tenants.mjs')) throw new Error('Gate não pode executar limpeza real do D1.');

console.log('OK: saneamento de Stage é manual e protegido; releases preservam estado zero e nunca criam/reparam tenants automaticamente.');
