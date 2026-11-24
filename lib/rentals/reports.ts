// Booking reports. Each report is a small table (title, columns, rows) so the same data feeds
// the reports page and the CSV downloads.
//
// "Revenue" counts the booking amount (deposits excluded) of bookings that went ahead
// (confirmed, checked in, in progress, completed), on the day of the booking.
// "Collected" counts money actually received, on the day it was paid, minus refunds.
import { db } from '../db';
import { addDays, formatDate, monthLabel, todayISO } from '../dates';
import { BOOKING_STATUS, CATEGORIES, EARNING, EQUIPMENT_CATEGORIES, PAYMENT_METHODS } from './constants';
import type { PriceLine } from './pricing';
import { durationLabel, rangeLabel, rentalDays } from './time';

export type Report = { key: string; title: string; description: string; columns: string[]; rows: (string | number)[][]; money?: number[] };

const istDay = (d: Date) => todayISO(d);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A valid report range: defaults to this month so far; at most 366 days. */
export function reportRange(from?: string, to?: string) {
  const today = todayISO();
  let start = from && DATE_RE.test(from) ? from : `${today.slice(0, 7)}-01`;
  let end = to && DATE_RE.test(to) ? to : today;
  if (end < start) [start, end] = [end, start];
  if (end > addDays(start, 366)) end = addDays(start, 366);
  return { from: start, to: end };
}

