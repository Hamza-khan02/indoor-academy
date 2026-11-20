import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ATTENDANCE_STATUS, PAYMENT_METHODS, STUDENT_STATUS } from '@/lib/constants';
import { addDays, todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/** Escapes a CSV cell and stops spreadsheet apps from treating it as a formula. */
function cell(v: unknown) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(header: string[], rows: unknown[][]) {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

async function build(type: string) {
  if (type === 'students') {
    const students = await db.student.findMany({ orderBy: { name: 'asc' }, include: { branch: true, batch: true } });
    return csv(
      ['Name', 'Age group', 'Playing role', 'Date of birth', 'Branch', 'Batch', 'Guardian', 'Guardian phone', 'Status', 'Joined on', 'Notes'],
      students.map((s) => [s.name, s.ageGroup, s.playingRole, s.dob, s.branch.name, s.batch?.name, s.guardianName, s.guardianPhone, STUDENT_STATUS[s.status], s.joinedOn, s.notes]),
    );
  }
  if (type === 'payments') {
    const payments = await db.feePayment.findMany({ orderBy: [{ paidOn: 'desc' }], include: { student: true } });
    return csv(
      ['Receipt no.', 'Paid on', 'Fee month', 'Student', 'Amount (INR)', 'Method', 'Reference', 'Recorded by'],
      payments.map((p) => [p.receiptNo, p.paidOn, p.forMonth, p.student.name, p.amount, PAYMENT_METHODS[p.method], p.reference, p.recordedBy]),
    );
  }
  if (type === 'attendance') {
    const since = addDays(todayISO(), -89);
    const rows = await db.attendance.findMany({ where: { date: { gte: since } }, orderBy: [{ date: 'desc' }], include: { student: true, batch: true } });
    return csv(
      ['Date', 'Student', 'Batch', 'Status', 'Marked by'],
      rows.map((a) => [a.date, a.student.name, a.batch?.name, ATTENDANCE_STATUS[a.status], a.markedBy]),
    );
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: { type: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Administrators only' }, { status: 403 });
  const body = await build(params.type);
  if (body === null) return NextResponse.json({ error: 'Unknown export' }, { status: 404 });
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="indoor-academy-${params.type}-${todayISO()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
