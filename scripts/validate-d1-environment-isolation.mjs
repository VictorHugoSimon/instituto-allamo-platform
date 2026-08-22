import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const root=read('wrangler.toml');
const stage=read('wrangler.stage.toml');
const prod=read('wrangler.production.toml');
const deployCmd=read('scripts/deploy-stage-safe.cmd');
const deployWorkflow=read('.github/workflows/deploy-stage.yml');
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
const forbid=(text,needle,label)=>{if(text.includes(needle))throw new Error(`Proibido: ${label} (${needle})`)};
const forbidEnvStage=(text,label)=>{if(/^\s*\[env\.stage\]\s*$/m.test(text))throw new Error(`Proibido: ${label} ([env.stage])`)};

const STAGE_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';
const PROD_ID='361c63ba-b9f8-409d-9a46-9609914da8b7';

if(STAGE_ID===PROD_ID) throw new Error('Stage e Produção não podem usar o mesmo D1.');

// O arquivo padrão é um guard: nenhuma operação remota deve escolher banco por acidente.
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

// Release de Stage precisa escolher explicitamente o arquivo de Stage.
must(deployCmd,'--config wrangler.stage.toml','deploy local de Stage com config explícita');
must(deployWorkflow,'--config wrangler.stage.toml','workflow de Stage com config explícita');
forbid(deployCmd,'--env stage','deploy local não pode usar env.stage');
forbid(deployWorkflow,'--env stage','workflow não pode usar env.stage');

console.log('OK: Pages config isolada — Stage e Produção usam arquivos distintos; preview de Produção não toca D1 produtivo; env.stage proibido.');
