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
  stage:{config:'wrangler.stage.toml',confirm:'APPLY-WORK-SCHEMA-STAGE'},
  production:{config:'wrangler.production.toml',confirm:'APPLY-WORK-SCHEMA-PRODUCTION'}
};
const env=ENVIRONMENTS[envArg];
const REQUIRED=['work_items','work_sprints','work_comments','work_checklist','work_links','work_events'];
const MIGRATION='migrations/2026-08-21-work-management.sql';

if(!env){console.error('[ABORTADO] Informe --env=stage ou --env=production.');process.exit(2)}
if(!fs.existsSync(env.config)){console.error(`[ABORTADO] Config não encontrada: ${env.config}`);process.exit(2)}
if(!fs.existsSync(MIGRATION)){console.error(`[ABORTADO] Migration não encontrada: ${MIGRATION}`);process.exit(2)}
if(APPLY&&confirmArg!==env.confirm){console.error(`[ABORTADO] Para aplicar em ${envArg}, use --confirm=${env.confirm}`);process.exit(2)}

function resolveNpxCli(){
  const candidates=[];
  if(process.env.npm_execpath)candidates.push(path.join(path.dirname(process.env.npm_execpath),'npx-cli.js'));
  candidates.push(path.join(path.dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'));
  return candidates.find(c=>c&&fs.existsSync(c))||null;
}
function runWrangler(args,{capture=true}={}){
  let r;
  if(process.platform==='win32'){
    const n=resolveNpxCli();
    if(!n)throw new Error('npx-cli.js não encontrado junto da instalação do Node/npm.');
    r=spawnSync(process.execPath,[n,'--yes',...args],{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false,windowsHide:true});
  }else{
    r=spawnSync('npx',['--yes',...args],{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false});
  }
  if(r.error)throw r.error;
  if(r.status!==0){
    if(capture){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr)}
    throw new Error(`Wrangler falhou (${r.status}).`);
  }
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
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
  throw new Error('Wrangler não retornou JSON D1 reconhecível.');
}
function rowsDeep(node){
  const out=[];
  const visit=v=>{
    if(Array.isArray(v)){for(const x of v)visit(x);return}
    if(v&&typeof v==='object'){
      if(Array.isArray(v.results))out.push(...v.results);
      for(const x of Object.values(v))visit(x);
    }
  };
  visit(node);return out;
}
function query(sql){
  const raw=runWrangler([WRANGLER,'d1','execute',DB,'--remote','--config',env.config,'--command',sql,'--json']);
  return rowsDeep(parseJson(raw));
}
function tableExists(name){
  const safe=String(name).replace(/'/g,"''");
  return query(`SELECT name FROM sqlite_master WHERE type='table' AND name='${safe}';`).some(r=>String(r.name||'')===name);
}
function missingTables(){return REQUIRED.filter(t=>!tableExists(t))}

console.log(`Ambiente: ${envArg}`);
let missing=missingTables();
console.log(`Work Management ausente: ${missing.length?missing.join(', '):'nenhuma'}`);
if(!APPLY){
  if(missing.length)console.log('[DRY-RUN] Migration necessária; nenhuma alteração aplicada.');
  else console.log('[DRY-RUN] Estrutura Work Management já está íntegra.');
  process.exit(0);
}
if(missing.length){
  console.log('[APPLY] Aplicando migration idempotente de Work Management...');
  runWrangler([WRANGLER,'d1','execute',DB,'--remote','--config',env.config,'--file',MIGRATION],{capture:false});
}
missing=missingTables();
if(missing.length)throw new Error(`Schema Work Management continua incompleto: ${missing.join(', ')}`);
const fkProblems=query('PRAGMA foreign_key_check;');
if(fkProblems.length){
  console.warn(`[ATENÇÃO] foreign_key_check retornou ${fkProblems.length} ocorrência(s). A estrutura foi criada, mas há referências legadas a revisar.`);
}
console.log('[OK] Work Management validado: work_items e tabelas dependentes disponíveis sem operações destrutivas.');
