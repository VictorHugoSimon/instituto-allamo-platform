import type { Env, ModelOutput } from '../types';
import { requireSession } from '../auth/session';
import { classify } from '../orchestrator/intent';
import { hybridSearch } from '../retrieval/hybrid';
import { buildSystemPrompt, buildUserPrompt } from '../orchestrator/prompt';
import { computeConfidence, decide, extractSignals } from '../orchestrator/confidence';
import { applyPolicies } from '../orchestrator/policy';
import { callTool } from '../tools/tenant-context';
import { emit } from '../telemetry/events';

export async function handleQuery(req: Request, env: Env) {
  const ctx = await requireSession(req, env);
  const body = (await req.json()) as { conversationId?: string; message: string; clientContext?: any };
  const question = (body.message ?? '').trim();
  if (question.length < 3) return { status: 'invalid', error: 'empty_message' };

  const conversationId = body.conversationId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const responseId = crypto.randomUUID();

  await emit(env, 'ai_question_received', {
    tenant: ctx.tenantId, user: ctx.userId, channel: 'chat',
    route: body.clientContext?.currentRoute, module_hint: body.clientContext?.module
  });

  const intent = await classify(env, question);
  const tenantContext = intent.needsTenantContext
    ? await callTool(env, 'tenant_config', ctx).catch(() => ({ available: false }))
    : {};

  const { hits, trace } = await hybridSearch(env, question, {
    module: intent.module, version: ctx.productVersion
  });

  await emit(env, 'ai_retrieval_completed', {
    query: question, filters: { module: intent.module, version: ctx.productVersion },
    source_types: [...new Set(hits.map(h => h.sourceType))],
    top_scores: hits.slice(0, 3).map(h => h.score), latency: trace.latencyMs
  });

  const out = await generate(env, question, hits, ctx, tenantContext);
  const signals = extractSignals(hits, {
    module: intent.module, version: ctx.productVersion,
    hasTenantContext: Boolean((tenantContext as any).available) || Object.keys(tenantContext).length > 0
  }, out.risk_level ?? intent.riskLevel);

  const confidence = computeConfidence(signals);
  const raw = decide(confidence, Number(env.CONFIDENCE_ANSWER), Number(env.CONFIDENCE_CLARIFY));
  const { decision, reason } = applyPolicies(raw, out, hits.length > 0);

  await persist(env, { conversationId, messageId, responseId, ctx, question, out, confidence, decision, trace, hits });

  await emit(env, 'ai_answer_generated', {
    decision, model: env.ANSWER_MODEL, prompt_version: env.PROMPT_VERSION,
    confidence, risk: out.risk_level, latency: trace.latencyMs, reason
  });

  const evidence = hits.map(h => ({
    type: h.sourceType,
    id: h.documentId,
    version: h.version,
    path: h.path,
    symbol: h.symbol,
    score: Number(h.score.toFixed(3)),
    origin: h.origin
  }));

  if (decision === 'escalate') {
    return {
      status: 'escalated', conversationId, responseId,
      reason: reason ?? 'insufficient_evidence',
      missing_context: out.missing_context ?? [],
      sources: out.sources ?? [],
      evidence,
      confidence,
      diagnostic: {
        question, module: intent.module, confidence,
        sourcesConsulted: hits.map(h => h.documentId),
        attempts: [
          'busca semântica e lexical com filtro de versão ' + ctx.productVersion,
          Object.keys(tenantContext).length ? 'consulta read-only de contexto do tenant' : 'contexto do tenant não disponível'
        ]
      }
    };
  }

  return {
    status: decision === 'clarify' ? 'needs_clarification' : 'answered',
    conversationId, responseId,
    answer: out.answer,
    steps: out.steps ?? [],
    sources: out.sources ?? [],
    evidence,
    confidence,
    missing_context: out.missing_context ?? [],
    feedbackToken: responseId
  };
}

async function generate(env: Env, question: string, hits: any[], ctx: any, tenantContext: any): Promise<ModelOutput> {
  const res = await env.AI.run(env.ANSWER_MODEL, {
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(question, hits, ctx, tenantContext) }
    ],
    max_tokens: 900
  }, { gateway: { id: env.AI_GATEWAY_ID || 'default', skipCache: false } });

  return parseOutput(res.response ?? res.result ?? '');
}

function parseOutput(value: unknown): ModelOutput {
  const fallback: ModelOutput = {
    intent: 'support_unknown', module: '', answer: '', steps: [], sources: [],
    needs_clarification: true, missing_context: ['resposta do modelo ilegível'], risk_level: 'high'
  };
  if (value && typeof value === 'object') return { ...fallback, ...(value as any) };
  const text = String(value ?? '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try { return { ...fallback, ...JSON.parse(match[0]) }; } catch { return fallback; }
}

async function persist(env: Env, p: any) {
  const now = new Date().toISOString();
  await env.META.batch([
    env.META.prepare('INSERT OR IGNORE INTO conversation (id, tenant_id, user_id, channel, started_at, status) VALUES (?,?,?,?,?,?)')
      .bind(p.conversationId, p.ctx.tenantId, p.ctx.userId, 'chat', now, 'open'),
    env.META.prepare('INSERT INTO message (id, conversation_id, role, text, created_at) VALUES (?,?,?,?,?)')
      .bind(p.messageId, p.conversationId, 'user', p.question, now),
    env.META.prepare('INSERT INTO retrieval_trace (id, message_id, query, source_ids, scores, filters, model, latency_ms) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), p.messageId, p.question,
            JSON.stringify(p.hits.map((h: any) => h.documentId)),
            JSON.stringify(p.hits.map((h: any) => h.score)),
            JSON.stringify(p.trace), env.EMBEDDING_MODEL, p.trace.latencyMs),
    env.META.prepare('INSERT INTO ai_response (id, message_id, answer, confidence, decision, sources, risk_level, prompt_version) VALUES (?,?,?,?,?,?,?,?)')
      .bind(p.responseId, p.messageId, p.out.answer ?? '', p.confidence, p.decision,
            JSON.stringify(p.out.sources ?? []), p.out.risk_level ?? 'low', env.PROMPT_VERSION)
  ]);
}