export async function buildReports(from: string, to: string): Promise<Report[]> {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${addDays(to, 1)}T00:00:00+05:30`);
  const [bookings, payments, refunds, facilities] = await Promise.all([
    db.rentalBooking.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      include: {
        facility: { select: { id: true, name: true, category: true } }, package: { select: { name: true } },
        resources: { include: { resource: { select: { id: true, name: true, code: true, facilityId: true } } } },
        equipment: { include: { item: { select: { id: true, name: true, code: true, category: true, priceUnit: true } } } },
      },
    }),
    db.rentalPayment.findMany({ where: { status: 'PAID', paidAt: { gte: start, lt: end } }, include: { booking: { select: { code: true, customerName: true } } }, orderBy: { paidAt: 'asc' } }),
    db.rentalRefund.findMany({ where: { status: 'PROCESSED', processedAt: { gte: start, lt: end } }, include: { booking: { select: { code: true, customerName: true } } }, orderBy: { processedAt: 'asc' } }),
    db.rentalFacility.findMany({ where: { category: { not: 'EQUIPMENT' } }, include: { resources: true }, orderBy: { name: 'asc' } }),
  ]);
  const earning = bookings.filter((b) => EARNING.includes(b.status));
  const cancelled = bookings.filter((b) => ['CANCELLED', 'REFUNDED', 'REJECTED'].includes(b.status));
  const sum = (list: { total: number }[]) => list.reduce((t, b) => t + b.total, 0);
  const days = rentalDays(from, to);
  const group = <T,>(list: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
    return m;
  };

  // ---- daily and monthly ----
  const byDay = group(bookings, (b) => b.date);
  const collectedByDay = new Map<string, number>();
  for (const p of payments) collectedByDay.set(istDay(p.paidAt!), (collectedByDay.get(istDay(p.paidAt!)) ?? 0) + p.amount);
  for (const r of refunds) collectedByDay.set(istDay(r.processedAt!), (collectedByDay.get(istDay(r.processedAt!)) ?? 0) - r.amount);
  const allDays = [...new Set([...byDay.keys(), ...collectedByDay.keys()])].sort();
  const daily: Report = {
    key: 'daily', title: 'Daily booking report', description: 'Bookings on each day, and the money collected that day.',
    columns: ['Date', 'Bookings', 'Went ahead', 'Cancelled', 'No-show', 'Revenue (₹)', 'Collected (₹)'], money: [5, 6],
    rows: allDays.map((d) => {
      const list = byDay.get(d) ?? [];
      return [formatDate(d), list.length, list.filter((b) => EARNING.includes(b.status)).length, list.filter((b) => ['CANCELLED', 'REFUNDED'].includes(b.status)).length, list.filter((b) => b.status === 'NO_SHOW').length, sum(list.filter((b) => EARNING.includes(b.status))), collectedByDay.get(d) ?? 0];
    }),
  };
  const months = [...new Set(allDays.map((d) => d.slice(0, 7)))];
  const monthly: Report = {
    key: 'monthly', title: 'Monthly booking report', description: 'The same figures by month.',
    columns: ['Month', 'Bookings', 'Went ahead', 'Cancelled', 'Revenue (₹)', 'Collected (₹)'], money: [4, 5],
    rows: months.map((m) => {
      const list = bookings.filter((b) => b.date.startsWith(m));
      const collected = [...collectedByDay.entries()].filter(([d]) => d.startsWith(m)).reduce((t, [, v]) => t + v, 0);
      return [monthLabel(m), list.length, list.filter((b) => EARNING.includes(b.status)).length, list.filter((b) => ['CANCELLED', 'REFUNDED'].includes(b.status)).length, sum(list.filter((b) => EARNING.includes(b.status))), collected];
    }),
  };

  // ---- facility revenue ----
  const byFacility = group(earning, (b) => b.facility.id);
  const facilityRevenue: Report = {
    key: 'facilities', title: 'Facility-wise revenue', description: 'Revenue of each facility from bookings that went ahead.',
    columns: ['Facility', 'Type', 'Bookings', 'Revenue (₹)', 'Average per booking (₹)'], money: [3, 4],
    rows: [...byFacility.values()].map((list) => [list[0].facility.name, CATEGORIES[list[0].facility.category]?.label ?? '', list.length, sum(list), Math.round(sum(list) / list.length)]).sort((a, b) => Number(b[3]) - Number(a[3])),
  };

  // ---- bowling machines ----
  const machineBookings = earning.filter((b) => b.facility.category === 'BOWLING_MACHINE');
  const byMachine = group(machineBookings.flatMap((b) => b.resources.filter((r) => r.role === 'PRIMARY').map((r) => ({ ...b, machine: r.resource }))), (b) => b.machine.id);
  const byPackage = group(machineBookings, (b) => b.package?.name ?? 'No package');
  const machines: Report = {
    key: 'machines', title: 'Bowling machine revenue', description: 'By machine, then by rental package.',
    columns: ['Machine / package', 'ID', 'Bookings', 'Hours', 'Revenue (₹)'], money: [4],
    rows: [
      ...[...byMachine.values()].map((list) => [list[0].machine.name, list[0].machine.code, list.length, Number((list.reduce((t, b) => t + (b.endMin - b.startMin), 0) / 60).toFixed(1)), sum(list)]),
      ...[...byPackage.entries()].map(([name, list]) => [`Package: ${name}`, '', list.length, Number((list.reduce((t, b) => t + (b.endMin - b.startMin), 0) / 60).toFixed(1)), sum(list)]),
    ],
  };

  // ---- equipment ----
  const lines = earning.flatMap((b) => b.equipment.filter((e) => e.status !== 'RELEASED').map((e) => ({ ...e, days: e.item.priceUnit === 'PER_DAY' ? rentalDays(b.date, b.returnDate) : 1 })));
  const byItem = group(lines, (l) => l.item.id);
  const equipment: Report = {
    key: 'equipment', title: 'Equipment rental revenue', description: 'Rental income and damage / loss charges per item.',
    columns: ['Item', 'ID', 'Category', 'Times rented', 'Quantity rented', 'Rental revenue (₹)', 'Damage / loss charges (₹)'], money: [5, 6],
    rows: [...byItem.values()].map((list) => [
      list[0].item.name, list[0].item.code, EQUIPMENT_CATEGORIES[list[0].item.category] ?? '', list.length, list.reduce((t, l) => t + l.qty, 0),
      list.reduce((t, l) => t + l.qty * l.unitPrice * l.days, 0), list.reduce((t, l) => t + l.charge, 0),
    ]).sort((a, b) => Number(b[5]) - Number(a[5])),
  };

  // ---- customers ----
  const byCustomer = group(bookings, (b) => `${b.customerPhone.replace(/\D/g, '').slice(-10)}`);
  const customers: Report = {
    key: 'customers', title: 'Customer-wise booking history', description: 'Everyone who booked in this period.',
    columns: ['Customer', 'Phone', 'Type', 'Bookings', 'Went ahead', 'Cancelled', 'Spent (₹)', 'Last booking'], money: [6],
    rows: [...byCustomer.values()].map((list) => {
      const last = list[list.length - 1];
      return [last.customerName, last.customerPhone, list.some((b) => b.customerType === 'STUDENT') ? 'Student' : 'Outside customer', list.length, list.filter((b) => EARNING.includes(b.status)).length, list.filter((b) => ['CANCELLED', 'REFUNDED'].includes(b.status)).length, sum(list.filter((b) => EARNING.includes(b.status))), formatDate(last.date)];
    }).sort((a, b) => Number(b[6]) - Number(a[6])),
  };

  // ---- payment collection ----
  const collection: Report = {
    key: 'payments', title: 'Payment collection report', description: 'Every payment received and refund paid in this period.',
    columns: ['Date', 'Receipt no.', 'Booking', 'Customer', 'Method', 'Reference', 'Recorded by', 'Amount (₹)'], money: [7],
    rows: [
      ...payments.map((p) => [formatDate(istDay(p.paidAt!)), p.receiptNo ?? '', p.booking.code, p.booking.customerName, PAYMENT_METHODS[p.method] ?? p.method, p.reference ?? '', p.recordedBy ?? (p.gateway ? 'Razorpay' : ''), p.amount] as (string | number)[]),
      ...refunds.map((r) => [formatDate(istDay(r.processedAt!)), 'REFUND', r.booking.code, r.booking.customerName, PAYMENT_METHODS[r.method ?? ''] ?? r.method ?? '', r.reference ?? '', r.processedBy ?? '', -r.amount] as (string | number)[]),
    ],
  };
  const byMethod = group(payments, (p) => p.method);
  const methods: Report = {
    key: 'methods', title: 'Collection by payment method', description: 'How customers paid.',
    columns: ['Method', 'Payments', 'Amount (₹)'], money: [2],
    rows: [
      ...[...byMethod.entries()].map(([m, list]) => [PAYMENT_METHODS[m] ?? m, list.length, list.reduce((t, p) => t + p.amount, 0)] as (string | number)[]),
      ...(refunds.length ? [['Refunds paid', refunds.length, -refunds.reduce((t, r) => t + r.amount, 0)] as (string | number)[]] : []),
    ],
  };

  // ---- cancelled ----
  const cancelledReport: Report = {
    key: 'cancelled', title: 'Cancelled booking report', description: 'Cancelled, rejected and refunded bookings.',
    columns: ['Booking', 'Date', 'Facility', 'Customer', 'Phone', 'Status', 'Reason', 'Amount (₹)', 'Cancellation charge (₹)'], money: [7, 8],
    rows: cancelled.map((b) => [b.code, formatDate(b.date), b.facility.name, b.customerName, b.customerPhone, BOOKING_STATUS[b.status]?.label ?? b.status, b.cancelReason ?? '', b.total, b.cancelCharge]),
  };

  // ---- utilisation ----
  const utilisation: Report = {
    key: 'utilisation', title: 'Facility utilisation report', description: 'Booked time as a share of the time the facility was open (blocked dates are not subtracted).',
    columns: ['Facility', 'Units', 'Hours open', 'Hours booked', 'Utilisation (%)'],
    rows: facilities.map((f) => {
      const units = f.resources.filter((r) => r.status !== 'INACTIVE').length;
      const open = (units * (f.closeTime - f.openTime) * days) / 60;
      const booked = earning.reduce((t, b) => t + b.resources.filter((r) => r.resource.facilityId === f.id).length * (b.endMin - b.startMin), 0) / 60;
      return [f.name, units, Math.round(open), Number(booked.toFixed(1)), open > 0 ? Number(((booked / open) * 100).toFixed(1)) : 0];
    }),
  };

  // ---- all bookings (export) ----
  const all: Report = {
    key: 'bookings', title: 'All bookings', description: 'One row per booking in this period.',
    columns: ['Booking', 'Date', 'Time', 'Length', 'Facility', 'Package', 'Units', 'Customer', 'Phone', 'Type', 'Status', 'Amount (₹)', 'Deposit (₹)', 'Paid (₹)', 'Due (₹)', 'Booked through', 'Price details'], money: [11, 12, 13, 14],
    rows: bookings.map((b) => [
      b.code, formatDate(b.date), b.kind === 'EQUIPMENT' ? (b.returnDate && b.returnDate !== b.date ? `until ${formatDate(b.returnDate)}` : 'one day') : rangeLabel(b.startMin, b.endMin),
      b.kind === 'EQUIPMENT' ? `${rentalDays(b.date, b.returnDate)} day(s)` : durationLabel(b.endMin - b.startMin), b.facility.name, b.package?.name ?? '',
      b.resources.map((r) => r.resource.name).join(' + '), b.customerName, b.customerPhone, b.customerType === 'STUDENT' ? 'Student' : 'Outside customer',
      BOOKING_STATUS[b.status]?.label ?? b.status, b.total, b.deposit, b.paid, Math.max(0, b.total + b.deposit - b.paid), b.source === 'STAFF' ? 'Staff' : 'Online',
      (JSON.parse(b.priceLines || '[]') as PriceLine[]).map((l) => `${l.label}: ${l.amount}`).join('; '),
    ]),
  };

  return [daily, monthly, facilityRevenue, machines, equipment, customers, collection, methods, cancelledReport, utilisation, all];
}

/** Headline numbers for the reports page. */
export async function reportTotals(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${addDays(to, 1)}T00:00:00+05:30`);
  const [bookings, paid, refunded] = await Promise.all([
    db.rentalBooking.groupBy({ by: ['status'], where: { date: { gte: from, lte: to } }, _count: { _all: true }, _sum: { total: true } }),
    db.rentalPayment.aggregate({ where: { status: 'PAID', paidAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.rentalRefund.aggregate({ where: { status: 'PROCESSED', processedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
  ]);
  const count = (statuses: string[]) => bookings.filter((b) => statuses.includes(b.status)).reduce((t, b) => t + b._count._all, 0);
  return {
    bookings: bookings.reduce((t, b) => t + b._count._all, 0),
    wentAhead: count(EARNING),
    cancelled: count(['CANCELLED', 'REFUNDED', 'REJECTED']),
    revenue: bookings.filter((b) => EARNING.includes(b.status)).reduce((t, b) => t + (b._sum.total ?? 0), 0),
    collected: (paid._sum.amount ?? 0) - (refunded._sum.amount ?? 0),
  };
}

/** A report as CSV text (with a BOM so Excel reads ₹ and Hindi names correctly). */
export function toCsv(report: Report) {
  const cell = (v: string | number) => {
    const s = String(v ?? '');
    // Stop spreadsheet formulas hidden in customer-typed text from running.
    const safe = typeof v === 'string' && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [report.columns, ...report.rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
