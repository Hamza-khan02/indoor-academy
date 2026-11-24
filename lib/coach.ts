// Coach public profile helpers. Safe in client and server code.
import { todayISO } from './dates';

/** The non-empty lines of a "one per line" field, without a leading bullet. */
export function profileLines(text: string | null | undefined) {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^[-•*]\s+/, ''))
    .filter(Boolean);
}

/**
 * Splits a trophy / award line into its year and title:
 *   "2019 - District champions" -> { year: '2019', title: 'District champions' }
 *   "2018-19: Best coach"       -> { year: '2018-19', title: 'Best coach' }
 *   "Man of the series"         -> { year: null, title: 'Man of the series' }
 */
export function parseAchievement(line: string) {
  const m = line.match(/^((?:19|20)\d{2}(?:\s*[-–/]\s*\d{2,4})?)\s*[-–—:|]\s*(\S.*)$/) ?? line.match(/^((?:19|20)\d{2})\s+(\S.*)$/);
  return m ? { year: m[1].replace(/\s+/g, ''), title: m[2] } : { year: null, title: line };
}

/** Whole years of coaching from the year the coach started, or null when it is not set. */
export function coachingYears(since: number | null | undefined, today = todayISO()) {
  if (!since) return null;
  const years = Number(today.slice(0, 4)) - since;
  return years >= 0 ? years : null;
}
