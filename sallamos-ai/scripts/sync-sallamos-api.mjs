#!/usr/bin/env node
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const DB = 'sallamos-ai-meta';
const config = JSON.parse(await readFile(new URL('../sources/sources.json', import.meta.url), 'utf8'));
const source = config.sources.find(s => s.id === 'sallamos-api-public');
if (!source) throw new Error('fonte sallamos-api-public não configurada');

const apiBase = `https://api.github.com/repos/${source.repository}`;
const headers = { 'accept': 'application/vnd.github+json', 'user-agent': 'sallamos-ai-support' };
const commitRes = await fetch(`${apiBase}/commits/${source.branch}`, { headers });
if (!commitRes.ok) throw new Error(`GitHub commit HTTP ${commitRes.status}`);
const commit = await commitRes.json();
const sha = commit.sha;
const shortSha = sha.slice(0, 7);
const statements = [];

for (const file of source.files) {
  const rawUrl = `https://raw.githubusercontent.com/${source.repository}/${source.branch}/${file.path}`;
  const res = await fetch(rawUrl, { headers: { 'user-agent': 'sallamos-ai-support' } });
  if (!res.ok) throw new Error(`${file.path}: HTTP ${res.status}`);
  const text = await res.text();
  const docId = `github:${source.repository}:${file.path}`;
  const title = `${source.repository} · ${file.path}`;

  statements.push(`DELETE FROM chunk_fts WHERE chunk_id IN (SELECT id FROM knowledge_chunk WHERE document_id=${q(docId)});`);
  statements.push(`DELETE FROM knowledge_chunk WHERE document_id=${q(docId)};`);
  statements.push(`INSERT INTO knowledge_document (id,source_type,title,module,version,owner,status,source_uri,content_hash,updated_at)
VALUES (${q(docId)},${q(file.sourceType ?? 'doc')},${q(title)},${q(file.module ?? 'api')},${q(shortSha)},${q(source.owner ?? 'Sallamos')},'homologado',${q(rawUrl)},${q(hash(text))},${q(new Date().toISOString())})
ON CONFLICT(id) DO UPDATE SET title=excluded.title,module=excluded.module,version=excluded.version,owner=excluded.owner,status=excluded.status,source_uri=excluded.source_uri,content_hash=excluded.content_hash,updated_at=excluded.updated_at;`);

  const chunks = split(text, 1800);
  chunks.forEach((chunk, i) => {
    const chunkId = `${docId}#${i}`;
    statements.push(`INSERT INTO knowledge_chunk (id,document_id,chunk_index,text,symbol,path,commit_sha,module,version,hash,embedded)
VALUES (${q(chunkId)},${q(docId)},${i},${q(chunk)},'',${q(file.path)},${q(shortSha)},${q(file.module ?? 'api')},${q(shortSha)},${q(hash(chunk))},0);`);
    statements.push(`INSERT INTO chunk_fts (text,symbol,path,chunk_id) VALUES (${q(chunk)},'',${q(file.path)},${q(chunkId)});`);
  });
}

const temp = '.sync-sallamos-api.sql';
await writeFile(temp, statements.join('\n'), 'utf8');
try {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npx, ['wrangler', 'd1', 'execute', DB, '--remote', '--file', temp], { stdio: 'inherit' });
  console.log(`SallamosAPI sincronizada no commit ${shortSha}.`);
} finally {
  await unlink(temp).catch(() => {});
}

function q(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}
function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}
function split(value, max) {
  const blocks = value.split(/\n\s*\n/);
  const out = [];
  let current = '';
  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length <= max) { current = next; continue; }
    if (current.trim()) out.push(current.trim());
    if (block.length <= max) { current = block; continue; }
    for (let i = 0; i < block.length; i += max) out.push(block.slice(i, i + max).trim());
    current = '';
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}
