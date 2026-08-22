import type { Env } from '../types';

const BATCH = 50;

export async function embedPending(env: Env): Promise<{ done: boolean; embedded: number }> {
  const rows = await env.META.prepare(
    'SELECT id, text, module, version, path, commit_sha FROM knowledge_chunk WHERE embedded = 0 LIMIT ?'
  ).bind(BATCH).all();

  const pending = rows.results ?? [];
  if (!pending.length) return { done: true, embedded: 0 };

  const out = await env.AI.run(env.EMBEDDING_MODEL, {
    text: pending.map((r: any) => r.text)
  });

  await env.VEC.upsert(pending.map((r: any, i: number) => ({
    id: r.id,
    values: out.data[i],
    metadata: {
      module: r.module ?? '', version: r.version ?? '',
      path: r.path ?? '', commit: r.commit_sha ?? ''
    }
  })));

  const ids = pending.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  await env.META.prepare(
    'UPDATE knowledge_chunk SET embedded = 1 WHERE id IN (' + placeholders + ')'
  ).bind(...ids).run();

  return { done: pending.length < BATCH, embedded: ids.length };
}
