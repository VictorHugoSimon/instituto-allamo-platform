#!/usr/bin/env node
import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const csvPath = String(args.csv ?? args._?.[0] ?? '').trim();
const output = String(args.output ?? 'eval-data/dataset.generated.jsonl').trim();
if (!csvPath) throw new Error('DATASET_BUILD: uso node scripts/build-production-dataset.mjs --csv <arquivo.csv> [--output eval-data/dataset.generated.jsonl]');

const csv = (await readFile(csvPath, 'utf8')).replace(/^\uFEFF/, '');
const table = parseCsv(csv);
if (table.length < 2) throw new Error('DATASET_BUILD: CSV vazio ou sem linhas de dados');

const headers = table[0].map(normalizeHeader);
const rows = table.slice(1).filter(r => r.some(v => String(v ?? '').trim()));
const get = (row, name) => String(row[headers.indexOf(normalizeHeader(name))] ?? '').trim();
for (const required of ['ID','Módulo','Pergunta candidata','Status revisão','Homologador','Decisão esperada','ID/Fonte homologada','Golden answer','Termos obrigatórios','Evidência homologação','Aprovado?']) {
  if (!headers.includes(normalizeHeader(required))) throw new Error(`DATASET_BUILD: coluna obrigatória ausente: ${required}`);
}

const errors = [];
const selected = [];
for (const [index, row] of rows.entries()) {
  const line = index + 2;
  const approved = yes(get(row, 'Aprovado?'));
  const status = normalize(get(row, 'Status revisão'));
  if (!approved) continue;
  if (status !== 'homologado') { errors.push(`linha ${line}: Aprovado=SIM exige Status revisão=homologado`); continue; }

  const candidateId = get(row, 'ID');
  const module = get(row, 'Módulo');
  const question = get(row, 'Pergunta candidata');
  const owner = get(row, 'Homologador');
  const decision = normalize(get(row, 'Decisão esperada'));
  const expectedSource = get(row, 'ID/Fonte homologada');
  const golden = get(row, 'Golden answer');
  const terms = splitTerms(get(row, 'Termos obrigatórios'));
  const evidence = get(row, 'Evidência homologação');

  if (!candidateId || !module || !question || !owner || !evidence) errors.push(`linha ${line}: ID, módulo, pergunta, homologador e evidência são obrigatórios`);
  if (!['answer','clarify','escalate'].includes(decision)) errors.push(`linha ${line}/${candidateId}: decisão deve ser answer, clarify ou escalate`);
  if (decision === 'answer' && !expectedSource) errors.push(`linha ${line}/${candidateId}: ID/Fonte homologada obrigatório para answer`);
  if (decision !== 'escalate' && golden.length < 10) errors.push(`linha ${line}/${candidateId}: Golden answer obrigatório para answer/clarify`);
  if (decision === 'answer' && (terms.length < 1 || terms.length > 8)) errors.push(`linha ${line}/${candidateId}: Termos obrigatórios deve conter 1..8 itens`);

  const productionId = candidateId.startsWith('cand-') ? 'prod-' + candidateId.slice(5) : 'prod-' + candidateId;
  const item = {
    id: productionId,
    dataset_type: 'production-real',
    approved: true,
    owner,
    module,
    question,
    expect_decision: decision,
    expected_source: decision === 'answer' ? expectedSource : null,
    golden_answer: decision === 'escalate' ? null : golden,
    must_contain: decision === 'answer' ? terms : [],
    evidence
  };
  if (containsLikelyPII(JSON.stringify(item))) errors.push(`linha ${line}/${candidateId}: possível PII detectada; sanitize a planilha antes da promoção`);
  selected.push(item);
}

if (errors.length) {
  console.error('DATASET BUILD BLOQUEADO');
  errors.slice(0, 100).forEach(e => console.error('- ' + e));
  process.exit(1);
}
if (!selected.length) throw new Error('DATASET_BUILD: nenhum caso com Aprovado?=SIM e status homologado');

await mkdir(dirname(output), { recursive: true });
const temp = output + '.tmp';
await writeFile(temp, selected.map(x => JSON.stringify(x)).join('\n') + '\n', 'utf8');

const validation = spawnSync(process.execPath, ['scripts/validate-eval-readiness.mjs', temp], { stdio: 'inherit' });
if (validation.status !== 0) {
  await unlink(temp).catch(() => {});
  console.error('DATASET_BUILD: arquivo final não foi alterado porque o gate estrutural falhou.');
  process.exit(validation.status ?? 1);
}
await rename(temp, output);
console.log(JSON.stringify({ datasetBuild: 'ready', sourceCsv: csvPath, output, cases: selected.length }, null, 2));

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith('--')) { out._.push(value); continue; }
    const key = value.slice(2); const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? argv[++i] : true;
  }
  return out;
}
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; continue; }
      if (ch === '"') { quoted = false; continue; }
      field += ch; continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (quoted) throw new Error('DATASET_BUILD: CSV com aspas não fechadas');
  return rows;
}
function normalizeHeader(v) { return normalize(v).replace(/[^a-z0-9]+/g, ' ').trim(); }
function normalize(v) { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function yes(v) { return ['sim','yes','true','1'].includes(normalize(v)); }
function splitTerms(v) { return String(v ?? '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean).slice(0, 20); }
function containsLikelyPII(value) {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const cpf = /\b(?:\d{3}[.\s-]?){2}\d{3}[-\s]?\d{2}\b/;
  const cnpj = /\b\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[\/]?\d{4}[-\s]?\d{2}\b/;
  const phone = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/;
  return email.test(value) || cpf.test(value) || cnpj.test(value) || phone.test(value);
}
