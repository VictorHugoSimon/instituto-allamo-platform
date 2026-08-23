#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

const rawToken = String(process.env.CLOUDFLARE_API_TOKEN ?? '');
const rawKey = String(process.env.CLOUDFLARE_API_KEY ?? '');
const rawEmail = String(process.env.CLOUDFLARE_EMAIL ?? '');
const accountId = normalizeSimple(process.env.CLOUDFLARE_ACCOUNT_ID ?? '');

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

let authMode = '';
if (token && tokenLooksLegacyKey) {
  // Um Global API Key legado é hex/32 e não funciona no header Bearer esperado por CLOUDFLARE_API_TOKEN.
  if (email) {
    apiKey = apiKey || token;
    token = '';
    authMode = 'api_key_email';
  } else {
    throw new Error('CLOUDFLARE_API_TOKEN tem formato hex de 32 caracteres e foi rejeitado como Bearer. Provável Global API Key: mova-o para CLOUDFLARE_API_KEY e configure CLOUDFLARE_EMAIL, ou substitua por um API Token moderno.');
  }
} else if (token) {
  authMode = 'api_token';
} else if (explicitLegacyReady) {
  authMode = 'api_key_email';
} else {
  throw new Error('Credencial Cloudflare incompleta: configure CLOUDFLARE_API_TOKEN ou o par CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL.');
}

if (authMode === 'api_token') {
  if (token.length < 20) throw new Error('CLOUDFLARE_API_TOKEN parece inválido: comprimento insuficiente');
  mask(token);
  writeEnv('CLOUDFLARE_API_TOKEN', token);
  writeEnv('CLOUDFLARE_API_KEY', '');
  writeEnv('CLOUDFLARE_EMAIL', '');
} else {
  if (!apiKey || !email) throw new Error('Global API Key requer CLOUDFLARE_API_KEY e CLOUDFLARE_EMAIL');
  mask(apiKey); mask(email);
  writeEnv('CLOUDFLARE_API_TOKEN', '');
  writeEnv('CLOUDFLARE_API_KEY', apiKey);
  writeEnv('CLOUDFLARE_EMAIL', email);
}

console.log(JSON.stringify({
  cloudflareAuthPreparation: 'ok',
  authMode,
  accountIdLength: accountId.length,
  tokenProvided: Boolean(rawToken.trim()),
  tokenLength: token ? token.length : null,
  tokenLooksLegacyKey,
  tokenEqualsAccountId,
  apiKeyProvided: Boolean(rawKey.trim()),
  emailProvided: Boolean(rawEmail.trim())
}, null, 2));

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
