import type { Env } from '../types';
import { requireSession } from '../auth/session';
import { emit } from '../telemetry/events';

export async function handleFeedback(req: Request, env: Env, path: string) {
  await requireSession(req, env);
  const body = (await req.json()) as { responseId: string; solved: boolean; rating?: number; comment?: string };

  await env.META.prepare(
    'INSERT INTO feedback (id, response_id, solved, rating, comment, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(), body.responseId, body.solved ? 1 : 0,
         body.rating ?? null, body.comment ?? null, new Date().toISOString()).run();

  await emit(env, 'ai_feedback_received', {
    solved: body.solved, rating: body.rating ?? null, reason: body.comment ?? null
  });

  if (!body.solved) await emit(env, 'knowledge_gap_detected', { response: body.responseId });

  return { status: 'recorded' };
}
