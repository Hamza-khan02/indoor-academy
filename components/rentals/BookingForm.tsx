'use client';

// The booking form, used by customers (on /book) and by staff (manual bookings). It only
// collects choices and shows what the server says: free slots, the price and the result all
// come from server actions, which check everything again before a booking is made.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, Loader2, Minus, Plus, Tag } from 'lucide-react';
import type { ActionResult } from '@/lib/form';
import { inr } from '@/lib/format';
import type { BookingInput } from '@/lib/rentals/booking';
import { OFFLINE_METHODS } from '@/lib/rentals/constants';
import type { Quote } from '@/lib/rentals/pricing';
import { durationLabel, timeLabel } from '@/lib/rentals/time';

type Slot = { startMin: number; free: boolean; maxSlots: number; left: number };
type SlotsResult = { slots: Slot[]; wholeDayFree: boolean; dayOpen: boolean } | null;
type QuoteResult = { ok: true; quote: Quote; isStudent: boolean; promoError: string | null; payNow: number } | { ok: false; error: string };

export type FormFacility = {
  id: string; name: string; category: string; slotMinutes: number; maxSlots: number; capacity: number;
  wholeDay: boolean; equipmentOnly: boolean;
  packages: { id: string; name: string; description: string | null; includesNet: boolean; includesOperator: boolean; includesBalls: boolean }[];
  resources: { id: string; name: string }[];
};
export type FormItem = { id: string; name: string; rentalPrice: number; priceUnit: string };

