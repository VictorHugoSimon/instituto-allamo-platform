const TICKETABLE = new Set(['incident', 'request', 'change', 'blocker']);
const NON_TICKETABLE = new Set(['question', 'decision', 'report', 'context', 'social']);
const VALID_PHASES = new Set(['implementation', 'hypercare', 'production', 'support', 'closed']);
const VALID_SYSTEMS = new Set(['sallamos', 'external', 'internal']);
const VALID_TYPES = new Set([...TICKETABLE, ...NON_TICKETABLE]);

export function routeServiceHub(input) {
  const tenantId = clean(input?.tenantId);
  const projectId = clean(input?.projectId);
  const systemKind = clean(input?.systemKind).toLowerCase();
  const phase = clean(input?.phase).toLowerCase();
  const messageType = clean(input?.messageType).toLowerCase();

  if (!tenantId || !projectId) throw new Error('tenant_and_project_required');
  if (!VALID_SYSTEMS.has(systemKind)) throw new Error('invalid_system_kind');
  if (!VALID_PHASES.has(phase)) throw new Error('invalid_lifecycle_phase');
  if (!VALID_TYPES.has(messageType)) throw new Error('invalid_message_type');

  if (messageType === 'question') {
    return decision('valkiria', false, 'answer_or_clarify', input);
  }
  if (messageType === 'social' || messageType === 'context' || messageType === 'report') {
    return decision('context_only', false, 'record_context', input);
  }
  if (messageType === 'decision') {
    return decision('project_queue', false, 'record_project_decision', input);
  }

  if (systemKind === 'sallamos' && phase === 'production') {
    return decision('sallamos', true, 'official_sallamos_ticket', input);
  }

  if (systemKind === 'sallamos' && (phase === 'implementation' || phase === 'hypercare')) {
    return decision('project_queue', true, 'implementation_transition_ticket', input);
  }

  if ((systemKind === 'external' || systemKind === 'internal') && phase === 'support') {
    return decision('allamo_service_desk', true, 'allamo_support_ticket', input);
  }

  if ((systemKind === 'external' || systemKind === 'internal') && (phase === 'implementation' || phase === 'hypercare')) {
    return decision('project_queue', true, 'project_delivery_ticket', input);
  }

  if (phase === 'closed') {
    return decision('human_review', TICKETABLE.has(messageType), 'closed_project_requires_review', input);
  }

  return decision('human_review', TICKETABLE.has(messageType), 'routing_rule_not_defined', input);
}

function decision(destination, ticketRequired, reason, input) {
  return {
    tenantId: clean(input.tenantId),
    projectId: clean(input.projectId),
    systemKind: clean(input.systemKind).toLowerCase(),
    phase: clean(input.phase).toLowerCase(),
    messageType: clean(input.messageType).toLowerCase(),
    destination,
    ticketRequired,
    reason,
    official: destination === 'sallamos' || destination === 'allamo_service_desk'
  };
}

function clean(value) {
  return String(value ?? '').trim();
}
