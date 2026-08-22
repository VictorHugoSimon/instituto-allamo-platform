import type { Env, Filters, Hit } from '../types';
import { rerank } from './rerank';

export interface RetrievalResult {
  hits: Hit[];
  trace: { query: string; semantic: number; lexical: number; latencyMs: number };
}

export async function hybridSearch(env: Env, query: string, filters: Filters): Promise<RetrievalResult> {
  const started = Date.now();
  const emb = await env.AI.run(env.EMBEDDING_MODEL, { text: [query] });
  const lexicalQuery = sanitizeMatch(query);

  const semanticPromise = env.VEC.query(emb.data[0], { topK: 8, returnMetadata: 'all' });
  const lexicalPromise = lexicalQuery
    ? env.META.prepare(
        `SELECT c.id, c.document_id, c.text, c.symbol, c.path, c.commit_sha,
                c.module, c.version, d.source_type, d.status, d.owner,
                bm25(chunk_fts) AS rank
           FROM chunk_fts
           JOIN knowledge_chunk c ON c.id = chunk_fts.chunk_id
           JOIN knowledge_document d ON d.id = c.document_id
          WHERE chunk_fts MATCH ?
          ORDER BY rank LIMIT 8`
      ).bind(lexicalQuery).all()
    : Promise.resolve({ results: [] });

  const [semantic, lexical] = await Promise.all([semanticPromise, lexicalPromise]);
  const semanticIds = semantic.matches.map((m: any) => m.id);
  const semanticHits = semanticIds.length ? await hydrate(env, semanticIds, semantic.matches) : [];
  const lexicalHits = (lexical.results ?? []).map(toLexicalHit);

  return {
    hits: rerank([...semanticHits, ...lexicalHits], filters),
    trace: { query, semantic: semanticHits.length, lexical: lexicalHits.length, latencyMs: Date.now() - started }
  };
}

async function hydrate(env: Env, ids: string[], matches: any[]): Promise<Hit[]> {
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.META.prepare(
    `SELECT c.id, c.document_id, c.text, c.symbol, c.path, c.commit_sha,
            c.module, c.version, d.source_type, d.status, d.owner
       FROM knowledge_chunk c
       JOIN knowledge_document d ON d.id = c.document_id
      WHERE c.id IN (${placeholders})`
  ).bind(...ids).all();

  const scoreById = new Map(matches.map((m: any) => [m.id, m.score]));
  return (rows.results ?? []).map((r: any) => ({
    chunkId: r.id, documentId: r.document_id, sourceType: r.source_type, text: r.text,
    path: r.path, symbol: r.symbol, commitSha: r.commit_sha, module: r.module,
    version: r.version, status: r.status, owner: r.owner,
    score: scoreById.get(r.id) ?? 0, origin: 'semantic' as const
  }));
}

function toLexicalHit(r: any): Hit {
  return {
    chunkId: r.id, documentId: r.document_id, sourceType: r.source_type, text: r.text,
    path: r.path, symbol: r.symbol, commitSha: r.commit_sha, module: r.module,
    version: r.version, status: r.status, owner: r.owner,
    score: Math.min(1, 1 / (1 + Math.abs(r.rank ?? 10))), origin: 'lexical'
  };
}

function sanitizeMatch(q: string): string {
  return q.replace(/["*():^-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2)
    .slice(0, 16)
    .map(t => '"' + t.replace(/"/g, '') + '"')
    .join(' OR ');
}
