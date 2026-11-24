'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { actionAdmin } from '@/lib/auth';
import { FormError, email, int, phone, run, text } from '@/lib/form';
import { todayISO } from '@/lib/dates';
import { SOCIAL_LABELS, socialError, socialUrl, type SocialPlatform } from '@/lib/social';

async function parseCoach(fd: FormData) {
  const branchId = text(fd, 'branchId');
  if (branchId && !(await db.branch.findUnique({ where: { id: branchId } }))) throw new FormError('Choose a valid branch.');
  return {
    name: text(fd, 'name', { required: true, label: 'Name', max: 80 }),
    phone: phone(fd, 'phone', { label: 'Phone' }),
    email: email(fd, 'email', { label: 'Email' }),
    specialization: text(fd, 'specialization', { label: 'Specialization', max: 60 }),
    active: fd.get('active') !== 'false',
    branchId,
  };
}

export async function createCoach(fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = await parseCoach(fd);
    await db.coach.create({ data });
    revalidatePath('/', 'layout');
    return `Coach ${data.name} added`;
  });
}

export async function updateCoach(id: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const data = await parseCoach(fd);
    await db.coach.update({ where: { id }, data });
    revalidatePath('/', 'layout');
    return `Coach ${data.name} updated`;
  });
}

/** The coach's public profile (their page on the home page): about, experience, trophies and social links. */
export async function updateCoachProfile(id: string, fd: FormData) {
  return run(async () => {
    await actionAdmin();
    const link = (platform: SocialPlatform, key: string) => {
      const url = socialUrl(platform, text(fd, key, { label: SOCIAL_LABELS[platform], max: 200 }));
      if (url === null) throw new FormError(socialError(platform));
      return url || null;
    };
    const coach = await db.coach.update({
      where: { id },
      data: {
        bio: text(fd, 'bio', { label: 'About', max: 1500 }),
        coachingSince: int(fd, 'coachingSince', { label: 'Coaching since', min: 1950, max: Number(todayISO().slice(0, 4)) }),
        experience: text(fd, 'experience', { label: 'Experience and qualifications', max: 2000 }),
        achievements: text(fd, 'achievements', { label: 'Trophies and awards', max: 3000 }),
        instagramUrl: link('instagram', 'instagramUrl'),
        facebookUrl: link('facebook', 'facebookUrl'),
        youtubeUrl: link('youtube', 'youtubeUrl'),
      },
    });
    revalidatePath('/', 'layout');
    return `${coach.name}'s public profile saved`;
  });
}

export async function deleteCoach(id: string) {
  return run(async () => {
    await actionAdmin();
    const c = await db.coach.delete({ where: { id } });
    revalidatePath('/', 'layout');
    return `Coach ${c.name} deleted. Their batches now have no coach assigned.`;
  });
}
