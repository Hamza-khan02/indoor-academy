// Notices (announcements): who sees what, and the text shared on WhatsApp.
import { todayISO } from './dates';

/** Prisma filter for notices a student's family should see today (not expired, and aimed at them). */
export function noticesForStudent(student: { branchId: string; batchId: string | null }, today = todayISO()) {
  return {
    AND: [
      { OR: [{ expiresOn: null }, { expiresOn: { gte: today } }] },
      {
        OR: [
          { audience: 'ALL' },
          { audience: 'BRANCH', branchId: student.branchId },
          ...(student.batchId ? [{ audience: 'BATCH', batchId: student.batchId }] : []),
        ],
      },
    ],
  };
}

export function audienceLabel(n: { audience: string; branch?: { name: string } | null; batch?: { name: string } | null }) {
  if (n.audience === 'BRANCH') return `Branch: ${n.branch?.name ?? '—'}`;
  if (n.audience === 'BATCH') return `Batch: ${n.batch?.name ?? '—'}`;
  return 'All families';
}

/** WhatsApp-formatted notice (*bold*), with the parent app link when the app's address is set. */
export function noticeShareText(n: { title: string; body: string }, academyName: string, publicUrl: string) {
  const lines = [`*${academyName} – Notice*`, '', `*${n.title}*`, n.body];
  if (publicUrl) lines.push('', `Parent app: ${publicUrl.replace(/\/+$/, '')}/parent/login`);
  return lines.join('\n');
}

/** Opens WhatsApp with the text typed in, letting the user pick a group or contact. */
export function whatsappShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
