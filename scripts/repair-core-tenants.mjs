import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const WRANGLER='wrangler@4.124.0';
const DB='DB';
const APPLY=process.argv.includes('--apply');
const envArg=(process.argv.find(a=>a.startsWith('--env='))||'').slice(6).toLowerCase();
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);

const ENVIRONMENTS={
  stage:{
    config:'wrangler.stage.toml',
    project:'allamo-pmo-stage',
    database:'allamo-pmo-stage',
    databaseId:'72e2f6a0-3d22-4d65-a820-4a9b9ea88321',
    confirm:'REPAIR-STAGE'
  },
  production:{
    config:'wrangler.production.toml',
    project:'allamo-pmo',
    database:'allamo-pmo',
    databaseId:'361c63ba-b9f8-409d-9a46-9609914da8b7',
    confirm:'REPAIR-PRODUCTION'
  }
};

const CORE=[
  { key:'dualclima', name:'Dual Clima', aliases:['dualclima','dual'], fallbackId:'dualclima' },
  { key:'madrid', name:'Madrid', aliases:['madrid','madri','madrie'], fallbackId:'madrid' },
  { key:'opr', name:'OPR', aliases:['opr'], fallbackId:'opr' }
];

const normalize=(v='')=>String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const sqlString=v=>`'${String(v).replace(/'/g,"''")}'`;
const sqlIdent=v=>`"${String(v).replace(/"/g,'""')}"`;

function fail(message,code=1){ console.error(`\n[ABORTADO] ${message}`); process.exit(code); }

