// All "calendar" dates in the app are India-time strings: 'YYYY-MM-DD' and months 'YYYY-MM'.
export const TIME_ZONE = 'Asia/Kolkata';
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function istParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { y: get('year'), m: get('month'), d: get('day'), h: Number(get('hour')) };
}

/** Today's date in India, e.g. '2026-11-20'. */
export function todayISO(now = new Date()) {
  const p = istParts(now);
  return `${p.y}-${p.m}-${p.d}`;
}

export function currentMonth(now = new Date()) {
  return todayISO(now).slice(0, 7);
}

function utc(iso: string) {
  return new Date(iso + 'T00:00:00Z');
}

export function addDays(iso: string, n: number) {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The last n dates ending today, oldest first. */
export function lastNDays(n: number, end = todayISO()) {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** The last n months ending with `end`, oldest first. */
export function lastNMonths(n: number, end = currentMonth()) {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - (n - 1)));
}

export function weekdayShort(iso: string) {
  return WEEKDAYS[utc(iso).getUTCDay()];
}

/** 'FRIDAY, 20 NOVEMBER 2026' style header date. */
export function formatLongDate(iso: string) {
  const d = utc(iso);
  return `${WEEKDAYS_LONG[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** '20 Nov 2026' */
export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = utc(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** 'Nov 2026' */
export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** '16:00' -> '04:00 PM' */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

export function greeting(now = new Date()) {
  const h = istParts(now).h;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Age in whole years from a 'YYYY-MM-DD' birth date. */
export function ageFrom(dob?: string | null, today = todayISO()) {
  if (!dob) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}
