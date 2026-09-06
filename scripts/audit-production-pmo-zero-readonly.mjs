import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const CONFIG='wrangler.production.toml';
const WRANGLER='wrangler@4.124.0';
const DB='DB';
const EXPECTED_NAME='allamo-pmo';
const EXPECTED_ID='361c63ba-b9f8-409d-9a46-9609914da8b7';
const STAGE_ID='72e2f6a0-3d22-4d65-a820-4a9b9ea88321';
const PROTECTED_PREFIXES=['service_hub_','commercial_'];
const PROTECTED_TABLES=new Set(['access_invitations']);

const qi=s=>`"${String(s).replace(/"/g,'""')}"`;
const clean=s=>String(s||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
const isProtected=t=>PROTECTED_TABLES.has(t)||PROTECTED_PREFIXES.some(p=>t.startsWith(p));

function abort(m){console.error('[ABORTADO] '+m);process.exit(2)}
function verify(){
  if(!fs.existsSync(CONFIG)) abort(`${CONFIG} ausente`);
  const cfg=fs.readFileSync(CONFIG,'utf8');
  const root=cfg.split(/^\[env\./m)[0];
  if(!root.includes(`database_name = "${EXPECTED_NAME}"`)) abort('Binding raiz não aponta para o D1 oficial de Produção.');
  if(!root.includes(`database_id = "${EXPECTED_ID}"`)) abort('UUID do binding raiz de Produção divergente.');
  if(root.includes(STAGE_ID)) abort('UUID do STAGE encontrado no binding raiz de Produção.');
  const prodBlock=(cfg.match(/\[env\.production\][\s\S]*?(?=\n\[env\.|$)/)||[])[0]||'';
  if(prodBlock&&!prodBlock.includes(EXPECTED_ID)) abort('[env.production] não aponta para o UUID oficial de Produção.');
  console.log('[OK] Guard de configuração: binding raiz/produção corretos; [env.preview] pode usar STAGE deliberadamente.');
}
function run(sql){
  let last='';
  for(let attempt=1;attempt<=5;attempt++){
    const r=spawnSync('npx',['--yes',WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    if(!r.error&&r.status===0) return String(r.stdout||'');
    last=String(r.stderr||r.stdout||r.error||'erro desconhecido');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,attempt*1500);
  }
  throw new Error(`Falha read-only D1 após retries: ${last.slice(0,800)}`);
}
function rows(sql){
  const raw=clean(run(sql));
  let payload;
  try{payload=JSON.parse(raw)}catch{
    const a=raw.indexOf('['), b=raw.lastIndexOf(']');
    if(a<0||b<a) throw new Error('Resposta D1 sem JSON reconhecível');
    payload=JSON.parse(raw.slice(a,b+1));
  }
  const out=[];
  const visit=v=>{
    if(Array.isArray(v)){v.forEach(visit);return}
    if(v&&typeof v==='object'){
      if(Array.isArray(v.results)) out.push(...v.results);
      else Object.values(v).forEach(visit);
    }
  };
  visit(payload);
  return out;
}

verify();
console.log('=== AUDITORIA READ-ONLY PMO PRODUÇÃO ===');
console.log(`D1: ${EXPECTED_NAME} (${EXPECTED_ID})`);

const headline=rows('SELECT (SELECT COUNT(*) FROM companies) AS companies, (SELECT COUNT(*) FROM projects) AS projects;')[0]||{};
const companies=Number(headline.companies||0);
const projects=Number(headline.projects||0);
console.log(`companies=${companies}; projects=${projects}`);

const tableNames=rows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
  .map(r=>String(r.name||''))
  .filter(Boolean)
  .filter(t=>!t.startsWith('d1_')&&!t.startsWith('_cf_')&&!isProtected(t));

const residual=[];
for(const table of tableNames){
  const cols=rows(`PRAGMA table_info(${qi(table)});`).map(r=>String(r.name||''));
  const parts=[];
  if(cols.includes('company_id')) parts.push('company_id IS NOT NULL AND TRIM(CAST(company_id AS TEXT)) <> \'\'');
  if(cols.includes('project_id')) parts.push('project_id IS NOT NULL AND TRIM(CAST(project_id AS TEXT)) <> \'\'');
  if(!parts.length) continue;
  const predicate=parts.map(x=>`(${x})`).join(' OR ');
  const n=Number(rows(`SELECT COUNT(*) AS n FROM ${qi(table)} WHERE ${predicate};`)[0]?.n||0);
  if(n>0) residual.push({table,n});
}

console.log(JSON.stringify({companies,projects,residual_scope_tables:residual},null,2));
if(companies===0&&projects===0&&residual.length===0){
  console.log('[OK] Produção está em estado zero PMO: 0 empresas, 0 projetos e nenhuma referência company_id/project_id nas tabelas PMO auditadas.');
}else{
  console.log('[ATENÇÃO] Produção não está completamente em estado zero PMO. Nenhuma alteração foi realizada.');
}
