import type { Env } from '../types';
import { requireSession } from '../auth/session';
import { emit } from '../telemetry/events';

export async function handleEscalation(req: Request, env: Env) {
  const ctx = await requireSession(req, env);
  const body = (await req.json()) as { conversationId: string; reason: string; diagnostic: unknown };

  const id = 'ESC-' + Date.now().toString(36).toUpperCase();

  await env.META.prepare(
    'INSERT INTO escalation (id, conversation_id, reason, diagnostic_payload, status, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(id, body.conversationId, body.reason,
         JSON.stringify(body.diagnostic ?? {}), 'aguardando', new Date().toISOString()).run();

  await emit(env, 'ai_escalated', {
    reason: body.reason, tenant: ctx.tenantId, target_queue: 'suporte-n1'
  });

  return { status: 'escalated', escalationId: id };
}
