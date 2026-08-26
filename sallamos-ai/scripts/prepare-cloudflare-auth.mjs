#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const rawToken = String(process.env.CLOUDFLARE_API_TOKEN ?? '');
const rawKey = String(process.env.CLOUDFLARE_API_KEY ?? '');
const rawEmail = String(process.env.CLOUDFLARE_EMAIL ?? '');
const accountId = normalizeSimple(process.env.CLOUDFLARE_ACCOUNT_ID ?? '');
const workflowName = String(process.env.GITHUB_WORKFLOW ?? '');
const verifyOnline = String(process.env.CLOUDFLARE_AUTH_VERIFY ?? '') === '1' || /^Release (?:STAGE|PRODUCTION)\b/i.test(workflowName);

let token = normalizeToken(rawToken);
let apiKey = normalizeSimple(rawKey).replace(/\s+/g, '');
let email = stripQuotes(String(rawEmail).trim()).trim();

if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID ausente');

const tokenEqualsAccountId = Boolean(token && token === accountId);
const tokenLooksLegacyKey = /^[a-f0-9]{32}$/i.test(token);
const explicitLegacyReady = Boolean(apiKey && email);

if (tokenEqualsAccountId) {
  if (!explicitLegacyReady) {
    throw new Error('CLOUDFLARE_API_TOKEN é igual ao CLOUDFLARE_ACCOUNT_ID. Cadastre um API Token real ou CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL.');
  }
  token = '';
}
if (tokenLooksLegacyKey) {
  if (email) {
    apiKey = apiKey || token;
    token = '';
  } else {
    throw new Error('CLOUDFLARE_API_TOKEN tem formato hex de 32 caracteres e foi rejeitado como Bearer. Provável Global API Key: mova-o para CLOUDFLARE_API_KEY e configure CLOUDFLARE_EMAIL, ou substitua por um API Token moderno.');
  }
}

mask(token);
mask(apiKey);
mask(email);

// Nesta branch operacional, a Global API Key existente é preferida porque um API Token
// pode autenticar no whoami e ainda assim não possuir D1/Pages Edit. Os valores nunca são impressos.
const candidates = [];
if (apiKey && email) {
  candidates.push({ mode: 'api_key_email', env: { CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_API_KEY: apiKey, CLOUDFLARE_EMAIL: email } });
}
if (token) {
  if (token.length < 20) throw new Error('CLOUDFLARE_API_TOKEN parece inválido: comprimento insuficiente');
  candidates.push({ mode: 'api_token', env: { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_API_KEY: '', CLOUDFLARE_EMAIL: '' } });
}
if (!candidates.length) {
  throw new Error('Credencial Cloudflare incompleta: configure CLOUDFLARE_API_TOKEN ou o par CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL.');
}

let selected = candidates[0];
if (verifyOnline) {
  selected = null;
  for (const candidate of candidates) {
    const check = verifyWrangler(candidate.env);
    if (!check.ok) {
      console.warn(`[cloudflare-auth] ${candidate.mode} não autenticou no Wrangler; tentando próximo modo.`);
      continue;
    }
    const access = await verifyResourceAccess(candidate.env);
    console.log(`[cloudflare-auth] ${candidate.mode}: workers=${access.workers}, d1=${access.d1}, pages=${access.pages}`);
    if (access.ok) { selected = candidate; break; }
    console.warn(`[cloudflare-auth] ${candidate.mode} autenticou, mas não tem acesso simultâneo a Workers, D1 e Pages; tentando próximo modo.`);
  }
  if (!selected) {
    throw new Error('Nenhuma credencial Cloudflare existente possui acesso simultâneo a Workers, D1 e Pages nesta conta.');
  }
}

writeEnv('CLOUDFLARE_API_TOKEN', selected.env.CLOUDFLARE_API_TOKEN);
writeEnv('CLOUDFLARE_API_KEY', selected.env.CLOUDFLARE_API_KEY);
writeEnv('CLOUDFLARE_EMAIL', selected.env.CLOUDFLARE_EMAIL);
writeEnv('CLOUDFLARE_ACCOUNT_ID', accountId);

console.log(JSON.stringify({
  cloudflareAuthPreparation: 'ok',
  authMode: selected.mode,
  verifiedWithWrangler: verifyOnline,
  resourceAccessVerified: verifyOnline,
  accountIdLength: accountId.length,
  tokenProvided: Boolean(rawToken.trim()),
  tokenLength: selected.mode === 'api_token' ? token.length : null,
  tokenLooksLegacyKey,
  tokenEqualsAccountId,
  apiKeyProvided: Boolean(rawKey.trim()),
  emailProvided: Boolean(rawEmail.trim()),
  fallbackSupported: true
}, null, 2));

function verifyWrangler(authEnv) {
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(cmd, ['--yes', 'wrangler@4.124.0', 'whoami'], {
    cwd: process.cwd(), encoding: 'utf8', shell: false, windowsHide: true,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, ...authEnv }
  });
  return { ok: !result.error && result.status === 0 };
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
  v = stripQuotes(v).replace(/\s+/g, '');
  return v;
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
