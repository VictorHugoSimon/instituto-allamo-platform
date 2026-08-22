import type { Decision, Hit, Signals } from '../types';

export function computeConfidence(sig: Signals): number {
  const c =
    0.30 * sig.retrievalRelevance +
    0.20 * sig.sourceAuthority +
    0.15 * sig.recency +
    0.15 * sig.corroboration +
    0.10 * sig.minimumContext +
    0.10 * (1 - sig.actionRisk);

  return Math.max(0, Math.min(1, c));
}

export function decide(confidence: number, answerAt: number, clarifyAt: number): Decision {
  if (confidence >= answerAt) return 'answer';
  if (confidence >= clarifyAt) return 'clarify';
  return 'escalate';
}

const AUTHORITY_WEIGHT: Record<string, number> = {
  tool: 1.0, doc: 0.9, release: 0.8, code: 0.7, faq: 0.6, history: 0.3
};

const HIGH_RISK_MODULES = ['fiscal', 'financeiro', 'folha'];

export function extractSignals(hits: Hit[],ctx: { module?: string; version?: string; hasTenantContext: boolean },riskLevel: 'low' | 'medium' | 'high'): Signals {
  const top = hits[0];
  const distinctDocs = new Set(hits.map(h => h.documentId)).size;
  const distinctTypes = new Set(hits.map(h => h.sourceType)).size;
  const versionMatch = hits.filter(h => !ctx.version || h.version === ctx.version).length;
  const risk = riskLevel === 'high' ? 1 : riskLevel === 'medium' ? 0.6 : ctx.module && HIGH_RISK_MODULES.includes(ctx.module) ? 0.5 : 0.1;
  return {
    retrievalRelevance: top ? top.score : 0,
    sourceAuthority: top ? (AUTHORITY_WEIGHT[top.sourceType] ?? 0.5) : 0,
    recency: hits.length ? versionMatch / hits.length : 0,
    corroboration: distinctDocs >= 2 && distinctTypes >= 2 ? 1 : distinctDocs >= 2 ? 0.6 : 0,
    minimumContext: ctx.hasTenantContext ? 1 : ctx.module ? 0.5 : 0.2,
    actionRisk: risk
  };
}
