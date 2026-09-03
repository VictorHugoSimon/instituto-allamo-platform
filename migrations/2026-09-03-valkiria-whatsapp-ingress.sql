-- Valkíria Service Hub — quarentena segura de ingressos de provedores.
-- Eventos podem chegar antes de o canal/tenant ser resolvido. Nada vira chamado automaticamente nesse estado.

CREATE TABLE IF NOT EXISTS service_hub_provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  external_channel_id TEXT,
  phone_number_id TEXT,
  sender_ref_hash TEXT,
  text_redacted TEXT NOT NULL DEFAULT '',
  occurred_at TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved','resolved','rejected','ignored')),
  error_code TEXT,
  channel_id TEXT,
  tenant_id TEXT,
  project_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(provider, provider_message_id)
);

CREATE INDEX IF NOT EXISTS idx_service_hub_provider_events_status
  ON service_hub_provider_events(provider, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_hub_provider_events_channel
  ON service_hub_provider_events(channel_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_hub_provider_events_tenant
  ON service_hub_provider_events(tenant_id, project_id, status, received_at DESC);
