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

const candidates = [];
if (token) {
  if (token.length < 20) throw new Error('CLOUDFLARE_API_TOKEN parece inválido: comprimento insuficiente');
  candidates.push({ mode: 'api_token', env: { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_API_KEY: '', CLOUDFLARE_EMAIL: '' } });
}
if (apiKey && email) {
  candidates.push({ mode: 'api_key_email', env: { CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_API_KEY: apiKey, CLOUDFLARE_EMAIL: email } });
}
if (!candidates.length) {
  throw new Error('Credencial Cloudflare incompleta: configure CLOUDFLARE_API_TOKEN ou o par CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL.');
}

let selected = candidates[0];
if (verifyOnline) {
  selected = null;
  for (const candidate of candidates) {
    const check = verifyWrangler(candidate.env);
    if (check.ok) { selected = candidate; break; }
    console.warn(`[cloudflare-auth] ${candidate.mode} não autenticou; tentando próximo modo disponível.`);
  }
  if (!selected) {
    throw new Error('Nenhuma credencial Cloudflare configurada autenticou no Wrangler. Atualize os GitHub Secrets antes do deploy.');
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
