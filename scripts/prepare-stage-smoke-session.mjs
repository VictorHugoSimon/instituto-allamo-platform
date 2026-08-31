import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const CONFIG='wrangler.stage.toml';
const DB='DB';
const WRANGLER='wrangler@4.124.0';

const abort=(m)=>{console.error('[ABORTADO] '+m);process.exit(2)};
if(!fs.existsSync(CONFIG)) abort('Config exclusiva de Stage não encontrada: '+CONFIG);
const cfg=fs.readFileSync(CONFIG,'utf8');
if(!/name\s*=\s*"allamo-pmo-stage"/.test(cfg)) abort('Config informada não pertence ao projeto allamo-pmo-stage.');
if(/database_name\s*=\s*"allamo-pmo"\s*$/m.test(cfg)) abort('Config de Stage aponta para o banco oficial de Produção.');

function run(args){
  const r=spawnSync('npx',['--yes',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(r.error) throw r.error;
  if(r.status!==0) throw new Error('Wrangler falhou ao operar o D1 de Stage.');
  return String(r.stdout||'')+String(r.stderr||'');
}
function parse(text){
  const clean=String(text||'').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g,'').trim();
  try{return JSON.parse(clean)}catch{}
  const starts=[],ends=[];
  for(let i=0;i<clean.length;i++)if(clean[i]==='['||clean[i]==='{')starts.push(i);
  for(let i=clean.length-1;i>=0;i--)if(clean[i]===']'||clean[i]==='}')ends.push(i);
  for(const a of starts)for(const b of ends){if(b<=a)continue;try{return JSON.parse(clean.slice(a,b+1))}catch{}}
  throw new Error('Payload JSON do D1 de Stage não reconhecido.');
}
function results(node){
  if(Array.isArray(node)){for(const x of node){const r=results(x);if(r)return r}return null}
  if(node&&typeof node==='object'){
    if(Array.isArray(node.results))return node.results;
    for(const v of Object.values(node)){const r=results(v);if(r)return r}
  }
  return null;
}
function query(sql){
  const out=run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json']);
  return results(parse(out))||[];
}
function exec(sql){
  run([WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json']);
}
const esc=s=>String(s).replace(/'/g,"''");

try{
  const user=query("SELECT id, role FROM users WHERE role IN ('pmo','admin') AND COALESCE(status,'Ativo') <> 'Bloqueado' ORDER BY CASE role WHEN 'pmo' THEN 0 ELSE 1 END, id LIMIT 1;")[0];
  if(!user?.id) abort('Nenhum usuário PMO/Admin ativo foi encontrado no D1 de Stage para a sessão de smoke.');

  const token=crypto.randomUUID();
  // A sessão dura no máximo 30 minutos e será expirada explicitamente no final do workflow.
  exec(`INSERT INTO sessions (token,user_id,expires_at) VALUES ('${esc(token)}','${esc(user.id)}',datetime('now','+30 minutes'));`);

  const envFile=process.env.GITHUB_ENV;
  if(!envFile) abort('GITHUB_ENV não está disponível; este helper só deve criar sessão em workflow controlado.');
  process.stdout.write(`::add-mask::${token}\n`);
  fs.appendFileSync(envFile,`\nALLAMO_SMOKE_TOKEN=${token}\n`);
  console.log('[OK] Sessão técnica efêmera criada exclusivamente no Stage; token mascarado e TTL de 30 minutos.');
}catch(e){
  console.error('[ABORTADO] Não foi possível preparar a sessão técnica de Stage:',e.message||String(e));
  process.exit(1);
}
