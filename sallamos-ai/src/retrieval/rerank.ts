import type { Filters, Hit, SourceType } from '../types';

const AUTHORITY: Record<SourceType, number> = {
  tool: 1.0, doc: 0.9, release: 0.8, code: 0.7, faq: 0.6, history: 0.3
};

export function rerank(hits: Hit[], filters: Filters): Hit[] {
  const byChunk = new Map<string, Hit>();
  for (const h of hits) {
    const existing = byChunk.get(h.chunkId);
    if (existing) {
      existing.score = Math.min(1, Math.max(existing.score, h.score) + 0.15);
      continue;
    }
    byChunk.set(h.chunkId, { ...h });
  }

  const scored = [...byChunk.values()].map(h => {
    let s = h.score;
    s *= 0.55 + 0.45 * (AUTHORITY[h.sourceType] ?? 0.5);
    if (h.status === 'homologado') s *= 1.1;
    if (h.status === 'desatualizado') s *= 0.7;
    if (!h.owner || h.status === 'sem_owner') s *= 0.6;
    if (filters.version && h.version && h.version !== filters.version) s *= 0.65;
    if (filters.module && h.module && h.module !== filters.module) s *= 0.85;
    if (filters.onlyApproved && h.status !== 'homologado') s *= 0.4;
    return { ...h, score: Math.min(1, s) };
  });

  return diversify(scored.sort((a, b) => b.score - a.score)).slice(0, 6);
}

function diversify(hits: Hit[]): Hit[] {
  const perDoc = new Map<string, number>();
  const out: Hit[] = [];
  for (const h of hits) {
    const n = perDoc.get(h.documentId) ?? 0;
    if (n >= 2) continue;
    perDoc.set(h.documentId, n + 1);
    out.push(h);
  }
  return out;
}
