-- Production hardening. Demo data is intentionally NOT part of migrations.
CREATE INDEX IF NOT EXISTS idx_conversation_tenant_started ON conversation(tenant_id, started_at);
CREATE INDEX IF NOT EXISTS idx_message_conversation_created ON message(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_response_message ON ai_response(message_id);
CREATE INDEX IF NOT EXISTS idx_escalation_conversation_status ON escalation(conversation_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_response ON feedback(response_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_status_module ON knowledge_document(status, module, version);

CREATE TABLE IF NOT EXISTS rate_limit_bucket (
  bucket TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (bucket, key_hash)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_updated ON rate_limit_bucket(updated_at);

CREATE TABLE IF NOT EXISTS system_event (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  event_type TEXT NOT NULL,
  tenant_id TEXT,
  user_id TEXT,
  request_id TEXT,
  payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_event_env_type_created ON system_event(environment, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_system_event_tenant_created ON system_event(tenant_id, created_at);
