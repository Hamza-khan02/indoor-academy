// Works out the price of a booking from the prices saved in the database.
// Pure: it takes the saved configuration and returns the lines of the bill. The server always
// calls this itself; a price sent by a browser is never trusted.
import { PRICE_UNITS } from './constants';
import { isWeekend, timeLabel } from './time';

export type PricingConfig = {
  unit: string;
  price: number;
  studentDiscountPct: number;
  peakStart: number | null;
  peakEnd: number | null;
  peakSurchargePct: number;
  weekendSurchargePct: number;
  securityDeposit: number;
};
export type PackageConfig = {
  name: string;
  pricePerUnit: number | null;
  operatorCharge: number;
  ballsCharge: number;
  includesOperator: boolean;
  includesBalls: boolean;
} | null;
export type EquipmentCharge = { name: string; qty: number; unitPrice: number; priceUnit: string };
export type PromoConfig = { code: string; percentOff: number; amountOff: number; minAmount: number } | null;

export type PriceLine = { label: string; amount: number; kind: 'BASE' | 'PEAK' | 'WEEKEND' | 'OPERATOR' | 'BALLS' | 'EQUIPMENT' | 'STUDENT' | 'PROMO' | 'CHARGE' };
export type Quote = {
  lines: PriceLine[];
  subtotal: number;
  discount: number;
  /** What the booking costs (subtotal - discount). */
  total: number;
  /** Refundable security deposit, collected on top of the total. */
  deposit: number;
  payable: number;
  promoApplied: boolean;
};

const pct = (amount: number, percent: number) => Math.round((amount * percent) / 100);

export function quote(input: {
  pricing: PricingConfig | null;
  pkg?: PackageConfig;
  /** Facility slot length in minutes; 0 with startMin = endMin for an equipment-only rental. */
  slotMinutes: number;
  date: string;
  startMin: number;
  endMin: number;
  equipment?: EquipmentCharge[];
  /** Days an equipment-only rental lasts (per-day items are charged per day). */
  days?: number;
  isStudent?: boolean;
  promo?: PromoConfig;
}): Quote {
  const { pricing, pkg = null, slotMinutes, date, startMin, endMin, equipment = [], days = 1, isStudent = false, promo = null } = input;
  const lines: PriceLine[] = [];
  const minutes = Math.max(0, endMin - startMin);

  if (pricing && pricing.unit !== 'PER_ITEM' && minutes > 0) {
    const unitPrice = pkg?.pricePerUnit ?? pricing.price;
    const unit = PRICE_UNITS[pricing.unit] ?? PRICE_UNITS.PER_HOUR;
    let base = 0;
    let peak = 0;
    let units = 1;
    if (pricing.unit === 'PER_DAY') {
      base = unitPrice;
    } else {
      const unitMinutes = pricing.unit === 'PER_SESSION' ? slotMinutes : unit.minutes;
      units = minutes / unitMinutes;
      const hasPeak = pricing.peakSurchargePct > 0 && pricing.peakStart !== null && pricing.peakEnd !== null;
      for (let t = startMin; t < endMin; t += slotMinutes) {
        const slotPrice = Math.round((unitPrice * Math.min(slotMinutes, endMin - t)) / unitMinutes);
        base += slotPrice;
        if (hasPeak && t >= pricing.peakStart! && t < pricing.peakEnd!) peak += pct(slotPrice, pricing.peakSurchargePct);
      }
    }
    const unitsText = pricing.unit === 'PER_DAY' ? 'whole day' : `${Number(units.toFixed(2))} × ${unit.short}`;
    lines.push({ kind: 'BASE', label: `${pkg ? pkg.name : 'Booking'} (${unitsText})`, amount: base });
    if (peak > 0) lines.push({ kind: 'PEAK', label: `Peak hours (${timeLabel(pricing.peakStart!)} – ${timeLabel(pricing.peakEnd!)}) +${pricing.peakSurchargePct}%`, amount: peak });
    if (pricing.weekendSurchargePct > 0 && isWeekend(date)) {
      lines.push({ kind: 'WEEKEND', label: `Weekend +${pricing.weekendSurchargePct}%`, amount: pct(base, pricing.weekendSurchargePct) });
    }
    if (pkg?.includesOperator && pkg.operatorCharge > 0) {
      lines.push({ kind: 'OPERATOR', label: 'Operator charges', amount: Math.round(pkg.operatorCharge * units) });
    }
    if (pkg?.includesBalls && pkg.ballsCharge > 0) lines.push({ kind: 'BALLS', label: 'Balls', amount: pkg.ballsCharge });
  }

  for (const e of equipment) {
    if (e.qty <= 0) continue;
    const perDay = e.priceUnit === 'PER_DAY';
    const n = perDay ? Math.max(1, days) : 1;
    lines.push({ kind: 'EQUIPMENT', label: `${e.name} × ${e.qty}${perDay && n > 1 ? ` × ${n} days` : ''}`, amount: e.unitPrice * e.qty * n });
  }

  const subtotal = lines.reduce((t, l) => t + l.amount, 0);
  let discount = 0;
  if (isStudent && pricing && pricing.studentDiscountPct > 0 && subtotal > 0) {
    const amount = pct(subtotal, pricing.studentDiscountPct);
    discount += amount;
    lines.push({ kind: 'STUDENT', label: `Academy student discount (${pricing.studentDiscountPct}%)`, amount: -amount });
  }
  let promoApplied = false;
  if (promo && subtotal - discount >= promo.minAmount && subtotal - discount > 0) {
    const amount = Math.min(subtotal - discount, pct(subtotal - discount, promo.percentOff) + promo.amountOff);
    if (amount > 0) {
      discount += amount;
      promoApplied = true;
      lines.push({ kind: 'PROMO', label: `Promo code ${promo.code}`, amount: -amount });
    }
  }

  const total = subtotal - discount;
  const deposit = pricing?.securityDeposit ?? 0;
  return { lines, subtotal, discount, total, deposit, payable: total + deposit, promoApplied };
}

/** Cancellation charge under the facility's policy: free until `freeHours` before the start, then a % of the amount. */
export function cancellationCharge(total: number, hoursBeforeStart: number, policy: { cancelFreeHours: number; cancelChargePct: number } | null) {
  if (!policy || policy.cancelChargePct <= 0 || hoursBeforeStart >= policy.cancelFreeHours) return 0;
  return pct(total, policy.cancelChargePct);
}
