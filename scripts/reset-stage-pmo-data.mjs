import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const CONFIG='wrangler.stage.toml';
const WRANGLER='wrangler@4.124.0';
const DB='DB';
const EXPECTED_PROJECT='allamo-pmo-stage';
const EXPECTED_DATABASE='allamo-pmo-stage';
const EXPECTED_DATABASE_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';
const PROD_DATABASE_ID='361c63ba-b9f8-409d-9a46-9609914da8b7';
const APPLY=process.argv.includes('--apply');
const CONFIRM=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const REQUIRED_CONFIRM='RESET-PMO-STAGE';

const q=v=>`'${String(v).replace(/'/g,"''")}'`;
const qi=v=>`"${String(v).replace(/"/g,'""')}"`;
const normalizeOutput=v=>String(v||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();

function fail(message,code=1){
  console.error(`\n[ABORTADO] ${message}`);
  process.exit(code);
}

function run(command,args,{capture=true}={}){
  const r=spawnSync(command,args,{
    cwd:ROOT,
    encoding:capture?'utf8':undefined,
    stdio:capture?['ignore','pipe','pipe']:'inherit',
    shell:false
  });
  if(r.error)throw r.error;
  if(r.status!==0){
    if(capture){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr)}
    throw new Error(`${command} falhou com código ${r.status}.`);
  }
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}

function runWrangler(args,{capture=true}={}){
  const npx=process.platform==='win32'?'npx.cmd':'npx';
  return run(npx,['--yes',WRANGLER,...args],{capture});
}

function extractRows(node){
  const candidates=[];
  const visit=value=>{
    if(Array.isArray(value)){
      if(value.every(v=>v&&typeof v==='object'&&!Array.isArray(v)))candidates.push(value);
      value.forEach(visit);
      return;
    }
    if(value&&typeof value==='object'){
      if(Array.isArray(value.results))candidates.unshift(value.results);
      Object.values(value).forEach(visit);
    }
  };
  visit(node);
  return candidates[0]||[];
}

function parseJson(text){
  const clean=normalizeOutput(text);
  try{return JSON.parse(clean)}catch{}
  const starts=[];for(let i=0;i<clean.length;i++)if(clean[i]==='['||clean[i]==='{')starts.push(i);
  const ends=[];for(let i=clean.length-1;i>=0;i--)if(clean[i]===']'||clean[i]==='}')ends.push(i);
  for(const a of starts){
    for(const b of ends){
      if(b<=a)continue;
      try{return JSON.parse(clean.slice(a,b+1))}catch{}
    }
  }
  throw new Error('Wrangler retornou resposta D1 sem JSON reconhecível.');
}

function query(sql){
  const out=runWrangler(['d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json']);
  return extractRows(parseJson(out));
}

function verifyStageConfig(){
  if(!fs.existsSync(CONFIG))fail(`${CONFIG} não encontrado.`,2);
  const text=fs.readFileSync(CONFIG,'utf8');
  if(!text.includes(`name = "${EXPECTED_PROJECT}"`))fail(`Config não aponta para Pages STAGE ${EXPECTED_PROJECT}.`,2);
  if(!text.includes(`database_name = "${EXPECTED_DATABASE}"`))fail(`Config não aponta para D1 STAGE ${EXPECTED_DATABASE}.`,2);
  if(!text.includes(`database_id = "${EXPECTED_DATABASE_ID}"`))fail('UUID do D1 STAGE não corresponde ao ambiente autorizado.',2);
  if(text.includes(PROD_DATABASE_ID))fail('UUID de Produção detectado no config de STAGE. Reset bloqueado.',2);
}

function listMetadata(){
  const tables=query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    .map(r=>String(r.name||''))
    .filter(Boolean)
    .filter(name=>!name.startsWith('d1_')&&!name.startsWith('_cf_'));
  const meta=new Map();
  for(const table of tables){
    const cols=query(`PRAGMA table_info(${qi(table)});`).map(r=>String(r.name||'')).filter(Boolean);
    let fks=[];
    try{
      fks=query(`PRAGMA foreign_key_list(${qi(table)});`).map(r=>({
        from:String(r.from||''),
        parent:String(r.table||''),
        to:String(r.to||'id')||'id'
      })).filter(x=>x.from&&x.parent);
    }catch{}
    meta.set(table,{cols,fks});
  }
  return meta;
}

