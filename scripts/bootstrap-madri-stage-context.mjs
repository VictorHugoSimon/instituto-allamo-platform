import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const WRANGLER='wrangler@4.124.0';
const DB='DB';
const CONFIG='wrangler.stage.toml';
const CONFIRM='CREATE-MADRI-CONTEXT-STAGE';
const MASTER_PLAN='migrations/2026-08-30-madri-pmo-master-plan.sql';
const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);

if(APPLY&&confirmArg!==CONFIRM){
  console.error(`[ABORTADO] Para criar o contexto no STAGE use --confirm=${CONFIRM}`);
  process.exit(2);
}
for(const f of [CONFIG,MASTER_PLAN])if(!fs.existsSync(f))throw new Error(`Arquivo obrigatório ausente: ${f}`);
const cfg=fs.readFileSync(CONFIG,'utf8');
if(!/^name\s*=\s*"allamo-pmo-stage"\s*$/m.test(cfg))throw new Error('wrangler.stage.toml não aponta para allamo-pmo-stage.');
if(/database_name\s*=\s*"allamo-pmo"\s*$/m.test(cfg))throw new Error('Configuração STAGE aponta indevidamente para D1 de Produção.');
if(!/database_name\s*=\s*"allamo-pmo-stage"/m.test(cfg))throw new Error('Binding D1 STAGE allamo-pmo-stage não localizado.');

