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

// O Wrangler pode devolver envelopes aninhados, por exemplo:
// { results: [ { results: [ { id, name } ] } ] }.
// O parser antigo aceitava o primeiro `results` e devolvia o envelope em vez das linhas.
// Esta versão sempre prefere o `results` mais profundo que não contenha outro envelope.
function extractResultsDeep(node){
  if(Array.isArray(node)){
    for(const item of node){
      const nested=extractResultsDeep(item);
      if(nested!==null)return nested;
    }
    return null;
  }
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results)){
      for(const item of node.results){
        const nested=extractResultsDeep(item);
        if(nested!==null)return nested;
      }
      return node.results;
    }
    for(const value of Object.values(node)){
      const nested=extractResultsDeep(value);
      if(nested!==null)return nested;
    }
  }
  return null;
}

const old=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{ throw new Error('Wrangler retornou saída não-JSON ao consultar D1.'); }`;
const replacement=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{\n      const clean=String(out||'').replace(/\\u001b\\[[0-9;?]*[ -\\/]*[@-~]/g,'').trim();\n      let recovered=null;\n      let recoveredSize=-1;\n      const starts=[];\n      for(let i=0;i<clean.length;i++) if(clean[i]==='['||clean[i]==='{') starts.push(i);\n      const ends=[];\n      for(let i=clean.length-1;i>=0;i--) if(clean[i]===']'||clean[i]==='}') ends.push(i);\n      for(const a of starts){\n        for(const b of ends){\n          if(b<=a) continue;\n          const slice=clean.slice(a,b+1);\n          try{\n            const candidate=JSON.parse(slice);\n            const rows=extractResults(candidate);\n            if(rows!==null && slice.length>recoveredSize){ recovered=candidate; recoveredSize=slice.length; }\n          }catch{}\n        }\n      }\n      if(recovered===null) throw new Error('Wrangler retornou saída sem payload JSON D1 reconhecível ao consultar D1.');\n      parsed=recovered;\n    }`;

const deepParserSource=`function extractResults(node){
  if(Array.isArray(node)){
    for(const item of node){
      const nested=extractResults(item);
      if(nested!==null)return nested;
    }
    return null;
  }
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results)){
      for(const item of node.results){
        const nested=extractResults(item);
        if(nested!==null)return nested;
      }
      return node.results;
    }
    for(const value of Object.values(node)){
      const nested=extractResults(value);
      if(nested!==null)return nested;
    }
  }
  return null;
}`;

const evidenceNeedle="  const companies=query(config,'SELECT id,name FROM companies ORDER BY name,id;');";
const evidenceGuard=`${evidenceNeedle}\n  const malformedCompanies=companies.filter(c=>!c||typeof c!=='object'||c.id==null||c.name==null);\n  if(malformedCompanies.length) fail('Consulta de companies retornou envelope inválido sem id/name. Nenhuma alteração será planejada.');`;

function patchSource(raw){
  let source=normalizeSource(raw);
  const parserStart=source.indexOf('function extractResults(node){');
  const parserEnd=source.indexOf('\n}\n\nfunction executeSqlFile',parserStart);
  if(parserStart<0||parserEnd<0){
    throw new Error('O reparo não possui extractResults() no contrato esperado; não é seguro executar o wrapper portátil.');
  }
  source=source.slice(0,parserStart)+deepParserSource+source.slice(parserEnd+2);

  if(!source.includes(old)){
    throw new Error('O contrato do parser do reparo mudou; wrapper portátil não será executado.');
  }
  source=source.replace(old,replacement);

  if(!source.includes(evidenceNeedle)){
    throw new Error('O contrato de collectEvidence() mudou; não é seguro executar sem validar id/name.');
  }
  if(!source.includes('malformedCompanies=')) source=source.replace(evidenceNeedle,evidenceGuard);
  return source;
}

if(process.argv.includes('--self-test')){
  try{
    const nested={results:[{success:true,results:[{id:'dualclima',name:'Dual Clima'},{id:'madri',name:'Madrid'}]}]};
    const nestedRows=extractResultsDeep(nested);
    if(!Array.isArray(nestedRows)||nestedRows.length!==2||nestedRows[0].id!=='dualclima'||nestedRows[1].id!=='madri'){
      throw new Error('Parser profundo não recuperou as linhas internas do envelope D1 aninhado.');
    }
    const direct={results:[{id:'opr',name:'OPR'}]};
    const directRows=extractResultsDeep(direct);
    if(!Array.isArray(directRows)||directRows[0]?.id!=='opr') throw new Error('Parser profundo quebrou payload D1 simples.');

    const lf=normalizeSource(sourceRaw);
    const crlf=lf.replace(/\n/g,'\r\n');
    const bomCrlf='\uFEFF'+crlf;
    for(const sample of [lf,crlf,bomCrlf]){
      const patched=patchSource(sample);
      if(!patched.includes('Wrangler retornou saída sem payload JSON D1 reconhecível')) throw new Error('Parser tolerante não foi aplicado no self-test.');
      if(!patched.includes('const rows=extractResults(candidate)')) throw new Error('Parser portátil não exige envelope D1 com results.');
      if(!patched.includes('slice.length>recoveredSize')) throw new Error('Parser portátil não prioriza o payload D1 estruturalmente mais completo.');
      if(!patched.includes('const nested=extractResults(item)')) throw new Error('Parser profundo não foi injetado na cópia temporária.');
      if(!patched.includes('malformedCompanies=companies.filter')) throw new Error('Fail-safe id/name não foi injetado em collectEvidence().');
    }
    console.log('OK: wrapper portátil aceita LF, CRLF e BOM+CRLF, resolve results D1 aninhado até as linhas id/name e aborta evidência malformada.');
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
