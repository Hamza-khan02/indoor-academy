'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionUser } from '@/lib/auth';
import { todayISO } from '@/lib/dates';
import { FormError, date, run, text } from '@/lib/form';

async function parseNotice(fd: FormData, isNew: boolean) {
  // "target" is ALL, BRANCH:<id> or BATCH:<id>
  const target = text(fd, 'target', { required: true, label: 'Who should see it' });
  let audience = 'ALL';
  let branchId: string | null = null;
  let batchId: string | null = null;
  if (target !== 'ALL') {
    const [kind, id] = target.split(':');
    if (kind === 'BRANCH' && id && (await db.branch.findUnique({ where: { id }, select: { id: true } }))) {
      audience = 'BRANCH';
      branchId = id;
    } else if (kind === 'BATCH' && id && (await db.batch.findUnique({ where: { id }, select: { id: true } }))) {
      audience = 'BATCH';
      batchId = id;
    } else {
      throw new FormError('Choose who should see this notice.');
    }
  }
  const expiresOn = date(fd, 'expiresOn', { label: 'Show until' });
  if (isNew && expiresOn && expiresOn < todayISO()) throw new FormError('"Show until" cannot be in the past.');
  return {
    title: text(fd, 'title', { required: true, label: 'Title', max: 120 }),
    body: text(fd, 'body', { required: true, label: 'Message', max: 2000 }),
    audience,
    branchId,
    batchId,
    pinned: fd.get('pinned') === 'on',
    expiresOn,
  };
}

export async function createNotice(fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    const data = await parseNotice(fd, true);
    await db.notice.create({ data: { ...data, createdById: user.id, createdBy: user.name } });
    revalidatePath('/', 'layout');
    return 'Notice posted. Parents can see it in the parent app.';
  });
}

export async function updateNotice(id: string, fd: FormData) {
  return run(async () => {
    await actionUser();
    const data = await parseNotice(fd, false);
    await db.notice.update({ where: { id }, data });
    revalidatePath('/', 'layout');
    return 'Notice updated';
  });
}

/** Admins can delete any notice; others only their own. */
export async function deleteNotice(id: string) {
  return run(async () => {
    const user = await actionUser();
    const notice = await db.notice.findUnique({ where: { id } });
    if (!notice) throw new FormError('This notice no longer exists.');
    if (user.role !== 'ADMIN' && notice.createdById !== user.id) throw new FormError('Only an administrator or the person who posted it can delete this notice.');
    await db.notice.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return 'Notice deleted';
  });
}
