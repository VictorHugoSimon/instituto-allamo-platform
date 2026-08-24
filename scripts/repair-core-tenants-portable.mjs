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

// O Wrangler pode devolver mais de um array chamado `results` no mesmo payload.
// Para não confundir metadados com as linhas SQL, a extração é orientada pelas
// colunas esperadas de cada consulta (ex.: companies exige id + name).
function extractResultsDeep(node,expectedFields=[]){
  const matches=[];
  const empties=[];
  const fallbacks=[];
  const isRow=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const hasExpected=row=>expectedFields.every(field=>Object.prototype.hasOwnProperty.call(row,field));
  const visit=(value,depth=0,fromResults=false)=>{
    if(Array.isArray(value)){
      if(fromResults){
        const allRows=value.every(isRow);
        if(value.length===0) empties.push({rows:value,depth});
        else if(allRows&&(!expectedFields.length||value.every(hasExpected))) matches.push({rows:value,depth});
        if(allRows) fallbacks.push({rows:value,depth});
      }
      for(const item of value) visit(item,depth+1,false);
      return;
    }
    if(value&&typeof value==='object'){
      if(Array.isArray(value.results)) visit(value.results,depth+1,true);
      for(const [key,nested] of Object.entries(value)) if(key!=='results') visit(nested,depth+1,false);
    }
  };
  visit(node);
  const choose=list=>list.sort((a,b)=>b.depth-a.depth||b.rows.length-a.rows.length)[0]?.rows??null;
  if(matches.length)return choose(matches);
  if(empties.length)return choose(empties);
  if(!expectedFields.length&&fallbacks.length)return choose(fallbacks);
  return null;
}

