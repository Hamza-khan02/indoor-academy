// Signed session token. Kept free of database imports so proxy.ts (which runs before every request) can use it.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'ia_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = { uid: string; role: string };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is missing or too short. Set a long random value in .env');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (payload.typ === 'parent') return null; // a parent token never opens staff pages
    if (typeof payload.uid !== 'string' || typeof payload.role !== 'string') return null;
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
}

// ---- Parent / student app sessions (separate cookie and token type) ----

export const PARENT_COOKIE = 'ia_parent';
export const PARENT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type ParentSessionPayload = { fid: string; v: number };

export async function signParentSession(payload: ParentSessionPayload) {
  return new SignJWT({ ...payload, typ: 'parent' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PARENT_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifyParentSession(token: string): Promise<ParentSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (payload.typ !== 'parent' || typeof payload.fid !== 'string' || typeof payload.v !== 'number') return null;
    return { fid: payload.fid, v: payload.v };
  } catch {
    return null;
  }
}
