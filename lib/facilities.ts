// Branch facilities: the standard list (with emoji) and helpers. Safe in client and server code.

export const FACILITIES = [
  { key: 'INDOOR_NETS', label: 'Indoor nets', emoji: '🏏', hint: 'e.g. 3 nets' },
  { key: 'TURF_PITCH', label: 'Turf / astro pitch', emoji: '🟩', hint: '' },
  { key: 'CEMENT_PITCH', label: 'Cement pitch', emoji: '⬜', hint: '' },
  { key: 'BOWLING_MACHINE', label: 'Bowling machine', emoji: '⚙️', hint: '' },
  { key: 'SPECIAL_MENTORING', label: 'Special mentoring', emoji: '🎯', hint: 'e.g. one-to-one sessions' },
  { key: 'VIDEO_ANALYSIS', label: 'Video analysis', emoji: '🎥', hint: '' },
  { key: 'FLOODLIGHTS', label: 'Floodlights', emoji: '💡', hint: 'evening practice' },
  { key: 'GYM', label: 'Fitness / gym area', emoji: '🏋️', hint: '' },
  { key: 'MATCH_PRACTICE', label: 'Match practice & tournaments', emoji: '🏆', hint: '' },
  { key: 'KIT', label: 'Kit / equipment provided', emoji: '🎒', hint: '' },
  { key: 'CHANGING_ROOM', label: 'Changing room / washroom', emoji: '🚿', hint: '' },
  { key: 'DRINKING_WATER', label: 'RO drinking water', emoji: '💧', hint: '' },
  { key: 'PARKING', label: 'Parking', emoji: '🅿️', hint: '' },
  { key: 'FIRST_AID', label: 'First aid', emoji: '⛑️', hint: '' },
  { key: 'PARENT_SEATING', label: 'Seating for parents', emoji: '🪑', hint: '' },
  { key: 'CCTV', label: 'CCTV', emoji: '📹', hint: '' },
] as const;

export type FacilityItem = { key: string; label?: string; detail?: string };

/** Reads the stored JSON safely; unknown or broken data becomes an empty list. */
export function parseFacilities(json: string | null | undefined): FacilityItem[] {
  if (!json) return [];
  try {
    const list = JSON.parse(json);
    return Array.isArray(list) ? list.filter((f) => f && typeof f.key === 'string') : [];
  } catch {
    return [];
  }
}

/** Facilities ready to show: standard ones in list order, then custom ones. */
export function displayFacilities(json: string | null | undefined) {
  const items = parseFacilities(json);
  const standard = FACILITIES.flatMap((f) => {
    const item = items.find((i) => i.key === f.key);
    return item ? [{ emoji: f.emoji, label: f.label, detail: item.detail ?? '' }] : [];
  });
  const custom = items.filter((i) => i.key === 'CUSTOM' && i.label).map((i) => ({ emoji: '✅', label: i.label!, detail: i.detail ?? '' }));
  return [...standard, ...custom];
}

export const MAX_BRANCH_PHOTOS = 12;
export const MAX_BRANCH_PHOTO_BYTES = 700 * 1024;
