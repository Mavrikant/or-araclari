import { describe, it, expect } from 'vitest';
import {
  generateFixture,
  groupByTeam,
  fixtureToCsv,
  normalizeTeamList,
  FixtureError,
  MAX_TEAMS,
} from './fixture';

const teamsOf = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

const matchKey = (home: string, away: string): string =>
  [home, away].sort().join('-vs-');

function collectAllMatches(
  fixture: ReturnType<typeof generateFixture>,
): Array<{ home: string; away: string; week: number }> {
  const out: Array<{ home: string; away: string; week: number }> = [];
  for (const round of fixture.rounds) {
    for (const entry of round.entries) {
      if (entry.kind === 'match') {
        out.push({ home: entry.home, away: entry.away, week: round.weekNumber });
      }
    }
  }
  return out;
}

describe('normalizeTeamList', () => {
  it('splits on newlines, commas, and semicolons', () => {
    expect(normalizeTeamList('A\nB\nC')).toEqual(['A', 'B', 'C']);
    expect(normalizeTeamList('A,B,C')).toEqual(['A', 'B', 'C']);
    expect(normalizeTeamList('A;B;C')).toEqual(['A', 'B', 'C']);
    expect(normalizeTeamList('A\nB,C;D')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(normalizeTeamList('  Galatasaray  \n\nFenerbahçe \n')).toEqual([
      'Galatasaray',
      'Fenerbahçe',
    ]);
  });

  it('preserves Turkish characters', () => {
    expect(normalizeTeamList('Beşiktaş\nGöztepe\nİstanbulspor')).toEqual([
      'Beşiktaş',
      'Göztepe',
      'İstanbulspor',
    ]);
  });
});

describe('generateFixture — validation', () => {
  it('rejects fewer than 2 teams', () => {
    expect(() => generateFixture({ teams: [] })).toThrow(FixtureError);
    expect(() => generateFixture({ teams: ['A'] })).toThrow(FixtureError);
  });

  it('rejects more than the configured max', () => {
    expect(() => generateFixture({ teams: teamsOf(MAX_TEAMS + 1) })).toThrow(
      /en fazla/i,
    );
  });

  it('accepts exactly the configured max', () => {
    expect(() => generateFixture({ teams: teamsOf(MAX_TEAMS) })).not.toThrow();
  });

  it('rejects duplicate team names (case-insensitive)', () => {
    expect(() =>
      generateFixture({ teams: ['Galatasaray', 'GALATASARAY'] }),
    ).toThrow(/tekrar/i);
    expect(() => generateFixture({ teams: ['Beşiktaş', 'beşiktaş'] })).toThrow(
      /tekrar/i,
    );
  });

  it('silently drops whitespace-only entries from the input', () => {
    // Friendly behavior: pasted lists often have trailing/intermediate
    // blank lines that the user did not intend as teams.
    const f = generateFixture({ teams: ['A', '   ', 'B', '\t', 'C'] });
    expect(f.teamCount).toBe(3);
  });
});

describe('generateFixture — single round-robin (even teams)', () => {
  it('N=2: one round, one match', () => {
    const f = generateFixture({ teams: ['A', 'B'] });
    expect(f.rounds.length).toBe(1);
    expect(f.totalMatches).toBe(1);
    expect(f.hasBye).toBe(false);
    expect(f.rounds[0].entries[0]).toMatchObject({ kind: 'match' });
  });

  it('N=4: 3 rounds × 2 matches each, every pair plays exactly once', () => {
    const f = generateFixture({ teams: teamsOf(4) });
    expect(f.rounds.length).toBe(3);
    expect(f.totalMatches).toBe(6); // C(4,2)
    f.rounds.forEach((r) => expect(r.entries.length).toBe(2));

    const pairs = new Set(
      collectAllMatches(f).map((m) => matchKey(m.home, m.away)),
    );
    expect(pairs.size).toBe(6);
  });

  it('N=8: 7 rounds × 4 matches each, 28 unique pairs', () => {
    const f = generateFixture({ teams: teamsOf(8) });
    expect(f.rounds.length).toBe(7);
    expect(f.totalMatches).toBe(28);
    f.rounds.forEach((r) => expect(r.entries.length).toBe(4));

    const pairs = new Set(
      collectAllMatches(f).map((m) => matchKey(m.home, m.away)),
    );
    expect(pairs.size).toBe(28);
  });

  it('a team never plays itself', () => {
    const f = generateFixture({ teams: teamsOf(8) });
    for (const m of collectAllMatches(f)) {
      expect(m.home).not.toBe(m.away);
    }
  });

  it('a team appears at most once per round', () => {
    const f = generateFixture({ teams: teamsOf(10) });
    for (const round of f.rounds) {
      const seen = new Set<string>();
      for (const entry of round.entries) {
        if (entry.kind === 'match') {
          expect(seen.has(entry.home)).toBe(false);
          expect(seen.has(entry.away)).toBe(false);
          seen.add(entry.home);
          seen.add(entry.away);
        } else {
          expect(seen.has(entry.team)).toBe(false);
          seen.add(entry.team);
        }
      }
    }
  });
});

describe('generateFixture — odd teams (BYE)', () => {
  it('N=3: 3 rounds with one BYE entry per round', () => {
    const f = generateFixture({ teams: ['A', 'B', 'C'] });
    expect(f.hasBye).toBe(true);
    expect(f.rounds.length).toBe(3);
    expect(f.totalMatches).toBe(3); // C(3,2)
    f.rounds.forEach((r) => {
      const byes = r.entries.filter((e) => e.kind === 'bye');
      expect(byes.length).toBe(1);
    });

    // Each team should be the BYE exactly once across the 3 rounds
    const byeTeams = f.rounds
      .flatMap((r) => r.entries)
      .filter((e) => e.kind === 'bye')
      .map((e) => (e as { team: string }).team);
    expect(new Set(byeTeams).size).toBe(3);
  });

  it('N=5: 5 rounds, every team has exactly one BYE and 4 opponents', () => {
    const f = generateFixture({ teams: teamsOf(5) });
    expect(f.rounds.length).toBe(5);
    expect(f.totalMatches).toBe(10); // C(5,2)

    const byTeam = groupByTeam(f);
    for (const t of byTeam) {
      const byes = t.matches.filter((m) => m.venue === 'bye');
      expect(byes.length).toBe(1);
      const games = t.matches.filter((m) => m.venue !== 'bye');
      expect(games.length).toBe(4);
      expect(new Set(games.map((g) => g.opponent)).size).toBe(4);
    }
  });
});

describe('generateFixture — double round-robin', () => {
  it('N=4 double: 6 rounds, every pair plays twice with home/away swapped', () => {
    const f = generateFixture({ teams: teamsOf(4), doubleRound: true });
    expect(f.rounds.length).toBe(6);
    expect(f.totalMatches).toBe(12); // C(4,2) * 2
    expect(f.doubleRound).toBe(true);

    // Group matches by unordered pair, expect each appears twice
    const counts = new Map<string, Array<{ home: string; away: string }>>();
    for (const m of collectAllMatches(f)) {
      const k = matchKey(m.home, m.away);
      const arr = counts.get(k) ?? [];
      arr.push({ home: m.home, away: m.away });
      counts.set(k, arr);
    }

    for (const [, instances] of counts) {
      expect(instances.length).toBe(2);
      // Home/away must be swapped between the two
      expect(instances[0].home).not.toBe(instances[1].home);
      expect(instances[0].away).not.toBe(instances[1].away);
    }
  });

  it('N=5 double: 10 rounds, each team has exactly 2 BYEs', () => {
    const f = generateFixture({ teams: teamsOf(5), doubleRound: true });
    expect(f.rounds.length).toBe(10);
    const byTeam = groupByTeam(f);
    for (const t of byTeam) {
      expect(t.matches.filter((m) => m.venue === 'bye').length).toBe(2);
    }
  });
});

describe('generateFixture — dates', () => {
  it('without startDate, no rounds carry a date', () => {
    const f = generateFixture({ teams: teamsOf(4) });
    f.rounds.forEach((r) => expect(r.date).toBeUndefined());
  });

  it('with startDate but no weeklyOn, weeks advance by 7 days', () => {
    const f = generateFixture({
      teams: teamsOf(4),
      startDate: '2026-08-15',
    });
    expect(f.rounds[0].date).toBe('2026-08-15');
    expect(f.rounds[1].date).toBe('2026-08-22');
    expect(f.rounds[2].date).toBe('2026-08-29');
  });

  it('with weeklyOn=Saturday, advances startDate to the next Saturday', () => {
    // 2026-08-12 is a Wednesday. Next Saturday is 2026-08-15.
    const f = generateFixture({
      teams: teamsOf(4),
      startDate: '2026-08-12',
      weeklyOn: 6,
    });
    expect(f.rounds[0].date).toBe('2026-08-15');
    expect(f.rounds[1].date).toBe('2026-08-22');
  });

  it('throws on malformed startDate', () => {
    expect(() =>
      generateFixture({ teams: teamsOf(4), startDate: 'not-a-date' }),
    ).toThrow(FixtureError);
  });
});

describe('groupByTeam', () => {
  it('lists every team exactly once, sorted by Turkish locale', () => {
    const f = generateFixture({
      teams: ['Çankaya', 'Antalya', 'İzmir', 'Şanlıurfa'],
    });
    const grouped = groupByTeam(f);
    expect(grouped.map((g) => g.team)).toEqual([
      'Antalya',
      'Çankaya',
      'İzmir',
      'Şanlıurfa',
    ]);
  });

  it('each team plays N-1 opponents in single round-robin', () => {
    const N = 6;
    const f = generateFixture({ teams: teamsOf(N) });
    for (const t of groupByTeam(f)) {
      expect(t.matches.length).toBe(N - 1);
      expect(new Set(t.matches.map((m) => m.opponent)).size).toBe(N - 1);
    }
  });
});

describe('fixtureToCsv', () => {
  it('emits a header row and one row per match/bye', () => {
    const f = generateFixture({ teams: ['A', 'B', 'C'] });
    const csv = fixtureToCsv(f);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Hafta,Tarih,Ev Sahibi,Deplasman,Bay');
    // 3 rounds × (1 match + 1 bye) = 6 rows + header
    expect(lines.length).toBe(7);
  });

  it('escapes commas and quotes in team names', () => {
    const f = generateFixture({ teams: ['A, Inc.', 'B "X" Ltd', 'C'] });
    const csv = fixtureToCsv(f);
    expect(csv).toContain('"A, Inc."');
    expect(csv).toContain('"B ""X"" Ltd"');
  });
});
