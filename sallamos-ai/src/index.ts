import type { Env } from './types';
import { handleQuery } from './api/support';
import { handleFeedback } from './api/feedback';
import { handleEscalation } from './api/escalation';
import { handleDemoSession } from './api/demo';
import { handleOverview, handleKnowledge, handleEscalationsList, handleInsights } from './api/dashboard';
import { embedPending } from './ingestion/embed-pending';
import { HttpError } from './auth/session';

const json = (data: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      if (path === '/health') return json({ ok: true, prompt: env.PROMPT_VERSION, demo: env.DEMO_MODE === 'true' });

      if (req.method === 'POST' && path === '/api/ai/demo/session') {
        const result: any = await handleDemoSession(env);
        return json(result, result.error ? 404 : 200);
      }

      if (req.method === 'POST' && path === '/api/ai/support/query') return json(await handleQuery(req, env));
      if (req.method === 'POST' && path.startsWith('/api/ai/conversations/') && path.endsWith('/feedback')) {
        return json(await handleFeedback(req, env, path));
      }
      if (req.method === 'POST' && path === '/api/ai/escalations') return json(await handleEscalation(req, env));
      if (req.method === 'GET' && path === '/api/ai/escalations') return json(await handleEscalationsList(req, env));
      if (req.method === 'GET' && path === '/api/ai/overview') return json(await handleOverview(req, env));
      if (req.method === 'GET' && path === '/api/ai/knowledge') return json(await handleKnowledge(req, env));
      if (req.method === 'GET' && path === '/api/ai/insights') return json(await handleInsights(req, env));

      if (req.method === 'POST' && path === '/api/ai/admin/reindex') {
        const auth = req.headers.get('authorization') ?? '';
        if (auth !== 'Bearer ' + env.ADMIN_TOKEN) return json({ error: 'forbidden' }, 403);
        return json(await embedPending(env));
      }

      return json({ error: 'not_found' }, 404);
    } catch (err: any) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('unhandled', err?.stack ?? err);
      return json({ error: 'internal_error' }, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    let guard = 0;
    let result = await embedPending(env);
    while (!result.done && guard++ < 20) result = await embedPending(env);
  }
};
