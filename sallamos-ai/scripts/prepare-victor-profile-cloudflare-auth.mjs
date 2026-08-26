#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

const token = normalizeToken(process.env.CLOUDFLARE_API_TOKEN || '');
const apiKey = normalizeSimple(process.env.CLOUDFLARE_API_KEY || '').replace(/\s+/g, '');
const email = normalizeSimple(process.env.CLOUDFLARE_EMAIL || '');
const accountId = normalizeSimple(process.env.CLOUDFLARE_ACCOUNT_ID || '');

if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID ausente no repositório host.');
mask(token); mask(apiKey); mask(email);

const candidates = [];
// Para esta ponte operacional, preferimos a Global API Key já autorizada quando disponível,
// pois o API Token histórico pode autenticar no whoami sem possuir D1/Pages Edit.
if (apiKey && email) candidates.push({ mode: 'api_key_email', token: '', apiKey, email });
if (token) candidates.push({ mode: 'api_token', token, apiKey: '', email: '' });
if (!candidates.length) throw new Error('Nenhuma credencial Cloudflare disponível no repositório host.');

let selected = null;
for (const candidate of candidates) {
  const probe = await probeCandidate(candidate);
  console.log(`[profile-cloudflare-auth] ${candidate.mode}: workers=${probe.workers}, d1=${probe.d1}, pages=${probe.pages}`);
  if (probe.ok) { selected = candidate; break; }
}
if (!selected) {
  throw new Error('As credenciais Cloudflare existentes autenticam, mas nenhuma possui acesso de leitura simultâneo a Workers, D1 e Pages nesta conta.');
}

writeEnv('CLOUDFLARE_API_TOKEN', selected.token);
writeEnv('CLOUDFLARE_API_KEY', selected.apiKey);
writeEnv('CLOUDFLARE_EMAIL', selected.email);
writeEnv('CLOUDFLARE_ACCOUNT_ID', accountId);
writeEnv('PROFILE_CF_AUTH_MODE', selected.mode);
console.log(`[profile-cloudflare-auth] modo selecionado: ${selected.mode}. Valores permanecem mascarados.`);

async function probeCandidate(candidate) {
  const headers = candidate.mode === 'api_token'
    ? { Authorization: `Bearer ${candidate.token}` }
    : { 'X-Auth-Email': candidate.email, 'X-Auth-Key': candidate.apiKey };
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const endpoints = {
    workers: `${base}/workers/scripts?per_page=1`,
    d1: `${base}/d1/database?per_page=1`,
    pages: `${base}/pages/projects?per_page=1`
  };
  const result = {};
  for (const [name, url] of Object.entries(endpoints)) {
    try {
      const response = await fetch(url, { headers: { ...headers, 'Content-Type': 'application/json' } });
      const data = await response.json().catch(() => ({}));
      result[name] = response.ok && data.success !== false ? 'ok' : `http_${response.status}`;
    } catch {
      result[name] = 'network_error';
    }
  }
  result.ok = result.workers === 'ok' && result.d1 === 'ok' && result.pages === 'ok';
  return result;
}

function normalizeToken(value) {
  let result = stripQuotes(String(value).trim()).replace(/^Bearer\s+/i, '').trim();
  return stripQuotes(result).replace(/\s+/g, '');
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
