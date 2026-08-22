#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'eval-data/dataset.jsonl';
const raw = await readFile(path, 'utf8');
const rows = raw.split('\n').map(x => x.trim()).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); }
  catch { throw new Error(`EVAL_GATE: JSON inválido na linha ${index + 1}`); }
});

const errors = [];
if (rows.length < 20) errors.push(`mínimo de 20 casos homologados; atual=${rows.length}`);
if (rows.length > 100) errors.push(`dataset de go-live deve ter no máximo 100 casos; atual=${rows.length}`);

const ids = new Set();
for (const [index, row] of rows.entries()) {
  const pos = index + 1;
  if (!row.id || typeof row.id !== 'string') errors.push(`linha ${pos}: id obrigatório`);
  else if (ids.has(row.id)) errors.push(`linha ${pos}: id duplicado ${row.id}`);
  else ids.add(row.id);

  if (row.dataset_type === 'demo') errors.push(`linha ${pos}/${row.id}: caso demo não pode liberar produção`);
  if (row.approved !== true) errors.push(`linha ${pos}/${row.id}: approved=true obrigatório`);
  if (!row.owner || typeof row.owner !== 'string') errors.push(`linha ${pos}/${row.id}: owner/homologador obrigatório`);
  if (!row.module || typeof row.module !== 'string') errors.push(`linha ${pos}/${row.id}: module obrigatório`);
  if (!row.question || String(row.question).trim().length < 8) errors.push(`linha ${pos}/${row.id}: question inválida`);
  if (!['answer','clarify','escalate'].includes(row.expect_decision)) errors.push(`linha ${pos}/${row.id}: expect_decision inválido`);
  if (row.expect_decision === 'answer' && !row.expected_source) errors.push(`linha ${pos}/${row.id}: expected_source obrigatório para answer`);
  if (row.expect_decision !== 'escalate' && (!row.golden_answer || String(row.golden_answer).trim().length < 10)) errors.push(`linha ${pos}/${row.id}: golden_answer obrigatório para answer/clarify`);
  if (!row.evidence || typeof row.evidence !== 'string') errors.push(`linha ${pos}/${row.id}: evidence deve registrar a referência usada na homologação`);
  if (containsLikelyPII(JSON.stringify(row))) errors.push(`linha ${pos}/${row.id}: possível PII detectada; sanitize antes da homologação`);
}

const modules = new Set(rows.map(x => x.module).filter(Boolean));
const decisions = new Set(rows.map(x => x.expect_decision).filter(Boolean));
if (modules.size < 3) errors.push(`cobertura insuficiente: mínimo 3 módulos; atual=${modules.size}`);
for (const d of ['answer','clarify','escalate']) if (!decisions.has(d)) errors.push(`dataset precisa conter decisão esperada '${d}'`);

if (errors.length) {
  console.error('PRODUCTION EVAL GATE BLOQUEADO');
  for (const e of errors.slice(0, 80)) console.error('- ' + e);
  process.exit(1);
}
console.log(JSON.stringify({ evalGate:'ready', cases:rows.length, modules:modules.size, decisions:[...decisions] }, null, 2));

function containsLikelyPII(value) {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const cpf = /\b(?:\d{3}[.\s-]?){2}\d{3}[-\s]?\d{2}\b/;
  const cnpj = /\b\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[\/]?\d{4}[-\s]?\d{2}\b/;
  return email.test(value) || cpf.test(value) || cnpj.test(value);
}
