import { json, error } from '../_shared/cors.ts';

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'votre_cle_secrete_super_secure_123';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
}

// Minimal JWT verify (HS256) without external deps
async function verifyJwt(token: string, secret: string): Promise<AuthUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = parts[0] + '.' + parts[1];
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { id: payload.id, email: payload.email, username: payload.username };
  } catch {
    return null;
  }
}

export async function signJwt(payload: object, secret: string, expiresInDays = 30): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 86400;
  const body = btoa(JSON.stringify({ ...payload, exp }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${header}.${body}.${sig}`;
}

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) return null;
  return verifyJwt(token, JWT_SECRET);
}

export async function requireAuth(req: Request): Promise<AuthUser | Response> {
  const user = await getAuthUser(req);
  if (!user) return error('Access denied. No token provided.', 401);
  return user;
}

export { JWT_SECRET };