function run(args,{capture=true}={}){
  const exe=process.platform==='win32'?'npx.cmd':'npx';
  const r=spawnSync(exe,['--yes',...args],{encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit',shell:process.platform==='win32'});
  if(r.error)throw r.error;
  if(r.status!==0){if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}throw new Error(`Wrangler falhou (${r.status})`)}
  return capture?String(r.stdout||'')+String(r.stderr||''):'';
}
function parse(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  for(let i=0;i<clean.length;i++){
    if(!['[','{'].includes(clean[i]))continue;
    for(let j=clean.length-1;j>i;j--){if(![']','}'].includes(clean[j]))continue;try{return JSON.parse(clean.slice(i,j+1))}catch{}}
  }
  throw new Error('JSON D1 não reconhecido');
}
function results(v){
  if(Array.isArray(v))return v.flatMap(results);
  if(v&&typeof v==='object'){
    if(Array.isArray(v.results))return v.results;
    for(const x of Object.values(v)){const r=results(x);if(r.length)return r}
  }
  return [];
}
function query(sql){return results(parse(run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'])))}
function exec(sql){run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql],{capture:false})}
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const lit=v=>v===null||v===undefined?'NULL':typeof v==='number'?String(v):`'${String(v).replaceAll("'","''")}'`;
const ident=v=>`"${String(v).replaceAll('"','""')}"`;

function tableInfo(table){return query(`PRAGMA table_info(${ident(table)});`)}
function buildInsert(table,values,whereSql){
  const cols=tableInfo(table),names=cols.map(c=>String(c.name||''));
  const requiredUnknown=cols.filter(c=>Number(c.notnull)===1&&!c.dflt_value&&!Object.prototype.hasOwnProperty.call(values,String(c.name))&&String(c.name)!=='id');
  if(requiredUnknown.length)throw new Error(`${table} possui campos obrigatórios desconhecidos: ${requiredUnknown.map(c=>c.name).join(', ')}`);
  const insertCols=names.filter(n=>Object.prototype.hasOwnProperty.call(values,n));
  if(!insertCols.length)throw new Error(`Nenhuma coluna compatível para inserir em ${table}`);
  return `INSERT INTO ${ident(table)} (${insertCols.map(ident).join(',')}) SELECT ${insertCols.map(c=>lit(values[c])).join(',')} WHERE NOT EXISTS (${whereSql});`;
}
function resolveCompany(){
  const rows=query('SELECT id,name FROM companies ORDER BY id;');
  const matches=rows.filter(r=>['madri','madrid'].includes(norm(r.id))||['madri','madrid'].includes(norm(r.name)));
  if(matches.length>1)throw new Error(`Tenant MADRI ambíguo no STAGE (matches=${matches.length}).`);
  return matches[0]||null;
}
function resolveNucci(companyId){
  const rows=query(`SELECT id,name,company_id FROM projects WHERE company_id=${lit(companyId)} ORDER BY id;`);
  const matches=rows.filter(r=>/nucci/i.test(String(r.name||'')));
  if(matches.length>1)throw new Error(`Projeto NUCCI ambíguo no STAGE (matches=${matches.length}).`);
  return {project:matches[0]||null,projects:rows};
}

let company=resolveCompany();
console.log(`[STAGE] Tenant MADRI: ${company?`${company.name} [${company.id}]`:'AUSENTE — será criado como Madri [madri]'}`);
if(!APPLY){
  if(company){const r=resolveNucci(company.id);console.log(`[STAGE] Projeto NUCCI: ${r.project?`${r.project.name} [${r.project.id}]`:'AUSENTE — será criado como Implantação NUCCI ERP'}`)}
  else console.log('[STAGE] Projeto NUCCI: será criado após o tenant MADRI.');
  console.log('[DRY-RUN] Nenhuma alteração aplicada no STAGE.');
  process.exit(0);
}

if(!company){
  const values={
    id:'madri',name:'Madri',city:'',system:'Nucci',own_system:0,lead:'PMO',start_date:'2026-08-24',status:'s',status_text:'Em implantação',pmo_mode:'PMO Direto',progress:0,
    summary:'Implantação NUCCI ERP/TMS — contexto STAGE MADRI',email:'',owner_email:'',grupo:'',billing_to:'',billing_email:'',billing_amount:'',billing_day:'',stakeholders:''
  };
  const sql=buildInsert('companies',values,`SELECT 1 FROM companies WHERE id='madri' OR lower(name)='madri'`);
  if(/\b(?:DELETE|DROP|TRUNCATE)\b/i.test(sql))throw new Error('SQL destrutivo detectado.');
  exec(sql);
  company=resolveCompany();
  if(!company)throw new Error('Falha ao criar/resolver tenant MADRI no STAGE.');
  console.log(`[OK] Tenant STAGE criado: ${company.name} [${company.id}]`);
}

let {project}=resolveNucci(company.id);
if(!project){
  const values={
    name:'Implantação NUCCI ERP',company_id:company.id,status:'Em andamento',badge:'started',urgency:'Alta',summary:'Implantação do ERP/TMS NUCCI na MADRI',lead:'PMO',start_date:'2026-08-24',meta_date:'',pmo_read:'Atenção',note:'Contexto STAGE controlado',linear_url:''
  };
  const sql=buildInsert('projects',values,`SELECT 1 FROM projects WHERE company_id=${lit(company.id)} AND lower(name)=lower('Implantação NUCCI ERP')`);
  if(/\b(?:DELETE|DROP|TRUNCATE)\b/i.test(sql))throw new Error('SQL destrutivo detectado.');
  exec(sql);
  ({project}=resolveNucci(company.id));
  if(!project)throw new Error('Falha ao criar/resolver projeto Implantação NUCCI ERP no STAGE.');
  console.log(`[OK] Projeto STAGE criado: ${project.name} [${project.id}]`);
}

const master=fs.readFileSync(MASTER_PLAN,'utf8');
if(/\b(?:DELETE|DROP|TRUNCATE)\b/i.test(master.replace(/^--.*$/gm,'')))throw new Error('Migration do baseline contém operação destrutiva.');
run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--file',MASTER_PLAN],{capture:false});

const ids=Array.from({length:18},(_,i)=>`MADRI-ACT-${String(i+1).padStart(3,'0')}`);
const row=query(`SELECT COUNT(*) n FROM work_items WHERE company_id=${lit(company.id)} AND project_id=${lit(project.id)} AND pmo_scope='MADRI_NUCCI' AND id IN (${ids.map(lit).join(',')});`)[0]||{};
if(Number(row.n)!==18)throw new Error(`Baseline do Plano Mestre incompleto no STAGE: ${Number(row.n||0)}/18.`);
console.log(`[OK] Contexto MADRI STAGE: ${company.name} / ${project.name}; Plano Mestre baseline=18/18.`);
