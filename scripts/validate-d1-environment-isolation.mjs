import fs from 'node:fs';

const text=fs.readFileSync('wrangler.toml','utf8');
const must=(needle,label)=>{if(!text.includes(needle))throw new Error(`Ausente: ${label} (${needle})`)};

const STAGE_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';
const PROD_ID='361c63ba-b9f8-409d-9a46-9609914da8b7';

must('[env.stage]','ambiente stage');
must('[[env.stage.d1_databases]]','binding D1 do stage');
must('database_name = "allamo-pmo-stage"','nome oficial do banco stage');
must(`database_id = "${STAGE_ID}"`,'UUID oficial do banco stage');
must('[env.production]','ambiente production');
must('[[env.production.d1_databases]]','binding D1 da produção');
must('database_name = "allamo-pmo"','nome oficial do banco produção');
must(`database_id = "${PROD_ID}"`,'UUID oficial do banco produção');

if(STAGE_ID===PROD_ID) throw new Error('Stage e Produção não podem usar o mesmo D1.');

const stageBlock=text.match(/\[\[env\.stage\.d1_databases\]\]([\s\S]*?)(?=\n\[|$)/)?.[1]||'';
const prodBlock=text.match(/\[\[env\.production\.d1_databases\]\]([\s\S]*?)(?=\n\[|$)/)?.[1]||'';
if(!stageBlock.includes(STAGE_ID)||stageBlock.includes(PROD_ID))throw new Error('Binding Stage incorreto ou contaminado com UUID de produção.');
if(!prodBlock.includes(PROD_ID)||prodBlock.includes(STAGE_ID))throw new Error('Binding Produção incorreto ou contaminado com UUID de Stage.');

console.log('OK: D1 isolado — Stage allamo-pmo-stage e Produção allamo-pmo usam UUIDs distintos e corretos.');
