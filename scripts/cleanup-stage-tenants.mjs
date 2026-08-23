import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CONFIG='wrangler.stage.toml';
const DB='DB';
const WRANGLER='wrangler@4.124.0';
const APPLY=process.argv.includes('--apply');
const KEEP=[
  { slug:'dualclima', label:'Dual Clima' },
  { slug:'madrid', label:'Madrid' },
  { slug:'opr', label:'OPR' }
];

const normalize=(v='')=>String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const sqlString=v=>`'${String(v).replace(/'/g,"''")}'`;
const sqlIdent=v=>`"${String(v).replace(/"/g,'""')}"`;
const npx=process.platform==='win32'?'npx.cmd':'npx';

function runWrangler(args,{capture=true}={}){
  const r=spawnSync(npx,[WRANGLER,...args],{
    encoding:'utf8',
    stdio:capture?['ignore','pipe','pipe']:'inherit',
    shell:false
  });
  if(r.status!==0){
    if(capture){ if(r.stdout)process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr); }
    throw new Error(`Wrangler falhou (${r.status}) em: ${args.join(' ')}`);
  }
  return capture?(r.stdout||''):'';
}

function extractResults(node){
  if(Array.isArray(node)){
    for(const item of node){ const r=extractResults(item); if(r)return r; }
    return null;
  }
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results)) return node.results;
    for(const v of Object.values(node)){ const r=extractResults(v); if(r)return r; }
  }
  return null;
}

function query(sql){
  const out=runWrangler(['d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json']);
  let parsed;
  try{ parsed=JSON.parse(out); }
  catch(e){ throw new Error('Não foi possível interpretar o JSON retornado pelo Wrangler.'); }
  return extractResults(parsed)||[];
}

function ensureStageConfig(){
  if(!fs.existsSync(CONFIG)) throw new Error(`${CONFIG} não encontrado.`);
  const text=fs.readFileSync(CONFIG,'utf8');
  if(!text.includes('name = "allamo-pmo-stage"')) throw new Error('Config não aponta para allamo-pmo-stage.');
  if(text.includes('name = "allamo-pmo"\n')) throw new Error('Config de Stage parece contaminada com Produção.');
}

