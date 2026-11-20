'use server';

import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { actionAdmin } from './auth';
import { FormError, run, text } from './form';
import { displayPhone, ensurePhoneKeys, phoneKey } from './family';
import { fillTemplate, whatsappUrl } from './messages';
import { getSettings } from './settings';

export type PinResult = {
  ok: boolean;
  error?: string;
  message?: string;
  pin?: string;
  phone?: string;
  loginUrl?: string;
  /** True when the link only works on this computer (app not online yet). */
  localOnly?: boolean;
  text?: string;
  waUrl?: string | null;
};

/** Where parents open the app: the saved public address, else the address the admin is using now. */
async function portalLoginUrl() {
  const settings = await getSettings();
  let base = settings.publicUrl;
  if (!base) {
    const h = headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? 'http';
    base = `${proto}://${host}`;
  }
  const url = `${base.replace(/\/+$/, '')}/parent/login`;
  const hostname = new URL(url).hostname;
  const localOnly = hostname === 'localhost' || hostname.startsWith('127.') || hostname === '[::1]';
  return { url, localOnly, settings };
}

/**
 * Creates the parent app login for a student's guardian phone, or replaces its PIN.
 * The PIN is returned once (only its hash is stored). Resetting logs the family out everywhere.
 */
export async function issueParentPin(studentId: string): Promise<PinResult> {
  try {
    const admin = await actionAdmin();
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) throw new FormError('This student no longer exists.');
    const key = phoneKey(student.guardianPhone);
    if (!key) throw new FormError("The guardian phone number isn't valid, so a login can't be made. Fix the phone number first.");
    // Link older student records (saved before the parent app) so every sibling is included.
    await ensurePhoneKeys();
    if (student.guardianPhoneKey !== key) await db.student.update({ where: { id: student.id }, data: { guardianPhoneKey: key } });

    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const pinHash = await bcrypt.hash(pin, 10);
    const existing = await db.familyLogin.findUnique({ where: { phoneKey: key } });
    if (existing) {
      await db.familyLogin.update({ where: { id: existing.id }, data: { pinHash, active: true, sessionVersion: { increment: 1 } } });
    } else {
      await db.familyLogin.create({ data: { phoneKey: key, pinHash, createdBy: admin.name } });
    }

    const children = await db.student.findMany({ where: { guardianPhoneKey: key, status: { not: 'INACTIVE' } }, orderBy: { name: 'asc' }, select: { name: true } });
    const names = (children.length ? children : [student]).map((c) => c.name);
    const { url, localOnly, settings } = await portalLoginUrl();
    const message = fillTemplate(settings.parentAccessTemplate, {
      parent: student.guardianName || 'Sir/Madam',
      students: names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0],
      academy: settings.academyName,
      link: url,
      phone: displayPhone(key),
      pin,
    });
    revalidatePath('/', 'layout');
    return {
      ok: true,
      message: existing ? 'New PIN created. The old PIN no longer works.' : 'Parent app login created.',
      pin,
      phone: displayPhone(key),
      loginUrl: url,
      localOnly,
      text: message,
      waUrl: whatsappUrl(student.guardianPhone, message),
    };
  } catch (e: any) {
    if (e instanceof FormError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function setFamilyLoginActive(id: string, active: boolean) {
  return run(async () => {
    await actionAdmin();
    await db.familyLogin.update({ where: { id }, data: { active, ...(active ? {} : { sessionVersion: { increment: 1 } }) } });
    revalidatePath('/', 'layout');
    return active ? 'Parent login switched on' : 'Parent login switched off; the family has been logged out';
  });
}

export async function deleteFamilyLogin(id: string) {
  return run(async () => {
    await actionAdmin();
    await db.familyLogin.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return 'Parent login removed';
  });
}

export async function updatePortalSettings(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    let value = text(fd, 'publicUrl', { label: 'App address', max: 200 }) ?? '';
    if (value) {
      if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
      try {
        const u = new URL(value);
        value = `${u.protocol}//${u.host}`;
      } catch {
        throw new FormError('Enter a web address like https://academy.example.com');
      }
    }
    await db.setting.upsert({ where: { key: 'publicUrl' }, create: { key: 'publicUrl', value }, update: { value } });
    revalidatePath('/', 'layout');
    return value ? `Parent app address set to ${value}` : 'Parent app address cleared';
  });
}
