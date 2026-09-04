import {spawnSync} from 'node:child_process';
const CONFIG='wrangler.stage.toml';
const DB='DB';
const WRANGLER='wrangler@4.124.0';
const prefixes=['service_hub_','commercial_'];
const exact=new Set(['access_invitations']);
const protectedName=n=>exact.has(n)||prefixes.some(p=>n.startsWith(p));
const npx=process.platform==='win32'?'npx.cmd':'npx';
const qi=v=>`"${String(v).replace(/"/g,'""')}"`;
const q=v=>`'${String(v).replace(/'/g,"''")}'`;

function rows(sql){
  const r=spawnSync(npx,['--yes',WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'],{encoding:'utf8',shell:false,env:process.env});
  if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');throw new Error('Consulta D1 falhou.');}
  const text=String(r.stdout||'').trim();
  let data;try{data=JSON.parse(text)}catch{const i=text.indexOf('[');data=JSON.parse(text.slice(i));}
  const walk=x=>{if(Array.isArray(x)){for(const v of x){const y=walk(v);if(y)return y}}else if(x&&typeof x==='object'){if(Array.isArray(x.results))return x.results;for(const v of Object.values(x)){const y=walk(v);if(y)return y}}return null};
  return walk(data)||[];
}

const companies=rows('SELECT id,name FROM companies ORDER BY id;');
const projects=rows('SELECT id,name,company_id FROM projects ORDER BY id;');
const companyIds=companies.map(x=>String(x.id));
const projectIds=projects.map(x=>String(x.id));
const companySql=companyIds.length?companyIds.map(q).join(','):"''";
const projectSql=projectIds.length?projectIds.map(q).join(','):"''";
const tables=rows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").map(x=>String(x.name||'')).filter(protectedName);
const blockers=[];
const audit=[];
for(const table of tables){
  const cols=rows(`PRAGMA table_info(${qi(table)});`).map(x=>String(x.name||''));
  const parts=[];
  if(cols.includes('company_id'))parts.push(`${qi('company_id')} IN (${companySql})`);
  if(cols.includes('project_id'))parts.push(`${qi('project_id')} IN (${projectSql})`);
  if(!parts.length){audit.push({table,direct_scope_columns:'none',linked_rows:'parent-dependent'});continue;}
  const result=rows(`SELECT COUNT(*) AS n FROM ${qi(table)} WHERE ${parts.join(' OR ')};`);
  const n=Number(result[0]?.n||0);
  audit.push({table,direct_scope_columns:parts.length,linked_rows:n});
  if(n>0)blockers.push({table,n});
}
console.log(JSON.stringify({companies:companies.length,projects:projects.length,protected_tables:audit,blockers},null,2));
if(blockers.length){
  console.error('BLOQUEADO: há registros vinculados em módulos fora do escopo PMO. Nenhum reset deve ser aplicado.');
  process.exit(4);
}
console.log('OK: nenhum registro diretamente vinculado foi encontrado nos módulos protegidos.');
