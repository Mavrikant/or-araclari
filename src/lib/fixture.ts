/**
 * Round-robin tournament scheduling.
 *
 * Uses the classic "circle method" with one team fixed and the rest rotating.
 * Handles odd team counts via a phantom BYE participant. Optional double
 * round-robin appends a mirrored second half with home/away swapped.
 *
 * The algorithm is pure: same input → same output, no DOM, no I/O.
 */

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 32;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RoundEntry =
  | { kind: 'match'; home: string; away: string }
  | { kind: 'bye'; team: string };

export interface FixtureRound {
  /** 1-indexed week number (Hafta 1, Hafta 2, ...). */
  weekNumber: number;
  /** ISO date string (YYYY-MM-DD), present only if startDate was provided. */
  date?: string;
  entries: ReadonlyArray<RoundEntry>;
}

export interface FixtureOptions {
  teams: ReadonlyArray<string>;
  /** Each pair plays twice (home + away). Defaults to false. */
  doubleRound?: boolean;
  /** ISO date string for the first round (YYYY-MM-DD). */
  startDate?: string | null;
  /**
   * If set together with startDate, the first round is shifted forward to
   * the next occurrence of this weekday (0=Sunday, 1=Monday, ..., 6=Saturday).
   */
  weeklyOn?: Weekday | null;
}

export interface Fixture {
  rounds: ReadonlyArray<FixtureRound>;
  teamCount: number;
  hasBye: boolean;
  doubleRound: boolean;
  totalMatches: number;
}

const BYE_INDEX = -1;

export class FixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureError';
  }
}

export function normalizeTeamList(input: string): string[] {
  return input
    .split(/\r?\n|;|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function validateTeams(teams: ReadonlyArray<string>): void {
  if (teams.length < MIN_TEAMS) {
    throw new FixtureError(`En az ${MIN_TEAMS} takım gereklidir.`);
  }
  if (teams.length > MAX_TEAMS) {
    throw new FixtureError(
      `Bu sürümde en fazla ${MAX_TEAMS} takım desteklenir (girilen: ${teams.length}).`,
    );
  }
  const seen = new Set<string>();
  for (const t of teams) {
    if (t.length === 0) {
      throw new FixtureError('Boş takım adı kabul edilmiyor.');
    }
    const key = t.toLocaleLowerCase('tr');
    if (seen.has(key)) {
      throw new FixtureError(`Tekrar eden takım adı: "${t}".`);
    }
    seen.add(key);
  }
}

function rotateInPlace(positions: number[]): void {
  const n = positions.length;
  const last = positions[n - 1];
  for (let i = n - 1; i > 1; i--) {
    positions[i] = positions[i - 1];
  }
  positions[1] = last;
}

function generateSingleRoundRobin(teams: ReadonlyArray<string>): RoundEntry[][] {
  const isOdd = teams.length % 2 === 1;
  const indices = teams.map((_, i) => i);
  if (isOdd) indices.push(BYE_INDEX);

  const n = indices.length;
  const roundsCount = n - 1;
  const matchesPerRound = n / 2;
  const positions = [...indices];
  const rounds: RoundEntry[][] = [];

  for (let r = 0; r < roundsCount; r++) {
    const entries: RoundEntry[] = [];
    for (let i = 0; i < matchesPerRound; i++) {
      const idxA = positions[i];
      const idxB = positions[n - 1 - i];

      // Alternate home/away orientation so the fixed team (index 0) doesn't
      // always play home — improves perceived fairness in the simple form.
      const swap = r % 2 === 1 && i === 0;

      if (idxA === BYE_INDEX) {
        entries.push({ kind: 'bye', team: teams[idxB] });
      } else if (idxB === BYE_INDEX) {
        entries.push({ kind: 'bye', team: teams[idxA] });
      } else {
        entries.push(
          swap
            ? { kind: 'match', home: teams[idxB], away: teams[idxA] }
            : { kind: 'match', home: teams[idxA], away: teams[idxB] },
        );
      }
    }
    rounds.push(entries);
    rotateInPlace(positions);
  }

  return rounds;
}

function mirrorRound(round: ReadonlyArray<RoundEntry>): RoundEntry[] {
  return round.map((entry) =>
    entry.kind === 'match'
      ? { kind: 'match', home: entry.away, away: entry.home }
      : entry,
  );
}

function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    throw new FixtureError(`Geçersiz tarih biçimi (YYYY-MM-DD bekleniyor): ${iso}`);
  }
  // Construct in local time to avoid timezone surprises in date display.
  return new Date(y, m - 1, d);
}

