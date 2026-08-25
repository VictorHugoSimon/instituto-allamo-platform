import type { Env, KnowledgeScope, SourceType } from '../types';
import { HttpError } from '../auth/session';
import { requireAdmin } from './admin';

const ALLOWED_STATUS = new Set(['rascunho', 'rejeitado', 'homologado', 'indexado']);
const ALLOWED_SCOPE = new Set<KnowledgeScope>(['global', 'tenant']);
const ALLOWED_SOURCE = new Set<SourceType>(['doc', 'code', 'release', 'faq', 'history', 'tool']);

export async function handleKnowledgeReviewQueue(req: Request, env: Env) {
  requireAdmin(req, env);
  const url = new URL(req.url);
  const status = clean(url.searchParams.get('status') ?? 'rascunho', 40);
  const scope = clean(url.searchParams.get('scope'), 20);
  const tenantId = clean(url.searchParams.get('tenantId'), 120);
  const module = clean(url.searchParams.get('module'), 60);
  const sourceType = clean(url.searchParams.get('sourceType'), 30);
  const before = clean(url.searchParams.get('before'), 60);
  const beforeId = clean(url.searchParams.get('beforeId'), 180);
  const limit = clampInt(url.searchParams.get('limit'), 25, 1, 100);

  if (!ALLOWED_STATUS.has(status)) throw new HttpError(400, 'invalid_review_status');
  if (scope && !ALLOWED_SCOPE.has(scope as KnowledgeScope)) throw new HttpError(400, 'invalid_knowledge_scope');
  if (sourceType && !ALLOWED_SOURCE.has(sourceType as SourceType)) throw new HttpError(400, 'invalid_source_type');
  if (before && Number.isNaN(new Date(before).getTime())) throw new HttpError(400, 'invalid_review_cursor');

  const where = ['d.status = ?'];
  const bindings: unknown[] = [status];
  if (scope) { where.push('d.scope = ?'); bindings.push(scope); }
  if (tenantId) { where.push('d.tenant_id = ?'); bindings.push(tenantId); }
  if (module) { where.push('d.module = ?'); bindings.push(module); }
  if (sourceType) { where.push('d.source_type = ?'); bindings.push(sourceType); }
  if (before) {
    if (beforeId) {
      where.push('(d.updated_at < ? OR (d.updated_at = ? AND d.id < ?))');
      bindings.push(before, before, beforeId);
    } else {
      where.push('d.updated_at < ?'); bindings.push(before);
    }
  }

  const sql = `
    SELECT
      d.id,d.source_type,d.title,d.module,d.version,d.owner,d.status,d.source_uri,d.updated_at,d.scope,d.tenant_id,
      re.external_event_id,re.kind AS runtime_kind,re.received_at,
      (SELECT COUNT(*) FROM knowledge_chunk c WHERE c.document_id=d.id) AS chunk_count,
      (SELECT COUNT(*) FROM knowledge_chunk c WHERE c.document_id=d.id AND c.embedded=1) AS embedded_chunks
    FROM knowledge_document d
    LEFT JOIN runtime_evidence_event re ON re.document_id=d.id
    WHERE ${where.join(' AND ')}
    ORDER BY d.updated_at DESC,d.id DESC
    LIMIT ?`;
  bindings.push(limit + 1);

  const rows = await env.META.prepare(sql).bind(...bindings).all();
  const all = (rows.results ?? []) as any[];
  const hasMore = all.length > limit;
  const items = all.slice(0, limit).map(toQueueItem);
  const last = items.at(-1);
  return {
    filters: { status, scope: scope || null, tenantId: tenantId || null, module: module || null, sourceType: sourceType || null },
    items,
    page: {
      limit,
      hasMore,
      nextCursor: hasMore && last ? { before: last.updatedAt, beforeId: last.id } : null
    }
  };
}

