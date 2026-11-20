// Signed session token. Kept free of Node-only imports so middleware (edge runtime) can use it.
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
    if (typeof payload.uid !== 'string' || typeof payload.role !== 'string') return null;
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
}