const oldParse=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{ throw new Error('Wrangler retornou saída não-JSON ao consultar D1.'); }\n    return extractResults(parsed)||[];`;
const tolerantParse=`    let parsed;\n    try{ parsed=JSON.parse(out); }\n    catch{\n      const clean=String(out||'').replace(/\\u001b\\[[0-9;?]*[ -\\/]*[@-~]/g,'').trim();\n      let recovered=null;\n      let recoveredSize=-1;\n      const starts=[];\n      for(let i=0;i<clean.length;i++) if(clean[i]==='['||clean[i]==='{') starts.push(i);\n      const ends=[];\n      for(let i=clean.length-1;i>=0;i--) if(clean[i]===']'||clean[i]==='}') ends.push(i);\n      for(const a of starts){\n        for(const b of ends){\n          if(b<=a) continue;\n          const slice=clean.slice(a,b+1);\n          try{\n            const candidate=JSON.parse(slice);\n            const rows=extractResults(candidate,expectedFields);\n            if(rows!==null && slice.length>recoveredSize){ recovered=candidate; recoveredSize=slice.length; }\n          }catch{}\n        }\n      }\n      if(recovered===null) throw new Error('Wrangler retornou saída sem payload JSON D1 reconhecível ao consultar D1.');\n      parsed=recovered;\n    }\n    const rows=extractResults(parsed,expectedFields);\n    if(rows===null) throw new Error('Wrangler retornou JSON D1 sem results compatível com as colunas esperadas: '+expectedFields.join(','));\n    return rows;`;

const deepParserSource=`function extractResults(node,expectedFields=[]){
  const matches=[];
  const empties=[];
  const fallbacks=[];
  const isRow=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const hasExpected=row=>expectedFields.every(field=>Object.prototype.hasOwnProperty.call(row,field));
  const visit=(value,depth=0,fromResults=false)=>{
    if(Array.isArray(value)){
      if(fromResults){
        const allRows=value.every(isRow);
        if(value.length===0) empties.push({rows:value,depth});
        else if(allRows&&(!expectedFields.length||value.every(hasExpected))) matches.push({rows:value,depth});
        if(allRows) fallbacks.push({rows:value,depth});
      }
      for(const item of value) visit(item,depth+1,false);
      return;
    }
    if(value&&typeof value==='object'){
      if(Array.isArray(value.results)) visit(value.results,depth+1,true);
      for(const [key,nested] of Object.entries(value)) if(key!=='results') visit(nested,depth+1,false);
    }
  };
  visit(node);
  const choose=list=>list.sort((a,b)=>b.depth-a.depth||b.rows.length-a.rows.length)[0]?.rows??null;
  if(matches.length)return choose(matches);
  if(empties.length)return choose(empties);
  if(!expectedFields.length&&fallbacks.length)return choose(fallbacks);
  return null;
}`;

const evidenceNeedle="  const companies=query(config,'SELECT id,name FROM companies ORDER BY name,id;',['id','name']);";
const evidenceGuard=`${evidenceNeedle}\n  const malformedCompanies=companies.filter(c=>!c||typeof c!=='object'||c.id==null||c.name==null);\n  if(malformedCompanies.length) fail('Consulta de companies retornou envelope inválido sem id/name. Nenhuma alteração será planejada.');`;

const windowsStreamNeedle="  return capture?(r.stdout||''):'';";
const windowsStreamReplacement="  if(!capture)return '';\n  const stdout=String(r.stdout||'');\n  const stderr=String(r.stderr||'');\n  if(process.platform==='win32' && !stdout.trim() && stderr.trim()) console.warn('[wrangler] stdout vazio; analisando stderr como fallback D1.');\n  return stdout+(stderr?'\\n'+stderr:'');";

// Consultas de evidência devem usar --command. No D1 remoto, --file segue o fluxo
// de import/ingestão e pode devolver somente métricas (rows read/written), sem as
// linhas do SELECT. --command usa o endpoint de query e preserva `results`.
const commandQuerySource=`function executeSqlCommand(config,sql,{json=true,capture=true,expectedFields=[]}={}){
  const args=[WRANGLER,'d1','execute',DB,'--remote','--config',config,'--command',sql];
  if(json)args.push('--json');
  const out=runWrangler(args,{capture});
  if(!json)return [];
  let parsed;
  try{ parsed=JSON.parse(out); }
  catch{
    const clean=String(out||'').replace(/\\u001b\\[[0-9;?]*[ -\\/]*[@-~]/g,'').trim();
    let recovered=null;
    let recoveredSize=-1;
    const starts=[];
    for(let i=0;i<clean.length;i++) if(clean[i]==='['||clean[i]==='{') starts.push(i);
    const ends=[];
    for(let i=clean.length-1;i>=0;i--) if(clean[i]===']'||clean[i]==='}') ends.push(i);
    for(const a of starts){
      for(const b of ends){
        if(b<=a) continue;
        const slice=clean.slice(a,b+1);
        try{
          const candidate=JSON.parse(slice);
          const rows=extractResults(candidate,expectedFields);
          if(rows!==null && slice.length>recoveredSize){ recovered=candidate; recoveredSize=slice.length; }
        }catch{}
      }
    }
    if(recovered===null) throw new Error('Wrangler retornou saída sem payload JSON D1 reconhecível ao consultar D1 via --command.');
    parsed=recovered;
  }
  const rows=extractResults(parsed,expectedFields);
  if(rows===null) throw new Error('Wrangler retornou JSON D1 sem results compatível com as colunas esperadas: '+expectedFields.join(','));
  return rows;
}

const query=(config,sql,expectedFields=[])=>executeSqlCommand(config,sql,{json:true,capture:true,expectedFields});`;

function patchSource(raw){
  let source=normalizeSource(raw);
  const parserStart=source.indexOf('function extractResults(node){');
  const parserEnd=source.indexOf('\n}\n\nfunction executeSqlFile',parserStart);
  if(parserStart<0||parserEnd<0){
    throw new Error('O reparo não possui extractResults() no contrato esperado; não é seguro executar o wrapper portátil.');
  }
  source=source.slice(0,parserStart)+deepParserSource+source.slice(parserEnd+2);

  if(!source.includes(windowsStreamNeedle)){
    throw new Error('O contrato de captura do Wrangler mudou; wrapper portátil não será executado.');
  }
  source=source.replace(windowsStreamNeedle,windowsStreamReplacement);

  source=source.replace(
    "function executeSqlFile(config,sql,{json=true,capture=true}={}){",
    "function executeSqlFile(config,sql,{json=true,capture=true,expectedFields=[]}={}){"
  );
  if(!source.includes('expectedFields=[]')) throw new Error('Não foi possível adicionar contrato de colunas ao executeSqlFile().');

  if(!source.includes(oldParse)){
    throw new Error('O contrato do parser do reparo mudou; wrapper portátil não será executado.');
  }
  source=source.replace(oldParse,tolerantParse);

  const baseQuery="const query=(config,sql)=>executeSqlFile(config,sql,{json:true,capture:true});";
  if(!source.includes(baseQuery)) throw new Error('O contrato do query() mudou; wrapper portátil não será executado.');
  source=source.replace(baseQuery,commandQuerySource);
  if(!source.includes("'--command',sql")) throw new Error('Consultas D1 não foram migradas para --command.');
  if(source.includes("const query=(config,sql,expectedFields=[])=>executeSqlFile")) throw new Error('Query ainda está usando --file; execução bloqueada.');

  const replacements=[
    ["query(config,'SELECT id,name FROM companies ORDER BY name,id;')","query(config,'SELECT id,name FROM companies ORDER BY name,id;',['id','name'])"],
    ["query(config,\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;\")","query(config,\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;\",['name'])"],
    ["query(config,`PRAGMA table_info(${sqlIdent(table)});`)","query(config,`PRAGMA table_info(${sqlIdent(table)});`,['name'])"],
    ["query(config,`SELECT DISTINCT company_id FROM ${sqlIdent(table)} WHERE company_id IS NOT NULL AND trim(CAST(company_id AS TEXT))<>'';`)","query(config,`SELECT DISTINCT company_id FROM ${sqlIdent(table)} WHERE company_id IS NOT NULL AND trim(CAST(company_id AS TEXT))<>'';`,['company_id'])"],
    ["query(config,'PRAGMA table_info(companies);')","query(config,'PRAGMA table_info(companies);',['name'])"],
    ["query(config,'SELECT company_id,COUNT(*) AS projects FROM projects GROUP BY company_id ORDER BY company_id;')","query(config,'SELECT company_id,COUNT(*) AS projects FROM projects GROUP BY company_id ORDER BY company_id;',['company_id','projects'])"]
  ];
  for(const [from,to] of replacements) source=source.split(from).join(to);

  if(!source.includes(evidenceNeedle)){
    throw new Error('O contrato de collectEvidence() mudou; não é seguro executar sem validar id/name.');
  }
  if(!source.includes('malformedCompanies=')) source=source.replace(evidenceNeedle,evidenceGuard);

  const required=[
    "['id','name']",
    "['company_id']",
    "['company_id','projects']",
    'extractResults(candidate,expectedFields)',
    'extractResults(parsed,expectedFields)',
    "const stderr=String(r.stderr||'')",
    "return stdout+(stderr?'\\n'+stderr:'')",
    'function executeSqlCommand(config,sql',
    "'--command',sql",
    'executeSqlCommand(config,sql,{json:true,capture:true,expectedFields})'
  ];
  for(const needle of required) if(!source.includes(needle)) throw new Error('Patch incompleto do contrato D1: '+needle);
  return source;
}

if(process.argv.includes('--self-test')){
  try{
    const nested={results:[{success:true,results:[{id:'dualclima',name:'Dual Clima'},{id:'madrid',name:'Madrid'}]}]};
    const nestedRows=extractResultsDeep(nested,['id','name']);
    if(!Array.isArray(nestedRows)||nestedRows.length!==2||nestedRows[0].id!=='dualclima'||nestedRows[1].id!=='madrid'){
      throw new Error('Parser por colunas não recuperou as linhas id/name do envelope D1 aninhado.');
    }

    const noisy={
      results:[{success:true,meta:{duration:1}}],
      payload:{results:[{id:'opr',name:'OPR'}]}
    };
    const noisyRows=extractResultsDeep(noisy,['id','name']);
    if(!Array.isArray(noisyRows)||noisyRows.length!==1||noisyRows[0]?.id!=='opr'){
      throw new Error('Parser escolheu results de metadados em vez das linhas com id/name.');
    }

    const invalid={results:[{success:true,meta:{duration:1}}]};
    if(extractResultsDeep(invalid,['id','name'])!==null){
      throw new Error('Parser aceitou envelope sem as colunas exigidas id/name.');
    }

    const empty={results:[]};
    const emptyRows=extractResultsDeep(empty,['id','name']);
    if(!Array.isArray(emptyRows)||emptyRows.length!==0) throw new Error('Parser não preservou result set vazio válido.');

    const lf=normalizeSource(sourceRaw);
    const crlf=lf.replace(/\n/g,'\r\n');
    const bomCrlf='\uFEFF'+crlf;
    for(const sample of [lf,crlf,bomCrlf]){
      const patched=patchSource(sample);
      if(!patched.includes('Wrangler retornou saída sem payload JSON D1 reconhecível')) throw new Error('Parser tolerante não foi aplicado no self-test.');
      if(!patched.includes('const rows=extractResults(candidate,expectedFields)')) throw new Error('Parser portátil não valida colunas no fragmento JSON recuperado.');
      if(!patched.includes('slice.length>recoveredSize')) throw new Error('Parser portátil não prioriza o payload D1 estruturalmente mais completo.');
      if(!patched.includes("['id','name']")) throw new Error('Consulta de companies não exige id/name.');
      if(!patched.includes("['company_id']")) throw new Error('Consulta de referências não exige company_id.');
      if(!patched.includes('malformedCompanies=companies.filter')) throw new Error('Fail-safe id/name não foi injetado em collectEvidence().');
      if(!patched.includes("const stderr=String(r.stderr||'')")) throw new Error('Wrapper portátil não captura stderr do Wrangler.');
      if(!patched.includes("return stdout+(stderr?'\\n'+stderr:'')")) throw new Error('Wrapper portátil não combina stdout/stderr para o parser D1.');
      if(!patched.includes("'--command',sql")) throw new Error('Consultas de evidência ainda não usam --command.');
      if(!patched.includes('executeSqlCommand(config,sql,{json:true,capture:true,expectedFields})')) throw new Error('query() não está roteando para executeSqlCommand.');
      if(patched.includes('const query=(config,sql,expectedFields=[])=>executeSqlFile')) throw new Error('query() voltou a usar --file para SELECT.');
    }
    console.log('OK: wrapper portátil aceita LF, CRLF e BOM+CRLF, captura stdout+stderr do Wrangler no Windows, usa --command para SELECT remoto, ignora results de metadados, seleciona linhas pelas colunas esperadas e aborta evidência malformada.');
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
