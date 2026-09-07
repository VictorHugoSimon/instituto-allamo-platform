import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...r]=a.replace(/^--/,'').split('=');return[k,r.join('=')||true]}));
const envName=String(args.env||'stage');
if(!['stage','production'].includes(envName))throw new Error('Use --env=stage|production');
const cfg=envName==='production'?'wrangler.production.toml':'wrangler.stage.toml';
const db=envName==='production'?'allamo-pmo':'allamo-pmo-stage';
const file=String(args.file||'/tmp/fch-detail.json');
const payload=JSON.parse(readFileSync(file,'utf8'));
const entries=Array.isArray(payload.entries)?payload.entries:[];
if(!entries.length)throw new Error('Payload FCH detalhado vazio');
const esc=s=>String(s??'').replace(/'/g,"''");

function execute(q){
  const p=spawnSync('npx',['wrangler@4.124.0','d1','execute',db,'--remote','--config',cfg,'--command',q,'--json'],{encoding:'utf8',env:process.env,maxBuffer:20*1024*1024});
  if(p.status!==0)throw new Error((p.stderr||p.stdout||'wrangler falhou').slice(0,4000));
  return p.stdout||'';
}
function extractResults(node){
  if(Array.isArray(node)){
    for(const item of node){const found=extractResults(item);if(found)return found;}
    return null;
  }
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results))return node.results;
    for(const value of Object.values(node)){const found=extractResults(value);if(found)return found;}
  }
  return null;
}
function rows(q){
  const raw=execute(q);
  try{return extractResults(JSON.parse(raw))||[];}catch{throw new Error('Falha ao interpretar resposta JSON do D1 durante preflight FCH.');}
}
function parseProjectMap(){
  const raw=String(process.env.FCH_TARGET_PROJECT_MAP||'').trim();
  if(!raw)throw new Error('FCH_TARGET_PROJECT_MAP ausente. Sincronização exige mapeamento explícito para project_id real.');
  let map;
  try{map=JSON.parse(raw);}catch{throw new Error('FCH_TARGET_PROJECT_MAP deve ser JSON válido.');}
  if(!map||Array.isArray(map)||typeof map!=='object')throw new Error('FCH_TARGET_PROJECT_MAP deve ser objeto JSON.');
  return map;
}
function validateTargetsBeforeWrite(){
  const map=parseProjectMap();
  const targets=[...new Set(entries.map(e=>String(e.target_project||'').trim()).filter(Boolean))];
  if(!targets.length)throw new Error('Payload FCH sem target_project.');
  const mapped={};
  for(const target of targets){
    const projectId=String(map[target]||'').trim();
    if(!projectId)throw new Error(`Mapeamento FCH ausente para ${target}.`);
    mapped[target]=projectId;
  }
  const ids=[...new Set(Object.values(mapped))];
  const inSql=ids.map(id=>`'${esc(id)}'`).join(',');
  const found=rows(`SELECT p.id,p.name,p.company_id,c.name AS company_name FROM projects p JOIN companies c ON c.id=p.company_id WHERE p.id IN (${inSql});`);
  const byId=new Map(found.map(p=>[String(p.id),p]));
  for(const [target,projectId] of Object.entries(mapped)){
    if(!byId.has(String(projectId)))throw new Error(`FCH bloqueado em ${envName}: ${target} aponta para project_id inexistente ou órfão: ${projectId}`);
  }
  console.log(`[fch-detail] preflight ${envName}: ${targets.map(t=>`${t}->${mapped[t]}`).join(', ')}; todos os projetos existem e pertencem a empresas reais.`);
  return mapped;
}

const projectMap=validateTargetsBeforeWrite();

// fch_entries é uma tabela derivada; a origem Google Drive permanece intocada.
// Nenhuma empresa/projeto é criada por esta rotina. A escrita só ocorre após o preflight acima.
execute('DELETE FROM fch_entries;');
for(let i=0;i<entries.length;i+=45){
  const vals=entries.slice(i,i+45).map(e=>`('${esc(e.source_file_id)}','${esc(e.source_file_name)}','${esc(e.source_modified_at)}','${esc(e.source_sheet)}',${Number(e.source_row)||0},'${esc(e.person)}','${esc(e.activity_date)}','${esc(e.source_project)}','${esc(e.target_project)}','${esc(e.allocation_rule)}','${esc(e.source_entry_hash)}',${Number(e.hours)||0},datetime('now'))`).join(',');
  execute(`INSERT INTO fch_entries(source_file_id,source_file_name,source_modified_at,source_sheet,source_row,person,activity_date,source_project,target_project,allocation_rule,source_entry_hash,hours,imported_at) VALUES ${vals};`);
}
const summary=payload.summary||{};
const detail={
  policy:'google-drive-readonly',
  sources:payload.sources||[],
  allocations:entries.length,
  source_entries:Number(summary.source_entries||0),
  capacity_hours:Number(summary.capacity_hours||0),
  opr_hours:Number(summary.opr_hours||0),
  madri_hours:Number(summary.madri_hours||0),
  target_project_map:projectMap
};
execute(`INSERT INTO sync_state(source,last_run,detail) VALUES('fch-drive',datetime('now'),'${esc(JSON.stringify(detail))}') ON CONFLICT(source) DO UPDATE SET last_run=datetime('now'),detail=excluded.detail;`);
console.log(`[fch-detail] ${envName}: ${entries.length} alocações; capacidade física ${detail.capacity_hours}h; OPR ${detail.opr_hours}h; MADRI ${detail.madri_hours}h`);
