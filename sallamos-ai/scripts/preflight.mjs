#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const env=String(process.argv[2]||'').toLowerCase();
if(!['stage','production'].includes(env))throw new Error('PREFLIGHT: uso node scripts/preflight.mjs <stage|production>');
const errors=[];
required('CLOUDFLARE_API_TOKEN'); required('CLOUDFLARE_ACCOUNT_ID');
if(env==='production'){
  required('SALLAMOS_AUTH_VALIDATE_URL'); required('SALLAMOS_API_BASE'); required('SALLAMOS_AI_STAGE_URL'); required('EVIDENCE_INGEST_TOKEN');
  if(process.env.PRODUCTION_GO_LIVE!=='true')errors.push('PRODUCTION_GO_LIVE deve ser true somente após Go/No-Go');
  httpsOnly('SALLAMOS_AUTH_VALIDATE_URL'); httpsOnly('SALLAMOS_API_BASE'); httpsOnly('SALLAMOS_AI_STAGE_URL');
}
const cfg=await readFile('wrangler.jsonc','utf8');
if(!cfg.includes(`"${env}"`))errors.push(`wrangler.jsonc sem ambiente ${env}`);
if(env==='production'&&/PREENCHER_PRODUCTION/.test(cfg))console.warn('PREFLIGHT WARN: database_id de produção será resolvido pelo provisionador; placeholder presente no arquivo versionado');
if(env==='stage'&&/PREENCHER_STAGE/.test(cfg))console.warn('PREFLIGHT WARN: database_id de stage será resolvido pelo provisionador; placeholder presente no arquivo versionado');
if(errors.length){console.error(`PREFLIGHT ${env.toUpperCase()} BLOQUEADO`);errors.forEach(e=>console.error('- '+e));process.exit(1)}
console.log(JSON.stringify({preflight:'ready',environment:env,cloudflareCredentials:'present',integrationConfig:env==='production'?'present':'optional',runtimeEvidence:env==='production'?'required':'optional'},null,2));
function required(name){if(!String(process.env[name]||'').trim())errors.push(`${name} ausente`)}
function httpsOnly(name){const v=String(process.env[name]||'').trim();if(v&&!v.startsWith('https://'))errors.push(`${name} deve usar HTTPS`)}
