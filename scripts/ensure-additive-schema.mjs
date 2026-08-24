import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const WRANGLER='wrangler@4.124.0';
const DB='DB';
const envArg=(process.argv.find(a=>a.startsWith('--env='))||'').slice(6).toLowerCase();
const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);

const ENVIRONMENTS={
  stage:{config:'wrangler.stage.toml',confirm:'APPLY-ADDITIVE-STAGE'},
  production:{config:'wrangler.production.toml',confirm:'APPLY-ADDITIVE-PRODUCTION'}
};

const env=ENVIRONMENTS[envArg];
if(!env){
  console.error('[ABORTADO] Informe --env=stage ou --env=production.');
  process.exit(2);
}
if(!fs.existsSync(env.config)){
  console.error(`[ABORTADO] Config não encontrada: ${env.config}`);
  process.exit(2);
}
if(APPLY && confirmArg!==env.confirm){
  console.error(`[ABORTADO] Para aplicar no ambiente ${envArg}, use --confirm=${env.confirm}`);
  process.exit(2);
}

function resolveNpxCli(){
  const candidates=[];
  if(process.env.npm_execpath) candidates.push(path.join(path.dirname(process.env.npm_execpath),'npx-cli.js'));
  candidates.push(path.join(path.dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'));
  for(const candidate of candidates) if(candidate&&fs.existsSync(candidate)) return candidate;
  return null;
}

function runWrangler(args,{capture=true}={}){
  let r;
  if(process.platform==='win32'){
    const npxCli=resolveNpxCli();
    if(!npxCli) throw new Error('npx-cli.js não encontrado junto da instalação do Node/npm.');
    r=spawnSync(process.execPath,[npxCli,'--yes',...args],{
      cwd:ROOT,
      encoding:capture?'utf8':undefined,
      stdio:capture?['ignore','pipe','pipe']:'inherit',
      shell:false,
      windowsHide:true
    });
  }else{
    r=spawnSync('npx',['--yes',...args],{
      cwd:ROOT,
      encoding:capture?'utf8':undefined,
      stdio:capture?['ignore','pipe','pipe']:'inherit',
      shell:false
    });
  }
  if(r.error) throw r.error;
  if(r.status!==0){
    if(capture){ if(r.stdout)process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr); }
    throw new Error(`Wrangler falhou (${r.status}).`);
  }
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}

function extractResultsDeep(node){
  const arrays=[];
  const visit=value=>{
    if(Array.isArray(value)){
      arrays.push(value);
      for(const item of value) visit(item);
      return;
    }
    if(value&&typeof value==='object'){
      if(Array.isArray(value.results)) arrays.unshift(value.results);
      for(const nested of Object.values(value)) visit(nested);
    }
  };
  visit(node);
  for(const arr of arrays){
    if(arr.every(v=>v&&typeof v==='object'&&!Array.isArray(v))) return arr;
  }
  return [];
}

function parseWranglerJson(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  try{return JSON.parse(clean);}catch{}
  const starts=[];
  const ends=[];
  for(let i=0;i<clean.length;i++) if(clean[i]==='['||clean[i]==='{') starts.push(i);
  for(let i=clean.length-1;i>=0;i--) if(clean[i]===']'||clean[i]==='}') ends.push(i);
  let best=null,bestSize=-1;
  for(const a of starts){
    for(const b of ends){
      if(b<=a)continue;
      const slice=clean.slice(a,b+1);
      try{
        const parsed=JSON.parse(slice);
        if(slice.length>bestSize){best=parsed;bestSize=slice.length;}
      }catch{}
    }
  }
  if(best===null) throw new Error('Wrangler não retornou payload JSON D1 reconhecível.');
  return best;
}

function query(sql){
  const out=runWrangler([WRANGLER,'d1','execute',DB,'--remote','--config',env.config,'--command',sql,'--json']);
  return extractResultsDeep(parseWranglerJson(out));
}

function execute(sql){
  runWrangler([WRANGLER,'d1','execute',DB,'--remote','--config',env.config,'--command',sql],{capture:false});
}

function tableExists(name){
  const rows=query(`SELECT name FROM sqlite_master WHERE type='table' AND name='${String(name).replace(/'/g,"''")}';`);
  return rows.some(r=>String(r.name||'')===name);
}

function columnExists(table,column){
  if(!tableExists(table)) return false;
  const rows=query(`PRAGMA table_info(${table});`);
  return rows.some(r=>String(r.name||'')===column);
}

const gmudExists=tableExists('gmud');
const gmudProjectExists=gmudExists&&columnExists('gmud','project');
const governanceTables=[
  'governance_events',
  'governance_event_agenda_items',
  'governance_event_stakeholders',
  'governance_event_work_links',
  'governance_event_decisions'
];
const missingGovernance=governanceTables.filter(t=>!tableExists(t));

console.log(`Ambiente: ${envArg}`);
console.log(`gmud existe: ${gmudExists?'sim':'não'}`);
console.log(`gmud.project existe: ${gmudProjectExists?'sim':'não'}`);
console.log(`Governança ausente: ${missingGovernance.length?missingGovernance.join(', '):'nenhuma'}`);

if(!APPLY){
  console.log('[DRY-RUN] Nenhuma alteração aplicada.');
  process.exit(0);
}

if(gmudExists&&!gmudProjectExists){
  console.log('[APPLY] Adicionando coluna aditiva gmud.project...');
  execute("ALTER TABLE gmud ADD COLUMN project TEXT NOT NULL DEFAULT '';");
}

if(missingGovernance.length){
  console.log('[APPLY] Aplicando migration idempotente de Governança...');
  runWrangler([WRANGLER,'d1','execute',DB,'--remote','--config',env.config,'--file','migrations/2026-08-23-governance-roadmap.sql'],{capture:false});
}

const gmudProjectAfter=!gmudExists||columnExists('gmud','project');
const missingAfter=governanceTables.filter(t=>!tableExists(t));
if(!gmudProjectAfter) throw new Error('gmud.project continua ausente após aplicação.');
if(missingAfter.length) throw new Error('Tabelas de Governança continuam ausentes: '+missingAfter.join(', '));

console.log('[OK] Schema aditivo validado sem operações destrutivas.');
