-- Isolamento de conhecimento por tenant e idempotência de runtime evidence.
ALTER TABLE knowledge_document ADD COLUMN scope TEXT NOT NULL DEFAULT 'global';
ALTER TABLE knowledge_document ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_scope_tenant_status
  ON knowledge_document(scope, tenant_id, status, module, version);

CREATE TABLE IF NOT EXISTS runtime_evidence_event (
  tenant_id TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, external_event_id)
);
CREATE INDEX IF NOT EXISTS idx_runtime_evidence_document
  ON runtime_evidence_event(document_id);
CREATE INDEX IF NOT EXISTS idx_runtime_evidence_received
  ON runtime_evidence_event(received_at);
