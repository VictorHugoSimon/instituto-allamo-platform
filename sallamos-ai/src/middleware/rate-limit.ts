import type { Env } from '../types';
import { HttpError } from '../auth/session';

export async function enforceRateLimit(env: Env, identity: string, scope = 'api') {
  const key = scope + ':' + identity;

  // Produção/stage na Cloudflare: contador distribuído na infraestrutura nativa.
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key });
    if (!success) throw new HttpError(429, 'rate_limited');
    return;
  }

  // Fallback somente para testes locais onde o binding nativo não estiver disponível.
  const limit = Math.max(1, Number(env.RATE_LIMIT_PER_MINUTE ?? 60));
  const bucket = new Date().toISOString().slice(0, 16);
  const keyHash = await sha256(key);
  const now = new Date().toISOString();
  const row: any = await env.META.prepare(
    `INSERT INTO rate_limit_bucket (bucket, key_hash, count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(bucket, key_hash)
     DO UPDATE SET count = count + 1, updated_at = excluded.updated_at
     RETURNING count`
  ).bind(bucket, keyHash, now).first();
  if (Number(row?.count ?? 1) > limit) throw new HttpError(429, 'rate_limited');
}

export async function cleanupRateLimits(env: Env) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  await env.META.prepare('DELETE FROM rate_limit_bucket WHERE updated_at < ?').bind(cutoff).run();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
