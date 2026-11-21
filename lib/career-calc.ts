// Career statistics built from a player's match scorecards, coach ratings and attendance.
// Pure functions (no database), safe anywhere.
import { careerStats, type StatRow } from './cricket';

export type CareerRow = StatRow & { match: { date: string; opponent: string; matchType: string } };
export type Scores = { batting: number; bowling: number; fielding: number; fitness: number };

/** Cricket season used in this app: April to March, e.g. '2026-11-20' -> '2026-27'. */
export function seasonOf(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Career stats grouped by a key (season, match type…), most recent / largest group first as given by `order`. */
export function groupStats<K extends string>(rows: CareerRow[], keyOf: (r: CareerRow) => K) {
  const groups = new Map<K, CareerRow[]>();
  for (const r of rows) {
    const k = keyOf(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()].map(([key, list]) => ({ key, ...careerStats(list) }));
}

export type Milestone = { date: string; title: string; detail: string; kind: 'bat' | 'bowl' | 'field' | 'start' };

/** Milestones in date order. `rows` must be sorted by match date (oldest first). */
export function milestones(rows: CareerRow[]): Milestone[] {
  const out: Milestone[] = [];
  if (rows.length === 0) return out;
  const vs = (r: CareerRow) => `vs ${r.match.opponent}`;
  out.push({ date: rows[0].match.date, title: 'First match', detail: vs(rows[0]), kind: 'start' });

  const firstWhere = (test: (r: CareerRow) => boolean, title: string, detail: (r: CareerRow) => string, kind: Milestone['kind']) => {
    const r = rows.find(test);
    if (r) out.push({ date: r.match.date, title, detail: detail(r), kind });
  };
  firstWhere((r) => r.batted && r.runs >= 50, 'First fifty', (r) => `${r.runs}${r.notOut ? '*' : ''} ${vs(r)}`, 'bat');
  firstWhere((r) => r.batted && r.runs >= 100, 'First hundred', (r) => `${r.runs}${r.notOut ? '*' : ''} ${vs(r)}`, 'bat');
  firstWhere((r) => r.wickets >= 3, 'First 3-wicket haul', (r) => `${r.wickets}/${r.runsConceded} ${vs(r)}`, 'bowl');
  firstWhere((r) => r.wickets >= 5, 'First 5-wicket haul', (r) => `${r.wickets}/${r.runsConceded} ${vs(r)}`, 'bowl');

  // Career totals crossing round numbers.
  let runs = 0;
  let wickets = 0;
  const runMarks = [100, 250, 500, 1000, 2000];
  const wicketMarks = [10, 25, 50, 100];
  for (const r of rows) {
    const beforeRuns = runs;
    const beforeWkts = wickets;
    runs += r.batted ? r.runs : 0;
    wickets += r.wickets;
    for (const m of runMarks) if (beforeRuns < m && runs >= m) out.push({ date: r.match.date, title: `${m} career runs`, detail: vs(r), kind: 'bat' });
    for (const m of wicketMarks) if (beforeWkts < m && wickets >= m) out.push({ date: r.match.date, title: `${m} career wickets`, detail: vs(r), kind: 'bowl' });
  }

  const batted = rows.filter((r) => r.batted);
  if (batted.length) {
    const best = batted.reduce((b, r) => (r.runs > b.runs || (r.runs === b.runs && r.notOut && !b.notOut) ? r : b));
    out.push({ date: best.match.date, title: 'Highest score', detail: `${best.runs}${best.notOut ? '*' : ''} (${best.balls}) ${vs(best)}`, kind: 'bat' });
  }
  const bowled = rows.filter((r) => r.ballsBowled > 0 && r.wickets > 0);
  if (bowled.length) {
    const best = bowled.reduce((b, r) => (r.wickets > b.wickets || (r.wickets === b.wickets && r.runsConceded < b.runsConceded) ? r : b));
    out.push({ date: best.match.date, title: 'Best bowling', detail: `${best.wickets}/${best.runsConceded} ${vs(best)}`, kind: 'bowl' });
  }
  const fielding = rows.map((r) => ({ r, n: r.catches + r.stumpings + r.runOuts })).filter((x) => x.n >= 2);
  if (fielding.length) {
    const best = fielding.reduce((b, x) => (x.n > b.n ? x : b));
    out.push({ date: best.r.match.date, title: 'Best in the field', detail: `${best.n} dismissals ${vs(best.r)}`, kind: 'field' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Match "impact" points per match: runs + 20 per wicket + 10 per catch / stumping / run out. */
export function impactPerMatch(rows: StatRow[]) {
  if (!rows.length) return null;
  const pts = rows.reduce((t, r) => t + (r.batted ? r.runs : 0) + 20 * r.wickets + 10 * (r.catches + r.stumpings + r.runOuts), 0);
  return pts / rows.length;
}

export const SCORE_WEIGHTS = { rating: 40, attendance: 30, matches: 30 } as const;

/**
 * Overall performance score out of 100.
 *  - Coach rating: latest assessment average × 10
 *  - Attendance: % of the last 90 days' sessions attended
 *  - Matches: impact points per match × 2, capped at 100 (50 points a match = full marks)
 * Missing parts are left out and the remaining weights are scaled up.
 */
export function performanceScore(input: { latestRating: Scores | null; attendancePct: number | null; rows: StatRow[] }) {
  const parts = {
    rating: input.latestRating ? ((input.latestRating.batting + input.latestRating.bowling + input.latestRating.fielding + input.latestRating.fitness) / 4) * 10 : null,
    attendance: input.attendancePct,
    matches: (() => {
      const ipm = impactPerMatch(input.rows);
      return ipm === null ? null : Math.min(100, ipm * 2);
    })(),
  };
  let weight = 0;
  let total = 0;
  for (const k of Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]) {
    const v = parts[k];
    if (v === null) continue;
    weight += SCORE_WEIGHTS[k];
    total += SCORE_WEIGHTS[k] * v;
  }
  return {
    score: weight ? Math.round(total / weight) : null,
    parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v === null ? null : Math.round(v)])) as Record<keyof typeof SCORE_WEIGHTS, number | null>,
  };
}

export type RankMetric = 'runs' | 'wickets' | 'average' | 'catches';

/**
 * Rank of one player among peers for each metric (1 = best). Only peers with at least one match count;
 * batting average needs at least 3 innings and 1 dismissal.
 */
export function ranks(playerId: string, peers: Map<string, StatRow[]>) {
  const table = [...peers.entries()].filter(([, rows]) => rows.length > 0).map(([id, rows]) => ({ id, s: careerStats(rows) }));
  const metric = (name: RankMetric, value: (s: ReturnType<typeof careerStats>) => number | null) => {
    const eligible = table.map((t) => ({ id: t.id, v: value(t.s) })).filter((t): t is { id: string; v: number } => t.v !== null);
    const mine = eligible.find((t) => t.id === playerId);
    return { metric: name, value: mine?.v ?? null, rank: mine ? 1 + eligible.filter((t) => t.v > mine.v).length : null, of: eligible.length };
  };
  return [
    metric('runs', (s) => s.runs),
    metric('wickets', (s) => s.wickets),
    metric('average', (s) => (s.innings >= 3 && s.average !== null ? s.average : null)),
    metric('catches', (s) => s.catches + s.stumpings),
  ];
}
