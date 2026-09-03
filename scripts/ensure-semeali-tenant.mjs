import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const WRANGLER='wrangler@4.124.0';
const DB='DB';
const CONFIG='wrangler.stage.toml';
const APPLY=process.argv.includes('--apply');
const confirm=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);

if(!fs.existsSync(CONFIG)){
  console.error('[ABORTADO] wrangler.stage.toml não encontrado.');
  process.exit(2);
}
if(APPLY&&confirm!=='ENSURE-SEMEALI-STAGE'){
  console.error('[ABORTADO] Para criar/reparar o tenant Semeali em STAGE, use --confirm=ENSURE-SEMEALI-STAGE.');
  process.exit(2);
}

function resolveNpxCli(){
  const candidates=[];
  if(process.env.npm_execpath)candidates.push(path.join(path.dirname(process.env.npm_execpath),'npx-cli.js'));
  candidates.push(path.join(path.dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'));
  for(const c of candidates)if(c&&fs.existsSync(c))return c;
  return null;
}
function runWrangler(args,{capture=true}={}){
  let r;
  if(process.platform==='win32'){
    const n=resolveNpxCli();if(!n)throw new Error('npx-cli.js não encontrado.');
    r=spawnSync(process.execPath,[n,'--yes',...args],{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false,windowsHide:true});
  }else{
    r=spawnSync('npx',['--yes',...args],{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false});
  }
  if(r.error)throw r.error;
  if(r.status!==0){if(capture){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr)}throw new Error(`Wrangler falhou (${r.status}).`)}
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}
function extractRows(node){
  const found=[];
  const visit=v=>{if(Array.isArray(v)){if(v.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))found.push(v);for(const x of v)visit(x);return}if(v&&typeof v==='object'){if(Array.isArray(v.results))found.unshift(v.results);for(const x of Object.values(v))visit(x)}};
  visit(node);return found[0]||[];
}
function parseJson(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  try{return JSON.parse(clean)}catch{}
  for(let a=0;a<clean.length;a++){
    if(clean[a]!=='['&&clean[a]!=='{')continue;
    for(let b=clean.length-1;b>a;b--){
      if(clean[b]!==']'&&clean[b]!=='}')continue;
      try{return JSON.parse(clean.slice(a,b+1))}catch{}
    }
  }
  throw new Error('Resposta D1 sem JSON reconhecível.');
}
function query(sql){
  return extractRows(parseJson(runWrangler([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'])));
}
function execute(sql){
  runWrangler([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql],{capture:false});
}
const q=s=>"'"+String(s??'').replace(/'/g,"''")+"'";

const existing=query("SELECT id,name,status,status_text,system FROM companies WHERE lower(id)='semeali' OR lower(name) LIKE '%semeali%' ORDER BY CASE WHEN lower(id)='semeali' THEN 0 ELSE 1 END,id LIMIT 1;")[0]||null;
console.log('Ambiente: stage');
console.log('Tenant Semeali: '+(existing?`presente (${existing.id} · ${existing.name})`:'ausente'));

if(!APPLY){
  console.log('[DRY-RUN] Nenhuma alteração aplicada.');
  process.exit(0);
}

if(!existing){
  execute(`INSERT INTO companies (id,name,city,system,own_system,lead,start_date,status,status_text,pmo_mode,progress,summary,email,owner_email,grupo,billing_to,billing_email,billing_amount,billing_day,stakeholders) VALUES (${q('semeali')},${q('Semeali')},${q('Araçatuba/SP')},${q('Államo Sales Intelligence')},1,${q('A definir')},${q('')},${q('s')},${q('Em implantação')},${q('White Label')},0,${q('Plataforma comercial white-label gerenciada pelo Instituto Államo.')},${q('')},${q('')},${q('')},${q('')},${q('')},${q('')},${q('')},${q('')});`);
}else if(String(existing.id)!=='semeali'){
  console.log(`[ATENÇÃO] Já existe empresa com nome Semeali usando id=${existing.id}. Nenhuma duplicata será criada.`);
}

const final=query("SELECT id,name,status,status_text,system FROM companies WHERE lower(id)='semeali' OR lower(name) LIKE '%semeali%' ORDER BY CASE WHEN lower(id)='semeali' THEN 0 ELSE 1 END,id LIMIT 1;")[0]||null;
if(!final)throw new Error('Tenant Semeali continua ausente após aplicação.');
console.log(`[OK] Tenant Semeali disponível em STAGE: ${final.id} · ${final.name}. Nenhum usuário ou senha foi criado.`);
