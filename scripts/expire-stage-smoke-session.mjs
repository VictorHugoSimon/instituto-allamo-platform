import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const CONFIG='wrangler.stage.toml';
const DB='DB';
const WRANGLER='wrangler@4.124.0';
const token=String(process.env.ALLAMO_SMOKE_TOKEN||'').trim();

if(!token){
  console.log('[INFO] Nenhuma sessão técnica de smoke foi criada; nada a expirar.');
  process.exit(0);
}
if(!fs.existsSync(CONFIG)){
  console.error('[ABORTADO] Config exclusiva de Stage não encontrada.');
  process.exit(2);
}
const cfg=fs.readFileSync(CONFIG,'utf8');
if(!/name\s*=\s*"allamo-pmo-stage"/.test(cfg)||/database_name\s*=\s*"allamo-pmo"\s*$/m.test(cfg)){
  console.error('[ABORTADO] Recusa de expiração fora do D1 exclusivo de Stage.');
  process.exit(2);
}
const esc=s=>String(s).replace(/'/g,"''");
const sql=`UPDATE sessions SET expires_at=datetime('now','-1 minute') WHERE token='${esc(token)}';`;
const r=spawnSync('npx',['--yes',WRANGLER,'d1','execute',DB,'--remote','--config',CONFIG,'--command',sql,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
if(r.error||r.status!==0){
  console.error('[ERRO] Não foi possível expirar a sessão técnica de Stage. Ela possui TTL máximo de 30 minutos e expirará automaticamente.');
  process.exitCode=1;
}else{
  console.log('[OK] Sessão técnica de smoke expirada no Stage.');
}
