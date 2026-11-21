'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin } from '@/lib/auth';
import { FormError, run, text } from '@/lib/form';
import { FACILITIES, MAX_BRANCH_PHOTOS, MAX_BRANCH_PHOTO_BYTES, type FacilityItem } from '@/lib/facilities';
import { imageType } from '@/lib/photos';

async function branchOrThrow(id: string) {
  const b = await db.branch.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!b) throw new FormError('This branch no longer exists.');
  return b;
}

/** Saves the ticked facilities (with optional details) and custom ones (one per line). */
export async function saveFacilities(branchId: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const branch = await branchOrThrow(branchId);
    const items: FacilityItem[] = [];
    for (const f of FACILITIES) {
      if (fd.get(`f_${f.key}`) !== 'on') continue;
      const detail = text(fd, `d_${f.key}`, { label: `${f.label} details`, max: 80 });
      items.push(detail ? { key: f.key, detail } : { key: f.key });
    }
    const custom = (text(fd, 'custom', { label: 'Other facilities', max: 1000 }) ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (custom.length > 15) throw new FormError('Add at most 15 other facilities.');
    for (const line of custom) {
      if (line.length > 80) throw new FormError(`"${line.slice(0, 30)}…" is too long (80 characters max).`);
      items.push({ key: 'CUSTOM', label: line });
    }
    await db.branch.update({ where: { id: branchId }, data: { facilities: JSON.stringify(items) } });
    revalidatePath('/', 'layout');
    return `Facilities saved for ${branch.name} (${items.length})`;
  });
}

export async function uploadBranchPhoto(branchId: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    await branchOrThrow(branchId);
    if ((await db.branchPhoto.count({ where: { branchId } })) >= MAX_BRANCH_PHOTOS) {
      throw new FormError(`A branch can have at most ${MAX_BRANCH_PHOTOS} photos. Delete one first.`);
    }
    const file = fd.get('photo');
    if (!file || typeof file === 'string' || file.size === 0) throw new FormError('Choose a photo first.');
    if (file.size > MAX_BRANCH_PHOTO_BYTES) throw new FormError('The photo is too large. Please choose a smaller image.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = imageType(bytes);
    if (!mimeType) throw new FormError('Only JPG, PNG or WebP photos can be used.');
    await db.branchPhoto.create({
      data: { branchId, data: Buffer.from(bytes), mimeType, caption: text(fd, 'caption', { label: 'Caption', max: 80 }) },
    });
    revalidatePath('/', 'layout');
    return 'Photo added';
  });
}

export async function deleteBranchPhoto(id: string) {
  return run(async () => {
    await actionAdmin();
    await db.branchPhoto.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return 'Photo deleted';
  });
}
