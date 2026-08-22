import type { Env } from '../types';
import { issueSessionToken } from '../auth/session';

export async function handleDemoSession(env: Env) {
  if ((env.DEMO_MODE ?? 'false').toLowerCase() !== 'true') {
    return { error: 'demo_disabled' };
  }

  const token = await issueSessionToken(env.SALLAMOS_SESSION_SECRET, {
    sub: 'demo-renato',
    tenant: 'esposende-calcados',
    profile: 'financeiro:editor',
    permissions: ['ai:support:query', 'ai:feedback:create'],
    version: '4.2.0',
    locale: 'pt-BR'
  }, 60 * 30);

  return {
    token,
    user: { name: 'Renato Cabral', profile: 'financeiro' },
    tenant: 'esposende-calcados',
    version: '4.2.0',
    expiresIn: 1800
  };
}
