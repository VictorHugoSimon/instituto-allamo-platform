import type { Decision, ModelOutput } from '../types';

export interface PolicyResult { decision: Decision; reason?: string; }

export function applyPolicies(decision: Decision, out: ModelOutput, hasSources: boolean): PolicyResult {
  if (decision !== 'escalate' && !hasSources) return { decision: 'escalate', reason: 'no_sources' };
  if (decision === 'answer' && out.needs_clarification) return { decision: 'clarify', reason: 'model_requested_clarification' };
  if (decision === 'answer' && out.risk_level === 'high') return { decision: 'escalate', reason: 'high_risk_topic' };
  if (decision === 'answer' && out.missing_context.length > 0) return { decision: 'clarify', reason: 'missing_context' };
  return { decision };
}