function idsSql(ids){return ids.length?ids.map(q).join(','):"''"}

function buildPredicates(meta,companyIds,projectIds){
  const companySql=idsSql(companyIds);
  const projectSql=idsSql(projectIds);
  const predicates=new Map();
  const depths=new Map();

  for(const [table,{cols}] of meta){
    const parts=[];
    if(companyIds.length&&cols.includes('company_id'))parts.push(`${qi('company_id')} IN (${companySql})`);
    if(projectIds.length&&cols.includes('project_id'))parts.push(`${qi('project_id')} IN (${projectSql})`);
    if(parts.length){predicates.set(table,`(${parts.join(' OR ')})`);depths.set(table,0)}
  }

  // Propaga o vínculo por FKs: um filho sem company_id/project_id pode ser removido
  // pela chave que referencia um pai já comprovadamente ligado ao tenant/projeto.
  for(let pass=0;pass<meta.size;pass++){
    let changed=false;
    for(const [table,{fks}] of meta){
      const derived=[];
      let derivedDepth=0;
      for(const fk of fks){
        if(fk.parent===table)continue;
        const parentPredicate=predicates.get(fk.parent);
        if(!parentPredicate)continue;
        derived.push(`${qi(fk.from)} IN (SELECT ${qi(fk.to)} FROM ${qi(fk.parent)} WHERE ${parentPredicate})`);
        derivedDepth=Math.max(derivedDepth,(depths.get(fk.parent)||0)+1);
      }
      if(!derived.length)continue;
      const direct=predicates.get(table);
      const next=direct?`(${direct} OR ${derived.join(' OR ')})`:`(${derived.join(' OR ')})`;
      if(next!==direct){predicates.set(table,next);depths.set(table,Math.max(depths.get(table)||0,derivedDepth));changed=true}
    }
    if(!changed)break;
  }
  return {predicates,depths};
}