function backup(){
  fs.mkdirSync('backups',{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.resolve('backups',`stage-before-tenant-cleanup-${stamp}.sql`);
  console.log(`\nBackup obrigatório: ${file}`);
  runWrangler(['d1','export',DB,'--remote','--config',CONFIG,'--output',file],{capture:false});
  if(!fs.existsSync(file)||fs.statSync(file).size===0) throw new Error('Backup do Stage não foi criado; limpeza abortada.');
  return file;
}

function main(){
  ensureStageConfig();
  const companies=query('SELECT id,name FROM companies ORDER BY name;');
  if(!companies.length) throw new Error('Nenhuma empresa encontrada no Stage; limpeza abortada.');

  const matched=new Map();
  for(const k of KEEP) matched.set(k.slug,companies.filter(c=>normalize(c.name)===k.slug||normalize(c.id)===k.slug));
  const problems=[];
  for(const k of KEEP){
    const arr=matched.get(k.slug)||[];
    if(arr.length!==1) problems.push(`${k.label}: esperado 1 cadastro, encontrado ${arr.length}`);
  }

  console.log('\nEmpresas encontradas no Stage:');
  for(const c of companies) console.log(`- ${c.name} [${c.id}]${KEEP.some(k=>normalize(c.name)===k.slug||normalize(c.id)===k.slug)?'  <- MANTER':''}`);

  if(problems.length){
    console.error('\n[ABORTADO] A lista permitida não foi resolvida de forma exata:');
    problems.forEach(p=>console.error('- '+p));
    console.error('Nenhum dado foi alterado. Ajuste nomes/IDs antes de executar novamente.');
    process.exit(3);
  }

  const keepIds=new Set([...matched.values()].flat().map(x=>String(x.id)));
  const victims=companies.filter(c=>!keepIds.has(String(c.id)));
  console.log('\nEmpresas que serão preservadas:');
  for(const k of KEEP){ const c=matched.get(k.slug)[0]; console.log(`- ${c.name} [${c.id}]`); }

  if(!victims.length){
    console.log('\nStage já está saneado. Nada para remover.');
    return;
  }

  console.log('\nEmpresas fora da allowlist:');
  victims.forEach(c=>console.log(`- REMOVER: ${c.name} [${c.id}]`));
  if(!APPLY){
    console.log('\nDRY-RUN concluído. Nenhum dado foi alterado.');
    console.log('Para aplicar após conferir a lista acima:');
    console.log('  node scripts/cleanup-stage-tenants.mjs --apply');
    return;
  }

  const victimIds=victims.map(v=>String(v.id));
  const victimSql=victimIds.map(sqlString).join(',');
  const projects=query(`SELECT id,name,company_id FROM projects WHERE company_id IN (${victimSql}) ORDER BY company_id,id;`);
  const projectIds=projects.map(p=>String(p.id));
  const projectSql=projectIds.length?projectIds.map(sqlString).join(','):"''";

  const tables=query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").map(r=>r.name).filter(Boolean);
  const tableCols=new Map();
  for(const table of tables){
    try{ tableCols.set(table,query(`PRAGMA table_info(${sqlIdent(table)});`).map(r=>String(r.name))); }
    catch(e){ tableCols.set(table,[]); }
  }

  const backupFile=backup();
  const statements=['PRAGMA foreign_keys=OFF;'];

  if(tables.includes('tenant_file_chunks')&&tables.includes('tenant_files')){
    statements.push(`DELETE FROM ${sqlIdent('tenant_file_chunks')} WHERE file_id IN (SELECT id FROM ${sqlIdent('tenant_files')} WHERE company_id IN (${victimSql}));`);
  }
  if(tables.includes('sessions')&&tables.includes('users')){
    statements.push(`DELETE FROM ${sqlIdent('sessions')} WHERE user_id IN (SELECT id FROM ${sqlIdent('users')} WHERE company_id IN (${victimSql}));`);
  }

  for(const table of tables){
    if(['companies','projects','sessions','tenant_file_chunks'].includes(table)) continue;
    const cols=tableCols.get(table)||[];
    if(cols.includes('company_id')) statements.push(`DELETE FROM ${sqlIdent(table)} WHERE company_id IN (${victimSql});`);
    else if(projectIds.length&&cols.includes('project_id')) statements.push(`DELETE FROM ${sqlIdent(table)} WHERE project_id IN (${projectSql});`);
  }

  if(tables.includes('projects')) statements.push(`DELETE FROM ${sqlIdent('projects')} WHERE company_id IN (${victimSql});`);
  if(tables.includes('users')) statements.push(`DELETE FROM ${sqlIdent('users')} WHERE company_id IN (${victimSql});`);
  if(tables.includes('sessions')&&tables.includes('users')) statements.push(`DELETE FROM ${sqlIdent('sessions')} WHERE user_id NOT IN (SELECT id FROM ${sqlIdent('users')});`);
  statements.push(`DELETE FROM ${sqlIdent('companies')} WHERE id IN (${victimSql});`);
  statements.push('PRAGMA foreign_keys=ON;');

  const tempFile=path.join(os.tmpdir(),`allamo-stage-cleanup-${Date.now()}.sql`);
  fs.writeFileSync(tempFile,statements.join('\n'),'utf8');
  try{
    console.log(`\nAplicando limpeza controlada em ${victims.length} empresa(s) e ${projects.length} projeto(s)...`);
    runWrangler(['d1','execute',DB,'--remote','--config',CONFIG,'--file',tempFile],{capture:false});
  } finally {
    try{fs.unlinkSync(tempFile)}catch(_){}
  }

  const after=query('SELECT id,name FROM companies ORDER BY name;');
  const afterNorm=new Set(after.map(c=>normalize(c.name)||normalize(c.id)));
  const unexpected=after.filter(c=>!KEEP.some(k=>normalize(c.name)===k.slug||normalize(c.id)===k.slug));
  if(unexpected.length||KEEP.some(k=>!after.some(c=>normalize(c.name)===k.slug||normalize(c.id)===k.slug))){
    throw new Error(`Pós-validação inconsistente. NÃO faça novos deploys; restaure o backup: ${backupFile}`);
  }

  console.log('\nLimpeza concluída e validada. Empresas restantes:');
  after.forEach(c=>console.log(`- ${c.name} [${c.id}]`));
  console.log(`Backup preservado em: ${backupFile}`);
}

try{main();}
catch(e){ console.error('\n[ERRO] '+(e?.message||e)); process.exit(1); }
