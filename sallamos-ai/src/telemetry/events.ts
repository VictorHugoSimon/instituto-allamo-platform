import type { Env } from '../types';

export type EventName =
  | 'ai_question_received' | 'ai_retrieval_completed' | 'ai_answer_generated'
  | 'ai_answer_shown' | 'ai_feedback_received' | 'ai_escalated'
  | 'ai_human_resolved' | 'knowledge_gap_detected' | 'voice_session_completed';

const PERSIST = new Set<EventName>([
  'ai_feedback_received', 'ai_escalated', 'ai_human_resolved',
  'knowledge_gap_detected', 'voice_session_completed'
]);

export async function emit(env: Env, name: EventName, payload: Record<string, unknown>) {
  const safe = redact(payload);
  const record = {
    event: name,
    at: new Date().toISOString(),
    environment: env.ENVIRONMENT,
    prompt_version: env.PROMPT_VERSION,
    ...safe
  };
  console.log(JSON.stringify(record));

  if (!PERSIST.has(name)) return;
  try {
    await env.META.prepare(
      'INSERT INTO system_event (id, environment, event_type, tenant_id, user_id, request_id, payload, created_at) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(
      crypto.randomUUID(), env.ENVIRONMENT, name,
      stringOrNull(safe.tenant), stringOrNull(safe.user), stringOrNull(safe.request_id),
      JSON.stringify(safe).slice(0, 12000), record.at
    ).run();
  } catch (error) {
    console.error(JSON.stringify({ event: 'telemetry_persist_failed', type: name, error: String(error) }));
  }
}

function redact(value: unknown): any {
  const blocked = /(password|senha|secret|token|authorization|cookie|cpf|cnpj|email|telefone|phone|conta|account_number|chave|api[_-]?key)/i;
  if (Array.isArray(value)) return value.slice(0, 30).map(redact);
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 2000) : value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.test(key)) { out[key] = '[REDACTED]'; continue; }
    out[key] = redact(child);
  }
  return out;
}
function stringOrNull(value: unknown) { return value == null ? null : String(value).slice(0, 200); }
