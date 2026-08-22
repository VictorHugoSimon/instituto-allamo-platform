#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const base = String(args.base || process.env.SALLAMOS_AI_BASE_URL || '').replace(/\/$/, '');
const environment = String(args.env || 'stage').toLowerCase();
if (!base) throw new Error('Smoke test requer --base URL ou SALLAMOS_AI_BASE_URL');
if (!['stage', 'production'].includes(environment)) throw new Error('Ambiente inválido');

console.log(`Smoke test ${environment}: ${base}`);

const live = await get('/health/live');
assert(live.ok === true, 'health/live não retornou ok=true');
assert(String(live.environment || '') === environment, `environment esperado=${environment}, recebido=${live.environment}`);

const readyRes = await fetchJson('/health/ready');
if (environment === 'production') {
  assert(readyRes.status === 200, `produção não está ready (HTTP ${readyRes.status})`);
  assert(readyRes.body.ok === true, 'produção ready=false');
  console.log('PRODUCTION_READINESS_OK');
  process.exit(0);
}

assert(readyRes.status === 200, `stage readiness HTTP ${readyRes.status}`);
assert(readyRes.body.ok === true, 'stage ready=false');

const demoRes = await fetchJson('/api/ai/demo/session', { method: 'POST' });
assert(demoRes.status === 200 && demoRes.body.token, 'sessão demo de stage indisponível');
const token = demoRes.body.token;

const overviewRes = await fetchJson('/api/ai/overview', { headers: { authorization: 'Bearer ' + token } });
assert(overviewRes.status === 200, `overview HTTP ${overviewRes.status}`);
assert(overviewRes.body?.tenant === 'stage-demo-tenant', 'tenant de overview inesperado');

const queryRes = await fetchJson('/api/ai/support/query', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'Onde consigo criar forma de pagamento débito automático e guia?', clientContext: { currentRoute: 'smoke-test' } })
});
assert(queryRes.status === 200, `support/query HTTP ${queryRes.status}`);
assert(['answered','needs_clarification','escalated'].includes(queryRes.body?.status), 'status de resposta inválido');
assert(Number.isFinite(Number(queryRes.body?.confidence)), 'confidence ausente');
if (queryRes.body.status === 'answered') assert((queryRes.body.evidence || []).length > 0, 'resposta sem evidência');

console.log(JSON.stringify({
  smoke: 'ok', environment,
  readiness: readyRes.body,
  supportDecision: queryRes.body.status,
  confidence: queryRes.body.confidence,
  evidence: (queryRes.body.evidence || []).length
}, null, 2));
console.log('STAGE_SMOKE_OK');

async function get(path) {
  const r = await fetchJson(path);
  assert(r.status === 200, `${path} HTTP ${r.status}`);
  return r.body;
}
async function fetchJson(path, init = {}) {
  const res = await fetch(base + path, { ...init, redirect: 'follow' });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}
function assert(condition, message) {
  if (!condition) throw new Error('SMOKE_FAILED: ' + message);
}
