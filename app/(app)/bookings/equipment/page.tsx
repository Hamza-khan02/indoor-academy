import Link from 'next/link';
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate, todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS } from '@/lib/rentals/constants';
import { inventory } from '@/lib/rentals/equipment';
import { requireRental } from '@/lib/rentals/staff';
import { ConfirmAction } from '@/components/ConfirmAction';
import { FormModal } from '@/components/FormModal';
import { Empty, PageHeader, Panel, StatCard } from '@/components/ui';
import { ItemFields } from '@/components/rentals/fields';
import { Chip, LineChip } from '@/components/rentals/ui';
import { adjustEquipment, deleteEquipmentItem, saveEquipmentItem } from '../actions';

const MOVES: Record<string, string> = {
  RESERVED: 'Reserved', ISSUED: 'Issued', RETURNED: 'Returned', INSPECTED: 'Back in stock', DAMAGED: 'Damaged', MISSING: 'Missing',
  REPAIRED: 'Repaired', ADJUSTED: 'Stock changed', RELEASED: 'Reservation released',
};

export default async function EquipmentPage() {
  await requireRental('config');
  const today = todayISO();
  const [items, out, moves] = await Promise.all([
    inventory(),
    db.bookingEquipment.findMany({
      where: { status: { in: ['ISSUED', 'RETURNED'] } },
      orderBy: { dueDate: 'asc' },
      include: { item: { select: { name: true, code: true } }, booking: { select: { id: true, code: true, customerName: true, customerPhone: true } } },
    }),
    db.equipmentMovement.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { item: { select: { name: true } } } }),
  ]);
  const sum = (key: 'totalQty' | 'available' | 'reserved' | 'rented' | 'damagedQty') => items.reduce((t, i) => t + i[key], 0);

  const addButton = (
    <FormModal title="Add equipment" eyebrow="INVENTORY" trigger={<><Plus size={17} /> Add item</>} action={saveEquipmentItem.bind(null, null)} submitLabel="Add item">
      <ItemFields />
    </FormModal>
  );

  return (
    <>
      <PageHeader title="Equipment" subtitle="Bats, balls, pads, gloves, helmets, stumps and anything else that is rented out. Available → Reserved → Issued → Returned → Inspection → Available." actions={addButton} />
      <div className="stats-grid">
        <StatCard title="Total items" value={String(sum('totalQty'))} detail={`${items.length} kinds of equipment`} icon={<Boxes size={17} />} color="blue" />
        <StatCard title="Available now" value={String(sum('available'))} detail="in stock and ready" icon={<Boxes size={17} />} color="green" />
        <StatCard title="Reserved / rented" value={`${sum('reserved')} / ${sum('rented')}`} detail="held for bookings / out with customers" icon={<Boxes size={17} />} color="amber" />
        <StatCard title="Damaged" value={String(sum('damagedQty'))} detail="out of service" icon={<Boxes size={17} />} color="red" />
      </div>

      <article className="panel padded spaced-bottom">
        {items.length === 0 ? <Empty title="No equipment yet" action={addButton}>Add the items the academy rents out, with their quantity and rental price.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>ITEM</th><th>CONDITION</th><th className="rn-num">TOTAL</th><th className="rn-num">AVAILABLE</th><th className="rn-num">RESERVED</th><th className="rn-num">RENTED</th><th className="rn-num">TO INSPECT</th><th className="rn-num">DAMAGED</th><th className="rn-num">RENTAL PRICE</th><th /></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} style={i.active ? undefined : { opacity: 0.55 }}>
                    <td><span className="rn-code">{i.code}</span></td>
                    <td><b>{i.name}</b><small className="muted block">{EQUIPMENT_CATEGORIES[i.category] ?? i.category}{i.active ? '' : ' · not rented out'}</small></td>
                    <td>{EQUIPMENT_CONDITIONS[i.condition] ?? i.condition}</td>
                    <td className="rn-num">{i.totalQty}</td>
                    <td className="rn-num"><span className={i.available > 0 ? 'c-present' : 'c-absent'}>{i.available}</span></td>
                    <td className="rn-num">{i.reserved}</td>
                    <td className="rn-num">{i.rented}</td>
                    <td className="rn-num">{i.toInspect}</td>
                    <td className="rn-num">{i.damagedQty}</td>
                    <td className="rn-num">{inr(i.rentalPrice)}<small className="muted block">{i.priceUnit === 'PER_DAY' ? 'per day' : 'per booking'}</small></td>
                    <td>
                      <div className="row-actions">
                        <FormModal title={`Stock of ${i.name}`} eyebrow="STOCK CHANGE" description={`${i.totalQty} in total, ${i.damagedQty} marked damaged.`} trigger="Stock" triggerClassName="text-btn" action={adjustEquipment.bind(null, i.id)} submitLabel="Save change">
                          <label>What happened *
                            <select name="type" defaultValue="ADD">
                              <option value="ADD">New items added to stock</option>
                              <option value="REMOVE">Items removed from stock</option>
                              <option value="REPAIRED">Damaged items repaired (back in service)</option>
                              <option value="WRITTEN_OFF">Damaged items written off (thrown away)</option>
                            </select>
                          </label>
                          <label>How many *<input name="qty" type="number" min={1} required defaultValue={1} /></label>
                          <label>Note<input name="note" maxLength={200} placeholder="e.g. Bought 6 new balls" /></label>
                        </FormModal>
                        <FormModal title={`Edit ${i.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={saveEquipmentItem.bind(null, i.id)}>
                          <ItemFields item={i} />
                        </FormModal>
                        <ConfirmAction action={deleteEquipmentItem.bind(null, i.id)} confirmText={`Delete ${i.name}? This only works if it was never rented.`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <div className="two-col">
        <Panel title="Out with customers and waiting for inspection" subtitle="Issue, return and inspect equipment from the booking's page.">
          {out.length === 0 ? <Empty title="Everything is in stock" /> : (
            <ul className="rn-unit-list">
              {out.map((l) => (
                <li key={l.id}>
                  <div className="stack">
                    <b>{l.item.name} × {l.qty}</b>
                    <small className="muted">
                      <Link href={`/bookings/${l.booking.id}`} className="text-btn inline">{l.booking.code}</Link> · {l.booking.customerName} · {l.booking.customerPhone}
                      {l.dueDate && <> · due back {formatDate(l.dueDate)}</>}
                    </small>
                  </div>
                  {l.status === 'ISSUED' && l.dueDate && l.dueDate < today ? <Chip tone="red">Overdue</Chip> : <LineChip status={l.status} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent movements" subtitle="Every change to the stock, newest first.">
          {moves.length === 0 ? <Empty title="No movements yet" /> : (
            <ul className="rn-unit-list">
              {moves.map((m) => (
                <li key={m.id}>
                  <div className="stack">
                    <b>{m.item.name} · {MOVES[m.type] ?? m.type}</b>
                    <small className="muted">{formatDate(todayISO(m.createdAt))} · {m.actor ?? 'System'}{m.note ? ` · ${m.note}` : ''}</small>
                  </div>
                  <span className="rn-money">{m.qty > 0 && ['ADJUSTED', 'REPAIRED', 'INSPECTED', 'RETURNED', 'RELEASED'].includes(m.type) ? '+' : ''}{m.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
