import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...r]=a.replace(/^--/,'').split('=');return[k,r.join('=')||true]}));
const envName=String(args.env||'stage');if(!['stage','production'].includes(envName))throw new Error('Use --env=stage|production');
const cfg=envName==='production'?'wrangler.production.toml':'wrangler.stage.toml';
const db=envName==='production'?'allamo-pmo':'allamo-pmo-stage';
const file=String(args.file||'/tmp/fch-detail.json');
const payload=JSON.parse(readFileSync(file,'utf8'));const entries=Array.isArray(payload.entries)?payload.entries:[];if(!entries.length)throw new Error('Payload FCH detalhado vazio');
const esc=s=>String(s??'').replace(/'/g,"''");
function sql(q){const p=spawnSync('npx',['wrangler@4.124.0','d1','execute',db,'--remote','--config',cfg,'--command',q,'--json'],{encoding:'utf8',env:process.env,maxBuffer:20*1024*1024});if(p.status!==0)throw new Error((p.stderr||p.stdout||'wrangler falhou').slice(0,4000));return p.stdout||''}
// fch_entries é uma tabela derivada; a origem Google Drive permanece intocada.
sql('DELETE FROM fch_entries;');
for(let i=0;i<entries.length;i+=45){const vals=entries.slice(i,i+45).map(e=>`('${esc(e.source_file_id)}','${esc(e.source_file_name)}','${esc(e.source_modified_at)}','${esc(e.source_sheet)}',${Number(e.source_row)||0},'${esc(e.person)}','${esc(e.activity_date)}','${esc(e.source_project)}','${esc(e.target_project)}','${esc(e.allocation_rule)}','${esc(e.source_entry_hash)}',${Number(e.hours)||0},datetime('now'))`).join(',');sql(`INSERT INTO fch_entries(source_file_id,source_file_name,source_modified_at,source_sheet,source_row,person,activity_date,source_project,target_project,allocation_rule,source_entry_hash,hours,imported_at) VALUES ${vals};`)}
const summary=payload.summary||{};const detail={policy:'google-drive-readonly',sources:payload.sources||[],allocations:entries.length,source_entries:Number(summary.source_entries||0),capacity_hours:Number(summary.capacity_hours||0),opr_hours:Number(summary.opr_hours||0),madri_hours:Number(summary.madri_hours||0)};
sql(`INSERT INTO sync_state(source,last_run,detail) VALUES('fch-drive',datetime('now'),'${esc(JSON.stringify(detail))}') ON CONFLICT(source) DO UPDATE SET last_run=datetime('now'),detail=excluded.detail;`);
console.log(`[fch-detail] ${envName}: ${entries.length} alocações; capacidade física ${detail.capacity_hours}h; OPR ${detail.opr_hours}h; MADRI ${detail.madri_hours}h`);
