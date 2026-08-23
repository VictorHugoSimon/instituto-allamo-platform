import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sourcePath=path.resolve(process.cwd(),'scripts','repair-core-tenants.mjs');
if(!fs.existsSync(sourcePath)){
  console.error('[ABORTADO] scripts/repair-core-tenants.mjs não encontrado.');
  process.exit(2);
}

const source=fs.readFileSync(sourcePath,'utf8');
const old=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{ throw new Error('Wrangler retornou saída não-JSON ao consultar D1.'); }`;
const replacement=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{\n      const clean=String(out||'').replace(/\\u001b\\[[0-9;?]*[ -\\/]*[@-~]/g,'').trim();\n      let recovered=null;\n      const starts=[];\n      for(let i=0;i<clean.length;i++) if(clean[i]==='['||clean[i]==='{') starts.push(i);\n      const ends=[];\n      for(let i=clean.length-1;i>=0;i--) if(clean[i]===']'||clean[i]==='}') ends.push(i);\n      outer: for(const a of starts){\n        for(const b of ends){\n          if(b<=a) continue;\n          try{ recovered=JSON.parse(clean.slice(a,b+1)); break outer; }catch{}\n        }\n      }\n      if(recovered===null) throw new Error('Wrangler retornou saída sem payload JSON reconhecível ao consultar D1.');\n      parsed=recovered;\n    }`;

if(!source.includes(old)){
  console.error('[ABORTADO] O contrato do parser do reparo mudou; wrapper portátil não será executado.');
  process.exit(3);
}

const tempFile=path.join(os.tmpdir(),`allamo-repair-core-portable-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(tempFile,source.replace(old,replacement),'utf8');

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
