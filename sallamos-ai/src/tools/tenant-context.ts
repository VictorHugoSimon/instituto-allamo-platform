import type { Env, SessionContext } from '../types';

const REGISTRY = ['tenant_config', 'user_permissions', 'feature_flags'] as const;
export type ToolName = typeof REGISTRY[number];

export async function callTool(env: Env, name: string, ctx: SessionContext): Promise<Record<string, unknown>> {
  if (!REGISTRY.includes(name as ToolName)) throw new Error('tool_not_allowed:' + name);

  if ((env.DEMO_MODE ?? 'false').toLowerCase() === 'true') return demoContext(name as ToolName, ctx);

  const base = (env.SALLAMOS_API_BASE ?? '').replace(/\/$/, '');
  if (!base) return { available: false, reason: 'sallamos_api_not_configured' };

  const res = await fetch(base + '/ai/context/' + name, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-caller': 'sallamos-ai' },
    body: JSON.stringify({ tenantId: ctx.tenantId, userId: ctx.userId })
  });

  if (!res.ok) return { available: false, reason: 'tool_unavailable' };
  return redact(await res.json());
}

function demoContext(name: ToolName, ctx: SessionContext): Record<string, unknown> {
  if (name === 'user_permissions') return { available: true, permissions: ctx.permissions };
  if (name === 'feature_flags') return { available: true, debito_automatico: true, dre_v42: true };
  return {
    available: true,
    module: 'financeiro', tenant: ctx.tenantId, version: ctx.productVersion, profile: ctx.profile,
    feature_flags: { debito_automatico: true, dre_v42: true }
  };
}

function redact(data: any): Record<string, unknown> {
  const BLOCK = /(cpf|cnpj|email|telefone|senha|token|secret|chave|conta_bancaria)/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (BLOCK.test(k)) continue;
    out[k] = typeof v === 'object' && v !== null ? redact(v) : v;
  }
  return out;
}
