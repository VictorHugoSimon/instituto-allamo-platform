import type { Env } from '../types';

const MODULES = [
  'financeiro', 'dre', 'obz', 'conciliacao', 'fiscal',
  'contas_pagar', 'contas_receber', 'suprimentos', 'relatorios'
];

export interface Intent {
  intent: string;
  module?: string;
  riskLevel: 'low' | 'medium' | 'high';
  needsTenantContext: boolean;
}

export async function classify(env: Env, question: string): Promise<Intent> {
  const q = question.toLowerCase();
  const module = MODULES.find(m => q.includes(m.replace('_', ' ')) || q.includes(m));
  const fiscal = /(imposto|reten|nota fiscal|nfe|tributa)/.test(q);
  const money = /(pagamento|boleto|cobran|valor|saldo|banc)/.test(q);
  const navigation = /(onde|como (crio|criar|fa[çc]o)|cadastr|configur)/.test(q);
  const broken = /(erro|n[ãa]o (aparece|funciona|abre)|sumiu|travou|divergen)/.test(q);
  return {
    intent: navigation ? 'support_navigation' : broken ? 'support_troubleshooting' : fiscal ? 'support_fiscal_rule' : 'support_unknown',
    module: module ?? (fiscal ? 'fiscal' : undefined),
    riskLevel: fiscal ? 'high' : money ? 'medium' : 'low',
    needsTenantContext: broken || fiscal
  };
}
