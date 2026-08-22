#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

const raw = String(process.env.CLOUDFLARE_API_TOKEN ?? '');
if (!raw.trim()) throw new Error('CLOUDFLARE_API_TOKEN ausente');

const originalLength = raw.length;
const hadWhitespace = /\s/.test(raw);
let value = raw.trim();
let hadWrappingQuotes = false;
let hadBearerPrefix = false;

function stripWrappingQuotes(input) {
  const first = input[0], last = input[input.length - 1];
  if (input.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    hadWrappingQuotes = true;
    return input.slice(1, -1).trim();
  }
  return input;
}

value = stripWrappingQuotes(value);
if (/^Bearer\s+/i.test(value)) {
  hadBearerPrefix = true;
  value = value.replace(/^Bearer\s+/i, '').trim();
}
value = stripWrappingQuotes(value);

// Cloudflare API tokens não devem conter espaços/quebras de linha.
value = value.replace(/\s+/g, '');

if (!value) throw new Error('CLOUDFLARE_API_TOKEN ficou vazio após normalização');
if (value.length < 20) throw new Error('CLOUDFLARE_API_TOKEN parece inválido: comprimento insuficiente após normalização');

// Mascara o valor normalizado antes de qualquer uso subsequente.
console.log(`::add-mask::${value}`);

const githubEnv = process.env.GITHUB_ENV;
if (!githubEnv) throw new Error('GITHUB_ENV não disponível');
appendFileSync(githubEnv, `CLOUDFLARE_API_TOKEN=${value}\n`, { encoding: 'utf8' });

console.log(JSON.stringify({
  cloudflareTokenNormalization: 'ok',
  originalLength,
  normalizedLength: value.length,
  hadBearerPrefix,
  hadWrappingQuotes,
  hadWhitespace
}, null, 2));
