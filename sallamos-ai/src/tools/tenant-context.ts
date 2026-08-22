import type { Env, SessionContext } from '../types';
import { fetchWithTimeout, timeoutFrom } from '../http/outbound';
import { sanitizeForStorage } from '../privacy/redact';

const REGISTRY = ['tenant_config', 'user_permissions', 'feature_flags'] as const;
export type ToolName = typeof REGISTRY[number];

export async function callTool(env: Env, name: string, ctx: SessionContext): Promise<Record<string, unknown>> {
  if (!REGISTRY.includes(name as ToolName)) throw new Error('tool_not_allowed:' + name);
  if ((env.DEMO_MODE ?? 'false').toLowerCase() === 'true' && env.ENVIRONMENT !== 'production') return demoContext(name as ToolName, ctx);
  const base = (env.SALLAMOS_API_BASE ?? '').replace(/\/$/, '');
  if (!base) return { available:false, reason:'sallamos_api_not_configured' };
  try {
    const res = await fetchWithTimeout(base + '/ai/context/' + name, {
      method:'POST', headers:{ 'content-type':'application/json', 'x-internal-caller':'sallamos-ai', ...(env.SALLAMOS_API_TOKEN ? { authorization:'Bearer ' + env.SALLAMOS_API_TOKEN } : {}) },
      body: JSON.stringify({ tenantId:ctx.tenantId, userId:ctx.userId, productVersion:ctx.productVersion })
    }, { timeoutMs: timeoutFrom(env.CONTEXT_TIMEOUT_MS, 1800), retries:1, retryStatuses:[408,500,502,503,504] });
    if (!res.ok) return { available:false, reason:'tool_unavailable', status:res.status };
    return sanitizeForStorage(await res.json()) as Record<string, unknown>;
  } catch (error: any) {
    return { available:false, reason: error?.name === 'AbortError' ? 'tool_timeout' : 'tool_unavailable' };
  }
}

function demoContext(name: ToolName, ctx: SessionContext): Record<string, unknown> {
  if (name === 'user_permissions') return { available:true, permissions:ctx.permissions };
  if (name === 'feature_flags') return { available:true, debito_automatico:true, dre_v42:true };
  return { available:true, module:'financeiro', tenant:ctx.tenantId, version:ctx.productVersion, profile:ctx.profile, feature_flags:{ debito_automatico:true, dre_v42:true } };
}
