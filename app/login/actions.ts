'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { endSession, startSession } from '@/lib/auth';
import type { ActionResult } from '@/lib/form';

// Basic brute-force protection: 5 failed attempts per email lock it for 15 minutes.
// In-memory, so it resets when the server restarts.
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function login(fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!email || !password) return { ok: false, error: 'Enter your email and password.' };

  const entry = failures.get(email);
  if (entry && entry.count >= MAX_FAILS && entry.until > Date.now()) {
    return { ok: false, error: 'Too many failed attempts. Try again in 15 minutes.' };
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    const count = entry && entry.until > Date.now() ? entry.count + 1 : 1;
    failures.set(email, { count, until: Date.now() + LOCK_MS });
    return { ok: false, error: 'Incorrect email or password.' };
  }

  failures.delete(email);
  try {
    await startSession(user);
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Login is not configured on the server (check AUTH_SECRET in .env).' };
  }
  return { ok: true, message: `Welcome, ${user.name}` };
}

export async function logout() {
  await endSession();
  redirect('/login');
}
