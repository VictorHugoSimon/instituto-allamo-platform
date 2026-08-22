import type { Env } from './types';
import { handleQuery } from './api/support';
import { handleFeedback } from './api/feedback';
import { handleEscalation } from './api/escalation';
import { handleDemoSession } from './api/demo';
import { handleOverview, handleKnowledge, handleEscalationsList, handleInsights } from './api/dashboard';
import { embedPending } from './ingestion/embed-pending';
import { cleanupRateLimits } from './middleware/rate-limit';
import { HttpError } from './auth/session';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const requestId = req.headers.get('cf-ray') ?? crypto.randomUUID();
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'OPTIONS') return withHeaders(new Response(null, { status: 204 }), req, env, requestId);

    try {
      if (path === '/health' || path === '/health/live') {
        return respond({ ok: true, service: 'sallamos-ai', environment: env.ENVIRONMENT, authMode: env.AUTH_MODE, prompt: env.PROMPT_VERSION, demo: env.DEMO_MODE === 'true' }, 200, req, env, requestId);
      }
      if (path === '/health/ready') {
        const ready = await readiness(env);
        return respond(ready, ready.ok ? 200 : 503, req, env, requestId);
      }

      if (req.method === 'POST' && path === '/api/ai/demo/session') {
        const result: any = await handleDemoSession(env);
        return respond(result, result.error ? 404 : 200, req, env, requestId);
      }

      if (req.method === 'POST' && path === '/api/ai/support/query') {
        const result: any = await handleQuery(req, env);
        return respond(result, result?.status === 'invalid' ? 400 : 200, req, env, requestId);
      }
      if (req.method === 'POST' && path.startsWith('/api/ai/conversations/') && path.endsWith('/feedback')) return respond(await handleFeedback(req, env, path), 200, req, env, requestId);
      if (req.method === 'POST' && path === '/api/ai/escalations') return respond(await handleEscalation(req, env), 200, req, env, requestId);
      if (req.method === 'GET' && path === '/api/ai/escalations') return respond(await handleEscalationsList(req, env), 200, req, env, requestId);
      if (req.method === 'GET' && path === '/api/ai/overview') return respond(await handleOverview(req, env), 200, req, env, requestId);
      if (req.method === 'GET' && path === '/api/ai/knowledge') return respond(await handleKnowledge(req, env), 200, req, env, requestId);
      if (req.method === 'GET' && path === '/api/ai/insights') return respond(await handleInsights(req, env), 200, req, env, requestId);

      if (req.method === 'POST' && path === '/api/ai/admin/reindex') {
        const auth = req.headers.get('authorization') ?? '';
        if (!env.ADMIN_TOKEN || auth !== 'Bearer ' + env.ADMIN_TOKEN) return respond({ error: 'forbidden' }, 403, req, env, requestId);
        return respond(await embedPending(env), 200, req, env, requestId);
      }

      return respond({ error: 'not_found' }, 404, req, env, requestId);
    } catch (err: any) {
      if (err instanceof HttpError) return respond({ error: err.message }, err.status, req, env, requestId);
      console.error(JSON.stringify({ event: 'unhandled', requestId, environment: env.ENVIRONMENT, error: err?.stack ?? String(err) }));
      return respond({ error: 'internal_error' }, 500, req, env, requestId);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    let guard = 0;
    let result = await embedPending(env);
    while (!result.done && guard++ < 20) result = await embedPending(env);
    await cleanupRateLimits(env);
  }
};

async function readiness(env: Env) {
  const checks: Record<string, boolean> = { database: false, auth: true, knowledge: true };
  let documents = 0;
  try {
    await env.META.prepare('SELECT 1 AS ok').first();
    checks.database = true;
    const row: any = await env.META.prepare("SELECT COUNT(*) AS total FROM knowledge_document WHERE status='homologado'").first();
    documents = Number(row?.total ?? 0);
  } catch {}

  if (env.ENVIRONMENT === 'production') {
    checks.auth = env.AUTH_MODE === 'external' && Boolean((env.SALLAMOS_AUTH_VALIDATE_URL ?? '').trim());
    checks.knowledge = documents > 0;
  }

  return { ok: Object.values(checks).every(Boolean), environment: env.ENVIRONMENT, checks, homologatedDocuments: documents };
}

function respond(data: unknown, status: number, req: Request, env: Env, requestId: string) {
  const res = new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  return withHeaders(res, req, env, requestId);
}

function withHeaders(res: Response, req: Request, env: Env, requestId: string) {
  const h = new Headers(res.headers);
  h.set('x-request-id', requestId);
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'no-referrer');
  h.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  h.set('content-security-policy', "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'");

  const origin = req.headers.get('origin');
  if (origin && isOriginAllowed(origin, req.url, env.ALLOWED_ORIGINS ?? '')) {
    h.set('access-control-allow-origin', origin);
    h.set('vary', 'Origin');
    h.set('access-control-allow-headers', 'authorization, content-type, x-request-id');
    h.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    h.set('access-control-max-age', '600');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function isOriginAllowed(origin: string, requestUrl: string, configured: string) {
  if (origin === new URL(requestUrl).origin) return true;
  const allowed = configured.split(',').map(x => x.trim()).filter(Boolean);
  return allowed.includes(origin);
}
