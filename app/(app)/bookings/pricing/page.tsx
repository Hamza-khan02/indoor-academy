import { Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/dates';
import { inr } from '@/lib/format';
import { CATEGORIES, PRICE_UNITS } from '@/lib/rentals/constants';
import { requireRental } from '@/lib/rentals/staff';
import { rangeLabel } from '@/lib/rentals/time';
import { ConfirmAction } from '@/components/ConfirmAction';
import { FormModal } from '@/components/FormModal';
import { Empty, PageHeader, Panel } from '@/components/ui';
import { PackageFields, PricingFields, PromoFields } from '@/components/rentals/fields';
import { Chip, FacilityChip, priceText, unitWord } from '@/components/rentals/ui';
import { deletePackage, deletePromo, savePackage, savePricing, savePromo } from '../actions';

/** Every rental price in one place. Nothing here is fixed in the code: bookings are priced from these rows. */
export default async function PricingPage() {
  await requireRental('config');
  const [facilities, promos] = await Promise.all([
    db.rentalFacility.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { pricing: true, packages: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { bookings: true } } } } },
    }),
    db.rentalPromo.findMany({ orderBy: { createdAt: 'desc' }, include: { facility: { select: { name: true } } } }),
  ]);
  const nets = facilities.filter((f) => f.category === 'NETS').map((f) => ({ id: f.id, name: f.name }));
  const names = facilities.map((f) => ({ id: f.id, name: f.name }));

  return (
    <>
      <PageHeader title="Pricing" subtitle="Rental prices, student discount, peak and weekend rates, packages, deposits, cancellation charges and promo codes." />
      {facilities.length === 0 && <article className="panel padded"><Empty title="No facilities yet">Add facilities first; each one then gets its prices here.</Empty></article>}

      {facilities.map((f) => {
        const p = f.pricing;
        const equipmentOnly = f.category === 'EQUIPMENT';
        return (
          <article key={f.id} id={`f-${f.id}`} className="panel padded spaced-bottom rn-facility">
            <div className="panel-head">
              <div>
                <h3>{CATEGORIES[f.category]?.emoji} {f.name} <FacilityChip status={f.status} /></h3>
                <p>{p?.updatedBy ? `Prices last changed by ${p.updatedBy}` : 'Prices not set yet'}</p>
              </div>
              <FormModal title={`Prices for ${f.name}`} eyebrow="PRICING" trigger={<><Pencil size={14} /> Edit prices</>} triggerClassName="secondary-btn" action={savePricing.bind(null, f.id)} submitLabel="Save prices">
                <PricingFields pricing={p} equipmentOnly={equipmentOnly} />
              </FormModal>
            </div>
            <dl className="rn-kv">
              <dt>{equipmentOnly ? 'Charged' : 'Price'}</dt>
              <dd>{equipmentOnly ? 'Per item (set on each item in Equipment)' : <><b>{priceText(p)}</b> for outside customers · {PRICE_UNITS[p?.unit ?? 'PER_HOUR']?.label}</>}</dd>
              <dt>Student discount</dt><dd>{p?.studentDiscountPct ? `${p.studentDiscountPct}% off for academy students` : 'None'}</dd>
              {!equipmentOnly && <><dt>Peak hours</dt><dd>{p?.peakSurchargePct && p.peakStart !== null && p.peakEnd !== null ? `${rangeLabel(p.peakStart, p.peakEnd)}: +${p.peakSurchargePct}%` : 'None'}</dd></>}
              {!equipmentOnly && <><dt>Weekends</dt><dd>{p?.weekendSurchargePct ? `+${p.weekendSurchargePct}% on Saturday and Sunday` : 'Same as weekdays'}</dd></>}
              <dt>Security deposit</dt><dd>{p?.securityDeposit ? `${inr(p.securityDeposit)}, refundable` : 'None'}</dd>
              <dt>Cancellation</dt><dd>{p?.cancelChargePct ? `Free until ${p.cancelFreeHours} hours before, then ${p.cancelChargePct}% of the amount` : 'Free at any time before the start'}</dd>
            </dl>

            {!equipmentOnly && (
              <>
                <div className="panel-head" style={{ margin: '20px 0 10px' }}>
                  <div><h3>Packages</h3><p>Combo prices and extras customers can choose for this facility.</p></div>
                  <FormModal title="Add package" eyebrow={f.name.toUpperCase()} trigger={<><Plus size={14} /> Add package</>} triggerClassName="text-btn" action={savePackage.bind(null, f.id, null)} submitLabel="Add package">
                    <PackageFields nets={nets} unitLabel={unitWord(p?.unit)} />
                  </FormModal>
                </div>
                {f.packages.length === 0 ? <p className="muted small-note">No packages: customers book the facility at its normal price.</p> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>PACKAGE</th><th className="rn-num">PRICE / {unitWord(p?.unit).toUpperCase()}</th><th className="rn-num">OPERATOR / {unitWord(p?.unit).toUpperCase()}</th><th className="rn-num">BALLS</th><th>STATE</th><th /></tr></thead>
                      <tbody>
                        {f.packages.map((pk) => (
                          <tr key={pk.id}>
                            <td><b>{pk.name}</b><small className="muted block">{[pk.includesNet && 'net', pk.includesOperator && 'operator', pk.includesBalls && 'balls'].filter(Boolean).join(' + ') || 'no extras'}</small></td>
                            <td className="rn-num">{pk.pricePerUnit ? inr(pk.pricePerUnit) : <span className="muted">normal price</span>}</td>
                            <td className="rn-num">{pk.includesOperator ? inr(pk.operatorCharge) : '—'}</td>
                            <td className="rn-num">{pk.includesBalls ? inr(pk.ballsCharge) : '—'}</td>
                            <td>{pk.active ? <Chip tone="green">On sale</Chip> : <Chip tone="grey">Switched off</Chip>}</td>
                            <td>
                              <div className="row-actions">
                                <FormModal title={`Edit ${pk.name}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={savePackage.bind(null, f.id, pk.id)}>
                                  <PackageFields pkg={pk} nets={nets} unitLabel={unitWord(p?.unit)} />
                                </FormModal>
                                {pk._count.bookings === 0 && <ConfirmAction action={deletePackage.bind(null, pk.id)} confirmText={`Delete the package "${pk.name}"?`} label="Delete"><Trash2 size={15} /></ConfirmAction>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </article>
        );
      })}

      <Panel
        title="Promo codes"
        subtitle="Customers type a code in the booking form. It applies after the student discount."
        action={
          <FormModal title="Add promo code" eyebrow="PROMOTIONS" trigger={<><Plus size={14} /> Add code</>} triggerClassName="text-btn" action={savePromo.bind(null, null)} submitLabel="Add code">
            <PromoFields facilities={names} />
          </FormModal>
        }
      >
        {promos.length === 0 ? <Empty title="No promo codes" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>CODE</th><th>DISCOUNT</th><th>VALID</th><th>FACILITY</th><th className="rn-num">USED</th><th>STATE</th><th /></tr></thead>
              <tbody>
                {promos.map((c) => (
                  <tr key={c.id}>
                    <td><span className="rn-code">{c.code}</span>{c.description && <small className="muted block">{c.description}</small>}</td>
                    <td>{[c.percentOff ? `${c.percentOff}%` : '', c.amountOff ? inr(c.amountOff) : ''].filter(Boolean).join(' + ')} off{c.minAmount ? <small className="muted block">on {inr(c.minAmount)} or more</small> : null}</td>
                    <td>{c.validFrom || c.validTo ? `${c.validFrom ? formatDate(c.validFrom) : 'now'} – ${c.validTo ? formatDate(c.validTo) : 'no end'}` : 'Always'}</td>
                    <td>{c.facility?.name ?? 'Any'}</td>
                    <td className="rn-num">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
                    <td>{c.active ? <Chip tone="green">Active</Chip> : <Chip tone="grey">Switched off</Chip>}</td>
                    <td>
                      <div className="row-actions">
                        <FormModal title={`Edit ${c.code}`} trigger={<Pencil size={15} />} triggerClassName="icon-action" triggerLabel="Edit" action={savePromo.bind(null, c.id)}>
                          <PromoFields promo={c} facilities={names} />
                        </FormModal>
                        <ConfirmAction action={deletePromo.bind(null, c.id)} confirmText={`Delete promo code ${c.code}?`} label="Delete"><Trash2 size={15} /></ConfirmAction>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
