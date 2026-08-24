import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const WRANGLER='wrangler@4.124.0';
const DB='DB';
const STAGE_CONFIG='wrangler.stage.toml';
const PRODUCTION_CONFIG='wrangler.production.toml';
const SYNC_KEY='stage-catalog-sync-2026-08-24-v1';
const APPLY=process.argv.includes('--apply');
const VERIFY_ONLY=process.argv.includes('--verify');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const backupArg=(process.argv.find(a=>a.startsWith('--backup='))||'').slice(9);
const REQUIRED_CONFIRM='SYNC-STAGE-CATALOG-PRODUCTION';

const normalize=(v='')=>String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const ident=v=>`"${String(v).replace(/"/g,'""')}"`;
const literal=v=>{
  if(v===null||v===undefined)return 'NULL';
  if(typeof v==='number'&&Number.isFinite(v))return String(v);
  if(typeof v==='boolean')return v?'1':'0';
  return `'${String(v).replace(/'/g,"''")}'`;
};
const meaningful=v=>v!==null&&v!==undefined&&String(v)!=='';
const fail=(m,code=1)=>{console.error(`\n[ABORTADO] ${m}`);process.exit(code)};

function resolveNpxCli(){
  const candidates=[];
  if(process.env.npm_execpath)candidates.push(path.join(path.dirname(process.env.npm_execpath),'npx-cli.js'));
  candidates.push(path.join(path.dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'));
  return candidates.find(c=>c&&fs.existsSync(c))||null;
}
function runWrangler(args,{capture=true}={}){
  let r;
  if(process.platform==='win32'){
    const npxCli=resolveNpxCli();
    if(!npxCli)throw new Error('npx-cli.js não encontrado junto da instalação do Node/npm.');
    r=spawnSync(process.execPath,[npxCli,'--yes',...args],{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false,windowsHide:true});
  }else{
    r=spawnSync('npx',['--yes',...args],{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:false});
  }
  if(r.error)throw r.error;
  if(r.status!==0){if(capture){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr)}throw new Error(`Wrangler falhou (${r.status}).`)}
  return capture?(r.stdout||''):'';
}
function extractResults(node){
  if(Array.isArray(node)){for(const item of node){const r=extractResults(item);if(r)return r}return null}
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results))return node.results;
    for(const value of Object.values(node)){const r=extractResults(value);if(r)return r}
  }
  return null;
}
function executeSqlFile(config,sql,{json=true,capture=true}={}){
  const temp=path.join(os.tmpdir(),`allamo-stage-prod-catalog-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  fs.writeFileSync(temp,sql.endsWith('\n')?sql:sql+'\n','utf8');
  try{
    const args=[WRANGLER,'d1','execute',DB,'--remote','--config',config,'--file',temp];
    if(json)args.push('--json');
    const out=runWrangler(args,{capture});
    if(!json)return [];
    let parsed;
    try{parsed=JSON.parse(out)}catch{throw new Error('Wrangler retornou saída não-JSON ao consultar D1.')}
    return extractResults(parsed)||[];
  }finally{try{fs.unlinkSync(temp)}catch{}}
}
const query=(config,sql)=>executeSqlFile(config,sql,{json:true,capture:true});

function verifyConfig(file,project,database){
  const p=path.resolve(ROOT,file);
  if(!fs.existsSync(p))fail(`${file} não encontrado.`);
  const text=fs.readFileSync(p,'utf8');
  if(!text.includes(`name = "${project}"`))fail(`${file} não aponta para ${project}.`);
  if(!text.includes(`database_name = "${database}"`))fail(`${file} não aponta para D1 ${database}.`);
}
function tableSchema(config,table){
  const rows=query(config,`PRAGMA table_info(${ident(table)});`);
  if(!rows.length)fail(`Tabela ${table} não encontrada em ${config}.`);
  return rows.map(r=>({name:String(r.name||''),type:String(r.type||''),pk:Number(r.pk||0),notnull:Number(r.notnull||0),dflt:r.dflt_value}));
}
const indexBy=(rows,key)=>new Map(rows.map(r=>[String(r[key]),r]));
const groupBy=(rows,keyFn)=>{const m=new Map();for(const r of rows){const k=keyFn(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return m};
const businessColumns=(stageSchema,prodSchema)=>{
  const prod=new Set(prodSchema.map(c=>c.name));
  return stageSchema.map(c=>c.name).filter(n=>prod.has(n)&&!['created_at','updated_at','deleted_at','archived_at'].includes(n));
};
function safeUpdateStatement(table,idColumn,targetId,row,columns,overrides={}){
  const sets=[];
  for(const col of columns){
    if(col===idColumn||col==='company_id')continue;
    const val=Object.prototype.hasOwnProperty.call(overrides,col)?overrides[col]:row[col];
    if(!meaningful(val))continue; // não apaga valor produtivo quando Stage estiver vazio
    sets.push(`${ident(col)}=${literal(val)}`);
  }
  return sets.length?`UPDATE ${ident(table)} SET ${sets.join(',')} WHERE ${ident(idColumn)}=${literal(targetId)};`:'';
}
function safeInsertStatement(table,row,columns,overrides={},omit=new Set()){
  const cols=[];const vals=[];
  for(const col of columns){
    if(omit.has(col))continue;
    const val=Object.prototype.hasOwnProperty.call(overrides,col)?overrides[col]:row[col];
    if(val===undefined)continue;
    cols.push(col);vals.push(literal(val));
  }
  if(!cols.length)fail(`Nenhuma coluna gravável para inserir em ${table}.`);
  return `INSERT INTO ${ident(table)} (${cols.map(ident).join(',')}) VALUES (${vals.join(',')});`;
}
function projectAltId(stageProject){
  const seed=`${stageProject.company_id}|${stageProject.id}|${stageProject.name}`;
  return `stage-${normalize(stageProject.name).slice(0,24)||'project'}-${crypto.createHash('sha1').update(seed).digest('hex').slice(0,8)}`;
}
function checkDuplicateNormalizedCompanies(rows,label){
  const groups=groupBy(rows,r=>normalize(r.name));
  for(const [key,list] of groups){if(key&&list.length>1)fail(`${label}: empresas ambíguas para slug ${key}: ${list.map(x=>`${x.name}[${x.id}]`).join(', ')}`)}
}
function checkDuplicateProjectNames(rows,label){
  const groups=groupBy(rows,r=>`${String(r.company_id)}|${normalize(r.name)}`);
  for(const [key,list] of groups){if(key&&!key.endsWith('|')&&list.length>1)fail(`${label}: projetos ambíguos no mesmo tenant: ${list.map(x=>`${x.name}[${x.id}]`).join(', ')}`)}
}
function markerExists(){
  const tables=query(PRODUCTION_CONFIG,"SELECT name FROM sqlite_master WHERE type='table' AND name='environment_sync_log';");
  if(!tables.length)return false;
  return query(PRODUCTION_CONFIG,`SELECT sync_key FROM environment_sync_log WHERE sync_key=${literal(SYNC_KEY)} LIMIT 1;`).length>0;
}
function backupProduction(){
  if(backupArg){
    const p=path.resolve(ROOT,backupArg);
    if(!fs.existsSync(p)||fs.statSync(p).size===0)fail(`Backup informado não existe ou está vazio: ${p}`);
    console.log(`Backup produtivo já confirmado: ${p}`);
    return p;
  }
  fs.mkdirSync(path.resolve(ROOT,'backups'),{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.resolve(ROOT,'backups',`production-before-stage-catalog-sync-${stamp}.sql`);
  console.log(`Criando backup obrigatório: ${file}`);
  runWrangler([WRANGLER,'d1','export',DB,'--remote','--config',PRODUCTION_CONFIG,'--output',file],{capture:false});
  if(!fs.existsSync(file)||fs.statSync(file).size===0)fail('Backup produtivo não foi criado.');
  return file;
}

function buildPlan(){
  verifyConfig(STAGE_CONFIG,'allamo-pmo-stage','allamo-pmo-stage');
  verifyConfig(PRODUCTION_CONFIG,'allamo-pmo','allamo-pmo');

  const stageCompanySchema=tableSchema(STAGE_CONFIG,'companies');
  const prodCompanySchema=tableSchema(PRODUCTION_CONFIG,'companies');
  const stageProjectSchema=tableSchema(STAGE_CONFIG,'projects');
  const prodProjectSchema=tableSchema(PRODUCTION_CONFIG,'projects');
  for(const [label,schema,required] of [
    ['Stage companies',stageCompanySchema,['id','name']],['Produção companies',prodCompanySchema,['id','name']],
    ['Stage projects',stageProjectSchema,['id','name','company_id']],['Produção projects',prodProjectSchema,['id','name','company_id']]
  ]) for(const col of required)if(!schema.some(c=>c.name===col))fail(`${label}: coluna obrigatória ${col} ausente.`);

  const stageCompanies=query(STAGE_CONFIG,'SELECT * FROM companies ORDER BY name,id;');
  const prodCompanies=query(PRODUCTION_CONFIG,'SELECT * FROM companies ORDER BY name,id;');
  const stageProjects=query(STAGE_CONFIG,'SELECT * FROM projects ORDER BY company_id,name,id;');
  const prodProjects=query(PRODUCTION_CONFIG,'SELECT * FROM projects ORDER BY company_id,name,id;');
  checkDuplicateNormalizedCompanies(stageCompanies,'Stage');
  checkDuplicateNormalizedCompanies(prodCompanies,'Produção');
  checkDuplicateProjectNames(stageProjects,'Stage');
  checkDuplicateProjectNames(prodProjects,'Produção');

  const prodCompanyById=indexBy(prodCompanies,'id');
  const prodCompanyByName=groupBy(prodCompanies,c=>normalize(c.name));
  const companyMap=new Map();
  const companyActions=[];
  const companyCols=businessColumns(stageCompanySchema,prodCompanySchema);

  for(const s of stageCompanies){
    const sid=String(s.id);const sname=normalize(s.name);
    let target=prodCompanyById.get(sid)||null;
    if(target&&normalize(target.name)!==sname)fail(`Conflito de company.id ${sid}: Stage=${s.name}, Produção=${target.name}.`);
    if(!target){
      const matches=prodCompanyByName.get(sname)||[];
      if(matches.length>1)fail(`Empresa ${s.name}: múltiplas correspondências em Produção.`);
      target=matches[0]||null;
    }
    if(target){
      companyMap.set(sid,String(target.id));
      const sql=safeUpdateStatement('companies','id',target.id,s,companyCols);
      companyActions.push({kind:'update',stageId:sid,targetId:String(target.id),name:s.name,sql});
    }else{
      if(prodCompanyById.has(sid))fail(`ID ${sid} já ocupado por outra empresa em Produção.`);
      companyMap.set(sid,sid);
      companyActions.push({kind:'insert',stageId:sid,targetId:sid,name:s.name,sql:safeInsertStatement('companies',s,companyCols)});
    }
  }

  for(const p of stageProjects){
    const cid=String(p.company_id||'');
    if(!cid||!companyMap.has(cid))fail(`Projeto Stage ${p.name}[${p.id}] referencia company_id desconhecido: ${cid||'(vazio)'}.`);
  }

  const projectCols=businessColumns(stageProjectSchema,prodProjectSchema);
  const prodProjectById=indexBy(prodProjects,'id');
  const prodProjectByTenantName=groupBy(prodProjects,p=>`${String(p.company_id)}|${normalize(p.name)}`);
  const prodIdSchema=prodProjectSchema.find(c=>c.name==='id');
  const projectIdIsInteger=/INT/i.test(prodIdSchema?.type||'');
  const projectActions=[];
  for(const s of stageProjects){
    const targetCompany=companyMap.get(String(s.company_id));
    const key=`${targetCompany}|${normalize(s.name)}`;
    const matches=prodProjectByTenantName.get(key)||[];
    if(matches.length>1)fail(`Projeto ${s.name}: múltiplas correspondências na empresa ${targetCompany}.`);
    if(matches.length===1){
      const target=matches[0];
      const sql=safeUpdateStatement('projects','id',target.id,s,projectCols,{company_id:targetCompany});
      projectActions.push({kind:'update',stageId:String(s.id),targetId:String(target.id),companyId:targetCompany,name:s.name,sql});
      continue;
    }

    let newId=s.id;
    const collision=prodProjectById.get(String(s.id));
    const omit=new Set();
    if(projectIdIsInteger){omit.add('id');newId='AUTO'}
    else if(collision){newId=projectAltId(s)}
    const row={...s,id:newId,company_id:targetCompany};
    projectActions.push({kind:'insert',stageId:String(s.id),targetId:String(newId),companyId:targetCompany,name:s.name,sql:safeInsertStatement('projects',row,projectCols,{company_id:targetCompany},omit)});
  }

  return {stageCompanies,prodCompanies,stageProjects,prodProjects,companyActions,projectActions,companyMap};
}

function printPlan(plan){
  const insertsC=plan.companyActions.filter(a=>a.kind==='insert');
  const updatesC=plan.companyActions.filter(a=>a.kind==='update');
  const insertsP=plan.projectActions.filter(a=>a.kind==='insert');
  const updatesP=plan.projectActions.filter(a=>a.kind==='update');
  console.log('\n=== SINCRONIZAÇÃO ADITIVA STAGE → PRODUÇÃO ===');
  console.log(`Stage: ${plan.stageCompanies.length} empresas / ${plan.stageProjects.length} projetos`);
  console.log(`Produção antes: ${plan.prodCompanies.length} empresas / ${plan.prodProjects.length} projetos`);
  console.log(`Empresas: ${insertsC.length} criar / ${updatesC.length} conciliar`);
  console.log(`Projetos: ${insertsP.length} criar / ${updatesP.length} conciliar`);
  for(const a of insertsC)console.log(`+ empresa ${a.name} [${a.targetId}]`);
  for(const a of insertsP)console.log(`+ projeto ${a.name} -> company ${a.companyId}`);
  console.log('Regra: Produção-only é preservado; não existe DELETE, DROP ou TRUNCATE nesta rotina.');
}
function validateParity(plan){
  const prodCompanies=query(PRODUCTION_CONFIG,'SELECT id,name FROM companies ORDER BY name,id;');
  const prodProjects=query(PRODUCTION_CONFIG,'SELECT id,name,company_id FROM projects ORDER BY company_id,name,id;');
  const byCompanyName=groupBy(prodCompanies,c=>normalize(c.name));
  for(const s of plan.stageCompanies){
    const rows=byCompanyName.get(normalize(s.name))||[];
    if(rows.length!==1)fail(`Validação: empresa ${s.name} deveria existir exatamente uma vez em Produção; encontrei ${rows.length}.`);
  }
  const prodCompanyIdByStage=new Map();
  for(const s of plan.stageCompanies){prodCompanyIdByStage.set(String(s.id),String((byCompanyName.get(normalize(s.name))||[])[0]?.id||''))}
  const byProject=groupBy(prodProjects,p=>`${String(p.company_id)}|${normalize(p.name)}`);
  for(const s of plan.stageProjects){
    const targetCompany=prodCompanyIdByStage.get(String(s.company_id));
    const rows=byProject.get(`${targetCompany}|${normalize(s.name)}`)||[];
    if(rows.length!==1)fail(`Validação: projeto ${s.name} da empresa ${targetCompany} deveria existir exatamente uma vez; encontrei ${rows.length}.`);
  }
  console.log(`Validação OK: todas as ${plan.stageCompanies.length} empresas e os ${plan.stageProjects.length} projetos do Stage existem em Produção.`);
}

function main(){
  if(APPLY&&confirmArg!==REQUIRED_CONFIRM)fail(`Confirmação inválida. Use --confirm=${REQUIRED_CONFIRM}.`);
  const plan=buildPlan();
  printPlan(plan);
  if(VERIFY_ONLY){validateParity(plan);return}
  if(!APPLY){
    console.log('\nDRY-RUN concluído. Nenhum dado foi alterado.');
    console.log(`Para aplicar: node scripts/sync-stage-catalog-to-production.mjs --apply --confirm=${REQUIRED_CONFIRM}`);
    return;
  }
  if(markerExists()){
    console.log(`\nMigração ${SYNC_KEY} já aplicada anteriormente. Nenhuma escrita repetida será executada.`);
    validateParity(plan);
    return;
  }
  const backup=backupProduction();
  const statements=[
    "CREATE TABLE IF NOT EXISTS environment_sync_log (sync_key TEXT PRIMARY KEY, source_environment TEXT NOT NULL, target_environment TEXT NOT NULL, detail TEXT, applied_at TEXT NOT NULL DEFAULT (datetime('now')));"
  ];
  for(const a of plan.companyActions)if(a.sql)statements.push(a.sql);
  for(const a of plan.projectActions)if(a.sql)statements.push(a.sql);
  statements.push(`INSERT INTO environment_sync_log(sync_key,source_environment,target_environment,detail) VALUES (${literal(SYNC_KEY)},'stage','production',${literal(`${plan.stageCompanies.length} companies / ${plan.stageProjects.length} projects`)}) ON CONFLICT(sync_key) DO NOTHING;`);
  statements.push("SELECT 'STAGE_CATALOG_SYNC_OK' AS status;");
  console.log('\nAplicando somente INSERT/UPDATE em companies/projects...');
  executeSqlFile(PRODUCTION_CONFIG,statements.join('\n'),{json:false,capture:false});
  validateParity(plan);
  console.log(`Backup preservado em: ${backup}`);
  console.log('Sincronização concluída sem excluir dados exclusivos de Produção.');
}

try{main()}catch(e){fail(e?.message||String(e))}
