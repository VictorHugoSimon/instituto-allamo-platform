#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const DB='sallamos-ai-meta', VECTOR='sallamos-docs', BUCKET='sallamos-ai-sources';
const NPX=process.platform==='win32'?'npx.cmd':'npx';
function run(args,capture=false){ console.log('> npx wrangler '+args.join(' ')); return execFileSync(NPX,['wrangler',...args],{encoding:'utf8',stdio:capture?['ignore','pipe','pipe']:'inherit'}); }
function tryRun(args){ try{run(args);return true;}catch{return false;} }
function readJson(args){ return JSON.parse(run(args,true)); }
function putSecret(name,value){ const cp=spawnSync(NPX,['wrangler','secret','put',name],{input:value+'\n',encoding:'utf8',stdio:['pipe','inherit','inherit']}); if(cp.status!==0)process.exit(cp.status??1); }
run(['whoami']);
let databases=[]; try{databases=readJson(['d1','list','--json']);}catch{}
let db=Array.isArray(databases)?databases.find(x=>x.name===DB):null;
if(!db){ run(['d1','create',DB]); databases=readJson(['d1','list','--json']); db=databases.find(x=>x.name===DB); }
const dbId=db?.uuid||db?.id||db?.database_id; if(!dbId)throw new Error('Não consegui resolver o database_id do D1.');
let cfg=readFileSync('wrangler.jsonc','utf8'); cfg=cfg.replace(/"database_id"\s*:\s*"[^"]+"/,`"database_id": "${dbId}"`); writeFileSync('wrangler.jsonc',cfg);
if(!tryRun(['vectorize','get',VECTOR])) run(['vectorize','create',VECTOR,'--dimensions=768','--metric=cosine']);
tryRun(['r2','bucket','create',BUCKET]);
const sessionSecret=randomBytes(32).toString('base64url'); const adminSecret=randomBytes(32).toString('base64url');
putSecret('SALLAMOS_SESSION_SECRET',sessionSecret); putSecret('ADMIN_TOKEN',adminSecret); putSecret('REPO_READ_TOKEN','poc-read-only-not-configured');
run(['d1','migrations','apply',DB,'--remote']); run(['deploy']);
console.log('\nPOC publicada.'); console.log('ADMIN_TOKEN='+adminSecret);
