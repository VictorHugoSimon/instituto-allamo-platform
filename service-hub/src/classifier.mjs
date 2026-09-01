const patterns = {
  critical: [
    /\b(sistema|serviço|servico|portal|api)\s+(caiu|fora|indispon[ií]vel|parou)\b/i,
    /\bningu[eé]m\s+consegue\s+(acessar|entrar|usar)\b/i,
    /\bprodução\s+(parada|fora)\b/i
  ],
  blocker: [
    /\b(bloquead[oa]|bloqueio|impedindo|não conseguimos avançar|nao conseguimos avancar)\b/i,
    /\bdepend[eê]ncia\s+externa\b/i
  ],
  incident: [
    /\b(erro|falha|bug|problema|indispon[ií]vel|não funciona|nao funciona|não abre|nao abre|não atualiza|nao atualiza|travou|parou)\b/i,
    /\b(não consigo|nao consigo|não conseguimos|nao conseguimos)\b/i
  ],
  change: [
    /\b(alterar regra|mudar regra|mudança|mudanca|change|gmud|nova regra|ajustar comportamento)\b/i,
    /\bprecisamos que o sistema passe a\b/i
  ],
  request: [
    /\b(solicito|solicitação|solicitacao|precisamos de|gostaria de|poderia incluir|favor criar|criar acesso|habilitar)\b/i,
    /\b(implementar|adicionar|incluir)\b/i
  ],
  decision: [
    /\b(decidido|decisão|decisao|aprovado que|ficou definido|definimos que|acordado que)\b/i
  ],
  report: [
    /\b(report|status report|status do projeto|andamento|cronograma|próximos passos|proximos passos)\b/i
  ],
  question: [
    /\?\s*$/,
    /\b(como|onde|qual|quando|quem|por que|porque)\b.*\?/i,
    /\b(como faço|como faco|onde encontro|onde fica|consigo configurar|como configurar)\b/i
  ],
  social: [
    /^\s*(bom dia|boa tarde|boa noite|obrigad[oa]|valeu|ok|certo|perfeito|show|beleza)[!.\s]*$/i
  ]
};

export function classifyServiceMessage(value) {
  const text = normalize(value);
  if (!text) return result('context', 0.99, 'normal', false, ['empty_or_whitespace']);

  if (matches(patterns.social, text)) return result('social', 0.98, 'normal', false, ['social_only']);
  if (matches(patterns.critical, text)) return result('incident', 0.94, 'critical', true, ['critical_outage_signal']);
  if (matches(patterns.blocker, text)) return result('blocker', 0.91, 'high', true, ['blocker_signal']);
  if (matches(patterns.incident, text)) {
    const priority = /\b(urgente|cr[ií]tico|produção|producao|todos|ningu[eé]m)\b/i.test(text) ? 'high' : 'medium';
    return result('incident', 0.88, priority, true, ['incident_signal']);
  }
  if (matches(patterns.change, text)) return result('change', 0.84, 'medium', true, ['change_signal']);
  if (matches(patterns.decision, text)) return result('decision', 0.86, 'normal', false, ['decision_signal']);
  if (matches(patterns.report, text)) return result('report', 0.82, 'normal', false, ['report_signal']);
  if (matches(patterns.request, text)) return result('request', 0.79, 'normal', true, ['request_signal']);
  if (matches(patterns.question, text)) return result('question', 0.80, 'normal', false, ['question_signal']);

  const hasActionVerb = /\b(verificar|validar|ajustar|corrigir|analisar|resolver|retornar|confirmar)\b/i.test(text);
  if (hasActionVerb) return result('context', 0.52, 'normal', false, ['ambiguous_action'], true);

  return result('context', 0.68, 'normal', false, ['no_actionable_signal']);
}

function result(messageType, confidence, priority, actionable, reasons, needsReview=false) {
  return { messageType, confidence, priority, actionable, needsReview, reasons };
}

function matches(list, text) { return list.some((pattern) => pattern.test(text)); }
function normalize(value) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 8000); }
