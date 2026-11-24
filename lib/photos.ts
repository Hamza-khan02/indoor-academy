// Student profile photos: URL helper (safe anywhere) and upload checks (server).

/** Largest photo accepted. The browser resizes to 320x320 JPEG first (usually 20–40 KB). */
export const MAX_PHOTO_BYTES = 300 * 1024;

/** Image URL with a version so browsers refresh it after a change, or null when there is no photo. */
export function photoUrl(student: { id: string; photoUpdatedAt?: Date | null }) {
  return student.photoUpdatedAt ? `/api/photo/${student.id}?v=${student.photoUpdatedAt.getTime()}` : null;
}

/** Same for a coach's photo. Coach photos are public (shown on the home page). */
export function coachPhotoUrl(coach: { id: string; photoUpdatedAt?: Date | null }) {
  return coach.photoUpdatedAt ? `/api/coach-photo/${coach.id}?v=${coach.photoUpdatedAt.getTime()}` : null;
}

/** Detects the real image type from the file's first bytes (never trust the file name). */
export function imageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  return null;
}
