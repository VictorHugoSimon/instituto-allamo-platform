import type { Env, SessionContext } from '../types';

export async function requireSession(req: Request, env: Env): Promise<SessionContext> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'missing_session');

  const claims = await verifySessionToken(token, env.SALLAMOS_SESSION_SECRET);
  if (!claims) throw new HttpError(401, 'invalid_session');

  return {
    tenantId: claims.tenant,
    userId: claims.sub,
    profile: claims.profile,
    permissions: claims.permissions ?? [],
    productVersion: claims.version,
    locale: claims.locale ?? 'pt-BR'
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function issueSessionToken(
  secret: string,
  claims: Record<string, unknown>,
  ttlSeconds = 60 * 60
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payloadObj = { ...claims, iat: now, exp: now + ttlSeconds };
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const key = await importKey(secret, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return payload + '.' + base64UrlEncode(new Uint8Array(sig));
}

export async function verifySessionToken(token: string, secret: string): Promise<any | null> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  try {
    const key = await importKey(secret, ['verify']);
    const ok = await crypto.subtle.verify(
      'HMAC', key, base64UrlDecode(signature), new TextEncoder().encode(payload)
    );
    if (!ok) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    const now = Math.floor(Date.now() / 1000);
    if (!claims?.sub || !claims?.tenant || !claims?.version || !claims?.profile) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

async function importKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, usage
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): ArrayBuffer {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
