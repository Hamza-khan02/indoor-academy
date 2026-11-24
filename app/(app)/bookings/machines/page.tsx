import Link from 'next/link';
import { CalendarDays, History, Pencil, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate, todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';
import { EARNING, HOLDING } from '@/lib/rentals/constants';
import { requireRental } from '@/lib/rentals/staff';
import { durationLabel } from '@/lib/rentals/time';
import { FormModal } from '@/components/FormModal';
import { Empty, PageHeader, Panel } from '@/components/ui';
import { PackageFields, ResourceFields } from '@/components/rentals/fields';
import { Chip, FacilityChip, priceText, unitWord } from '@/components/rentals/ui';
import { savePackage, saveResource } from '../actions';

/** Bowling machine management: every machine, its range and state, its bookings, and the rental packages. */
export default async function MachinesPage() {
  await requireRental('config');
  const today = todayISO();
  const [facilities, nets] = await Promise.all([
    db.rentalFacility.findMany({
      where: { category: 'BOWLING_MACHINE' },
      orderBy: { name: 'asc' },
      include: {
        pricing: true,
        packages: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { netFacility: { select: { name: true } }, _count: { select: { bookings: true } } } },
        resources: { orderBy: { code: 'asc' }, include: { bookings: { select: { booking: { select: { date: true, status: true, total: true, resources: { select: { role: true } } } } } } } },
      },
    }),
    db.rentalFacility.findMany({ where: { category: 'NETS' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Bowling machines" subtitle="Each machine's ID, speed range, state and booking history, and the rental packages customers choose from." />
      {facilities.length === 0 ? (
        <article className="panel padded">
          <Empty title="No bowling machine facility yet" action={<Link className="primary-btn" href="/bookings/facilities">Go to Facilities</Link>}>
            Add a facility of type &quot;Bowling machine&quot; in Facilities. The five standard packages (machine only, with net, with operator, with balls, complete) are created with it, ready to be priced.
          </Empty>
        </article>
      ) : facilities.map((f) => (
        <section key={f.id} className="rn-stack spaced-bottom">
          <Panel
            title={<>{f.name} <FacilityChip status={f.status} /></>}
            subtitle={`Rented in ${durationLabel(f.slotMinutes)} slots, up to ${durationLabel(f.slotMinutes * f.maxSlots)} per booking · base price ${priceText(f.pricing)}`}
            action={
              <div className="rn-actions">
                <Link className="text-btn" href={`/bookings/calendar?facility=${f.id}`}><CalendarDays size={14} /> Calendar</Link>
                <FormModal title="Add machine" eyebrow={f.name.toUpperCase()} trigger={<><Plus size={14} /> Add machine</>} triggerClassName="text-btn" action={saveResource.bind(null, f.id, null)} submitLabel="Add machine">
                  <ResourceFields machine />
                </FormModal>
              </div>
            }
          >
            {f.resources.length === 0 ? <Empty title="No machines yet" /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>MACHINE ID</th><th>NAME</th><th>SPEED RANGE</th><th>BOWLING MODES</th><th>STATE</th><th className="rn-num">BOOKINGS</th><th className="rn-num">UPCOMING</th><th>LAST USED</th><th className="rn-num">EARNED</th><th /></tr></thead>
                  <tbody>
                    {f.resources.map((m) => {
                      const all = m.bookings.map((b) => b.booking);
                      const earning = all.filter((b) => EARNING.includes(b.status));
                      const upcoming = all.filter((b) => HOLDING.includes(b.status) && b.date >= today).length;
                      const last = earning.filter((b) => b.date <= today).map((b) => b.date).sort().at(-1);
                      return (
                        <tr key={m.id}>
                          <td><span className="rn-code">{m.code}</span></td>
                          <td><b>{m.name}</b></td>
                          <td>{m.speedMin || m.speedMax ? `${m.speedMin ?? '?'} – ${m.speedMax ?? '?'} km/h` : <span className="muted">Not set</span>}</td>
                          <td className="wrap">{m.modes ? m.modes.split(',').map((x) => <span key={x} className="batch-tag spaced">{x.trim()}</span>) : <span className="muted">Not set</span>}</td>
                          <td><FacilityChip status={m.status} unit />{m.status !== 'ACTIVE' && m.maintenanceNote && <small className="muted block">{m.maintenanceNote}</small>}</td>
                          <td className="rn-num">{earning.length}</td>
                          <td className="rn-num">{upcoming}</td>
                          <td>{last ? formatDate(last) : <span className="muted">Never</span>}</td>
                          <td className="rn-num">{inr(earning.reduce((t, b) => t + b.total, 0))}</td>
                          <td>
                            <div className="row-actions">
                              <Link className="icon-action" href={`/bookings/list?unit=${m.id}`} title="Booking history" aria-label={`Booking history of ${m.name}`}><History size={15} /></Link>
                              <FormModal title={`Edit ${m.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={saveResource.bind(null, f.id, m.id)}>
                                <ResourceFields unit={m} machine />
                              </FormModal>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Rental packages"
            subtitle={`A package with a net reserves a free net in the same booking, or refuses the booking. Prices are per ${unitWord(f.pricing?.unit)}.`}
            action={
              <FormModal title="Add package" eyebrow={f.name.toUpperCase()} trigger={<><Plus size={14} /> Add package</>} triggerClassName="text-btn" action={savePackage.bind(null, f.id, null)} submitLabel="Add package">
                <PackageFields nets={nets} unitLabel={unitWord(f.pricing?.unit)} />
              </FormModal>
            }
          >
            <div className="table-wrap">
              <table>
                <thead><tr><th>PACKAGE</th><th>INCLUDES</th><th className="rn-num">PRICE</th><th className="rn-num">OPERATOR</th><th className="rn-num">BALLS</th><th className="rn-num">BOOKINGS</th><th>STATE</th><th /></tr></thead>
                <tbody>
                  {f.packages.map((p) => (
                    <tr key={p.id}>
                      <td><b>{p.name}</b>{p.description && <small className="muted block">{p.description}</small>}</td>
                      <td className="wrap">
                        <span className="batch-tag spaced">Machine</span>
                        {p.includesNet && <span className="batch-tag spaced">Net{p.netFacility ? ` · ${p.netFacility.name}` : ' · not chosen'}</span>}
                        {p.includesOperator && <span className="batch-tag spaced">Operator</span>}
                        {p.includesBalls && <span className="batch-tag spaced">Balls</span>}
                      </td>
                      <td className="rn-num">{p.pricePerUnit ? inr(p.pricePerUnit) : <span className="muted">base</span>}</td>
                      <td className="rn-num">{p.includesOperator ? inr(p.operatorCharge) : '—'}</td>
                      <td className="rn-num">{p.includesBalls ? inr(p.ballsCharge) : '—'}</td>
                      <td className="rn-num">{p._count.bookings}</td>
                      <td>{p.active ? <Chip tone="green">On sale</Chip> : <Chip tone="grey">Switched off</Chip>}{p.includesNet && !p.netFacilityId && <small className="c-absent block">Choose its nets facility</small>}</td>
                      <td>
                        <FormModal title={`Edit ${p.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={savePackage.bind(null, f.id, p.id)}>
                          <PackageFields pkg={p} nets={nets} unitLabel={unitWord(f.pricing?.unit)} />
                        </FormModal>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      ))}
    </>
  );
}
