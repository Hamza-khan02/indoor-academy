// WhatsApp message templates. Pure data + helpers, safe to import in client components.

export const PLACEHOLDERS: Record<string, string> = {
  '{parent}': "Guardian's name (or Sir/Madam)",
  '{student}': "Student's name",
  '{academy}': 'Academy name',
  '{batch}': 'Batch name',
  '{amount}': 'Fee amount due (fee reminder)',
  '{month}': 'Fee month (fee reminder)',
  '{date}': 'Date of absence (absence notice)',
};

export const MESSAGE_PRESETS = {
  en: {
    label: 'English',
    fee: 'Namaste {parent}, this is a gentle reminder from {academy}. The fee of {amount} for {student} ({batch}) for {month} is pending. Please pay at the earliest. Thank you!',
    absent: 'Namaste {parent}, {student} was absent from {batch} practice at {academy} on {date}. Please let us know if everything is okay. Thank you!',
  },
  hi: {
    label: 'हिंदी',
    fee: 'नमस्ते {parent}, {academy} की ओर से याद दिलाना है कि {student} ({batch}) की {month} की फीस {amount} बाकी है। कृपया जल्द से जल्द जमा करें। धन्यवाद!',
    absent: 'नमस्ते {parent}, {student} {date} को {academy} में {batch} की प्रैक्टिस में अनुपस्थित रहे। कृपया कारण बताएं। धन्यवाद!',
  },
} as const;

export type MessageSettings = { academyName: string; feeTemplate: string; absentTemplate: string };

export const DEFAULT_MESSAGE_SETTINGS: MessageSettings = {
  academyName: 'INDOOR ACADEMY',
  feeTemplate: MESSAGE_PRESETS.en.fee,
  absentTemplate: MESSAGE_PRESETS.en.absent,
};

/** Replaces {placeholders}; unknown ones are left as typed. */
export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}

/**
 * Converts an Indian phone number to the digits wa.me expects (country code, no '+').
 * 98765 43210 -> 919876543210, 098765 43210 -> 919876543210, +91 98765 43210 -> 919876543210.
 * Returns null when it cannot be a valid number.
 */
export function whatsappNumber(phone: string | null | undefined) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

/** A wa.me link that opens WhatsApp with the message typed in, or null for an unusable number. */
export function whatsappUrl(phone: string | null | undefined, text?: string) {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