type Props = {
  mode: 'customer' | 'staff';
  facility: FormFacility;
  items: FormItem[];
  today: string;
  lastDay: string;
  /** Customer side: who is booking. null = not logged in yet. */
  booker: { kind: 'CUSTOMER' } | { kind: 'FAMILY'; students: { id: string; name: string; active: boolean }[] } | null;
  /** Staff side: students that can be picked for a student booking. */
  students?: { id: string; name: string; phone: string }[];
  onlineAvailable: boolean;
  payAtVenue: boolean;
  initial?: { date?: string; startMin?: number; resourceId?: string; packageId?: string; slots?: number };
  loginHref: string;
  successBase: string;
  loadSlots: (facilityId: string, date: string, packageId: string | null) => Promise<SlotsResult>;
  getQuote: (input: BookingInput) => Promise<QuoteResult>;
  submit: (input: BookingInput, payment: { amount: number; method: string; reference: string } | null) => Promise<ActionResult & { id?: string }>;
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const plusDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

export function BookingForm(props: Props) {
  const { mode, facility, items, today, lastDay, booker, students = [], initial = {} } = props;
  const staff = mode === 'staff';
  const router = useRouter();
  const [date, setDate] = useState(initial.date && initial.date >= today ? initial.date : today);
  const [packageId, setPackageId] = useState<string | null>(initial.packageId ?? (facility.packages.length === 1 ? facility.packages[0].id : null));
  const [startMin, setStartMin] = useState<number | null>(initial.startMin ?? null);
  const [slots, setSlots] = useState(initial.slots ?? 1);
  const [resourceId, setResourceId] = useState(initial.resourceId ?? '');
  const [returnDate, setReturnDate] = useState(date);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [players, setPlayers] = useState('');
  const [notes, setNotes] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [method, setMethod] = useState<'ONLINE' | 'PAY_AT_VENUE'>(props.onlineAvailable && !staff ? 'ONLINE' : 'PAY_AT_VENUE');
  const family = booker?.kind === 'FAMILY' ? booker.students : [];
  const [studentId, setStudentId] = useState(family.find((s) => s.active)?.id ?? family[0]?.id ?? '');
  // Staff: the customer
  const [walkStudent, setWalkStudent] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payRef, setPayRef] = useState('');

  const [day, setDay] = useState<SlotsResult>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const seq = useRef(0);

  const needsPackage = facility.category === 'BOWLING_MACHINE' && facility.packages.length > 0;
  const timed = !facility.wholeDay && !facility.equipmentOnly;
  const chosenSlot = day?.slots.find((s) => s.startMin === startMin) ?? null;
  const maxSlots = chosenSlot ? Math.max(1, chosenSlot.maxSlots) : 1;
  const equipment = useMemo(() => Object.entries(qty).filter(([, n]) => n > 0).map(([itemId, n]) => ({ itemId, qty: n })), [qty]);

  // Free slots for the chosen day (and package: a machine + net package needs both to be free).
  useEffect(() => {
    if (facility.equipmentOnly) return;
    let live = true;
    setLoadingSlots(true);
    props.loadSlots(facility.id, date, packageId).then((r) => {
      if (!live) return;
      setDay(r);
      setLoadingSlots(false);
      setStartMin((current) => (current !== null && r?.slots.some((s) => s.startMin === current && s.free) ? current : null));
    }).catch(() => live && setLoadingSlots(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facility.id, date, packageId]);

  useEffect(() => { if (slots > maxSlots) setSlots(maxSlots); }, [slots, maxSlots]);
  useEffect(() => { if (returnDate < date) setReturnDate(date); }, [date, returnDate]);

  const who: BookingInput['who'] | null = staff
    ? { kind: 'WALK_IN', name, phone, email: email || null, studentId: walkStudent || null }
    : booker?.kind === 'FAMILY' ? (studentId ? { kind: 'FAMILY', familyLoginId: '', studentId } : null)
    : booker?.kind === 'CUSTOMER' ? { kind: 'CUSTOMER', customerId: '' } : null;

  const ready = (!needsPackage || packageId) && (timed ? startMin !== null : facility.equipmentOnly ? equipment.length > 0 : Boolean(day?.wholeDayFree));
  const input: BookingInput | null = ready
    ? {
        facilityId: facility.id, packageId, date, startMin, slots, resourceId: staff && resourceId ? resourceId : null,
        equipment, returnDate: facility.equipmentOnly ? returnDate : null,
        players: players ? Number(players) : null, notes, promoCode: promoCode || null, paymentMethod: method,
        // The server fills in who the logged-in customer is; the ids here are only placeholders.
        who: who ?? { kind: 'WALK_IN', name: '', phone: '' },
      }
    : null;
  const inputKey = input ? JSON.stringify({ ...input, notes: undefined, who: staff ? { walkStudent } : studentId }) : '';

  // Price from the server whenever the choices change.
  useEffect(() => {
    if (!input) { setQuote(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      props.getQuote(input).then((q) => { if (mine === seq.current) setQuote(q); }).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  async function confirm() {
    if (!input) return;
    setError(null);
    setPending(true);
    try {
      const amount = staff && payAmount ? Number(payAmount) : 0;
      const result = await props.submit(input, amount > 0 ? { amount, method: payMethod, reference: payRef } : null);
      if (result.ok && result.id) {
        router.push(props.successBase + result.id);
        router.refresh();
        return;
      }
      setError(result.error ?? 'Could not make the booking. Please try again.');
      // The slot may have just been taken: show the day again.
      if (!facility.equipmentOnly) props.loadSlots(facility.id, date, packageId).then(setDay).catch(() => {});
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setPending(false);
  }

  const days = Array.from({ length: 14 }, (_, i) => plusDays(today, i)).filter((d) => d <= lastDay);
  const q = quote && 'quote' in quote ? quote : null;
  let step = 0;

  return (
    <div className="rn-wizard">
      <div>
        <section className="rn-step">
          <h3><span>{++step}</span> {facility.equipmentOnly ? 'Pick-up day' : 'Choose a day'}</h3>
          <div className="rn-days">
            {days.map((d) => {
              const dt = new Date(d + 'T00:00:00Z');
              return (
                <button type="button" key={d} className={d === date ? 'on' : undefined} onClick={() => setDate(d)} aria-pressed={d === date}>
                  {d === today ? 'Today' : DOW[dt.getUTCDay()]}<b>{dt.getUTCDate()}</b>{MONTHS[dt.getUTCMonth()]}
                </button>
              );
            })}
          </div>
          <div className="rn-date-row">
            <CalendarDays size={15} /> Another day:
            <input type="date" value={date} min={today} max={staff ? undefined : lastDay} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
            {facility.equipmentOnly && (
              <>Return by: <input type="date" value={returnDate} min={date} max={plusDays(date, 29)} onChange={(e) => e.target.value && setReturnDate(e.target.value)} aria-label="Return date" /></>
            )}
          </div>
        </section>

        {facility.packages.length > 0 && (
          <section className="rn-step">
            <h3><span>{++step}</span> Rental package {needsPackage && <small>required</small>}</h3>
            <div className="rn-packs">
              {!needsPackage && (
                <button type="button" className={packageId === null ? 'on' : undefined} onClick={() => setPackageId(null)}><b>Standard booking</b><small>The facility on its own.</small></button>
              )}
              {facility.packages.map((p) => (
                <button type="button" key={p.id} className={packageId === p.id ? 'on' : undefined} onClick={() => setPackageId(p.id)} aria-pressed={packageId === p.id}>
                  <b>{p.name}</b>
                  {p.description && <small>{p.description}</small>}
                  <span>{p.includesNet && <i>Net reserved with it</i>}{p.includesOperator && <i>Operator</i>}{p.includesBalls && <i>Balls</i>}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {timed && (
          <section className="rn-step">
            <h3><span>{++step}</span> Time slot {loadingSlots && <small><Loader2 size={12} className="spin" /> checking…</small>}</h3>
            {!day ? <p className="rn-empty">{loadingSlots ? 'Loading the free slots…' : 'Could not load this day.'}</p>
              : !day.dayOpen ? <p className="rn-note warn">Bookings are not open for this day.</p>
              : !day.slots.some((s) => s.free) ? <p className="rn-note warn">No free slots on this day{packageId ? ' for this package' : ''}. Try another day.</p>
              : (
                <div className="rn-slots">
                  {day.slots.map((s) => {
                    const inRange = startMin !== null && s.startMin > startMin && s.startMin < startMin + slots * facility.slotMinutes;
                    return (
                      <button type="button" key={s.startMin} disabled={!s.free} className={s.startMin === startMin ? 'on' : inRange ? 'in' : undefined}
                        onClick={() => { setStartMin(s.startMin); setSlots(1); }} aria-pressed={s.startMin === startMin}>
                        {timeLabel(s.startMin)}<small>{s.free ? (s.left > 1 ? `${s.left} free` : 'free') : 'taken'}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            {startMin !== null && maxSlots > 1 && (
              <>
                <h3 style={{ margin: '18px 0 10px' }}><span>{++step}</span> How long?</h3>
                <div className="rn-pills">
                  {Array.from({ length: maxSlots }, (_, i) => i + 1).map((n) => (
                    <button type="button" key={n} className={n === slots ? 'on' : undefined} onClick={() => setSlots(n)} aria-pressed={n === slots}>{durationLabel(n * facility.slotMinutes)}</button>
                  ))}
                </div>
              </>
            )}
            {staff && facility.resources.length > 1 && (
              <label className="rn-field" style={{ marginTop: 16, maxWidth: 260 }}>Unit
                <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                  <option value="">First free unit</option>
                  {facility.resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            )}
          </section>
        )}
        {facility.wholeDay && day && !day.wholeDayFree && <p className="rn-note warn" style={{ marginBottom: 14 }}>{facility.name} is not free on this day. Try another day.</p>}

        {items.length > 0 && (
          <section className="rn-step">
            <h3><span>{++step}</span> {facility.equipmentOnly ? 'Equipment to rent' : 'Add equipment'} {!facility.equipmentOnly && <small>optional</small>}</h3>
            <ul className="rn-items">
              {items.map((it) => (
                <li key={it.id}>
                  <div className="stack"><b>{it.name}</b><small className="muted">{inr(it.rentalPrice)} {it.priceUnit === 'PER_DAY' ? 'per day' : 'each'}</small></div>
                  <div className="rn-qty">
                    <button type="button" onClick={() => setQty((v) => ({ ...v, [it.id]: Math.max(0, (v[it.id] ?? 0) - 1) }))} disabled={!qty[it.id]} aria-label={`Fewer ${it.name}`}><Minus size={14} /></button>
                    <output aria-label={`${it.name} quantity`}>{qty[it.id] ?? 0}</output>
                    <button type="button" onClick={() => setQty((v) => ({ ...v, [it.id]: Math.min(50, (v[it.id] ?? 0) + 1) }))} aria-label={`More ${it.name}`}><Plus size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rn-step">
          <h3><span>{++step}</span> {staff ? 'Customer' : 'Details'}</h3>
          <div className="rn-fields">
            {staff && (
              <>
                <label className="rn-field wide">Academy student (gets the student price)
                  <select value={walkStudent} onChange={(e) => { const s = students.find((x) => x.id === e.target.value); setWalkStudent(e.target.value); if (s) { setName(s.name); setPhone(s.phone); } }}>
                    <option value="">Not a student (outside customer)</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}
                  </select>
                </label>
                <label className="rn-field">Name *<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
                <label className="rn-field">Phone *<input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={20} /></label>
                <label className="rn-field wide">Email (for confirmations)<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={120} /></label>
              </>
            )}
            {!staff && booker?.kind === 'FAMILY' && (
              <label className="rn-field wide">Booking for
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  {family.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (not active)'}</option>)}
                </select>
              </label>
            )}
            {!facility.equipmentOnly && (
              <label className="rn-field">Number of players (up to {facility.capacity})<input value={players} onChange={(e) => setPlayers(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={3} /></label>
            )}
            <label className="rn-field wide">Note for the academy<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} /></label>
          </div>
        </section>
      </div>

      <aside className="rn-summary" aria-live="polite">
        <h3>{facility.name}</h3>
        <p>
          {new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
          {timed && startMin !== null && <> · {timeLabel(startMin)} – {timeLabel(startMin + slots * facility.slotMinutes)}</>}
          {facility.wholeDay && ' · whole day'}
          {facility.equipmentOnly && returnDate !== date && <> to {new Date(returnDate + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</>}
        </p>
        {!ready && <p className="rn-note">{needsPackage && !packageId ? 'Choose a rental package.' : facility.equipmentOnly ? 'Add the items you want to rent.' : timed ? 'Choose a time slot to see the price.' : 'Choose a free day.'}</p>}
        {quote && 'error' in quote && <p className="rn-note bad">{quote.error}</p>}
        {q && (
          <>
            <ul className="rn-lines">
              {q.quote.lines.map((l, i) => <li key={i} className={l.amount < 0 ? 'minus' : undefined}><span>{l.label}</span><b>{l.amount < 0 ? `− ${inr(-l.amount)}` : inr(l.amount)}</b></li>)}
              {q.quote.deposit > 0 && <li className="soft"><span>Refundable security deposit</span><b>{inr(q.quote.deposit)}</b></li>}
            </ul>
            {q.isStudent && <p className="rn-note good" style={{ marginTop: 10 }}>Academy student price applied.</p>}
            <div className="rn-promo">
              <input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="Promo code" maxLength={20} aria-label="Promo code" />
              <button type="button" className="secondary-btn" onClick={() => setPromoCode(promoInput.trim().toUpperCase())}><Tag size={14} /> Apply</button>
            </div>
            {q.promoError && <p className="rn-note bad" style={{ marginTop: 8 }}>{q.promoError}</p>}
            <div className="rn-total"><span>Total{q.quote.deposit > 0 ? ' incl. deposit' : ''}</span><b>{inr(q.quote.payable)}</b></div>

            {!staff && q.quote.payable > 0 && (
              <div className="rn-pay" role="radiogroup" aria-label="Payment method">
                {props.onlineAvailable && (
                  <label><input type="radio" name="method" checked={method === 'ONLINE'} onChange={() => setMethod('ONLINE')} />
                    <span>Pay online now<small>UPI, cards and net banking. {q.payNow < q.quote.payable ? `Pay ${inr(q.payNow)} now, the rest at the academy.` : 'Your slot is confirmed when the payment goes through.'}</small></span>
                  </label>
                )}
                {props.payAtVenue && (
                  <label><input type="radio" name="method" checked={method === 'PAY_AT_VENUE'} onChange={() => setMethod('PAY_AT_VENUE')} />
                    <span>Pay at the academy<small>Cash or UPI at the counter.</small></span>
                  </label>
                )}
              </div>
            )}
            {staff && q.quote.payable > 0 && (
              <div className="rn-fields" style={{ marginTop: 14 }}>
                <label className="rn-field">Received now (₹)<input value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" /></label>
                <label className="rn-field">Method<select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>{Object.entries(OFFLINE_METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="rn-field wide">Reference<input value={payRef} onChange={(e) => setPayRef(e.target.value)} maxLength={80} placeholder="UPI / card slip number" /></label>
              </div>
            )}
          </>
        )}
        {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        {!staff && !booker ? (
          <Link className="primary-btn rn-confirm" href={props.loginHref}>Log in to book <ArrowRight size={16} /></Link>
        ) : (
          <button type="button" className="primary-btn rn-confirm" disabled={!q || pending} onClick={confirm}>
            {pending ? 'Booking…' : staff ? 'Create booking' : q && q.quote.payable > 0 && method === 'ONLINE' ? 'Continue to payment' : 'Confirm booking'} {!pending && <ArrowRight size={16} />}
          </button>
        )}
        <p className="rn-fineprint">The price and the free slots are checked again on our server when you confirm, so a slot cannot be booked twice.</p>
      </aside>
    </div>
  );
}
