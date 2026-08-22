import type { Env } from '../types';
import { issueSessionToken } from '../auth/session';

export async function handleDemoSession(env: Env) {
  if ((env.DEMO_MODE ?? 'false').toLowerCase() !== 'true' || env.ENVIRONMENT === 'production') {
    return { error: 'demo_disabled' };
  }

  const token = await issueSessionToken(env.SALLAMOS_SESSION_SECRET, {
    sub: 'stage-demo-user', tenant: 'stage-demo-tenant', profile: 'financeiro:editor',
    permissions: ['ai:support:query','ai:feedback:create','ai:escalation:create','ai:dashboard:read'],
    version: '4.2.0', locale: 'pt-BR'
  }, 60 * 30);

  return { token, user: { name: 'Usuário Stage', profile: 'financeiro' }, tenant: 'stage-demo-tenant', version: '4.2.0', expiresIn: 1800 };
}
