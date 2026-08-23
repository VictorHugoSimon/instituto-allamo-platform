import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sourcePath=path.resolve(process.cwd(),'scripts','repair-core-tenants.mjs');
if(!fs.existsSync(sourcePath)){
  console.error('[ABORTADO] scripts/repair-core-tenants.mjs não encontrado.');
  process.exit(2);
}

const normalizeSource=(raw)=>String(raw||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
const sourceRaw=fs.readFileSync(sourcePath,'utf8');
const old=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{ throw new Error('Wrangler retornou saída não-JSON ao consultar D1.'); }`;
const replacement=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{\n      const clean=String(out||'').replace(/\\u001b\\[[0-9;?]*[ -\\/]*[@-~]/g,'').trim();\n      let recovered=null;\n      let recoveredSize=-1;\n      const starts=[];\n      for(let i=0;i<clean.length;i++) if(clean[i]==='['||clean[i]==='{') starts.push(i);\n      const ends=[];\n      for(let i=clean.length-1;i>=0;i--) if(clean[i]===']'||clean[i]==='}') ends.push(i);\n      for(const a of starts){\n        for(const b of ends){\n          if(b<=a) continue;\n          const slice=clean.slice(a,b+1);\n          try{\n            const candidate=JSON.parse(slice);\n            const rows=extractResults(candidate);\n            if(rows!==null && slice.length>recoveredSize){ recovered=candidate; recoveredSize=slice.length; }\n          }catch{}\n        }\n      }\n      if(recovered===null) throw new Error('Wrangler retornou saída sem payload JSON D1 reconhecível ao consultar D1.');\n      parsed=recovered;\n    }`;

function patchSource(raw){
  const source=normalizeSource(raw);
  if(!source.includes('function extractResults(node)')){
    throw new Error('O reparo não possui extractResults(); não é seguro executar o wrapper portátil.');
  }
  if(!source.includes(old)){
    throw new Error('O contrato do parser do reparo mudou; wrapper portátil não será executado.');
  }
  return source.replace(old,replacement);
}

if(process.argv.includes('--self-test')){
  try{
    const lf=normalizeSource(sourceRaw);
    const crlf=lf.replace(/\n/g,'\r\n');
    const bomCrlf='\uFEFF'+crlf;
    for(const sample of [lf,crlf,bomCrlf]){
      const patched=patchSource(sample);
      if(!patched.includes('Wrangler retornou saída sem payload JSON D1 reconhecível')) throw new Error('Parser tolerante não foi aplicado no self-test.');
      if(!patched.includes('const rows=extractResults(candidate)')) throw new Error('Parser portátil não exige envelope D1 com results.');
      if(!patched.includes('slice.length>recoveredSize')) throw new Error('Parser portátil não prioriza o payload D1 estruturalmente mais completo.');
    }
    console.log('OK: wrapper portátil aceita LF, CRLF e BOM+CRLF e só recupera payload JSON que contém results do D1.');
    process.exit(0);
  }catch(e){
    console.error('[ABORTADO] Self-test do wrapper portátil falhou: '+(e?.message||String(e)));
    process.exit(4);
  }
}

let patchedSource;
try{ patchedSource=patchSource(sourceRaw); }
catch(e){
  console.error('[ABORTADO] '+(e?.message||String(e)));
  process.exit(3);
}

const tempFile=path.join(os.tmpdir(),`allamo-repair-core-portable-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(tempFile,patchedSource,'utf8');

try{
  const result=spawnSync(process.execPath,[tempFile,...process.argv.slice(2)],{
    cwd:process.cwd(),
    env:process.env,
    stdio:'inherit',
    shell:false
  });
  if(result.error) throw result.error;
  process.exitCode=Number.isInteger(result.status)?result.status:1;
}finally{
  try{fs.unlinkSync(tempFile)}catch{}
}
