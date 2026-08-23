#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = new URL('../scripts/prepare-cloudflare-auth.mjs', import.meta.url);
const accountId = 'a'.repeat(32);
const modernToken = 'cfut_' + 'T'.repeat(48);
const legacyKey = 'b'.repeat(32);

runCase('modern API token', {
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_API_TOKEN: modernToken
}, 0, ({ stdout, envFile }) => {
  assert.match(stdout, /"authMode": "api_token"/);
  assert.match(envFile, new RegExp(`CLOUDFLARE_API_TOKEN=${modernToken}`));
  assert.match(envFile, /CLOUDFLARE_API_KEY=\n/);
});

runCase('account id mistakenly used as token', {
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_API_TOKEN: accountId
}, 1, ({ stderr }) => {
  assert.match(stderr, /API_TOKEN é igual ao CLOUDFLARE_ACCOUNT_ID/);
});

runCase('explicit legacy global API key', {
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_API_KEY: legacyKey,
  CLOUDFLARE_EMAIL: 'ci@example.invalid'
}, 0, ({ stdout, envFile }) => {
  assert.match(stdout, /"authMode": "api_key_email"/);
  assert.match(envFile, /CLOUDFLARE_API_TOKEN=\n/);
  assert.match(envFile, new RegExp(`CLOUDFLARE_API_KEY=${legacyKey}`));
  assert.match(envFile, /CLOUDFLARE_EMAIL=ci@example\.invalid/);
});

runCase('legacy key temporarily stored in API token slot with email present', {
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_API_TOKEN: legacyKey,
  CLOUDFLARE_EMAIL: 'ci@example.invalid'
}, 0, ({ stdout, envFile }) => {
  assert.match(stdout, /"authMode": "api_key_email"/);
  assert.match(envFile, new RegExp(`CLOUDFLARE_API_KEY=${legacyKey}`));
});

runCase('legacy-looking token without email', {
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_API_TOKEN: legacyKey
}, 1, ({ stderr }) => {
  assert.match(stderr, /Provável Global API Key/);
});

runCase('missing credentials', {
  CLOUDFLARE_ACCOUNT_ID: accountId
}, 1, ({ stderr }) => {
  assert.match(stderr, /Credencial Cloudflare incompleta/);
});

console.log('CLOUDFLARE_AUTH_CONTRACT_OK');

function runCase(name, extraEnv, expectedStatus, verify) {
  const dir = mkdtempSync(join(tmpdir(), 'sallamos-auth-'));
  const githubEnv = join(dir, 'github-env');
  writeFileSync(githubEnv, '');
  const env = { ...process.env, GITHUB_ENV: githubEnv };
  for (const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CLOUDFLARE_ACCOUNT_ID']) delete env[key];
  Object.assign(env, extraEnv);
  const cp = spawnSync(process.execPath, [SCRIPT.pathname], { env, encoding: 'utf8' });
  assert.equal(cp.status, expectedStatus, `${name}: exit ${cp.status}\nstdout=${cp.stdout}\nstderr=${cp.stderr}`);
  verify({ stdout: cp.stdout, stderr: cp.stderr, envFile: readFileSync(githubEnv, 'utf8') });
  console.log(`PASS: ${name}`);
}
