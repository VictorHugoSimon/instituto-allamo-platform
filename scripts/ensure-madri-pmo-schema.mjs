import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd(),WRANGLER='wrangler@4.124.0',DB='DB';
const envArg=(process.argv.find(a=>a.startsWith('--env='))||'').slice(6).toLowerCase();
const APPLY=process.argv.includes('--apply');
const confirmArg=(process.argv.find(a=>a.startsWith('--confirm='))||'').slice(10);
const ENV={
  stage:{config:'wrangler.stage.toml',confirm:'APPLY-MADRI-PMO-STAGE'},
  production:{config:'wrangler.production.toml',confirm:'APPLY-MADRI-PMO-PRODUCTION'}
};
const target=ENV[envArg];
if(!target){console.error('[ABORTADO] Informe --env=stage ou --env=production.');process.exit(2)}
if(!fs.existsSync(target.config)){console.error('[ABORTADO] Config não encontrada: '+target.config);process.exit(2)}
if(APPLY&&confirmArg!==target.confirm){console.error('[ABORTADO] Confirmação inválida. Use --confirm='+target.confirm);process.exit(2)}

function run(args,{capture=true}={}){const r=spawnSync('npx',['--yes',...args],{cwd:ROOT,encoding:capture?'utf8':undefined,stdio:capture?['ignore','pipe','pipe']:'inherit'});if(r.error)throw r.error;if(r.status!==0){if(capture){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}throw new Error('Wrangler falhou ('+r.status+')')}return capture?String(r.stdout||'')+String(r.stderr||''):''}
function parse(text){const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();try{return JSON.parse(clean)}catch{}const starts=[],ends=[];for(let i=0;i<clean.length;i++)if(clean[i]==='['||clean[i]==='{')starts.push(i);for(let i=clean.length-1;i>=0;i--)if(clean[i]===']'||clean[i]==='}')ends.push(i);for(const a of starts)for(const b of ends){if(b<=a)continue;try{return JSON.parse(clean.slice(a,b+1))}catch{}}throw new Error('Payload JSON D1 não reconhecido')}
function results(node){if(Array.isArray(node)){for(const x of node){const r=results(x);if(r)return r}return null}if(node&&typeof node==='object'){if(Array.isArray(node.results))return node.results;for(const v of Object.values(node)){const r=results(v);if(r)return r}}return null}
function query(sql){return results(parse(run([WRANGLER,'d1','execute',DB,'--remote','--config',target.config,'--command',sql,'--json'])))||[]}
function exec(sql){run([WRANGLER,'d1','execute',DB,'--remote','--config',target.config,'--command',sql],{capture:false})}
function table(name){return query(`SELECT name FROM sqlite_master WHERE type='table' AND name='${String(name).replace(/'/g,"''")}';`).some(r=>r.name===name)}
function cols(name){return table(name)?query(`PRAGMA table_info(${name});`).map(r=>String(r.name||'')):[]}

if(!table('work_items'))throw new Error('Tabela work_items ausente. A migration base de Work Management deve existir antes do MADRI PMO.');
const requiredCols={
  pmo_scope:"TEXT NOT NULL DEFAULT ''",
  front:"TEXT NOT NULL DEFAULT ''",
  dependency_text:"TEXT NOT NULL DEFAULT ''",
  impact_text:"TEXT NOT NULL DEFAULT ''",
  critical_path:'INTEGER NOT NULL DEFAULT 0',
  next_step:"TEXT NOT NULL DEFAULT ''",
  evidence:"TEXT NOT NULL DEFAULT ''",
  source_ref:"TEXT NOT NULL DEFAULT ''",
  version:'INTEGER NOT NULL DEFAULT 1'
};
const existing=cols('work_items');
const missingCols=Object.keys(requiredCols).filter(c=>!existing.includes(c));
const support=['madri_pmo_demands','madri_pmo_roles','madri_pmo_cadence'];
const missingTables=support.filter(t=>!table(t));
console.log('Ambiente:',envArg);
console.log('Colunas work_items ausentes:',missingCols.length?missingCols.join(', '):'nenhuma');
console.log('Tabelas MADRI PMO ausentes:',missingTables.length?missingTables.join(', '):'nenhuma');
if(!APPLY){console.log('[DRY-RUN] Nenhuma alteração aplicada.');process.exit(0)}
for(const c of missingCols){console.log('[APPLY] ALTER work_items +',c);exec(`ALTER TABLE work_items ADD COLUMN ${c} ${requiredCols[c]};`)}
console.log('[APPLY] Migration idempotente MADRI PMO + seed de evidências...');
run([WRANGLER,'d1','execute',DB,'--remote','--config',target.config,'--file','migrations/2026-08-30-madri-pmo-master-plan.sql'],{capture:false});
const after=cols('work_items');
const stillCols=Object.keys(requiredCols).filter(c=>!after.includes(c));
const stillTables=support.filter(t=>!table(t));
if(stillCols.length)throw new Error('Colunas continuam ausentes: '+stillCols.join(', '));
if(stillTables.length)throw new Error('Tabelas continuam ausentes: '+stillTables.join(', '));
const tenant=query("SELECT id,name FROM companies WHERE lower(CAST(id AS TEXT)) IN ('madrid','madri') OR lower(name) IN ('madrid','madri');");
if(tenant.length!==1)throw new Error('Tenant Madrid/Madri deve resolver exatamente um cadastro antes do seed; encontrado: '+tenant.length);
const count=query("SELECT COUNT(*) total FROM work_items WHERE pmo_scope='MADRI_NUCCI';");
const total=Number(count[0]?.total||0);if(total<18)throw new Error('Seed MADRI PMO incompleto; ações encontradas: '+total);
console.log('[OK] Schema MADRI PMO aditivo validado. Ações seed:',total);
