import { db } from './db';
import { DEFAULT_MESSAGE_SETTINGS, type MessageSettings, fillTemplate, whatsappUrl } from './messages';
import { DEFAULT_RECEIPT_PREFIX } from './receipts';
import { PAYMENT_METHODS } from './constants';
import { formatDate, monthLabel } from './dates';
import { inr } from './format';

export type ReceiptSettings = { receiptPrefix: string; academyAddress: string; academyPhone: string; receiptNote: string };
/** publicUrl: where parents open the app once it is online, e.g. https://academy.example.com */
export type AppSettings = MessageSettings & ReceiptSettings & { publicUrl: string };

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  receiptPrefix: DEFAULT_RECEIPT_PREFIX,
  academyAddress: '',
  academyPhone: '',
  receiptNote: 'This is a computer-generated receipt.',
};

const DEFAULTS: AppSettings = { ...DEFAULT_MESSAGE_SETTINGS, ...DEFAULT_RECEIPT_SETTINGS, publicUrl: '' };

/** Academy details, WhatsApp templates and receipt settings, falling back to defaults for anything not saved. */
export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(DEFAULTS) } } });
  const settings = { ...DEFAULTS };
  for (const r of rows) (settings as Record<string, string>)[r.key] = r.value;
  return settings;
}

type StudentContact = { name: string; guardianName: string | null; guardianPhone: string; batchName?: string | null };

function baseVars(settings: MessageSettings, s: StudentContact) {
  return {
    parent: s.guardianName || 'Sir/Madam',
    student: s.name,
    academy: settings.academyName,
    batch: s.batchName || 'academy',
  };
}

/** WhatsApp link with a fee reminder typed in. */
export function feeReminderUrl(settings: MessageSettings, s: StudentContact, amount: number, month: string) {
  const text = fillTemplate(settings.feeTemplate, { ...baseVars(settings, s), amount: inr(amount), month: monthLabel(month) });
  return whatsappUrl(s.guardianPhone, text);
}

/** WhatsApp link with an absence notice typed in. */
export function absenceNoticeUrl(settings: MessageSettings, s: StudentContact, day: string) {
  const text = fillTemplate(settings.absentTemplate, { ...baseVars(settings, s), date: formatDate(day) });
  return whatsappUrl(s.guardianPhone, text);
}

/** WhatsApp link with payment receipt details typed in. */
export function receiptMessageUrl(
  settings: MessageSettings,
  s: StudentContact,
  p: { amount: number; forMonth: string; paidOn: string; method: string; receiptNo: string | null },
) {
  const text = fillTemplate(settings.receiptTemplate, {
    ...baseVars(settings, s),
    amount: inr(p.amount),
    month: monthLabel(p.forMonth),
    date: formatDate(p.paidOn),
    method: PAYMENT_METHODS[p.method] ?? p.method,
    receipt: p.receiptNo ?? '—',
  });
  return whatsappUrl(s.guardianPhone, text);
}
