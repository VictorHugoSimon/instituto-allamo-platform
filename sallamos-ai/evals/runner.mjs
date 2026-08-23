#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const args = parseArgs(process.argv.slice(2));
const base = String(args.base ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const datasetPath = args.dataset ?? 'eval-data/dataset.jsonl';
const dataset = (await readFile(datasetPath, 'utf8')).split('\n').map(x => x.trim()).filter(Boolean).map(l => JSON.parse(l));
const results = [];
let token = String(args.token ?? '');

if (!token && truthy(args['auto-token'])) {
  const demo = await fetchJson(base + '/api/ai/demo/session', { method: 'POST' });
  if (demo.status !== 200 || !demo.body?.token) throw new Error('EVAL_GATE: não foi possível obter sessão controlada de STAGE');
  token = String(demo.body.token);
}
if (!token) throw new Error('EVAL_GATE: informe --token ou --auto-token true');

for (const c of dataset) {
  const started = Date.now();
  let out = {};
  let httpStatus = 0;
  let error = null;
  try {
    const res = await fetch(base + '/api/ai/support/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ message: c.question, clientContext: { module: c.module, currentRoute: 'production-eval' } })
    });
    httpStatus = res.status;
    out = await res.json().catch(() => ({}));
    if (!res.ok) error = `HTTP_${res.status}`;
  } catch (e) { error = e?.message ?? String(e); }

  const decision = out.status === 'answered' ? 'answer' : out.status === 'needs_clarification' ? 'clarify' : 'escalate';
  const evidenceIds = (out.evidence ?? []).map(e => String(e.id ?? ''));
  const sourceIds = (out.sources ?? []).map(s => typeof s === 'string' ? s : `${s.type ?? ''}:${s.id ?? ''}`);
  const retrieved = [...evidenceIds, ...sourceIds];
  const terms = Array.isArray(c.must_contain) ? c.must_contain.map(String).filter(Boolean) : [];
  const answerText = normalize([out.answer, ...(out.steps ?? [])].filter(Boolean).join(' '));
  const missingTerms = terms.filter(t => !answerText.includes(normalize(t)));
  const expectedEscalation = c.expect_decision === 'escalate';

  results.push({
    id: c.id,
    module: c.module,
    httpStatus,
    error,
    expectedDecision: c.expect_decision,
    actualDecision: decision,
    decisionOk: !error && decision === c.expect_decision,
    retrievalOk: !error && (!c.expected_source || retrieved.some(s => s.includes(String(c.expected_source)))),
    grounded: !error && (decision !== 'answer' || retrieved.length > 0),
    termsOk: !error && (decision !== 'answer' || !terms.length || missingTerms.length === 0),
    expectedEscalation,
    latency: Date.now() - started,
    confidence: Number.isFinite(Number(out.confidence)) ? Number(out.confidence) : null,
    evidenceCount: (out.evidence ?? []).length,
    missingTerms
  });
}

const rate = key => results.filter(r => r[key]).length / Math.max(1, results.length);
const esc = results.filter(r => r.expectedEscalation);
const escalationRecall = esc.filter(r => r.decisionOk).length / Math.max(1, esc.length);
const sorted = results.map(r => r.latency).sort((a,b) => a-b);
const p95 = sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0;
const summary = {
  cases: results.length,
  decisionAccuracy: round(rate('decisionOk')),
  retrievalHitRate: round(rate('retrievalOk')),
  groundedness: round(rate('grounded')),
  answerTermsAccuracy: round(rate('termsOk')),
  escalationRecall: round(escalationRecall),
  p95LatencyMs: p95,
  errors: results.filter(r => r.error).length
};
console.table(summary);

const gates = {
  decision: Number(args['decision-gate'] ?? 0.90),
  retrieval: Number(args['retrieval-gate'] ?? 0.85),
  terms: Number(args['terms-gate'] ?? 0.90),
  escalation: Number(args['escalation-gate'] ?? 1.00),
  groundedness: 1.00,
  maxP95: Number(args['max-p95'] ?? 12000)
};
const failures = [];
if (summary.decisionAccuracy < gates.decision) failures.push(`decision ${summary.decisionAccuracy} < ${gates.decision}`);
if (summary.retrievalHitRate < gates.retrieval) failures.push(`retrieval ${summary.retrievalHitRate} < ${gates.retrieval}`);
if (summary.answerTermsAccuracy < gates.terms) failures.push(`terms ${summary.answerTermsAccuracy} < ${gates.terms}`);
if (summary.escalationRecall < gates.escalation) failures.push(`escalation ${summary.escalationRecall} < ${gates.escalation}`);
if (summary.groundedness < 1) failures.push(`groundedness ${summary.groundedness} < 1`);
if (summary.p95LatencyMs > gates.maxP95) failures.push(`p95 ${summary.p95LatencyMs}ms > ${gates.maxP95}ms`);
if (summary.errors > 0) failures.push(`${summary.errors} erro(s) HTTP/rede`);

const report = { generatedAt: new Date().toISOString(), base, dataset: datasetPath, summary, gates, pass: failures.length === 0, failures, results };
if (args.output) await writeFile(String(args.output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ qualityGate: report.pass ? 'PASS' : 'BLOCKED', ...summary, failures }, null, 2));
if (failures.length) process.exit(1);

function parseArgs(argv) { const out = {}; for (let i=0;i<argv.length;i++) { const x=argv[i]; if (!x.startsWith('--')) continue; const k=x.slice(2); const n=argv[i+1]; out[k]=n && !n.startsWith('--') ? argv[++i] : true; } return out; }
function truthy(v) { return ['1','true','yes','sim'].includes(String(v ?? '').toLowerCase()); }
function normalize(v) { return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
function round(v) { return Number(v.toFixed(4)); }
async function fetchJson(url, init) { const res=await fetch(url,init); return { status:res.status, body:await res.json().catch(()=>({})) }; }
