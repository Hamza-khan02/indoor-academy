// Small helpers for reading and validating FormData inside server actions.

/** `message` is set when ok, `error` when not. */
export type ActionResult = { ok: boolean; message?: string; error?: string };

/** An error whose message is safe to show to the user. */
export class FormError extends Error {}

/** Runs an action body and turns errors into a user-facing result. */
export async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (e: any) {
    if (e instanceof FormError) return { ok: false, error: e.message };
    if (e?.code === 'P2002') return { ok: false, error: 'A record with these details already exists.' };
    if (e?.code === 'P2003' || e?.code === 'P2014') {
      return { ok: false, error: 'This record is still linked to other records. Move or remove those first.' };
    }
    if (e?.code === 'P2025') return { ok: false, error: 'This record no longer exists. Refresh the page.' };
    console.error(e);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

type TextOpts = { required?: boolean; label?: string; max?: number };

export function text(fd: FormData, key: string, opts: TextOpts & { required: true }): string;
export function text(fd: FormData, key: string, opts?: TextOpts): string | null;
export function text(fd: FormData, key: string, { required = false, label = key, max = 200 }: TextOpts = {}) {
  const raw = fd.get(key);
  // Browsers send line breaks as \r\n; store plain \n.
  const value = typeof raw === 'string' ? raw.trim().replace(/\r\n?/g, '\n') : '';
  if (!value) {
    if (required) throw new FormError(`${label} is required.`);
    return null;
  }
  if (value.length > max) throw new FormError(`${label} must be at most ${max} characters.`);
  return value;
}

export function int(
  fd: FormData,
  key: string,
  { required = false, label = key, min = -Infinity, max = Infinity }: { required?: boolean; label?: string; min?: number; max?: number } = {},
) {
  const value = text(fd, key, { label });
  if (value === null) {
    if (required) throw new FormError(`${label} is required.`);
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n)) throw new FormError(`${label} must be a whole number.`);
  if (n < min || n > max) throw new FormError(`${label} must be between ${min} and ${max}.`);
  return n;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function date(fd: FormData, key: string, opts: { required?: boolean; label?: string } = {}) {
  const value = text(fd, key, opts);
  if (value !== null && (!DATE_RE.test(value) || Number.isNaN(Date.parse(value)))) {
    throw new FormError(`${opts.label ?? key} is not a valid date.`);
  }
  return value;
}

export function month(fd: FormData, key: string, opts: { required?: boolean; label?: string } = {}) {
  const value = text(fd, key, opts);
  if (value !== null && !MONTH_RE.test(value)) throw new FormError(`${opts.label ?? key} is not a valid month.`);
  return value;
}

export function time(fd: FormData, key: string, opts: { required?: boolean; label?: string } = {}) {
  const value = text(fd, key, opts);
  if (value !== null && !TIME_RE.test(value)) throw new FormError(`${opts.label ?? key} is not a valid time.`);
  return value;
}

export function oneOf<T extends string>(
  fd: FormData,
  key: string,
  options: readonly T[],
  { required = false, label = key }: { required?: boolean; label?: string } = {},
): T | null {
  const value = text(fd, key, { required, label });
  if (value === null) return null;
  if (!options.includes(value as T)) throw new FormError(`Choose a valid ${label.toLowerCase()}.`);
  return value as T;
}

export function phone(fd: FormData, key: string, opts: { required?: boolean; label?: string } = {}) {
  const value = text(fd, key, { ...opts, max: 20 });
  if (value !== null) {
    const digits = value.replace(/\D/g, '');
    if (!/^[+\d\s-]+$/.test(value) || digits.length < 10 || digits.length > 13) {
      throw new FormError(`${opts.label ?? key} must be a valid phone number.`);
    }
  }
  return value;
}

export function email(fd: FormData, key: string, opts: { required?: boolean; label?: string } = {}) {
  const value = text(fd, key, { ...opts, max: 120 });
  if (value !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new FormError(`${opts.label ?? key} must be a valid email address.`);
  }
  return value?.toLowerCase() ?? null;
}