function resolveNpxCli(){
  const candidates=[];
  if(process.env.npm_execpath){
    candidates.push(path.join(path.dirname(process.env.npm_execpath),'npx-cli.js'));
  }
  candidates.push(path.join(path.dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'));
  for(const candidate of candidates){
    if(candidate&&fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function runWrangler(args,{capture=true}={}){
  let r;
  if(process.platform==='win32'){
    const npxCli=resolveNpxCli();
    if(!npxCli) throw new Error('npx-cli.js não encontrado junto da instalação do Node/npm.');
    r=spawnSync(process.execPath,[npxCli,'--yes',...args],{
      cwd:ROOT,
      encoding:capture?'utf8':undefined,
      stdio:capture?['ignore','pipe','pipe']:'inherit',
      shell:false,
      windowsHide:true
    });
  }else{
    r=spawnSync('npx',['--yes',...args],{
      cwd:ROOT,
      encoding:capture?'utf8':undefined,
      stdio:capture?['ignore','pipe','pipe']:'inherit',
      shell:false
    });
  }
  if(r.error) throw r.error;
  if(r.status!==0){
    if(capture){ if(r.stdout)process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr); }
    throw new Error(`Wrangler falhou (${r.status}) em ${args.slice(1,4).join(' ')}`);
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
    for(const value of Object.values(node)){ const r=extractResults(value); if(r)return r; }
  }
  return null;
}

function executeSqlFile(config,sql,{json=true,capture=true}={}){
  const temp=path.join(os.tmpdir(),`allamo-core-tenant-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  fs.writeFileSync(temp,sql.endsWith('\n')?sql:sql+'\n','utf8');
  try{
    const args=[WRANGLER,'d1','execute',DB,'--remote','--config',config,'--file',temp];
    if(json)args.push('--json');
    const out=runWrangler(args,{capture});
    if(!json)return [];
    let parsed;
    try{ parsed=JSON.parse(out); }
    catch{ throw new Error('Wrangler retornou saída não-JSON ao consultar D1.'); }
    return extractResults(parsed)||[];
  }finally{
    try{fs.unlinkSync(temp)}catch{}
  }
}

const query=(config,sql)=>executeSqlFile(config,sql,{json:true,capture:true});

function verifyConfig(target){
  const file=path.resolve(ROOT,target.config);
  if(!fs.existsSync(file)) fail(`${target.config} não encontrado.`);
  const text=fs.readFileSync(file,'utf8');
  if(!text.includes(`name = "${target.project}"`)) fail(`${target.config} não aponta para o projeto ${target.project}.`);
  if(!text.includes(`database_name = "${target.database}"`)) fail(`${target.config} não aponta para o D1 ${target.database}.`);
  if(!text.includes(`database_id = "${target.databaseId}"`)) fail(`${target.config} não contém o ID D1 esperado para este ambiente.`);
}

function collectEvidence(config){
  const companies=query(config,'SELECT id,name FROM companies ORDER BY name,id;');
  const tables=query(config,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").map(r=>String(r.name||'')).filter(Boolean).filter(name=>!name.startsWith('d1_')&&!name.startsWith('_cf_'));
  const refs=new Map();
  const add=(id,source)=>{
    const raw=String(id||'').trim(); if(!raw)return;
    if(!refs.has(raw))refs.set(raw,new Set());
    refs.get(raw).add(source);
  };

  for(const table of tables){
    if(table==='companies')continue;
    let cols=[];
    try{ cols=query(config,`PRAGMA table_info(${sqlIdent(table)});`).map(r=>String(r.name||'')); }catch{ continue; }
    if(!cols.includes('company_id'))continue;
    try{
      const rows=query(config,`SELECT DISTINCT company_id FROM ${sqlIdent(table)} WHERE company_id IS NOT NULL AND trim(CAST(company_id AS TEXT))<>'';`);
      rows.forEach(r=>add(r.company_id,table));
    }catch(e){ console.warn(`[aviso] não foi possível ler referências de ${table}: ${e.message}`); }
  }
  return {companies,refs,tables};
}

function resolvePlans(evidence){
  const plans=[];
  for(const core of CORE){
    const existing=evidence.companies.filter(c=>core.aliases.includes(normalize(c.id))||core.aliases.includes(normalize(c.name)));
    if(existing.length>1){
      fail(`${core.name}: há ${existing.length} cadastros compatíveis (${existing.map(c=>`${c.name}[${c.id}]`).join(', ')}). Não vou escolher automaticamente.`);
    }
    if(existing.length===1){
      const row=existing[0];
      plans.push({core,action:String(row.name)===core.name?'keep':'rename',id:String(row.id),oldName:String(row.name||''),sources:[...(evidence.refs.get(String(row.id))||[])]});
      continue;
    }

    const candidates=[...evidence.refs.entries()]
      .filter(([id])=>core.aliases.includes(normalize(id)))
      .map(([id,sources])=>({id,sources:[...sources]}));
    if(candidates.length>1){
      fail(`${core.name}: encontrei múltiplos IDs órfãos compatíveis (${candidates.map(c=>c.id).join(', ')}). Requer decisão manual para não quebrar projetos/reports.`);
    }
    if(candidates.length===1){
      plans.push({core,action:'insert',id:candidates[0].id,oldName:'',sources:candidates[0].sources,reason:'ID preservado porque já é referenciado por dados existentes'});
    }else{
      plans.push({core,action:'insert',id:core.fallbackId,oldName:'',sources:[],reason:'Sem referência órfã identificável; será usado o ID canônico'});
    }
  }
  return plans;
}

function buildInsert(config,plan){
  const cols=query(config,'PRAGMA table_info(companies);');
  const names=cols.map(c=>String(c.name||''));
  if(!names.includes('id')||!names.includes('name')) fail('Tabela companies não possui id/name conforme contrato esperado.');

  const values={
    id:plan.id,
    name:plan.core.name,
    city:'',
    system:'',
    own_system:0,
    lead:'A definir',
    start_date:'',
    status:'s',
    status_text:'A reconciliar',
    pmo_mode:'PMO Direto',
    progress:0,
    summary:'',
    email:'',
    owner_email:'',
    grupo:'',
    billing_to:'',
    billing_email:'',
    billing_amount:'',
    billing_day:'',
    stakeholders:''
  };

  const requiredUnknown=cols.filter(c=>Number(c.notnull)===1&&!c.dflt_value&&!['id','name'].includes(String(c.name))&&!(String(c.name) in values));
  if(requiredUnknown.length) fail(`Tabela companies ganhou campos obrigatórios desconhecidos: ${requiredUnknown.map(c=>c.name).join(', ')}.`);

  const insertCols=names.filter(n=>Object.prototype.hasOwnProperty.call(values,n));
  const insertValues=insertCols.map(n=>typeof values[n]==='number'?String(values[n]):sqlString(values[n]));
  return `INSERT INTO companies (${insertCols.map(sqlIdent).join(',')}) SELECT ${insertValues.join(',')} WHERE NOT EXISTS (SELECT 1 FROM companies WHERE id=${sqlString(plan.id)});`;
}

function backup(target,envName){
  fs.mkdirSync(path.resolve(ROOT,'backups'),{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.resolve(ROOT,'backups',`${envName}-before-core-tenant-repair-${stamp}.sql`);
  console.log(`\nBackup obrigatório antes da alteração: ${file}`);
  runWrangler([WRANGLER,'d1','export',DB,'--remote','--config',target.config,'--output',file],{capture:false});
  if(!fs.existsSync(file)||fs.statSync(file).size===0) fail('Backup não foi criado ou está vazio. Nenhuma alteração será aplicada.');
  return file;
}

function printPlan(envName,evidence,plans){
  console.log(`\n=== RECUPERAÇÃO DE TENANTS · ${envName.toUpperCase()} ===`);
  console.log(`Empresas atuais: ${evidence.companies.length}`);
  evidence.companies.forEach(c=>console.log(`- atual: ${c.name} [${c.id}]`));
  console.log('\nPlano aditivo:');
  for(const p of plans){
    const refs=p.sources.length?` | refs: ${p.sources.join(', ')}`:'';
    if(p.action==='keep') console.log(`- ${p.core.name}: manter [${p.id}]${refs}`);
    if(p.action==='rename') console.log(`- ${p.core.name}: corrigir nome "${p.oldName}" -> "${p.core.name}" preservando ID [${p.id}]${refs}`);
    if(p.action==='insert') console.log(`- ${p.core.name}: criar [${p.id}] (${p.reason})${refs}`);
  }
}

function validateAfter(config){
  const companies=query(config,'SELECT id,name FROM companies ORDER BY name,id;');
  for(const core of CORE){
    const rows=companies.filter(c=>core.aliases.includes(normalize(c.id))||core.aliases.includes(normalize(c.name))||String(c.name)===core.name);
    if(rows.length!==1) fail(`Pós-validação: ${core.name} deveria resolver exatamente 1 cadastro; encontrei ${rows.length}.`);
    if(String(rows[0].name)!==core.name) fail(`Pós-validação: nome canônico de ${core.name} não foi aplicado.`);
  }
  const projectCounts=query(config,'SELECT company_id,COUNT(*) AS projects FROM projects GROUP BY company_id ORDER BY company_id;');
  console.log('\nPós-validação OK. Empresas-base:');
  companies.filter(c=>CORE.some(core=>core.aliases.includes(normalize(c.id))||String(c.name)===core.name)).forEach(c=>console.log(`- ${c.name} [${c.id}]`));
  console.log('\nProjetos por company_id (somente para conferência; nenhum projeto é criado por esta rotina):');
  projectCounts.forEach(r=>console.log(`- ${r.company_id}: ${r.projects}`));
}

function main(){
  if(!ENVIRONMENTS[envArg]){
    console.log('Uso:');
    console.log('  node scripts/repair-core-tenants.mjs --env=stage');
    console.log('  node scripts/repair-core-tenants.mjs --env=stage --apply --confirm=REPAIR-STAGE');
    console.log('  node scripts/repair-core-tenants.mjs --env=production');
    console.log('  node scripts/repair-core-tenants.mjs --env=production --apply --confirm=REPAIR-PRODUCTION');
    fail('Informe --env=stage ou --env=production.',2);
  }
  const target=ENVIRONMENTS[envArg];
  verifyConfig(target);
  const evidence=collectEvidence(target.config);
  const plans=resolvePlans(evidence);
  printPlan(envArg,evidence,plans);

  if(!APPLY){
    console.log('\nDRY-RUN concluído. Nenhum dado foi alterado.');
    console.log(`Para aplicar após conferir este plano, repita com --apply --confirm=${target.confirm}.`);
    return;
  }
  if(confirmArg!==target.confirm) fail(`Confirmação inválida. Para ${envArg}, use --confirm=${target.confirm}.`);

  const changes=plans.filter(p=>p.action!=='keep');
  if(!changes.length){
    console.log('\nAs três empresas já existem com os nomes canônicos. Nada a alterar.');
    validateAfter(target.config);
    return;
  }

  const backupFile=backup(target,envArg);
  const statements=[];
  for(const plan of changes){
    if(plan.action==='rename') statements.push(`UPDATE companies SET name=${sqlString(plan.core.name)} WHERE id=${sqlString(plan.id)} AND name<>${sqlString(plan.core.name)};`);
    if(plan.action==='insert') statements.push(buildInsert(target.config,plan));
  }
  statements.push("SELECT 'CORE_TENANT_REPAIR_OK' AS status;");

  console.log('\nAplicando somente INSERT/UPDATE em companies...');
  executeSqlFile(target.config,statements.join('\n'),{json:false,capture:false});
  validateAfter(target.config);
  console.log(`\nBackup preservado em: ${backupFile}`);
  console.log('Nenhum projeto, report, arquivo, tarefa ou outro tenant foi removido por esta rotina.');
}

try{main();}
catch(e){ fail(e?.message||String(e)); }
