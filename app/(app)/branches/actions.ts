'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin } from '@/lib/auth';
import { FormError, run, text } from '@/lib/form';
import { isGoogleMapsUrl } from '@/lib/maps';

function parseBranch(fd: FormData) {
  const mapsUrl = text(fd, 'mapsUrl', { label: 'Google Maps link', max: 300 });
  if (mapsUrl && !isGoogleMapsUrl(mapsUrl)) {
    throw new FormError('Paste a Google Maps link (Google Maps → Share → Copy link), e.g. https://maps.app.goo.gl/…');
  }
  return {
    name: text(fd, 'name', { required: true, label: 'Branch name', max: 60 }),
    address: text(fd, 'address', { label: 'Address', max: 200 }),
    mapsUrl,
  };
}

export async function createBranch(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = parseBranch(fd);
    await db.branch.create({ data });
    revalidatePath('/', 'layout');
    return `Branch ${data.name} created`;
  });
}

export async function updateBranch(id: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = parseBranch(fd);
    await db.branch.update({ where: { id }, data });
    revalidatePath('/', 'layout');
    return `Branch ${data.name} updated`;
  });
}

export async function deleteBranch(id: string) {
  return run(async () => {
    await actionAdmin();
    const [students, batches] = await Promise.all([
      db.student.count({ where: { branchId: id } }),
      db.batch.count({ where: { branchId: id } }),
    ]);
    if (students || batches) {
      throw new FormError(`This branch still has ${students} students and ${batches} batches. Move or delete them first.`);
    }
    const b = await db.branch.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return `Branch ${b.name} deleted`;
  });
}