export async function handleKnowledgeReviewDetail(req: Request, env: Env, documentId: string) {
  requireAdmin(req, env);
  const id = clean(documentId, 180);
  if (!id) throw new HttpError(400, 'knowledge_document_id_required');

  const doc: any = await env.META.prepare(`
    SELECT
      d.id,d.source_type,d.title,d.module,d.version,d.owner,d.status,d.source_uri,d.content_hash,d.updated_at,d.scope,d.tenant_id,
      re.external_event_id,re.kind AS runtime_kind,re.payload_hash,re.received_at
    FROM knowledge_document d
    LEFT JOIN runtime_evidence_event re ON re.document_id=d.id
    WHERE d.id=? LIMIT 1`).bind(id).first();
  if (!doc) throw new HttpError(404, 'knowledge_document_not_found');

  const [chunks, audit] = await env.META.batch([
    env.META.prepare(`SELECT id,chunk_index,text,symbol,path,commit_sha,module,version,hash,embedded FROM knowledge_chunk WHERE document_id=? ORDER BY chunk_index ASC LIMIT 120`).bind(id),
    env.META.prepare(`SELECT id,action,confirmation,result,actor,timestamp FROM action_audit WHERE tool='knowledge-admin' AND confirmation=? ORDER BY timestamp DESC LIMIT 50`).bind(id)
  ]);

  const chunkItems = (chunks.results ?? []) as any[];
  return {
    document: {
      id: doc.id,
      sourceType: doc.source_type,
      title: doc.title,
      module: doc.module,
      version: doc.version,
      owner: doc.owner,
      status: doc.status,
      sourceUri: doc.source_uri,
      contentHash: doc.content_hash,
      updatedAt: doc.updated_at,
      scope: doc.scope,
      tenantId: doc.tenant_id ?? null,
      runtimeEvidence: doc.external_event_id ? {
        eventId: doc.external_event_id,
        kind: doc.runtime_kind,
        payloadHash: doc.payload_hash,
        receivedAt: doc.received_at
      } : null
    },
    content: {
      chunks: chunkItems.map((c: any) => ({
        id: c.id,
        index: Number(c.chunk_index),
        text: c.text,
        symbol: c.symbol || null,
        path: c.path || null,
        commitSha: c.commit_sha || null,
        module: c.module || null,
        version: c.version || null,
        hash: c.hash || null,
        embedded: Boolean(c.embedded)
      })),
      truncated: chunkItems.length >= 120
    },
    audit: (audit.results ?? []).map((r: any) => ({
      id: r.id,
      action: r.action,
      actor: r.actor,
      timestamp: r.timestamp,
      result: safeJson(r.result)
    })),
    allowedActions: allowedActions(doc)
  };
}

function toQueueItem(r: any) {
  return {
    id: r.id,
    sourceType: r.source_type,
    title: r.title,
    module: r.module,
    version: r.version,
    owner: r.owner,
    status: r.status,
    sourceUri: r.source_uri,
    updatedAt: r.updated_at,
    scope: r.scope,
    tenantId: r.tenant_id ?? null,
    runtimeEvidence: r.external_event_id ? { eventId: r.external_event_id, kind: r.runtime_kind, receivedAt: r.received_at } : null,
    chunks: Number(r.chunk_count ?? 0),
    embeddedChunks: Number(r.embedded_chunks ?? 0)
  };
}

function allowedActions(doc: any) {
  if (doc.status === 'rascunho') return {
    approveTenant: doc.scope === 'tenant',
    approveGlobal: true,
    reject: true,
    globalApprovalRequiresEvidence: doc.scope === 'tenant'
  };
  return { approveTenant: false, approveGlobal: false, reject: false, globalApprovalRequiresEvidence: false };
}
function clean(v: unknown, max: number) { return String(v ?? '').trim().slice(0, max); }
function clampInt(v: string | null, fallback: number, min: number, max: number) {
  const n = Number(v ?? fallback); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}
function safeJson(v: unknown) { try { return JSON.parse(String(v ?? '{}')); } catch { return { raw: String(v ?? '').slice(0, 2000) }; } }
