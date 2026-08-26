#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const rawToken = String(process.env.CLOUDFLARE_API_TOKEN ?? '');
const rawKey = String(process.env.CLOUDFLARE_API_KEY ?? '');
const rawEmail = String(process.env.CLOUDFLARE_EMAIL ?? '');
const accountId = normalizeSimple(process.env.CLOUDFLARE_ACCOUNT_ID ?? '');
const verifyOnline = String(process.env.CLOUDFLARE_AUTH_VERIFY ?? '') === '1';

let token = normalizeToken(rawToken);
let apiKey = normalizeSimple(rawKey).replace(/\s+/g, '');
let email = stripQuotes(String(rawEmail).trim()).trim();

if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID ausente');

const tokenEqualsAccountId = Boolean(token && token === accountId);
const tokenLooksLegacyKey = /^[a-f0-9]{32}$/i.test(token);
const legacyReady = Boolean(apiKey && email);

if (tokenEqualsAccountId) {
  if (!legacyReady) throw new Error('CLOUDFLARE_API_TOKEN é igual ao CLOUDFLARE_ACCOUNT_ID e não há fallback Global API Key configurado.');
  token = '';
}
if (tokenLooksLegacyKey) {
  if (email) {
    apiKey = apiKey || token;
    token = '';
  } else {
    throw new Error('Credencial de 32 caracteres parece Global API Key, mas CLOUDFLARE_EMAIL está ausente.');
  }
}

mask(token); mask(apiKey); mask(email);

const candidates = [];
if (apiKey && email) candidates.push({ mode: 'api_key_email', env: { CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_API_KEY: apiKey, CLOUDFLARE_EMAIL: email } });
if (token) candidates.push({ mode: 'api_token', env: { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_API_KEY: '', CLOUDFLARE_EMAIL: '' } });
if (!candidates.length) throw new Error('Nenhuma credencial Cloudflare disponível.');

let selected = candidates[0];
if (verifyOnline) {
  selected = null;
  for (const candidate of candidates) {
    if (!verifyWrangler(candidate.env)) continue;
    const access = await verifyResourceAccess(candidate.env);
    console.log(`[cloudflare-auth] ${candidate.mode}: workers=${access.workers}, d1=${access.d1}, pages=${access.pages}`);
    if (access.ok) { selected = candidate; break; }
  }
  if (!selected) throw new Error('Nenhuma credencial Cloudflare existente possui acesso simultâneo a Workers, D1 e Pages.');
}

writeEnv('CLOUDFLARE_API_TOKEN', selected.env.CLOUDFLARE_API_TOKEN);
writeEnv('CLOUDFLARE_API_KEY', selected.env.CLOUDFLARE_API_KEY);
writeEnv('CLOUDFLARE_EMAIL', selected.env.CLOUDFLARE_EMAIL);
writeEnv('CLOUDFLARE_ACCOUNT_ID', accountId);
writeEnv('PROFILE_CF_AUTH_MODE', selected.mode);

console.log(JSON.stringify({
  cloudflareAuthPreparation: 'ok',
  authMode: selected.mode,
  verified: verifyOnline,
  accountIdLength: accountId.length,
  fallbackSupported: true
}, null, 2));

function verifyWrangler(authEnv) {
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(cmd, ['--yes', 'wrangler@4.124.0', 'whoami'], {
    cwd: process.cwd(), encoding: 'utf8', shell: false, windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, ...authEnv }
  });
  return !result.error && result.status === 0;
}

async function verifyResourceAccess(authEnv) {
  const headers = authEnv.CLOUDFLARE_API_TOKEN
    ? { Authorization: `Bearer ${authEnv.CLOUDFLARE_API_TOKEN}` }
    : { 'X-Auth-Email': authEnv.CLOUDFLARE_EMAIL, 'X-Auth-Key': authEnv.CLOUDFLARE_API_KEY };
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const endpoints = {
    workers: `${base}/workers/scripts?per_page=1`,
    d1: `${base}/d1/database?per_page=1`,
    pages: `${base}/pages/projects?per_page=1`
  };
  const statuses = {};
  for (const [name, url] of Object.entries(endpoints)) {
    try {
      const response = await fetch(url, { headers: { ...headers, 'Content-Type': 'application/json' } });
      const data = await response.json().catch(() => ({}));
      statuses[name] = response.ok && data.success !== false ? 'ok' : `http_${response.status}`;
    } catch {
      statuses[name] = 'network_error';
    }
  }
  return { ...statuses, ok: statuses.workers === 'ok' && statuses.d1 === 'ok' && statuses.pages === 'ok' };
}

function normalizeToken(value) {
  let v = stripQuotes(String(value).trim());
  v = v.replace(/^Bearer\s+/i, '').trim();
  return stripQuotes(v).replace(/\s+/g, '');
}
function normalizeSimple(value) { return stripQuotes(String(value).trim()).trim(); }
function stripQuotes(value) {
  if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))) return value.slice(1, -1);
  return value;
}
function mask(value) { if (value) console.log(`::add-mask::${value}`); }
function writeEnv(name, value) {
  if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV não disponível');
  appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`, 'utf8');
}
