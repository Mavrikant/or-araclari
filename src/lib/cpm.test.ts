import { describe, it, expect } from 'vitest';
import { solveCpm, CpmError } from './cpm';

describe('solveCpm — single activity', () => {
  it('one activity has slack 0 and is critical', () => {
    const r = solveCpm([{ id: 'A', duration: 5, predecessors: [] }]);
    expect(r.projectDuration).toBe(5);
    expect(r.activities[0].critical).toBe(true);
    expect(r.criticalPath).toEqual(['A']);
  });
});

describe('solveCpm — sequential chain', () => {
  it('A→B→C sums durations', () => {
    const r = solveCpm([
      { id: 'A', duration: 3, predecessors: [] },
      { id: 'B', duration: 4, predecessors: ['A'] },
      { id: 'C', duration: 2, predecessors: ['B'] },
    ]);
    expect(r.projectDuration).toBe(9);
    expect(r.criticalPath).toEqual(['A', 'B', 'C']);
    for (const a of r.activities) {
      expect(a.slack).toBe(0);
      expect(a.critical).toBe(true);
    }
  });
});

describe('solveCpm — parallel branches', () => {
  it('classic textbook: two parallel paths, longer one is critical', () => {
    /*  A → B → D
     *  A → C → D
     *  B = 4, C = 2 → critical path A-B-D
     */
    const r = solveCpm([
      { id: 'A', duration: 1, predecessors: [] },
      { id: 'B', duration: 4, predecessors: ['A'] },
      { id: 'C', duration: 2, predecessors: ['A'] },
      { id: 'D', duration: 3, predecessors: ['B', 'C'] },
    ]);
    expect(r.projectDuration).toBe(8); // 1+4+3
    expect(r.criticalPath).toEqual(['A', 'B', 'D']);

    const c = r.activities.find((a) => a.id === 'C')!;
    expect(c.slack).toBe(2); // free time on the shorter branch
    expect(c.critical).toBe(false);
  });

  it('correctly handles three parallel branches with different lengths', () => {
    const r = solveCpm([
      { id: 'Start', duration: 0, predecessors: [] },
      { id: 'X', duration: 5, predecessors: ['Start'] },
      { id: 'Y', duration: 7, predecessors: ['Start'] },
      { id: 'Z', duration: 3, predecessors: ['Start'] },
      { id: 'End', duration: 0, predecessors: ['X', 'Y', 'Z'] },
    ]);
    expect(r.projectDuration).toBe(7);
    expect(r.criticalPath).toContain('Y');
    const x = r.activities.find((a) => a.id === 'X')!;
    expect(x.slack).toBe(2);
  });
});

describe('solveCpm — slack semantics', () => {
  it('LS - ES equals slack equals LF - EF', () => {
    const r = solveCpm([
      { id: 'A', duration: 2, predecessors: [] },
      { id: 'B', duration: 3, predecessors: ['A'] },
      { id: 'C', duration: 5, predecessors: ['A'] },
      { id: 'D', duration: 1, predecessors: ['B', 'C'] },
    ]);
    for (const a of r.activities) {
      expect(a.lateStart - a.earlyStart).toBeCloseTo(a.slack);
      expect(a.lateFinish - a.earlyFinish).toBeCloseTo(a.slack);
    }
  });
});

describe('solveCpm — validation', () => {
  it('rejects empty list', () => {
    expect(() => solveCpm([])).toThrow(CpmError);
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      solveCpm([
        { id: 'A', duration: 1, predecessors: [] },
        { id: 'A', duration: 2, predecessors: [] },
      ]),
    ).toThrow(/Tekrar/);
  });

  it('rejects negative duration', () => {
    expect(() =>
      solveCpm([{ id: 'A', duration: -1, predecessors: [] }]),
    ).toThrow(CpmError);
  });

  it('accepts zero duration (milestone)', () => {
    const r = solveCpm([
      { id: 'A', duration: 0, predecessors: [] },
      { id: 'B', duration: 5, predecessors: ['A'] },
    ]);
    expect(r.projectDuration).toBe(5);
  });

  it('rejects unknown predecessor id', () => {
    expect(() =>
      solveCpm([
        { id: 'A', duration: 1, predecessors: [] },
        { id: 'B', duration: 2, predecessors: ['MISSING'] },
      ]),
    ).toThrow(/bulunamadı/);
  });

  it('rejects self-reference', () => {
    expect(() =>
      solveCpm([{ id: 'A', duration: 1, predecessors: ['A'] }]),
    ).toThrow(/kendisini/);
  });

  it('rejects cycle', () => {
    expect(() =>
      solveCpm([
        { id: 'A', duration: 1, predecessors: ['B'] },
        { id: 'B', duration: 1, predecessors: ['A'] },
      ]),
    ).toThrow(/döngü/);
  });
});
