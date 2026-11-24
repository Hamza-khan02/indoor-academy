'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import type { ActionResult } from '@/lib/form';
import { timeLabel } from '@/lib/rentals/time';

type Slot = { startMin: number; free: boolean; maxSlots: number; left: number };
type SlotsResult = { slots: Slot[]; wholeDayFree: boolean; dayOpen: boolean } | null;

/** Pick a new day (and start time) for a booking. The server checks the new slot is really free. */
export function Reschedule({
  bookingId, timed, slotsNeeded, today, lastDay, currentDate, units = [], loadSlots, action,
}: {
  bookingId: string;
  /** false for whole-day and equipment-only bookings: only the day changes. */
  timed: boolean;
  slotsNeeded: number;
  today: string;
  lastDay?: string;
  currentDate: string;
  /** Staff only: lets them move the booking to a particular unit. */
  units?: { id: string; name: string }[];
  loadSlots: (date: string) => Promise<SlotsResult>;
  action: (id: string, change: { date: string; startMin: number | null; resourceId: string | null }) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(currentDate >= today ? currentDate : today);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [unit, setUnit] = useState('');
  const [day, setDay] = useState<SlotsResult>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setDay(null);
    setStartMin(null);
    loadSlots(date).then((r) => live && setDay(r)).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const r = await action(bookingId, { date, startMin: timed ? startMin : null, resourceId: unit || null });
      setMessage({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? '' });
      if (r.ok) { setOpen(false); router.refresh(); }
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server. Please try again.' });
    }
    setPending(false);
  }

  if (!open) {
    return (
      <>
        <button type="button" className="secondary-btn" onClick={() => setOpen(true)}><CalendarClock size={15} /> Reschedule</button>
        {message?.ok && <span className="c-present" role="status" style={{ fontSize: 12 }}>{message.text}</span>}
      </>
    );
  }
  const usable = day?.slots.filter((s) => s.free && s.maxSlots >= slotsNeeded) ?? [];
  const canSave = timed ? startMin !== null : Boolean(day?.wholeDayFree) || !day;
  return (
    <div className="rn-step" style={{ width: '100%', marginBottom: 0 }}>
      <h3><span><CalendarClock size={14} /></span> Move this booking</h3>
      <div className="rn-date-row" style={{ marginTop: 0, marginBottom: 12 }}>
        New day: <input type="date" value={date} min={today} max={lastDay} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="New date" />
        {units.length > 1 && (
          <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit" className="rn-unit-select">
            <option value="">Same or first free unit</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>
      {timed && (
        !day ? <p className="rn-empty">Loading the free slots…</p>
          : usable.length === 0 ? <p className="rn-note warn">No free slot of this length on that day. Try another day.</p>
          : (
            <div className="rn-slots">
              {usable.map((s) => (
                <button type="button" key={s.startMin} className={s.startMin === startMin ? 'on' : undefined} onClick={() => setStartMin(s.startMin)} aria-pressed={s.startMin === startMin}>
                  {timeLabel(s.startMin)}<small>free</small>
                </button>
              ))}
            </div>
          )
      )}
      {!timed && day && !day.wholeDayFree && <p className="rn-note warn">That day is not free. Try another day.</p>}
      {message && !message.ok && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{message.text}</p>}
      <div className="rn-actions" style={{ marginTop: 14 }}>
        <button type="button" className="primary-btn" disabled={!canSave || pending} onClick={save}>{pending ? 'Moving…' : 'Move booking'}</button>
        <button type="button" className="secondary-btn" onClick={() => setOpen(false)} disabled={pending}>Keep current time</button>
      </div>
    </div>
  );
}
