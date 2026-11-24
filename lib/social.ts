// Social media links shown on the public home page and coach pages. Safe in client and server code.

const HOSTS = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  youtube: ['youtube.com', 'youtu.be'],
} as const;

export type SocialPlatform = keyof typeof HOSTS;

export const SOCIAL_PLATFORMS = Object.keys(HOSTS) as SocialPlatform[];
export const SOCIAL_LABELS: Record<SocialPlatform, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube' };
export const SOCIAL_EXAMPLES: Record<SocialPlatform, string> = {
  instagram: 'instagram.com/yourpage',
  facebook: 'facebook.com/yourpage',
  youtube: 'youtube.com/@yourchannel',
};

/**
 * Turns what was typed into a full https link for that platform:
 *   instagram.com/indooracademy -> https://instagram.com/indooracademy
 *   @indooracademy (Instagram only) -> https://www.instagram.com/indooracademy
 * Returns '' for an empty value and null when it is not a page on that platform, so the
 * public pages can only ever link to Instagram, Facebook and YouTube.
 */
export function socialUrl(platform: SocialPlatform, input: string | null | undefined) {
  let value = (input ?? '').trim();
  if (!value) return '';
  if (platform === 'instagram' && /^@[\w.]{1,30}$/.test(value)) value = `https://www.instagram.com/${value.slice(1)}`;
  else if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
    if (!(HOSTS[platform] as readonly string[]).includes(host)) return null;
    if (url.pathname === '/' && !url.search) return null; // the site itself, not a page on it
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

/** Message shown when a typed link is not a page on that platform. */
export function socialError(platform: SocialPlatform) {
  return `${SOCIAL_LABELS[platform]} link must be a ${SOCIAL_LABELS[platform]} page, e.g. ${SOCIAL_EXAMPLES[platform]}.`;
}

/** Short text for a link: "@handle" when the address has one, otherwise the platform name. */
export function socialHandle(platform: SocialPlatform, url: string) {
  try {
    const first = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean)[0] ?? '');
    if (platform === 'instagram' && /^[\w.]+$/.test(first) && !['p', 'reel', 'reels', 'explore', 'stories'].includes(first)) return `@${first}`;
    if (platform === 'youtube' && /^@[\w.-]+$/.test(first)) return first;
    if (platform === 'facebook' && /^[\w.-]+$/.test(first) && !['profile.php', 'people', 'pages', 'groups', 'share', 'p'].includes(first)) return first;
  } catch {}
  return SOCIAL_LABELS[platform];
}
