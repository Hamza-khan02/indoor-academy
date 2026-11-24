import Link from 'next/link';
import { ArrowRight, Clock, GraduationCap, MapPin, ShieldCheck, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { inr } from '@/lib/format';
import { getBooker } from '@/lib/rentals/account';
import { CATEGORIES } from '@/lib/rentals/constants';
import { durationLabel, rangeLabel } from '@/lib/rentals/time';
import { getSettings } from '@/lib/settings';
import { unitWord } from '@/components/rentals/ui';

/** Public list of what can be booked. Anyone can look; booking needs a login. */
export default async function BookHome() {
  const [facilities, booker, settings, itemCount] = await Promise.all([
    db.rentalFacility.findMany({
      where: { status: { in: ['ACTIVE', 'MAINTENANCE'] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { pricing: true, branch: { select: { name: true } }, resources: { where: { status: 'ACTIVE' }, select: { id: true } }, packages: { where: { active: true }, select: { pricePerUnit: true } } },
    }),
    getBooker(),
    getSettings(),
    db.equipmentItem.count({ where: { active: true } }),
  ]);
  const student = booker?.kind === 'FAMILY';

  return (
    <>
      <section className="bk-hero">
        <span className="eyebrow"><span className="live-dot" /> ONLINE BOOKING</span>
        <h1>Book your <span>practice.</span></h1>
        <p>
          Reserve cricket nets, turf, a practice pitch or a bowling machine at {settings.academyName}, and rent equipment with it.
          Pick a free slot, see the price, and you are done. Academy students get their student price automatically.
        </p>
        <div className="rn-actions">
          {booker
            ? <Link className="secondary-btn" href="/book/account">My bookings <ArrowRight size={15} /></Link>
            : <><Link className="primary-btn" href="/book/login">Log in or register <ArrowRight size={15} /></Link><span className="muted" style={{ fontSize: 12 }}>No admission needed to book.</span></>}
        </div>
      </section>

      {facilities.length === 0 ? (
        <div className="bk-card rn-empty"><b>Online booking opens soon</b>The academy is setting up its facilities. Please call us to book in the meantime.</div>
      ) : (
        <div className="bk-grid">
          {facilities.map((f) => {
            const cat = CATEGORIES[f.category];
            const open = f.status === 'ACTIVE';
            const equipmentOnly = f.category === 'EQUIPMENT';
            const prices = [f.pricing?.price ?? 0, ...f.packages.map((p) => p.pricePerUnit ?? 0)].filter((n) => n > 0);
            const from = prices.length ? Math.min(...prices) : 0;
            const body = (
              <>
                <div className="bk-fac-top">
                  <span className="bk-fac-icon" aria-hidden>{cat?.emoji}</span>
                  <div><small className="cat">{cat?.label}</small><h3>{f.name}</h3></div>
                </div>
                {f.description && <p>{f.description}</p>}
                <div className="bk-fac-meta">
                  <span><Clock size={12} /> {rangeLabel(f.openTime, f.closeTime)}</span>
                  {!equipmentOnly && <span>{f.pricing?.unit === 'PER_DAY' ? 'Whole-day booking' : `${durationLabel(f.slotMinutes)} slots`}</span>}
                  {!equipmentOnly && <span><Users size={12} /> Up to {f.capacity}</span>}
                  {!equipmentOnly && f.resources.length > 1 && <span>{f.resources.length} {cat?.unit.toLowerCase()}s</span>}
                  {equipmentOnly && <span>{itemCount} items to rent</span>}
                  {f.branch && <span><MapPin size={12} /> {f.branch.name}</span>}
                  {(f.pricing?.securityDeposit ?? 0) > 0 && <span><ShieldCheck size={12} /> {inr(f.pricing!.securityDeposit)} refundable deposit</span>}
                </div>
                <div className="bk-fac-foot">
                  <div className="bk-price">
                    <small>{equipmentOnly ? 'Rental' : f.packages.length > 0 ? 'From' : 'Price'}</small>
                    <b>{equipmentOnly ? 'Per item' : from > 0 ? <>{inr(from)} <span>/ {unitWord(f.pricing?.unit)}</span></> : 'Ask us'}</b>
                    {(f.pricing?.studentDiscountPct ?? 0) > 0 && <small className={student ? 'c-present' : undefined} style={{ marginTop: 3 }}><GraduationCap size={11} /> {f.pricing!.studentDiscountPct}% off for academy students</small>}
                  </div>
                  <span className="bk-go">{open ? <>Book now <ArrowRight size={15} /></> : (f.maintenanceNote || 'Under maintenance')}</span>
                </div>
              </>
            );
            return open
              ? <Link key={f.id} className="bk-fac" href={`/book/${f.id}`}>{body}</Link>
              : <div key={f.id} className="bk-fac closed">{body}</div>;
          })}
        </div>
      )}
    </>
  );
}
