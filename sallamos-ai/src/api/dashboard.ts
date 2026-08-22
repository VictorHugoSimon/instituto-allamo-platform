import type { Env } from '../types';
import { requirePermission, requireSession } from '../auth/session';

export async function handleOverview(req: Request, env: Env) {
  const ctx = await requireSession(req, env); requirePermission(ctx, 'ai:dashboard:read');
  const [responses, escalations, docs, feedback] = await env.META.batch([
    env.META.prepare(`SELECT COUNT(*) AS total, AVG(ar.confidence) AS avg_confidence FROM ai_response ar JOIN message m ON m.id=ar.message_id JOIN conversation c ON c.id=m.conversation_id WHERE c.tenant_id=?`).bind(ctx.tenantId),
    env.META.prepare(`SELECT COUNT(*) AS total FROM escalation e JOIN conversation c ON c.id=e.conversation_id WHERE c.tenant_id=? AND e.status NOT IN ('resolved','fechado')`).bind(ctx.tenantId),
    env.META.prepare(`SELECT COUNT(*) AS total FROM knowledge_document WHERE status='homologado'`),
    env.META.prepare(`SELECT COUNT(*) AS total, AVG(CASE WHEN f.solved=1 THEN 1.0 ELSE 0.0 END) AS solved_rate FROM feedback f JOIN ai_response ar ON ar.id=f.response_id JOIN message m ON m.id=ar.message_id JOIN conversation c ON c.id=m.conversation_id WHERE c.tenant_id=?`).bind(ctx.tenantId)
  ]);
  const rr: any = responses.results?.[0] ?? {}, er: any = escalations.results?.[0] ?? {}, dr: any = docs.results?.[0] ?? {}, fr: any = feedback.results?.[0] ?? {};
  return { tenant: ctx.tenantId, version: ctx.productVersion, kpis: { interactions: Number(rr.total ?? 0), averageConfidence: Number(rr.avg_confidence ?? 0), openEscalations: Number(er.total ?? 0), knowledgeDocuments: Number(dr.total ?? 0), feedbackCount: Number(fr.total ?? 0), solvedRate: Number(fr.solved_rate ?? 0) } };
}

export async function handleKnowledge(req: Request, env: Env) {
  const ctx = await requireSession(req, env); requirePermission(ctx, 'ai:dashboard:read');
  const rows = await env.META.prepare(`SELECT id, source_type, title, module, version, owner, status, source_uri, updated_at FROM knowledge_document WHERE status IN ('homologado','indexado') ORDER BY updated_at DESC LIMIT 100`).all();
  return { items: rows.results ?? [] };
}

export async function handleEscalationsList(req: Request, env: Env) {
  const ctx = await requireSession(req, env); requirePermission(ctx, 'ai:dashboard:read');
  const rows = await env.META.prepare(`SELECT e.id, e.conversation_id, e.reason, e.diagnostic_payload, e.assigned_to, e.status, e.created_at FROM escalation e JOIN conversation c ON c.id=e.conversation_id WHERE c.tenant_id=? ORDER BY e.created_at DESC LIMIT 100`).bind(ctx.tenantId).all();
  return { items: (rows.results ?? []).map((r: any) => ({ ...r, diagnostic: safeJson(r.diagnostic_payload), diagnostic_payload: undefined })) };
}

export async function handleInsights(req: Request, env: Env) {
  const ctx = await requireSession(req, env); requirePermission(ctx, 'ai:dashboard:read');
  const decisions = await env.META.prepare(`SELECT ar.decision, COUNT(*) AS total, AVG(ar.confidence) AS avg_confidence FROM ai_response ar JOIN message m ON m.id=ar.message_id JOIN conversation c ON c.id=m.conversation_id WHERE c.tenant_id=? GROUP BY ar.decision`).bind(ctx.tenantId).all();
  const risks = await env.META.prepare(`SELECT ar.risk_level, COUNT(*) AS total FROM ai_response ar JOIN message m ON m.id=ar.message_id JOIN conversation c ON c.id=m.conversation_id WHERE c.tenant_id=? GROUP BY ar.risk_level`).bind(ctx.tenantId).all();
  return { decisions: decisions.results ?? [], risks: risks.results ?? [] };
}
function safeJson(v: unknown) { try { return JSON.parse(String(v ?? '{}')); } catch { return {}; } }
