import fs from 'node:fs';

const sync=fs.readFileSync('scripts/sync-stage-catalog-to-production.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy-production.yml','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const must=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};

must(sync,"const STAGE_CONFIG='wrangler.stage.toml'",'config exclusiva de Stage');
must(sync,"const PRODUCTION_CONFIG='wrangler.production.toml'",'config exclusiva de Produção');
must(sync,"SYNC_STAGE_CATALOG",'placeholder impossível');
