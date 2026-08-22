import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const root=read('wrangler.toml');
const stage=read('wrangler.stage.toml');
const prod=read('wrangler.production.toml');
const stageCmd=read('scripts/deploy-stage-safe.cmd');
const stageWorkflow=read('.github/workflows/deploy-stage.yml');
const prodCmd=read('scripts/deploy-production-safe.cmd');
const prodWorkflow=read('.github/workflows/deploy-production.yml');
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
const forbid=(text,needle,label)=>{if(text.includes(needle))throw new Error(`Proibido: ${label} (${needle})`)};
const forbidEnvStage=(text,label)=>{if(/^\s*\[env\.stage\]\s*$/m.test(text))throw new Error(`Proibido: ${label} ([env.stage])`)};

const STAGE_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';
const PROD_ID='361c63ba-b9f8-409d-9a46-9609914da8b7';

if(STAGE_ID===PROD_ID) throw new Error('Stage e Produção não podem usar o mesmo D1.');

// O arquivo padrão no repositório é um guard. Ele só é sobrescrito dentro do worktree/runner
// depois dos testes, imediatamente antes de uma operação remota.
must(root,'name = "allamo-pmo-config-guard"','wrangler raiz em modo guard');
forbid(root,'database_id','wrangler raiz não pode possuir UUID D1');
forbid(root,'d1_databases','wrangler raiz não pode possuir binding D1');
forbidEnvStage(root,'Cloudflare Pages não suporta ambiente nomeado stage');

// Stage: arquivo dedicado e compatível com os únicos environments aceitos pelo Pages.
must(stage,'name = "allamo-pmo-stage"','projeto Pages oficial de Stage');
must(stage,'[env.production]','environment production do projeto Stage');
must(stage,'[env.preview]','environment preview do projeto Stage');
must(stage,'database_name = "allamo-pmo-stage"','nome oficial do banco Stage');
must(stage,`database_id = "${STAGE_ID}"`,'UUID oficial do banco Stage');
forbidEnvStage(stage,'ambiente stage inválido no Pages');
forbid(stage,PROD_ID,'config de Stage contaminada com UUID de Produção');

// Produção: top-level/production usam PROD; preview é explicitamente não produtivo.
must(prod,'name = "allamo-pmo"','projeto Pages oficial de Produção');
must(prod,'[env.production]','environment production do projeto de Produção');
must(prod,'[env.preview]','environment preview explicitamente isolado');
forbidEnvStage(prod,'ambiente stage inválido no Pages');

const prodTop=prod.split('[env.production]')[0]||'';
const afterProd=prod.split('[env.production]')[1]||'';
const prodEnv=afterProd.split('[env.preview]')[0]||'';
const previewEnv=prod.split('[env.preview]')[1]||'';
must(prodTop,'database_name = "allamo-pmo"','D1 top-level oficial de Produção');
must(prodTop,`database_id = "${PROD_ID}"`,'UUID top-level oficial de Produção');
forbid(prodTop,STAGE_ID,'top-level de Produção não pode usar Stage');
must(prodEnv,'database_name = "allamo-pmo"','D1 do env.production oficial');
must(prodEnv,`database_id = "${PROD_ID}"`,'UUID do env.production oficial');
forbid(prodEnv,STAGE_ID,'env.production não pode usar Stage');
must(previewEnv,'database_name = "allamo-pmo-stage"','preview usa D1 não produtivo');
must(previewEnv,`database_id = "${STAGE_ID}"`,'preview aponta para D1 não produtivo');
forbid(previewEnv,PROD_ID,'preview do projeto de Produção nunca pode usar D1 produtivo');

// Pages não aceita caminho customizado de config em pages deploy. A config dedicada é
// materializada como wrangler.toml somente no worktree/runner efêmero, depois dos gates.
must(stageCmd,'copy /Y wrangler.stage.toml wrangler.toml','Stage local materializa config no worktree');
must(stageWorkflow,'cp wrangler.stage.toml wrangler.toml','Stage Actions materializa config no runner');
must(stageCmd,'--project-name allamo-pmo-stage --branch production','Stage publica no projeto/branch corretos');
must(stageWorkflow,'--project-name allamo-pmo-stage --branch production','workflow Stage publica no projeto/branch corretos');
forbid(stageCmd,'pages deploy public --config','Pages Stage não usa --config customizado');
forbid(stageWorkflow,'pages deploy public --config','workflow Pages Stage não usa --config customizado');
forbid(stageCmd,'--env stage','deploy local não pode usar env.stage');
forbid(stageWorkflow,'--env stage','workflow não pode usar env.stage');
forbid(stageCmd,'wrangler.production.toml','Stage local nunca materializa config de Produção');
forbid(stageWorkflow,'wrangler.production.toml','Stage Actions nunca materializa config de Produção');

// Produção exige main, confirmação explícita, backup antes do deploy e config exclusiva.
must(prodCmd,'DEPLOY-PRODUCTION','produção local exige confirmação explícita');
must(prodCmd,'if /I not "%BRANCH%"=="main"','produção local exige branch main');
must(prodCmd,'copy /Y wrangler.production.toml wrangler.toml','produção local materializa config produtiva');
must(prodCmd,'d1 export DB --remote','produção local faz backup D1');
must(prodCmd,'--project-name allamo-pmo --branch main','produção local publica projeto/branch corretos');
forbid(prodCmd,'pages deploy public --config','Pages Produção não usa --config customizado');
forbid(prodCmd,'wrangler.stage.toml','produção local nunca materializa Stage');

must(prodWorkflow,"inputs.confirm == 'DEPLOY-PRODUCTION'",'workflow produção exige confirmação');
must(prodWorkflow,"github.ref == 'refs/heads/main'",'workflow produção exige main');
must(prodWorkflow,'cp wrangler.production.toml wrangler.toml','workflow produção materializa config produtiva');
must(prodWorkflow,'d1 export DB --remote','workflow produção faz backup D1');
must(prodWorkflow,'actions/upload-artifact@v4','workflow preserva backup como artifact');
must(prodWorkflow,'--project-name allamo-pmo --branch main','workflow produção publica projeto/branch corretos');
forbid(prodWorkflow,'pages deploy public --config','workflow Pages Produção não usa --config customizado');
forbid(prodWorkflow,'cp wrangler.stage.toml wrangler.toml','workflow produção nunca materializa config Stage');

console.log('OK: Pages/D1 isolados — configs dedicadas são materializadas apenas em runners temporários; Stage e Produção têm gates, projetos e D1 distintos; Produção exige backup e main.');
