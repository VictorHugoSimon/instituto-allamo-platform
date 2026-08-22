#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const DB = 'sallamos-ai-meta';
const VECTOR = 'sallamos-docs';
const BUCKET = 'sallamos-ai-sources';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const generated = new Map();

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
  const cp = spawnSync(NPX, ['wrangler', 'secret', 'put', name], {
    input: value + '\n', encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit']
  });
  if (cp.status !== 0) throw new Error('falha ao gravar secret ' + name);
}

run(['whoami']);

let databases = readJson(['d1', 'list', '--json']);
let db = Array.isArray(databases) ? databases.find(x => x.name === DB) : null;
if (!db) {
  run(['d1', 'create', DB]);
  databases = readJson(['d1', 'list', '--json']);
  db = databases.find(x => x.name === DB);
}
const dbId = db?.uuid || db?.id || db?.database_id;
if (!dbId) throw new Error('Não consegui resolver o database_id do D1.');

let cfg = readFileSync('wrangler.jsonc', 'utf8');
cfg = cfg.replace(/"database_id"\s*:\s*"[^"]+"/, `"database_id": "${dbId}"`);
writeFileSync('wrangler.jsonc', cfg);

if (!tryRun(['vectorize', 'get', VECTOR])) run(['vectorize', 'create', VECTOR, '--dimensions=768', '--metric=cosine']);
tryRun(['r2', 'bucket', 'create', BUCKET]);

const secretList = readJson(['secret', 'list', '--json'], []);
const existing = new Set((Array.isArray(secretList) ? secretList : []).map(x => x.name));
ensureSecret('SALLAMOS_SESSION_SECRET', process.env.SALLAMOS_SESSION_SECRET, true, existing);
ensureSecret('ADMIN_TOKEN', process.env.ADMIN_TOKEN, true, existing);
if (process.env.REPO_READ_TOKEN) putSecret('REPO_READ_TOKEN', process.env.REPO_READ_TOKEN);

run(['d1', 'migrations', 'apply', DB, '--remote']);
run(['deploy']);

console.log('\nPOC publicada com provisionamento idempotente.');
if (generated.has('ADMIN_TOKEN')) console.log('ADMIN_TOKEN (guarde com segurança): ' + generated.get('ADMIN_TOKEN'));

function ensureSecret(name, supplied, allowGenerateLocal, current) {
  if (supplied) { putSecret(name, supplied); return; }
  if (current.has(name)) { console.log(`secret ${name}: já existe`); return; }
  if (process.env.CI) throw new Error(`secret obrigatório ausente no CI: ${name}`);
  if (!allowGenerateLocal) return;
  const value = randomBytes(32).toString('base64url');
  putSecret(name, value);
  generated.set(name, value);
}
