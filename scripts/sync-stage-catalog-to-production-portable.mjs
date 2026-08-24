import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const sourcePath=path.resolve(ROOT,'scripts','sync-stage-catalog-to-production.mjs');
if(!fs.existsSync(sourcePath)){
  console.error('[ABORTADO] scripts/sync-stage-catalog-to-production.mjs não encontrado.');
  process.exit(2);
}

const sourceRaw=fs.readFileSync(sourcePath,'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');

const oldCapture="  return capture?(r.stdout||''):'';";
const safeCapture=`  if(!capture)return '';
  const stdout=String(r.stdout||'');
  const stderr=String(r.stderr||'');
  return stdout+(stderr?'\\n'+stderr:'');`;

const baseQuery="const query=(config,sql)=>executeSqlFile(config,sql,{json:true,capture:true});";
const commandQuery=`function extractD1Json(out){
  const raw=String(out||'');
  try{return JSON.parse(raw)}catch{}
  const clean=raw.replace(/\\u001b\\[[0-9;?]*[ -\\/]*[@-~]/g,'').trim();
  try{return JSON.parse(clean)}catch{}
  const starts=[]; const ends=[];
  for(let i=0;i<clean.length;i++)if(clean[i]==='['||clean[i]==='{')starts.push(i);
  for(let i=clean.length-1;i>=0;i--)if(clean[i]===']'||clean[i]==='}')ends.push(i);
  let best=null,bestSize=-1;
  for(const a of starts){
    for(const b of ends){
      if(b<=a)continue;
      const slice=clean.slice(a,b+1);
      try{
        const candidate=JSON.parse(slice);
        if(extractResults(candidate)!==null&&slice.length>bestSize){best=candidate;bestSize=slice.length;}
      }catch{}
    }
  }
  if(best===null)throw new Error('Wrangler retornou saída sem payload JSON D1 reconhecível ao consultar D1 via --command.');
  return best;
}
function executeSqlCommand(config,sql,{json=true,capture=true}={}){
  const args=[WRANGLER,'d1','execute',DB,'--remote','--config',config,'--command',sql];
  if(json)args.push('--json');
  const out=runWrangler(args,{capture});
  if(!json)return [];
  const parsed=extractD1Json(out);
  const rows=extractResults(parsed);
  if(rows===null)throw new Error('Wrangler retornou JSON D1 sem results ao consultar via --command.');
  return rows;
}
const query=(config,sql)=>executeSqlCommand(config,sql,{json:true,capture:true});`;

function patchSource(raw){
  let source=raw;
  if(!source.includes(oldCapture))throw new Error('Contrato de captura do Wrangler mudou; sincronização bloqueada.');
  source=source.replace(oldCapture,safeCapture);
  if(!source.includes(baseQuery))throw new Error('Contrato query() mudou; sincronização bloqueada.');
  source=source.replace(baseQuery,commandQuery);
  if(!source.includes("'--command',sql"))throw new Error('Leituras D1 não foram migradas para --command.');
  if(source.includes("const query=(config,sql)=>executeSqlFile"))throw new Error('query() ainda aponta para --file.');
  if(!source.includes("'--file',temp"))throw new Error('Canal controlado de escrita por arquivo desapareceu; execução bloqueada.');
  return source;
}

let patched;
try{patched=patchSource(sourceRaw)}catch(e){
  console.error('[ABORTADO]',e.message||e);
  process.exit(2);
}

if(process.argv.includes('--self-test')){
  console.log('OK: leituras D1 usam --command; escrita controlada por --file permanece separada.');
  process.exit(0);
}

const temp=path.join(os.tmpdir(),`allamo-catalog-sync-portable-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(temp,patched,'utf8');
try{
  const forwarded=process.argv.slice(2);
  const r=spawnSync(process.execPath,[temp,...forwarded],{cwd:ROOT,stdio:'inherit',shell:false,env:process.env});
  if(r.error)throw r.error;
  process.exitCode=r.status??1;
}finally{
  try{fs.unlinkSync(temp)}catch{}
}
