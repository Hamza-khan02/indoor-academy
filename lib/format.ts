const inrFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹ 2,84,000 */
export function inr(n: number) {
  return `₹ ${inrFormatter.format(n || 0)}`;
}

/** ₹ 2.84L / ₹ 1.2Cr / ₹ 45,000 */
export function inrCompact(n: number) {
  if (n >= 1e7) return `₹ ${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (n >= 1e5) return `₹ ${(n / 1e5).toFixed(2).replace(/\.?0+$/, '')}L`;
  return inr(n);
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}

function belowThousand(n: number) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

/** Whole rupees in words, Indian system: 250000 -> 'Rupees Two Lakh Fifty Thousand Only'. */
export function rupeesInWords(amount: number) {
  let n = Math.floor(Math.abs(amount));
  if (n === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 100 ? belowThousand(crore) : belowHundred(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return `Rupees ${parts.join(' ')} Only`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Stable avatar colour class (av0..av4) for a name. */
export function avatarClass(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `av${h % 5}`;
}

/** Percentage rounded to one decimal, or null when there is nothing to divide by. */
export function percent(part: number, total: number) {
  if (!total) return null;
  return Math.round((part / total) * 1000) / 10;
}
