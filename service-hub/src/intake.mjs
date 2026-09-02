import { classifyServiceMessage } from './classifier.mjs';
import { routeServiceHub } from './routing.mjs';
import { createServiceHubRepository, httpError } from './repository.mjs';
import { redactServiceText } from './redact.mjs';

const PROVIDERS = ['whatsapp','sallamos','portal','email','api','other'];

export async function processInboundChannelMessage(env, input) {
  const db = env?.DB;
  if (!db?.prepare) throw httpError(500, 'd1_database_required');

  const provider = one(input?.provider, PROVIDERS, 'invalid_channel_provider');
  const externalChannelId = required(input?.externalChannelId, 'external_channel_id_required', 300);
  const providerMessageId = required(input?.providerMessageId, 'provider_message_id_required', 300);
  const rawText = String(input?.text ?? '').slice(0, 12000);
  const occurredAt = validIso(input?.occurredAt) ? new Date(input.occurredAt).toISOString() : new Date().toISOString();

  const channel = await db.prepare(`
    SELECT id,tenant_id,project_id,system_id,provider,name
    FROM service_hub_channels
    WHERE provider=? AND external_channel_id=? AND active=1
    LIMIT 1
  `).bind(provider, externalChannelId).first();
  if (!channel) throw httpError(404, 'channel_not_registered');

  const existing = await db.prepare(`
    SELECT id,ticket_id,message_type,confidence,occurred_at
    FROM service_hub_messages
    WHERE channel_id=? AND provider_message_id=?
    LIMIT 1
  `).bind(channel.id, providerMessageId).first();
  if (existing) return duplicateResult(existing, channel);

  const system = await db.prepare(`
    SELECT id,tenant_id,project_id,name,system_kind,lifecycle_phase,official_ticket_source
    FROM service_hub_systems
    WHERE id=? AND tenant_id=? AND active=1
    LIMIT 1
  `).bind(channel.system_id, channel.tenant_id).first();
  if (!system) throw httpError(409, 'channel_system_not_available');
  if (String(system.project_id) !== String(channel.project_id)) throw httpError(409, 'channel_system_project_mismatch');

  const classification = classifyServiceMessage(rawText);
  const route = classification.needsReview
    ? {
        tenantId: channel.tenant_id,
        projectId: channel.project_id,
        systemKind: system.system_kind,
        phase: system.lifecycle_phase,
        messageType: classification.messageType,
        destination: 'human_review',
        ticketRequired: classification.actionable,
        reason: 'low_classification_confidence',
        official: false
      }
    : routeServiceHub({
        tenantId: channel.tenant_id,
        projectId: channel.project_id,
        systemKind: system.system_kind,
        phase: system.lifecycle_phase,
        messageType: classification.messageType
      });

  const sanitized = redactServiceText(rawText, 12000);
  const messageId = 'msg:' + crypto.randomUUID();
  const senderRefHash = optional(input?.senderRefHash, 180);

  try {
    await db.prepare(`
      INSERT INTO service_hub_messages(
        id,tenant_id,project_id,channel_id,provider_message_id,direction,sender_ref_hash,
        text_redacted,message_type,confidence,ticket_id,occurred_at,created_at
      ) VALUES(?,?,?,?,?,'inbound',?,?,?,?,NULL,?,?)
    `).bind(
      messageId,
      channel.tenant_id,
      channel.project_id,
      channel.id,
      providerMessageId,
      senderRefHash,
      sanitized.text,
      classification.messageType,
      classification.confidence,
      occurredAt,
      new Date().toISOString()
    ).run();
  } catch (error) {
    const retryExisting = await db.prepare(`
      SELECT id,ticket_id,message_type,confidence,occurred_at
      FROM service_hub_messages
      WHERE channel_id=? AND provider_message_id=?
      LIMIT 1
    `).bind(channel.id, providerMessageId).first();
    if (retryExisting) return duplicateResult(retryExisting, channel);
    throw error;
  }

  let ticket = null;
  if (route.ticketRequired && ['allamo_service_desk','project_queue','human_review'].includes(route.destination)) {
    const repo = createServiceHubRepository(db);
    const ctx = {
      tenantId: channel.tenant_id,
      actorType: 'integration',
      actorRef: `channel:${provider}`,
      permissions: ['service_hub:*']
    };
    ticket = await repo.createTicket(ctx, {
      projectId: channel.project_id,
      systemId: system.id,
      channelId: channel.id,
      source: ticketSource(provider),
      messageType: ticketMessageType(classification.messageType),
      priority: classification.priority,
      title: ticketTitle(sanitized.text, classification.messageType),
      description: sanitized.text
    });
    await db.prepare(`
      UPDATE service_hub_messages
      SET ticket_id=?
      WHERE id=? AND tenant_id=?
    `).bind(ticket.id, messageId, channel.tenant_id).run();
  }

  return {
    accepted: true,
    duplicate: false,
    messageId,
    tenantId: channel.tenant_id,
    projectId: channel.project_id,
    channelId: channel.id,
    systemId: system.id,
    classification,
    route,
    ticket,
    nextAction: nextAction(route, ticket),
    contentRedacted: sanitized.redacted
  };
}

function duplicateResult(existing, channel) {
  return {
    accepted: true,
    duplicate: true,
    messageId: existing.id,
    ticketId: existing.ticket_id ?? null,
    tenantId: channel.tenant_id,
    projectId: channel.project_id,
    channelId: channel.id,
    messageType: existing.message_type ?? null,
    confidence: existing.confidence ?? null,
    nextAction: 'already_processed'
  };
}

function nextAction(route, ticket) {
  if (route.destination === 'sallamos') return 'handoff_to_sallamos';
  if (route.destination === 'valkiria') return 'valkiria_answer_or_clarify';
  if (route.destination === 'context_only') return 'context_recorded';
  if (route.destination === 'project_queue') return ticket ? 'project_ticket_created' : 'project_review';
  if (route.destination === 'allamo_service_desk') return ticket ? 'allamo_ticket_created' : 'allamo_review';
  return ticket ? 'human_review_ticket_created' : 'human_review';
}

function ticketSource(provider) {
  if (provider === 'whatsapp') return 'whatsapp';
  if (provider === 'sallamos') return 'sallamos';
  if (provider === 'portal') return 'portal';
  return 'api';
}

function ticketMessageType(messageType) {
  return ['incident','request','change','blocker','question'].includes(messageType) ? messageType : 'request';
}

function ticketTitle(text, messageType) {
  const compact = String(text ?? '').replace(/\s+/g, ' ').trim();
  const prefix = ({incident:'Incidente',request:'Solicitação',change:'Mudança',blocker:'Bloqueio',question:'Dúvida'})[messageType] ?? 'Atendimento';
  if (!compact) return prefix;
  return `${prefix} · ${compact.slice(0, 120)}`;
}

function validIso(value) {
  if (!value) return false;
  const time = Date.parse(String(value));
  return Number.isFinite(time);
}
function required(value, code, max=500) {
  const v = String(value ?? '').trim().slice(0,max);
  if (!v) throw httpError(400, code);
  return v;
}
function optional(value, max=500) {
  const v = String(value ?? '').trim().slice(0,max);
  return v || null;
}
function one(value, values, code) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!values.includes(v)) throw httpError(400, code);
  return v;
}