function computeRoundDate(
  start: Date,
  roundIndex: number,
  weeklyOn: Weekday | null,
): string {
  const d = new Date(start.getTime());
  if (weeklyOn !== null && weeklyOn !== undefined) {
    const delta = (weeklyOn - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + delta);
  }
  d.setDate(d.getDate() + roundIndex * 7);
  return isoDate(d);
}

export function generateFixture(options: FixtureOptions): Fixture {
  const teams = options.teams.map((t) => t.trim()).filter((t) => t.length > 0);
  validateTeams(teams);

  const doubleRound = options.doubleRound ?? false;

  const single = generateSingleRoundRobin(teams);
  const all: RoundEntry[][] = doubleRound
    ? [...single, ...single.map(mirrorRound)]
    : single;

  const start =
    options.startDate != null ? parseIsoDate(options.startDate) : null;
  const weeklyOn = options.weeklyOn ?? null;

  const rounds: FixtureRound[] = all.map((entries, i) => ({
    weekNumber: i + 1,
    entries,
    ...(start
      ? { date: computeRoundDate(start, i, weeklyOn) }
      : {}),
  }));

  const totalMatches = rounds.reduce(
    (sum, r) => sum + r.entries.filter((e) => e.kind === 'match').length,
    0,
  );

  return {
    rounds,
    teamCount: teams.length,
    hasBye: teams.length % 2 === 1,
    doubleRound,
    totalMatches,
  };
}

/**
 * Group a fixture by team — returns each team's complete schedule for
 * "takım bazlı görünüm".
 */
export interface TeamSchedule {
  team: string;
  matches: Array<{
    weekNumber: number;
    date?: string;
    opponent: string;
    venue: 'home' | 'away' | 'bye';
  }>;
}

export function groupByTeam(fixture: Fixture): TeamSchedule[] {
  const map = new Map<string, TeamSchedule>();

  const ensure = (team: string): TeamSchedule => {
    let s = map.get(team);
    if (!s) {
      s = { team, matches: [] };
      map.set(team, s);
    }
    return s;
  };

  for (const round of fixture.rounds) {
    for (const entry of round.entries) {
      if (entry.kind === 'bye') {
        ensure(entry.team).matches.push({
          weekNumber: round.weekNumber,
          date: round.date,
          opponent: '—',
          venue: 'bye',
        });
      } else {
        ensure(entry.home).matches.push({
          weekNumber: round.weekNumber,
          date: round.date,
          opponent: entry.away,
          venue: 'home',
        });
        ensure(entry.away).matches.push({
          weekNumber: round.weekNumber,
          date: round.date,
          opponent: entry.home,
          venue: 'away',
        });
      }
    }
  }

  return [...map.values()].sort((a, b) =>
    a.team.localeCompare(b.team, 'tr'),
  );
}

export function fixtureToCsv(fixture: Fixture): string {
  const header = ['Hafta', 'Tarih', 'Ev Sahibi', 'Deplasman', 'Bay'];
  const lines = [header.join(',')];

  const escape = (v: string): string => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  for (const round of fixture.rounds) {
    for (const entry of round.entries) {
      const date = round.date ?? '';
      const row =
        entry.kind === 'match'
          ? [String(round.weekNumber), date, entry.home, entry.away, '']
          : [String(round.weekNumber), date, '', '', entry.team];
      lines.push(row.map(escape).join(','));
    }
  }

  return lines.join('\n') + '\n';
}
