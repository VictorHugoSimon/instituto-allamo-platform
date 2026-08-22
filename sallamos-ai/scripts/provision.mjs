#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const environment = String(process.argv[2] ?? '').toLowerCase();
if (!['stage', 'production'].includes(environment)) {
  throw new Error('Uso: node scripts/provision.mjs <stage|production>');
}

const spec = environment === 'stage'
  ? { db: 'sallamos-ai-meta-stage', vector: 'sallamos-docs-stage', bucket: 'sallamos-ai-sources-stage', placeholder: 'PREENCHER_STAGE' }
  : { db: 'sallamos-ai-meta-production', vector: 'sallamos-docs-production', bucket: 'sallamos-ai-sources-production', placeholder: 'PREENCHER_PRODUCTION' };

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const configPath = 'wrangler.jsonc';

function run(args, capture = false) {
  console.log('> npx wrangler ' + args.join(' '));
  return execFileSync(NPX, ['wrangler', ...args], {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
}
function tryRun(args) { try { run(args); return true; } catch { return false; } }
function readJson(args, fallback = []) { try { return JSON.parse(run(args, true)); } catch { return fallback; } }
function putSecret(name, value) {
  if (!value) return;
  const cp = spawnSync(NPX, ['wrangler', 'secret', 'put', name, '--env', environment], {
    input: value + '\n', encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit']
  });
  if (cp.status !== 0) throw new Error('falha ao gravar secret ' + name + ' em ' + environment);
}

run(['whoami']);

let databases = readJson(['d1', 'list', '--json']);
let db = Array.isArray(databases) ? databases.find(x => x.name === spec.db) : null;
if (!db) {
  run(['d1', 'create', spec.db]);
  databases = readJson(['d1', 'list', '--json']);
  db = databases.find(x => x.name === spec.db);
}
const dbId = db?.uuid || db?.id || db?.database_id;
if (!dbId) throw new Error('Não consegui resolver o database_id de ' + spec.db);

const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
const target = cfg?.env?.[environment]?.d1_databases?.find(x => x.binding === 'META');
if (!target) throw new Error('Binding META não encontrado para ' + environment);
target.database_id = dbId;
writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n');

if (!tryRun(['vectorize', 'get', spec.vector])) {
  run(['vectorize', 'create', spec.vector, '--dimensions=768', '--metric=cosine']);
}
tryRun(['r2', 'bucket', 'create', spec.bucket]);

const secretList = readJson(['secret', 'list', '--env', environment, '--json'], []);
const existing = new Set((Array.isArray(secretList) ? secretList : []).map(x => x.name));
ensureGeneratedSecret('SALLAMOS_SESSION_SECRET', process.env.SALLAMOS_SESSION_SECRET, existing);
ensureGeneratedSecret('ADMIN_TOKEN', process.env.ADMIN_TOKEN, existing);
putOptionalSecret('SALLAMOS_API_BASE', process.env.SALLAMOS_API_BASE, existing);
putOptionalSecret('SALLAMOS_AUTH_VALIDATE_URL', process.env.SALLAMOS_AUTH_VALIDATE_URL, existing);
putOptionalSecret('SALLAMOS_API_TOKEN', process.env.SALLAMOS_API_TOKEN, existing);
putOptionalSecret('REPO_READ_TOKEN', process.env.REPO_READ_TOKEN, existing);

run(['d1', 'migrations', 'apply', spec.db, '--remote', '--env', environment]);
if (environment === 'stage' && existsSync('seeds/stage.sql')) {
  run(['d1', 'execute', spec.db, '--remote', '--env', environment, '--file', 'seeds/stage.sql']);
}

if (process.env.SYNC_KNOWLEDGE === 'true') {
  execFileSync(process.execPath, ['scripts/sync-sallamos-api.mjs', '--env', environment], { stdio: 'inherit' });
}

run(['deploy', '--env', environment]);
console.log(`\nSallamos AI ${environment} provisionado e publicado com recursos isolados.`);

function ensureGeneratedSecret(name, supplied, current) {
  if (supplied) { putSecret(name, supplied); return; }
  if (current.has(name)) { console.log(`secret ${name}: preservado`); return; }
  const value = randomBytes(48).toString('base64url');
  putSecret(name, value);
  console.log(`secret ${name}: criado no Worker sem exposição no log`);
}
function putOptionalSecret(name, supplied, current) {
  if (supplied) { putSecret(name, supplied); return; }
  if (current.has(name)) console.log(`secret opcional ${name}: preservado`);
}
