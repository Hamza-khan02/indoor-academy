'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import type { ActionResult } from '@/lib/form';
import { endParentSession, ensurePhoneKeys, phoneKey, startParentSession } from '@/lib/family';

// 5 wrong PINs for a phone lock it for 15 minutes (in memory; resets on server restart).
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const WRONG = 'Incorrect phone number or PIN.';

export async function parentLogin(fd: FormData): Promise<ActionResult> {
  const key = phoneKey(String(fd.get('phone') ?? ''));
  const pin = String(fd.get('pin') ?? '').trim();
  if (!key || !/^\d{6}$/.test(pin)) return { ok: false, error: 'Enter the registered phone number and the 6-digit PIN.' };

  const entry = failures.get(key);
  if (entry && entry.count >= MAX_FAILS && entry.until > Date.now()) {
    return { ok: false, error: 'Too many wrong attempts. Try again in 15 minutes.' };
  }

  const login = await db.familyLogin.findUnique({ where: { phoneKey: key } });
  const valid = login ? await bcrypt.compare(pin, login.pinHash) : false;
  if (!login || !valid) {
    const count = entry && entry.until > Date.now() ? entry.count + 1 : 1;
    failures.set(key, { count, until: Date.now() + LOCK_MS });
    return { ok: false, error: WRONG };
  }
  // Only reveal that a login is switched off to someone who knows its PIN.
  if (!login.active) return { ok: false, error: 'This login has been switched off. Please contact the academy.' };

  failures.delete(key);
  await ensurePhoneKeys();
  await db.familyLogin.update({ where: { id: login.id }, data: { lastLoginAt: new Date() } });
  try {
    await startParentSession(login);
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Login is not configured on the server. Please contact the academy.' };
  }
  return { ok: true, message: 'Welcome' };
}

export async function parentLogout() {
  await endParentSession();
  redirect('/parent/login');
}
