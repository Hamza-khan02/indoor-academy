// Time helpers for bookings. Times are minutes from midnight (India time); days are 'YYYY-MM-DD'.
// Pure functions, safe in client and server code.
import { formatTime } from '../dates';

/** Slots are held in 15-minute blocks. */
export const BLOCK = 15;
const IST_OFFSET_MIN = 330;

/** '16:30' -> 990, or null when it is not a time. */
export function toMin(hhmm: string | null | undefined) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 990 -> '16:30' */
export function fromMin(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** 990 -> '04:30 PM'. Midnight at the end of a day (1440) reads '12:00 AM'. */
export const timeLabel = (min: number) => formatTime(fromMin(min % 1440));
/** '04:30 PM – 06:00 PM'; a range that covers the whole day reads 'All day (24 hours)'. */
export const rangeLabel = (startMin: number, endMin: number) => (startMin === 0 && endMin === 1440 ? 'All day (24 hours)' : `${timeLabel(startMin)} – ${timeLabel(endMin)}`);

export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} hr` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min';
}

/** The 15-minute block numbers a time range covers. */
export function blocksOf(startMin: number, endMin: number) {
  const blocks: number[] = [];
  for (let b = Math.floor(startMin / BLOCK); b * BLOCK < endMin; b++) blocks.push(b);
  return blocks;
}

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Saturday or Sunday. */
export function isWeekend(iso: string) {
  const day = new Date(iso + 'T00:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

/** Today's date and the time now, in India. */
export function nowIST(now = new Date()) {
  const d = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** The moment a day + time in India happens. */
export function instantOf(iso: string, min: number) {
  return new Date(Date.parse(iso + 'T00:00:00Z') + (min - IST_OFFSET_MIN) * 60_000);
}

/** Hours from now until a day + time in India (negative when it has passed). */
export function hoursUntil(iso: string, min: number, now = new Date()) {
  return (instantOf(iso, min).getTime() - now.getTime()) / 3_600_000;
}

/** Whole days from one date to another, counting both: a same-day rental is 1 day. */
export function rentalDays(from: string, to: string | null | undefined) {
  if (!to || to < from) return 1;
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000) + 1;
}

/** The start times a facility offers: one per slot from opening to closing. */
export function slotStarts(openTime: number, closeTime: number, slotMinutes: number) {
  const starts: number[] = [];
  for (let t = openTime; t + slotMinutes <= closeTime; t += slotMinutes) starts.push(t);
  return starts;
}

/** Quarter-hour times for dropdowns: [{ value: 360, label: '06:00 AM' }, ...] */
export function quarterHours(from = 0, to = 24 * 60) {
  const out: { value: number; label: string }[] = [];
  for (let t = from; t <= to; t += BLOCK) out.push({ value: t, label: t === 1440 ? '12:00 AM (midnight)' : timeLabel(t) });
  return out;
}
