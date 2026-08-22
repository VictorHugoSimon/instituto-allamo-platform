-- Sallamos AI · schema mínimo
CREATE TABLE IF NOT EXISTS knowledge_document (
  id TEXT PRIMARY KEY, source_type TEXT NOT NULL, title TEXT, module TEXT, version TEXT,
  owner TEXT, status TEXT, source_uri TEXT, content_hash TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS knowledge_chunk (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, text TEXT NOT NULL,
  symbol TEXT, path TEXT, commit_sha TEXT, module TEXT, version TEXT, hash TEXT,
  embedded INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (document_id) REFERENCES knowledge_document(id)
);
CREATE INDEX IF NOT EXISTS idx_chunk_pending ON knowledge_chunk(embedded);
CREATE INDEX IF NOT EXISTS idx_chunk_module ON knowledge_chunk(module, version);
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(text, symbol, path, chunk_id UNINDEXED, tokenize = 'unicode61');
CREATE TABLE IF NOT EXISTS repo_snapshot (id TEXT PRIMARY KEY, repository TEXT, branch TEXT, commit_sha TEXT, release TEXT, indexed_at TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS conversation (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, channel TEXT, started_at TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS message (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, text TEXT, created_at TEXT, redaction_status TEXT);
CREATE TABLE IF NOT EXISTS retrieval_trace (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, query TEXT, source_ids TEXT, scores TEXT, filters TEXT, model TEXT, latency_ms INTEGER);
CREATE TABLE IF NOT EXISTS ai_response (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, answer TEXT, confidence REAL, decision TEXT, sources TEXT, risk_level TEXT, prompt_version TEXT);
CREATE TABLE IF NOT EXISTS escalation (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, reason TEXT, diagnostic_payload TEXT, assigned_to TEXT, status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, response_id TEXT NOT NULL, solved INTEGER, rating INTEGER, comment TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS action_audit (id TEXT PRIMARY KEY, tenant TEXT, user_id TEXT, tool TEXT, action TEXT, dry_run INTEGER, confirmation TEXT, result TEXT, actor TEXT, timestamp TEXT);
