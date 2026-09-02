-- Valkíria Service Hub — fundação do domínio de atendimento.
-- Usa tenant_id/company e project_id da plataforma como referências lógicas.
-- Não cria FKs para tabelas legadas, preservando compatibilidade com os ambientes atuais.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS service_hub_systems (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  system_kind TEXT NOT NULL CHECK (system_kind IN ('sallamos','external','internal')),
  lifecycle_phase TEXT NOT NULL CHECK (lifecycle_phase IN ('implementation','hypercare','production','support','closed')),
  official_ticket_source TEXT NOT NULL CHECK (official_ticket_source IN ('sallamos','allamo','project_queue','manual')),
  external_ref TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_hub_systems_tenant_project ON service_hub_systems(tenant_id, project_id, active);

CREATE TABLE IF NOT EXISTS service_hub_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  system_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('whatsapp','sallamos','portal','email','api','other')),
  external_channel_id TEXT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, external_channel_id)
);
CREATE INDEX IF NOT EXISTS idx_service_hub_channels_tenant_project ON service_hub_channels(tenant_id, project_id, active);

CREATE TABLE IF NOT EXISTS service_hub_sla_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  system_id TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low','normal','medium','high','critical')),
  first_response_minutes INTEGER NOT NULL CHECK (first_response_minutes > 0),
  resolution_minutes INTEGER NOT NULL CHECK (resolution_minutes > 0),
  business_hours_only INTEGER NOT NULL DEFAULT 0 CHECK (business_hours_only IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_hub_sla_lookup ON service_hub_sla_policies(tenant_id, project_id, system_id, priority, active);

CREATE TABLE IF NOT EXISTS service_hub_routing_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  system_kind TEXT NOT NULL CHECK (system_kind IN ('sallamos','external','internal','any')),
  lifecycle_phase TEXT NOT NULL CHECK (lifecycle_phase IN ('implementation','hypercare','production','support','closed','any')),
  message_type TEXT NOT NULL CHECK (message_type IN ('question','incident','request','change','blocker','decision','report','context','social','any')),
  destination TEXT NOT NULL CHECK (destination IN ('valkiria','sallamos','allamo_service_desk','project_queue','context_only','human_review')),
  ticket_required INTEGER NOT NULL DEFAULT 0 CHECK (ticket_required IN (0,1)),
  precedence INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_hub_routes_lookup ON service_hub_routing_rules(tenant_id, system_kind, lifecycle_phase, message_type, active, precedence);

CREATE TABLE IF NOT EXISTS service_hub_tickets (
  id TEXT PRIMARY KEY,
  ticket_key TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  system_id TEXT,
  channel_id TEXT,
  external_ticket_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('whatsapp','sallamos','portal','api','manual','valkiria')),
  message_type TEXT NOT NULL CHECK (message_type IN ('incident','request','change','blocker','question')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triage','in_progress','waiting_customer','waiting_vendor','resolved','closed','cancelled')),
  title TEXT NOT NULL,
  description_redacted TEXT NOT NULL DEFAULT '',
  assigned_to TEXT,
  sla_policy_id TEXT,
  first_response_due_at TEXT,
  resolution_due_at TEXT,
  first_responded_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_hub_tickets_tenant_status ON service_hub_tickets(tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_hub_tickets_project_status ON service_hub_tickets(tenant_id, project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_hub_tickets_sla ON service_hub_tickets(tenant_id, resolution_due_at, status);

CREATE TABLE IF NOT EXISTS service_hub_ticket_events (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','client','valkiria','system','integration')),
  actor_ref TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_hub_ticket_events_ticket ON service_hub_ticket_events(tenant_id, ticket_id, created_at);

CREATE TABLE IF NOT EXISTS service_hub_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_ref_hash TEXT,
  text_redacted TEXT NOT NULL DEFAULT '',
  message_type TEXT CHECK (message_type IN ('question','incident','request','change','blocker','decision','report','context','social')),
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  ticket_id TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel_id, provider_message_id)
);
CREATE INDEX IF NOT EXISTS idx_service_hub_messages_tenant_channel ON service_hub_messages(tenant_id, channel_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS service_hub_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_hub_audit_tenant_entity ON service_hub_audit_log(tenant_id, entity_type, entity_id, created_at DESC);
