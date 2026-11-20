'use server';

import { revalidatePath } from 'next/cache';
import { db } from './db';
import { actionUser } from './auth';
import { getFamily } from './family';
import { FormError, run } from './form';
import { MAX_PHOTO_BYTES, imageType } from './photos';

async function readPhoto(fd: FormData) {
  const file = fd.get('photo');
  if (!file || typeof file === 'string') throw new FormError('Choose a photo first.');
  if (file.size === 0) throw new FormError('The photo is empty.');
  if (file.size > MAX_PHOTO_BYTES) throw new FormError('The photo is too large. Please choose a smaller image.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = imageType(bytes);
  if (!mimeType) throw new FormError('Only JPG, PNG or WebP photos can be used.');
  return { data: Buffer.from(bytes), mimeType };
}

async function savePhoto(studentId: string, fd: FormData, updatedBy: string) {
  const photo = await readPhoto(fd);
  const now = new Date();
  await db.$transaction([
    db.studentPhoto.upsert({ where: { studentId }, create: { studentId, ...photo, updatedBy }, update: { ...photo, updatedBy } }),
    db.student.update({ where: { id: studentId }, data: { photoUpdatedAt: now } }),
  ]);
}

async function deletePhoto(studentId: string) {
  await db.$transaction([
    db.studentPhoto.deleteMany({ where: { studentId } }),
    db.student.update({ where: { id: studentId }, data: { photoUpdatedAt: null } }),
  ]);
}

// ---- Staff (admin or coach) ----

export async function uploadStudentPhoto(studentId: string, fd: FormData) {
  return run(async () => {
    const user = await actionUser();
    if (!(await db.student.findUnique({ where: { id: studentId }, select: { id: true } }))) throw new FormError('This student no longer exists.');
    await savePhoto(studentId, fd, user.name);
    revalidatePath('/', 'layout');
    return 'Photo updated';
  });
}

export async function removeStudentPhoto(studentId: string) {
  return run(async () => {
    await actionUser();
    await deletePhoto(studentId);
    revalidatePath('/', 'layout');
    return 'Photo removed';
  });
}

// ---- Parent / student app (own children only) ----

async function ownChild(studentId: string) {
  const family = await getFamily();
  if (!family) throw new FormError('Your session has expired. Please log in again.');
  if (!family.students.some((s) => s.id === studentId)) throw new FormError('You can only change your own child\'s photo.');
}

export async function uploadChildPhoto(studentId: string, fd: FormData) {
  return run(async () => {
    await ownChild(studentId);
    await savePhoto(studentId, fd, 'Parent / student');
    revalidatePath('/', 'layout');
    return 'Photo updated';
  });
}

export async function removeChildPhoto(studentId: string) {
  return run(async () => {
    await ownChild(studentId);
    await deletePhoto(studentId);
    revalidatePath('/', 'layout');
    return 'Photo removed';
  });
}
