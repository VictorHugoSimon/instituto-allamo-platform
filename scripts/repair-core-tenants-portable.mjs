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

const oldExtract=`function extractResults(node){\n  if(Array.isArray(node)){\n    for(const item of node){ const r=extractResults(item); if(r)return r; }\n    return null;\n  }\n  if(node&&typeof node==='object'){\n    if(Array.isArray(node.results)) return node.results;\n    for(const value of Object.values(node)){ const r=extractResults(value); if(r)return r; }\n  }\n  return null;\n}`;

const deepExtract=`function extractResults(node){\n  // ALLAMO_DEEPEST_D1_RESULTS: Wrangler pode envelopar results dentro de results.\n  if(Array.isArray(node)){\n    for(const item of node){ const r=extractResults(item); if(r!==null)return r; }\n    return null;\n  }\n  if(node&&typeof node==='object'){\n    if(Array.isArray(node.results)){\n      for(const item of node.results){\n        if(item&&typeof item==='object'&&Array.isArray(item.results)){\n          const nested=extractResults(item);\n          if(nested!==null)return nested;\n        }\n      }\n      return node.results;\n    }\n    for(const value of Object.values(node)){ const r=extractResults(value); if(r!==null)return r; }\n  }\n  return null;\n}`;

function patchSource(raw){
  let source=normalizeSource(raw);
  if(source.includes(oldExtract)) source=source.replace(oldExtract,deepExtract);
  else if(!source.includes('ALLAMO_DEEPEST_D1_RESULTS')){
    throw new Error('O contrato de extractResults() mudou; não é seguro executar o wrapper portátil.');
  }
  if(!source.includes(old)){
    throw new Error('O contrato do parser do reparo mudou; wrapper portátil não será executado.');
  }
  return source.replace(old,replacement);
}

function loadExtractResults(source){
  const a=source.indexOf('function extractResults(node){');
  const b=source.indexOf('\n}\n\nfunction executeSqlFile',a);
  if(a<0||b<0) throw new Error('Não foi possível isolar extractResults() para self-test.');
  const fnSource=source.slice(a,b+2);
  return new Function(`${fnSource}; return extractResults;`)();
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
      if(!patched.includes('ALLAMO_DEEPEST_D1_RESULTS')) throw new Error('Parser profundo de results não foi aplicado.');
      const extractResults=loadExtractResults(patched);
      const rows=[{id:'dualclima',name:'Dual Clima'},{id:'madri',name:'Madrid'},{id:'opr',name:'OPR'}];
      const flat=[{results:rows,success:true}];
      const nested=[{results:[{results:rows,success:true}],success:true}];
      const nestedObject={result:[{results:[{results:rows}]}]};
      for(const fixture of [flat,nested,nestedObject]){
        const got=extractResults(fixture);
        if(!Array.isArray(got)||got.length!==3||got[0]?.id!=='dualclima'||got[1]?.id!=='madri'||got[2]?.id!=='opr'){
          throw new Error('extractResults() não chegou às linhas reais id/name no envelope D1.');
        }
      }
    }
    console.log('OK: wrapper portátil aceita LF, CRLF e BOM+CRLF, recupera payload JSON D1 e desce até o results real com id/name.');
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
