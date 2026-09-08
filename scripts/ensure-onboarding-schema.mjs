import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const WRANGLER='wrangler@4.124.0';
const envArg=(process.argv.find(a=>a.startsWith('--env='))||'').slice(6).toLowerCase();
const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const ENV={
  stage:{config:'wrangler.stage.toml',confirm:'APPLY-ONBOARDING-SCHEMA-STAGE'},
  production:{config:'wrangler.production.toml',confirm:'APPLY-ONBOARDING-SCHEMA-PRODUCTION'}
};
const target=ENV[envArg];
if(!target)throw new Error('Informe --env=stage ou --env=production.');
if(!fs.existsSync(target.config))throw new Error(`Config ausente: ${target.config}`);
if(APPLY&&confirmArg!==target.confirm)throw new Error(`Confirmação inválida. Use --confirm=${target.confirm}`);

function run(args,{json=false}={}){
  const r=spawnSync('npx',['--yes',WRANGLER,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false});
  if(r.error)throw r.error;
  if(r.status!==0){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);throw new Error(`Wrangler falhou (${r.status}).`)}
  const out=String(r.stdout||'')+String(r.stderr||'');
  if(!json)return out;
  const clean=out.replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'');
  const a=clean.indexOf('['),b=clean.lastIndexOf(']');
  if(a<0||b<a)throw new Error('D1 não retornou JSON reconhecível.');
  return JSON.parse(clean.slice(a,b+1)).flatMap(x=>x?.results||[]);
}
function query(sql){return run(['d1','execute','DB','--remote','--config',target.config,'--command',sql,'--json'],{json:true})}
function tableExists(){return query("SELECT name FROM sqlite_master WHERE type='table' AND name='onboarding_requests';").some(r=>r.name==='onboarding_requests')}

const existed=tableExists();
console.log(`[ONBOARDING SCHEMA] ambiente=${envArg} tabela=${existed?'presente':'ausente'} apply=${APPLY?'sim':'não'}`);
if(!APPLY){
  console.log(existed?'[DRY-RUN] Schema de onboarding já disponível.':'[DRY-RUN] Migration aditiva será necessária; nenhum dado foi alterado.');
  process.exit(0);
}
if(!existed){
  run(['d1','execute','DB','--remote','--config',target.config,'--file','migrations/2026-09-08-pmo-onboarding-idempotency.sql']);
}
if(!tableExists())throw new Error('onboarding_requests continua ausente após aplicação.');
const cols=query('PRAGMA table_info(onboarding_requests);');
const byName=new Map(cols.map(c=>[String(c.name),c]));
for(const name of ['request_id','entity_type','payload_hash','status','entity_id','company_id','actor_id','actor_name','actor_role','created_at','completed_at']){
  if(!byName.has(name))throw new Error(`Coluna obrigatória ausente em onboarding_requests: ${name}`);
}
if(Number(byName.get('request_id')?.pk)!==1)throw new Error('request_id precisa permanecer PRIMARY KEY.');
console.log('[OK] Ledger idempotente de onboarding validado. Nenhuma empresa/projeto foi criada por este gate.');
