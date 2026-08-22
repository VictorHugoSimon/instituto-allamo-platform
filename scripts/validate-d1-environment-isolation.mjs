import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const root=read('wrangler.toml');
const stage=read('wrangler.stage.toml');
const prod=read('wrangler.production.toml');
const deployCmd=read('scripts/deploy-stage-safe.cmd');
const deployWorkflow=read('.github/workflows/deploy-stage.yml');
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};
const forbid=(text,needle,label)=>{if(text.includes(needle))throw new Error(`Proibido: ${label} (${needle})`)};

const STAGE_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';
const PROD_ID='361c63ba-b9f8-409d-9a46-9609914da8b7';

if(STAGE_ID===PROD_ID) throw new Error('Stage e Produção não podem usar o mesmo D1.');

// O arquivo padrão é um guard: nenhuma operação remota deve escolher banco por acidente.
must(root,'name = "allamo-pmo-config-guard"','wrangler raiz em modo guard');
forbid(root,'database_id','wrangler raiz não pode possuir UUID D1');
forbid(root,'d1_databases','wrangler raiz não pode possuir binding D1');
forbid(root,'[env.stage]','Cloudflare Pages não suporta ambiente nomeado stage');

// Stage: arquivo dedicado e compatível com os únicos environments aceitos pelo Pages.
must(stage,'name = "allamo-pmo-stage"','projeto Pages oficial de Stage');
must(stage,'[env.production]','environment production do projeto Stage');
must(stage,'[env.preview]','environment preview do projeto Stage');
must(stage,'database_name = "allamo-pmo-stage"','nome oficial do banco Stage');
must(stage,`database_id = "${STAGE_ID}"`,'UUID oficial do banco Stage');
forbid(stage,'[env.stage]','ambiente stage inválido no Pages');
forbid(stage,PROD_ID,'config de Stage contaminada com UUID de Produção');

// Produção: arquivo dedicado; previews não recebem D1 de Produção.
must(prod,'name = "allamo-pmo"','projeto Pages oficial de Produção');
must(prod,'[env.production]','environment production do projeto de Produção');
must(prod,'[env.preview]','environment preview explicitamente isolado');
must(prod,'database_name = "allamo-pmo"','nome oficial do banco Produção');
must(prod,`database_id = "${PROD_ID}"`,'UUID oficial do banco Produção');
forbid(prod,'[env.stage]','ambiente stage inválido no Pages');
forbid(prod,STAGE_ID,'config de Produção contaminada com UUID de Stage');
const previewBlock=prod.split('[env.preview]')[1]||'';
if(previewBlock.includes('database_id')||previewBlock.includes('d1_databases'))throw new Error('Preview do projeto de Produção não pode possuir D1 de Produção.');

// Release de Stage precisa escolher explicitamente o arquivo de Stage.
must(deployCmd,'--config wrangler.stage.toml','deploy local de Stage com config explícita');
must(deployWorkflow,'--config wrangler.stage.toml','workflow de Stage com config explícita');
forbid(deployCmd,'--env stage','deploy local não pode usar env.stage');
forbid(deployWorkflow,'--env stage','workflow não pode usar env.stage');

console.log('OK: Pages config isolada — Stage e Produção usam arquivos distintos, sem env.stage e sem risco de cruzamento D1.');
