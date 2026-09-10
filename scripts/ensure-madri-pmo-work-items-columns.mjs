import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const WRANGLER='wrangler@4.124.0';
const DB='DB';
const CONFIG='wrangler.production.toml';
const CONFIRM='APPLY-MADRI-PMO-WORK-ITEMS-PRODUCTION';
const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);

if(APPLY&&confirmArg!==CONFIRM){
  console.error(`[ABORTADO] Para aplicar as extensões MADRI PMO em Produção use --confirm=${CONFIRM}`);
  process.exit(2);
}
if(!fs.existsSync(CONFIG))throw new Error(`Arquivo obrigatório ausente: ${CONFIG}`);
const cfg=fs.readFileSync(CONFIG,'utf8');
const productiveCfg=cfg.split(/^\[env\.preview\]\s*$/m)[0];
if(!/^name\s*=\s*"allamo-pmo"\s*$/m.test(productiveCfg))throw new Error('wrangler.production.toml não aponta para o projeto allamo-pmo.');
if(/database_name\s*=\s*"allamo-pmo-stage"/m.test(productiveCfg))throw new Error('Bindings efetivos de Produção apontam indevidamente para o D1 de STAGE.');
if(!/database_name\s*=\s*"allamo-pmo"/m.test(productiveCfg))throw new Error('Binding D1 de Produção allamo-pmo não localizado.');

const requiredCols={
  pmo_scope:"TEXT NOT NULL DEFAULT ''",
  front:"TEXT NOT NULL DEFAULT ''",
  dependency_text:"TEXT NOT NULL DEFAULT ''",
  impact_text:"TEXT NOT NULL DEFAULT ''",
  critical_path:'INTEGER NOT NULL DEFAULT 0',
  next_step:"TEXT NOT NULL DEFAULT ''",
  evidence:"TEXT NOT NULL DEFAULT ''",
  source_ref:"TEXT NOT NULL DEFAULT ''",
  version:'INTEGER NOT NULL DEFAULT 1'
};

function run(args,{capture=true}={}){
  const exe=process.platform==='win32'?'npx.cmd':'npx';
  const r=spawnSync(exe,['--yes',...args],{encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:process.platform==='win32'});
  if(r.error)throw r.error;
  if(r.status!==0){
    if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}
    throw new Error(`Wrangler falhou (${r.status})`);
  }
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}
function parse(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  for(let i=0;i<clean.length;i++){
    if(!['[','{'].includes(clean[i]))continue;
    for(let j=clean.length-1;j>i;j--){
      if(![']','}'].includes(clean[j]))continue;
      try{return JSON.parse(clean.slice(i,j+1))}catch{}
    }
  }
  throw new Error('JSON D1 não reconhecido');
}
function results(v){
  if(Array.isArray(v))return v.flatMap(results);
  if(v&&typeof v==='object'){
    if(Array.isArray(v.results))return v.results;
    for(const x of Object.values(v)){const r=results(x);if(r.length)return r}
  }
  return [];
}
function query(sql){return results(parse(run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'])))}
function exec(sql){run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql],{capture:false})}
function tableInfo(table){return query(`PRAGMA table_info("${String(table).replaceAll('"','""')}");`)}

const before=tableInfo('work_items');
if(!before.length)throw new Error('Tabela work_items ausente em Produção. Execute primeiro o schema base de Work Management.');
const existing=new Set(before.map(c=>String(c.name||'').toLowerCase()));
const missing=Object.keys(requiredCols).filter(c=>!existing.has(c));
console.log(`[PRODUCTION] Extensões MADRI PMO em work_items: ${missing.length?`faltando ${missing.join(', ')}`:'OK'}.`);

if(!APPLY){
  console.log('[DRY-RUN] Nenhuma alteração aplicada em Produção.');
  process.exit(0);
}

for(const col of missing){
  if(!Object.prototype.hasOwnProperty.call(requiredCols,col))throw new Error(`Coluna não autorizada: ${col}`);
  console.log(`[APPLY] work_items + ${col}`);
  exec(`ALTER TABLE work_items ADD COLUMN ${col} ${requiredCols[col]};`);
}

const after=new Set(tableInfo('work_items').map(c=>String(c.name||'').toLowerCase()));
const remaining=Object.keys(requiredCols).filter(c=>!after.has(c));
if(remaining.length)throw new Error(`Extensões MADRI PMO continuam ausentes em work_items: ${remaining.join(', ')}.`);
console.log(`[OK] Extensões MADRI PMO em work_items validadas: ${Object.keys(requiredCols).join(', ')}.`);
