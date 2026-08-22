import type { Env, SessionContext } from '../types';

export async function requireSession(req: Request, env: Env): Promise<SessionContext> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'missing_session');

  const mode = (env.AUTH_MODE ?? 'hmac').toLowerCase();
  if (mode === 'external') return validateExternalSession(token, env);

  const claims = await verifySessionToken(token, env.SALLAMOS_SESSION_SECRET);
  if (!claims) throw new HttpError(401, 'invalid_session');
  return normalizeClaims(claims);
}

export function requirePermission(ctx: SessionContext, permission: string) {
  const p = new Set(ctx.permissions ?? []);
  if (p.has(permission) || p.has('ai:*') || p.has('*')) return;
  throw new HttpError(403, 'forbidden');
}

async function validateExternalSession(token: string, env: Env): Promise<SessionContext> {
  const validateUrl = (env.SALLAMOS_AUTH_VALIDATE_URL ?? '').trim();
  if (!validateUrl) throw new HttpError(503, 'external_auth_not_configured');

  let res: Response;
  try {
    res = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
        ...(env.SALLAMOS_API_TOKEN ? { 'x-sallamos-ai-token': env.SALLAMOS_API_TOKEN } : {})
      },
      body: JSON.stringify({ audience: 'sallamos-ai-support' })
    });
  } catch {
    throw new HttpError(503, 'auth_provider_unavailable');
  }

  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'invalid_session');
  if (!res.ok) throw new HttpError(503, 'auth_provider_unavailable');

  const data: any = await res.json().catch(() => null);
  if (!data || data.valid === false) throw new HttpError(401, 'invalid_session');

  return normalizeClaims({
    sub: data.userId ?? data.sub,
    tenant: data.tenantId ?? data.tenant,
    profile: data.profile ?? data.role,
    permissions: data.permissions ?? [],
    version: data.productVersion ?? data.version,
    locale: data.locale ?? 'pt-BR'
  });
}

function normalizeClaims(claims: any): SessionContext {
  if (!claims?.sub || !claims?.tenant || !claims?.profile || !claims?.version) {
    throw new HttpError(401, 'invalid_session_claims');
  }
  return {
    tenantId: String(claims.tenant),
    userId: String(claims.sub),
    profile: String(claims.profile),
    permissions: Array.isArray(claims.permissions) ? claims.permissions.map(String) : [],
    productVersion: String(claims.version),
    locale: String(claims.locale ?? 'pt-BR')
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function issueSessionToken(secret: string, claims: Record<string, unknown>, ttlSeconds = 60 * 60): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payloadObj = { ...claims, iat: now, exp: now + ttlSeconds };
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const key = await importKey(secret, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return payload + '.' + base64UrlEncode(new Uint8Array(sig));
}

export async function verifySessionToken(token: string, secret: string): Promise<any | null> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !secret) return null;
  try {
    const key = await importKey(secret, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, base64UrlDecode(signature), new TextEncoder().encode(payload));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp <= now) return null;
    return claims;
  } catch { return null; }
}

async function importKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function base64UrlDecode(value: string): ArrayBuffer {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/'); while (normalized.length % 4) normalized += '=';
  const binary = atob(normalized); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
