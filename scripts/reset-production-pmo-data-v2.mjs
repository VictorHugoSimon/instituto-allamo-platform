import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const CONFIG='wrangler.production.toml';
const WRANGLER='wrangler@4.124.0';
const DB='DB';
const EXPECTED_PROJECT='allamo-pmo';
const EXPECTED_DATABASE='allamo-pmo';
const EXPECTED_DATABASE_ID='361c63ba-b9f8-409d-9a46-9609914da8b7';
const STAGE_DATABASE_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';
const APPLY=process.argv.includes('--apply');
const CONFIRM=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const REQUIRED_CONFIRM='RESET-PMO-PRODUCTION';
const PROTECTED_TABLE_PREFIXES=['service_hub_','commercial_'];
const PROTECTED_TABLES=new Set(['access_invitations']);
const MAX_STATEMENT_BYTES=50000;
const MAX_SQL_FILE_BYTES=500000;

const q=v=>`'${String(v).replace(/'/g,"''")}'`;
const qi=v=>`"${String(v).replace(/"/g,'""')}"`;
const clean=v=>String(v||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
const isProtected=t=>PROTECTED_TABLES.has(t)||PROTECTED_TABLE_PREFIXES.some(p=>t.startsWith(p));
const fail=(m,c=1)=>{console.error(`\n[ABORTADO] ${m}`);process.exit(c)};
const sleepSync=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);

