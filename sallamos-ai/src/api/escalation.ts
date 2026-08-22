import type { Env } from '../types';
import { HttpError, requirePermission, requireSession } from '../auth/session';
import { emit } from '../telemetry/events';

export async function handleEscalation(req: Request, env: Env) {
  const ctx = await requireSession(req, env); requirePermission(ctx, 'ai:escalation:create');
  const body = (await req.json()) as { conversationId: string; reason: string; diagnostic: unknown };
  if (!body.conversationId) throw new HttpError(400, 'conversation_id_required');
  const owned: any = await env.META.prepare('SELECT id FROM conversation WHERE id=? AND tenant_id=? LIMIT 1').bind(body.conversationId, ctx.tenantId).first();
  if (!owned) throw new HttpError(404, 'conversation_not_found');
  const id = 'ESC-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const reason = String(body.reason ?? 'insufficient_evidence').slice(0, 120);
  const diagnostic = JSON.stringify(body.diagnostic ?? {}).slice(0, 20000);
  await env.META.prepare('INSERT INTO escalation (id, conversation_id, reason, diagnostic_payload, status, created_at) VALUES (?,?,?,?,?,?)').bind(id, body.conversationId, reason, diagnostic, 'aguardando', new Date().toISOString()).run();
  await emit(env, 'ai_escalated', { reason, tenant: ctx.tenantId, target_queue: 'suporte-n1' });
  return { status: 'escalated', escalationId: id };
}