function backup(){
  fs.mkdirSync(path.resolve(ROOT,'backups'),{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.resolve(ROOT,'backups',`stage-before-pmo-zero-reset-${stamp}.sql`);
  console.log(`\nBackup obrigatório antes do reset: ${file}`);
  run(process.execPath,['scripts/secure-d1-export.mjs','--config',CONFIG,'--output',file],{capture:false});
  if(!fs.existsSync(file)||fs.statSync(file).size===0)fail('Backup não foi criado ou está vazio. Nenhuma alteração foi aplicada.');
  return file;
}

function validateZero(meta,deletedCompanyIds,deletedProjectIds){
  const companies=query('SELECT id,name FROM companies ORDER BY id;');
  const projects=query('SELECT id,name,company_id FROM projects ORDER BY id;');
  if(companies.length!==0)fail(`Pós-validação: companies deveria estar vazia; encontrei ${companies.length}.`);
  if(projects.length!==0)fail(`Pós-validação: projects deveria estar vazia; encontrei ${projects.length}.`);

  const residual=[];
  const companySql=idsSql(deletedCompanyIds);
  const projectSql=idsSql(deletedProjectIds);
  for(const [table,{cols}] of meta){
    if(['companies','projects'].includes(table))continue;
    const parts=[];
    if(deletedCompanyIds.length&&cols.includes('company_id'))parts.push(`${qi('company_id')} IN (${companySql})`);
    if(deletedProjectIds.length&&cols.includes('project_id'))parts.push(`${qi('project_id')} IN (${projectSql})`);
    if(!parts.length)continue;
    const rows=query(`SELECT COUNT(*) AS n FROM ${qi(table)} WHERE ${parts.join(' OR ')};`);
    const n=Number(rows[0]?.n||0);
    if(n>0)residual.push(`${table}:${n}`);
  }
  if(residual.length)fail(`Pós-validação encontrou referências remanescentes: ${residual.join(', ')}.`);
  console.log('\n[OK] Estado zero validado: 0 empresas, 0 projetos e nenhuma referência company_id/project_id aos IDs removidos.');
}

function main(){
  verifyStageConfig();
  if(APPLY&&CONFIRM!==REQUIRED_CONFIRM)fail(`Confirmação inválida. Para aplicar use --confirm=${REQUIRED_CONFIRM}.`,2);

  const companies=query('SELECT id,name FROM companies ORDER BY name,id;');
  const projects=query('SELECT id,name,company_id FROM projects ORDER BY company_id,id;');
  const companyIds=companies.map(c=>String(c.id)).filter(Boolean);
  const projectIds=projects.map(p=>String(p.id)).filter(Boolean);

  console.log('\n=== RESET PMO STAGE → ESTADO ZERO ===');
  console.log(`D1 autorizado: ${EXPECTED_DATABASE} (${EXPECTED_DATABASE_ID})`);
  console.log(`Empresas atuais: ${companies.length}`);
  companies.forEach(c=>console.log(`- ${c.name} [${c.id}]`));
  console.log(`Projetos atuais: ${projects.length}`);
  projects.forEach(p=>console.log(`- ${p.name} [${p.id}] · company_id=${p.company_id||''}`));

  const meta=listMetadata();
  const {predicates,depths}=buildPredicates(meta,companyIds,projectIds);
  const affected=[...predicates.keys()].filter(t=>!['companies','projects'].includes(t));
  console.log(`Tabelas dependentes identificadas: ${affected.length}`);
  affected.sort().forEach(t=>console.log(`- ${t}`));

  if(!companies.length&&!projects.length){
    console.log('\nStage já está em estado zero. Nenhuma alteração necessária.');
    validateZero(meta,[],[]);
    return;
  }

  if(!APPLY){
    console.log('\nDRY-RUN concluído. Nenhum dado foi alterado.');
    console.log(`Para aplicar somente no STAGE após validar a release: node scripts/reset-stage-pmo-data.mjs --apply --confirm=${REQUIRED_CONFIRM}`);
    return;
  }

  const backupFile=backup();
  const ordered=[...affected].sort((a,b)=>(depths.get(b)||0)-(depths.get(a)||0)||a.localeCompare(b));
  const statements=['PRAGMA foreign_keys=OFF;'];
  for(const table of ordered){
    const predicate=predicates.get(table);
    if(predicate)statements.push(`DELETE FROM ${qi(table)} WHERE ${predicate};`);
  }
  if(projectIds.length)statements.push(`DELETE FROM ${qi('projects')} WHERE id IN (${idsSql(projectIds)});`);
  if(companyIds.length)statements.push(`DELETE FROM ${qi('companies')} WHERE id IN (${idsSql(companyIds)});`);
  // Remove apenas sessões que ficaram órfãs; sessões de usuários PMO globais permanecem.
  if(meta.has('sessions')&&meta.has('users'))statements.push(`DELETE FROM ${qi('sessions')} WHERE user_id NOT IN (SELECT id FROM ${qi('users')});`);
  statements.push('PRAGMA foreign_keys=ON;');

  const temp=path.join(os.tmpdir(),`allamo-pmo-stage-reset-${Date.now()}.sql`);
  fs.writeFileSync(temp,statements.join('\n')+'\n','utf8');
  try{
    console.log(`\nAplicando reset controlado: ${companies.length} empresa(s), ${projects.length} projeto(s), ${ordered.length} tabela(s) dependente(s)...`);
    runWrangler(['d1','execute',DB,'--remote','--config',CONFIG,'--file',temp],{capture:false});
  }finally{
    try{fs.unlinkSync(temp)}catch{}
  }

  validateZero(meta,companyIds,projectIds);
  console.log(`Backup preservado em: ${backupFile}`);
  console.log('Produção não foi consultada nem alterada por esta rotina.');
}

try{main()}catch(e){fail(e?.message||String(e))}