function run(command,args,{capture=true}={}){
  const r=spawnSync(command,args,{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false});
  if(r.error)throw r.error;
  if(r.status!==0){
    if(capture){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr)}
    throw new Error(`${command} falhou com código ${r.status}.`);
  }
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}
function wrangler(args,{capture=true}={}){
  const npx=process.platform==='win32'?'npx.cmd':'npx';
  return run(npx,['--yes',WRANGLER,...args],{capture});
}
function parseJson(text){
  const s=clean(text);
  try{return JSON.parse(s)}catch{}
  const starts=[s.indexOf('['),s.indexOf('{')].filter(x=>x>=0);
  const a=starts.length?Math.min(...starts):-1;
  const b=Math.max(s.lastIndexOf(']'),s.lastIndexOf('}'));
  if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
  throw new Error('Resposta D1 sem JSON reconhecível.');
}
function rowsFrom(node){
  if(Array.isArray(node)){
    for(const x of node){const r=rowsFrom(x);if(r)return r}
    return null;
  }
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results))return node.results;
    for(const v of Object.values(node)){const r=rowsFrom(v);if(r)return r}
  }
  return null;
}
function query(sql,{attempts=5}={}){
  let last='';
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const out=wrangler(['d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json']);
      return rowsFrom(parseJson(out))||[];
    }catch(e){
      last=e?.message||String(e);
      if(attempt<attempts)sleepSync(attempt*1500);
    }
  }
  throw new Error(`Consulta D1 falhou após ${attempts} tentativas: ${last}`);
}
function verifyProduction(){
  if(!fs.existsSync(CONFIG))fail(`${CONFIG} não encontrado.`,2);
  const cfg=fs.readFileSync(CONFIG,'utf8');
  const root=cfg.split(/^\[env\./m)[0];
  if(!root.includes(`name = "${EXPECTED_PROJECT}"`))fail('Projeto Pages de Produção divergente.',2);
  if(!root.includes(`database_name = "${EXPECTED_DATABASE}"`))fail('Nome do D1 de Produção divergente.',2);
  if(!root.includes(`database_id = "${EXPECTED_DATABASE_ID}"`))fail('UUID do D1 de Produção divergente.',2);
  if(root.includes(STAGE_DATABASE_ID))fail('UUID do STAGE detectado no binding raiz. Reset bloqueado.',2);
  const prodBlock=(cfg.match(/\[env\.production\][\s\S]*?(?=\n\[env\.|$)/)||[])[0]||'';
  if(prodBlock&&!prodBlock.includes(EXPECTED_DATABASE_ID))fail('[env.production] não aponta para o D1 oficial de Produção.',2);
}
function idsSql(ids){return ids.length?ids.map(q).join(','):"''"}
function metadata(){
  const tables=query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    .map(r=>String(r.name||''))
    .filter(Boolean)
    .filter(n=>!n.startsWith('d1_')&&!n.startsWith('_cf_'));
  const meta=new Map();
  for(const table of tables){
    const cols=query(`PRAGMA table_info(${qi(table)});`).map(r=>String(r.name||'')).filter(Boolean);
    let fks=[];
    try{
      fks=query(`PRAGMA foreign_key_list(${qi(table)});`).map(r=>({from:String(r.from||''),parent:String(r.table||''),to:String(r.to||'id')||'id'})).filter(x=>x.from&&x.parent&&x.parent!==table);
    }catch{}
    meta.set(table,{cols,fks});
  }
  return meta;
}
function buildCompactScopes(meta,companyIds,projectIds){
  const scopes=new Map();
  const companySql=idsSql(companyIds), projectSql=idsSql(projectIds);
  for(const [table,{cols}] of meta){
    const direct=[];
    if(companyIds.length&&cols.includes('company_id'))direct.push(`${qi('company_id')} IN (${companySql})`);
    if(projectIds.length&&cols.includes('project_id'))direct.push(`${qi('project_id')} IN (${projectSql})`);
    if(direct.length)scopes.set(table,{depth:0,expr:`(${direct.join(' OR ')})`,direct:true});
  }
  for(let pass=0;pass<meta.size;pass++){
    let changed=false;
    for(const [table,{fks}] of meta){
      const current=scopes.get(table);
      if(current?.direct)continue;
      let bestDepth=current?.depth??Infinity;
      const candidates=[];
      for(const fk of fks){
        const parent=scopes.get(fk.parent);
        if(!parent)continue;
        const depth=parent.depth+1;
        if(depth>bestDepth)continue;
        const expr=`${qi(fk.from)} IN (SELECT ${qi(fk.to)} FROM ${qi(fk.parent)} WHERE ${parent.expr})`;
        if(depth<bestDepth){bestDepth=depth;candidates.length=0}
        if(depth===bestDepth&&!candidates.includes(expr))candidates.push(expr);
      }
      if(!candidates.length)continue;
      const expr=candidates.length===1?`(${candidates[0]})`:`(${candidates.join(' OR ')})`;
      if(!current||bestDepth<current.depth||expr!==current.expr){scopes.set(table,{depth:bestDepth,expr,direct:false});changed=true}
    }
    if(!changed)break;
  }
  return scopes;
}
function protectedBlockers(scopes){
  const blockers=[];
  const tables=[...scopes.keys()].filter(isProtected).sort();
  console.log(`\nMódulos protegidos encontrados no escopo: ${tables.length}`);
  for(const table of tables){
    const n=Number(query(`SELECT COUNT(*) AS n FROM ${qi(table)} WHERE ${scopes.get(table).expr};`)[0]?.n||0);
    console.log(`- ${table}: ${n} registro(s) vinculado(s)`);
    if(n>0)blockers.push({table,n});
  }
  return blockers;
}
function backup(){
  fs.mkdirSync(path.resolve(ROOT,'backups'),{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.resolve(ROOT,'backups',`production-before-pmo-zero-reset-${stamp}.sql`);
  console.log(`\nBackup obrigatório: ${file}`);
  run(process.execPath,['scripts/secure-d1-export.mjs','--config',CONFIG,'--output',file],{capture:false});
  if(!fs.existsSync(file)||fs.statSync(file).size===0)fail('Backup ausente ou vazio; reset cancelado.');
  return file;
}
function validateZero(meta,companyIds,projectIds){
  const companies=query('SELECT COUNT(*) AS n FROM companies;');
  const projects=query('SELECT COUNT(*) AS n FROM projects;');
  if(Number(companies[0]?.n||0)!==0)fail('Pós-validação: companies não está vazia.');
  if(Number(projects[0]?.n||0)!==0)fail('Pós-validação: projects não está vazia.');
  const residual=[];
  const csql=idsSql(companyIds), psql=idsSql(projectIds);
  for(const [table,{cols}] of meta){
    if(['companies','projects'].includes(table)||isProtected(table))continue;
    const parts=[];
    if(companyIds.length&&cols.includes('company_id'))parts.push(`${qi('company_id')} IN (${csql})`);
    if(projectIds.length&&cols.includes('project_id'))parts.push(`${qi('project_id')} IN (${psql})`);
    if(!parts.length)continue;
    const n=Number(query(`SELECT COUNT(*) AS n FROM ${qi(table)} WHERE ${parts.join(' OR ')};`)[0]?.n||0);
    if(n>0)residual.push(`${table}:${n}`);
  }
  if(residual.length)fail(`Referências PMO remanescentes: ${residual.join(', ')}`);
  console.log('\n[OK] Estado zero PROD confirmado: 0 empresas, 0 projetos e nenhuma referência PMO direta remanescente.');
}
function main(){
  verifyProduction();
  if(APPLY&&CONFIRM!==REQUIRED_CONFIRM)fail(`Confirmação inválida. Use --confirm=${REQUIRED_CONFIRM}.`,2);
  const companies=query('SELECT id,name FROM companies ORDER BY name,id;');
  const projects=query('SELECT id,name,company_id FROM projects ORDER BY company_id,id;');
  const companyIds=companies.map(x=>String(x.id)).filter(Boolean);
  const projectIds=projects.map(x=>String(x.id)).filter(Boolean);
  console.log('\n=== RESET PMO PRODUÇÃO → ESTADO ZERO V2 ===');
  console.log(`D1 autorizado: ${EXPECTED_DATABASE} (${EXPECTED_DATABASE_ID})`);
  console.log(`Empresas atuais: ${companies.length}`);
  companies.forEach(x=>console.log(`- ${x.name} [${x.id}]`));
  console.log(`Projetos atuais: ${projects.length}`);
  projects.forEach(x=>console.log(`- ${x.name} [${x.id}] · company_id=${x.company_id||''}`));
  const meta=metadata();
  const scopes=buildCompactScopes(meta,companyIds,projectIds);
  const blockers=protectedBlockers(scopes);
  if(blockers.length){blockers.forEach(x=>console.error(`- BLOQUEIO ${x.table}: ${x.n}`));fail('Existem dados vinculados em módulos fora do PMO. Reset PROD cancelado.',4)}
  const affected=[...scopes.keys()].filter(t=>!['companies','projects'].includes(t)&&!isProtected(t));
  const ordered=affected.sort((a,b)=>(scopes.get(b)?.depth||0)-(scopes.get(a)?.depth||0)||a.localeCompare(b));
  console.log(`Tabelas PMO elegíveis: ${ordered.length}`);
  const statements=['PRAGMA foreign_keys=OFF;'];
  for(const table of ordered)statements.push(`DELETE FROM ${qi(table)} WHERE ${scopes.get(table).expr};`);
  if(projectIds.length)statements.push(`DELETE FROM ${qi('projects')} WHERE id IN (${idsSql(projectIds)});`);
  if(companyIds.length)statements.push(`DELETE FROM ${qi('companies')} WHERE id IN (${idsSql(companyIds)});`);
  if(meta.has('sessions')&&meta.has('users'))statements.push(`DELETE FROM ${qi('sessions')} WHERE user_id NOT IN (SELECT id FROM ${qi('users')});`);
  statements.push('PRAGMA foreign_keys=ON;');
  const lengths=statements.map(s=>Buffer.byteLength(s,'utf8'));
  const max=Math.max(...lengths,0);
  const fileBytes=Buffer.byteLength(statements.join('\n')+'\n','utf8');
  console.log(`Maior statement: ${max} bytes; arquivo total: ${fileBytes} bytes.`);
  if(max>MAX_STATEMENT_BYTES)fail(`Statement excede limite de segurança (${max} > ${MAX_STATEMENT_BYTES}).`);
  if(fileBytes>MAX_SQL_FILE_BYTES)fail(`Arquivo SQL excede limite de segurança (${fileBytes} > ${MAX_SQL_FILE_BYTES}).`);
  if(!companies.length&&!projects.length){console.log('Produção já está em estado zero.');validateZero(meta,[],[]);return}
  if(!APPLY){console.log('\n[OK] DRY-RUN PROD V2 concluído. Nenhum dado foi alterado.');return}
  const backupFile=backup();
  const temp=path.join(os.tmpdir(),`allamo-pmo-production-reset-v2-${Date.now()}.sql`);
  fs.writeFileSync(temp,statements.join('\n')+'\n','utf8');
  try{
    console.log(`Aplicando reset atômico PROD: ${companies.length} empresa(s), ${projects.length} projeto(s), ${ordered.length} tabela(s) PMO.`);
    wrangler(['d1','execute',DB,'--remote','--config',CONFIG,'--file',temp],{capture:false});
  }finally{try{fs.unlinkSync(temp)}catch{}}
  validateZero(meta,companyIds,projectIds);
  console.log(`Backup preservado em: ${backupFile}`);
  console.log('STAGE e módulos protegidos não foram alterados.');
}
try{main()}catch(e){fail(e?.message||String(e))}
