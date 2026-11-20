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
