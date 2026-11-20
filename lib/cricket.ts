// Cricket helpers: overs <-> balls and career statistics. Pure functions, safe anywhere.

/** 22 balls -> "3.4" */
export function oversText(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

/** "3.4" -> 22 balls; "4" -> 24. Returns null when the text isn't valid overs (the part after the dot must be 0-5). */
export function parseOvers(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  const m = t.match(/^(\d{1,3})(?:\.(\d))?$/);
  if (!m) return null;
  const extra = m[2] ? Number(m[2]) : 0;
  if (extra > 5) return null;
  return Number(m[1]) * 6 + extra;
}

export type StatRow = {
  batted: boolean; notOut: boolean; runs: number; balls: number; fours: number; sixes: number;
  ballsBowled: number; maidens: number; runsConceded: number; wickets: number; catches: number; stumpings: number; runOuts: number;
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Career totals and averages from a player's per-match rows. */
export function careerStats(rows: StatRow[]) {
  const batted = rows.filter((r) => r.batted);
  const runs = batted.reduce((t, r) => t + r.runs, 0);
  const balls = batted.reduce((t, r) => t + r.balls, 0);
  const notOuts = batted.filter((r) => r.notOut).length;
  const dismissals = batted.length - notOuts;
  const best = batted.reduce<StatRow | null>((b, r) => (!b || r.runs > b.runs || (r.runs === b.runs && r.notOut && !b.notOut) ? r : b), null);

  const ballsBowled = rows.reduce((t, r) => t + r.ballsBowled, 0);
  const runsConceded = rows.reduce((t, r) => t + r.runsConceded, 0);
  const wickets = rows.reduce((t, r) => t + r.wickets, 0);
  const bowled = rows.filter((r) => r.ballsBowled > 0);
  const bestBowling = bowled.reduce<StatRow | null>((b, r) => (!b || r.wickets > b.wickets || (r.wickets === b.wickets && r.runsConceded < b.runsConceded) ? r : b), null);

  return {
    matches: rows.length,
    innings: batted.length,
    runs,
    balls,
    notOuts,
    highest: best ? `${best.runs}${best.notOut ? '*' : ''}` : '—',
    average: dismissals ? round(runs / dismissals) : null,
    strikeRate: balls ? round((runs / balls) * 100) : null,
    fifties: batted.filter((r) => r.runs >= 50 && r.runs < 100).length,
    hundreds: batted.filter((r) => r.runs >= 100).length,
    fours: batted.reduce((t, r) => t + r.fours, 0),
    sixes: batted.reduce((t, r) => t + r.sixes, 0),
    overs: oversText(ballsBowled),
    ballsBowled,
    maidens: rows.reduce((t, r) => t + r.maidens, 0),
    runsConceded,
    wickets,
    economy: ballsBowled ? round(runsConceded / (ballsBowled / 6)) : null,
    bowlingAverage: wickets ? round(runsConceded / wickets) : null,
    bestBowling: bestBowling ? `${bestBowling.wickets}/${bestBowling.runsConceded}` : '—',
    catches: rows.reduce((t, r) => t + r.catches, 0),
    stumpings: rows.reduce((t, r) => t + r.stumpings, 0),
    runOuts: rows.reduce((t, r) => t + r.runOuts, 0),
  };
}

/** One-line summary of a player's match, e.g. "34* (28) · 2/18 (4) · 1 ct". */
export function matchLine(r: StatRow) {
  const parts: string[] = [];
  if (r.batted) parts.push(`${r.runs}${r.notOut ? '*' : ''} (${r.balls})`);
  if (r.ballsBowled > 0) parts.push(`${r.wickets}/${r.runsConceded} (${oversText(r.ballsBowled)})`);
  const field = [r.catches && `${r.catches} ct`, r.stumpings && `${r.stumpings} st`, r.runOuts && `${r.runOuts} ro`].filter(Boolean);
  if (field.length) parts.push(field.join(', '));
  return parts.join(' · ') || 'Did not bat or bowl';
}
