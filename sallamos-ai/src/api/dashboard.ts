import type { Env } from '../types';
import { requireSession } from '../auth/session';

export async function handleOverview(req: Request, env: Env) {
  const ctx = await requireSession(req, env);
  const [responses, escalations, docs, feedback] = await env.META.batch([
    env.META.prepare('SELECT COUNT(*) AS total, AVG(confidence) AS avg_confidence FROM ai_response'),
    env.META.prepare("SELECT COUNT(*) AS total FROM escalation WHERE status NOT IN ('resolved','fechado')"),
    env.META.prepare('SELECT COUNT(*) AS total FROM knowledge_document'),
    env.META.prepare('SELECT COUNT(*) AS total, AVG(CASE WHEN solved = 1 THEN 1.0 ELSE 0.0 END) AS solved_rate FROM feedback')
  ]);

  const rr: any = responses.results?.[0] ?? {};
  const er: any = escalations.results?.[0] ?? {};
  const dr: any = docs.results?.[0] ?? {};
  const fr: any = feedback.results?.[0] ?? {};

  return {
    tenant: ctx.tenantId,
    version: ctx.productVersion,
    kpis: {
      interactions: Number(rr.total ?? 0),
      averageConfidence: Number(rr.avg_confidence ?? 0),
      openEscalations: Number(er.total ?? 0),
      knowledgeDocuments: Number(dr.total ?? 0),
      feedbackCount: Number(fr.total ?? 0),
      solvedRate: Number(fr.solved_rate ?? 0)
    }
  };
}

export async function handleKnowledge(req: Request, env: Env) {
  await requireSession(req, env);
  const rows = await env.META.prepare(
    `SELECT id, source_type, title, module, version, owner, status, source_uri, updated_at
       FROM knowledge_document
      ORDER BY updated_at DESC LIMIT 100`
  ).all();
  return { items: rows.results ?? [] };
}

export async function handleEscalationsList(req: Request, env: Env) {
  await requireSession(req, env);
  const rows = await env.META.prepare(
    `SELECT id, conversation_id, reason, diagnostic_payload, assigned_to, status, created_at
       FROM escalation
      ORDER BY created_at DESC LIMIT 100`
  ).all();
  return {
    items: (rows.results ?? []).map((r: any) => ({
      ...r,
      diagnostic: safeJson(r.diagnostic_payload)
    }))
  };
}

export async function handleInsights(req: Request, env: Env) {
  await requireSession(req, env);
  const decisions = await env.META.prepare(
    `SELECT decision, COUNT(*) AS total, AVG(confidence) AS avg_confidence
       FROM ai_response GROUP BY decision`
  ).all();
  const risks = await env.META.prepare(
    `SELECT risk_level, COUNT(*) AS total FROM ai_response GROUP BY risk_level`
  ).all();
  return { decisions: decisions.results ?? [], risks: risks.results ?? [] };
}

function safeJson(v: unknown) {
  try { return JSON.parse(String(v ?? '{}')); } catch { return {}; }
}
