import { db } from './db';
import { DEFAULT_MESSAGE_SETTINGS, type MessageSettings, fillTemplate, whatsappUrl } from './messages';
import { formatDate, monthLabel } from './dates';
import { inr } from './format';

/** Academy name and WhatsApp templates, falling back to defaults for anything not saved yet. */
export async function getMessageSettings(): Promise<MessageSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(DEFAULT_MESSAGE_SETTINGS) } } });
  const settings = { ...DEFAULT_MESSAGE_SETTINGS };
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
