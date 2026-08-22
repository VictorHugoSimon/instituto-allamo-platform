import type { Env } from '../types';

export async function cleanupRetention(env: Env) {
  const dataDays = boundedDays(env.DATA_RETENTION_DAYS, env.ENVIRONMENT === 'production' ? 90 : 14);
  const eventDays = boundedDays(env.EVENT_RETENTION_DAYS, env.ENVIRONMENT === 'production' ? 180 : 30);
  const dataCutoff = isoDaysAgo(dataDays);
  const eventCutoff = isoDaysAgo(eventDays);

  const protectedConversations = `SELECT conversation_id FROM escalation WHERE status NOT IN ('resolved','fechado','closed')`;

  const results = await env.META.batch([
    env.META.prepare(`DELETE FROM feedback WHERE response_id IN (SELECT ar.id FROM ai_response ar JOIN message m ON m.id=ar.message_id WHERE m.created_at < ? AND m.conversation_id NOT IN (${protectedConversations}))`).bind(dataCutoff),
    env.META.prepare(`DELETE FROM retrieval_trace WHERE message_id IN (SELECT id FROM message WHERE created_at < ? AND conversation_id NOT IN (${protectedConversations}))`).bind(dataCutoff),
    env.META.prepare(`DELETE FROM ai_response WHERE message_id IN (SELECT id FROM message WHERE created_at < ? AND conversation_id NOT IN (${protectedConversations}))`).bind(dataCutoff),
    env.META.prepare(`DELETE FROM message WHERE created_at < ? AND conversation_id NOT IN (${protectedConversations})`).bind(dataCutoff),
    env.META.prepare(`DELETE FROM conversation WHERE started_at < ? AND id NOT IN (${protectedConversations}) AND id NOT IN (SELECT DISTINCT conversation_id FROM message)`).bind(dataCutoff),
    env.META.prepare('DELETE FROM system_event WHERE created_at < ?').bind(eventCutoff)
  ]);

  return { dataRetentionDays: dataDays, eventRetentionDays: eventDays, batches: results.length };
}

function boundedDays(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(730, Math.floor(n))) : fallback;
}
function isoDaysAgo(days: number) { return new Date(Date.now() - days * 86400000).toISOString(); }
