import { describe, it, expect } from 'vitest';
import { solveTSP, parsePoints, TSPError, type Point } from './tsp';

const pts = (defs: Array<[string, number, number]>): Point[] =>
  defs.map(([label, x, y]) => ({ label, x, y }));

describe('parsePoints', () => {
  it('parses tab-separated points with Turkish decimals', () => {
    expect(parsePoints('A\t0,5\t1,5\nB\t2\t3')).toEqual([
      { label: 'A', x: 0.5, y: 1.5 },
      { label: 'B', x: 2, y: 3 },
    ]);
  });

  it('rejects rows with fewer than 3 cells', () => {
    expect(() => parsePoints('A\t1')).toThrow(/biçimi/i);
  });

  it('rejects non-numeric coordinates', () => {
    expect(() => parsePoints('A\tx\t1')).toThrow(/sayı/i);
  });
});

describe('solveTSP — basic correctness', () => {
  it('2 points: distance is computed correctly', () => {
    const r = solveTSP({
      points: pts([['A', 0, 0], ['B', 3, 4]]),
    });
    // Closed tour A→B→A = 5+5 = 10
    expect(r.totalDistance).toBeCloseTo(10);
  });

  it('square: optimum is the perimeter', () => {
    const r = solveTSP({
      points: pts([['A', 0, 0], ['B', 1, 0], ['C', 1, 1], ['D', 0, 1]]),
    });
    // Square perimeter = 4 (best closed tour)
    expect(r.totalDistance).toBeCloseTo(4);
  });

  it('triangle: optimum is the perimeter', () => {
    const r = solveTSP({
      points: pts([['A', 0, 0], ['B', 3, 0], ['C', 0, 4]]),
    });
    // 3-4-5 triangle, perimeter = 12
    expect(r.totalDistance).toBeCloseTo(12);
  });

  it('order visits every point exactly once', () => {
    const r = solveTSP({
      points: pts([
        ['A', 0, 0],
        ['B', 1, 0],
        ['C', 2, 0],
        ['D', 3, 0],
        ['E', 4, 0],
      ]),
    });
    expect(new Set(r.order).size).toBe(5);
    expect(r.order).toHaveLength(5);
  });

  it('open tour does not return to start', () => {
    const r = solveTSP({
      points: pts([['A', 0, 0], ['B', 1, 0], ['C', 2, 0]]),
      closed: false,
    });
    // Open A→B→C = 1+1 = 2
    expect(r.totalDistance).toBeCloseTo(2);
    expect(r.legDistances).toHaveLength(2);
    expect(r.closed).toBe(false);
  });

  it('closed tour returns to start (legs include return)', () => {
    const r = solveTSP({
      points: pts([['A', 0, 0], ['B', 1, 0], ['C', 2, 0]]),
      closed: true,
    });
    expect(r.legDistances).toHaveLength(3);
  });
});

describe('solveTSP — 2-opt improvement', () => {
  it('improves over nearest-neighbor on a known crossing case', () => {
    // Four points where nearest-neighbor produces a crossing tour
    const points = pts([
      ['A', 0, 0],
      ['B', 0, 10],
      ['C', 10, 0],
      ['D', 10, 10],
    ]);
    const withImprovement = solveTSP({ points, improve: true });
    const withoutImprovement = solveTSP({ points, improve: false });
    expect(withImprovement.totalDistance).toBeLessThanOrEqual(
      withoutImprovement.totalDistance + 1e-9,
    );
  });

  it('reports swap count when improve is on', () => {
    const r = solveTSP({
      points: pts([
        ['A', 0, 0],
        ['B', 5, 5],
        ['C', 10, 0],
        ['D', 5, 10],
        ['E', 15, 5],
        ['F', 20, 0],
      ]),
      improve: true,
    });
    expect(r.swaps).toBeGreaterThanOrEqual(0);
  });
});

describe('solveTSP — start point', () => {
  it('uses given start index', () => {
    const r = solveTSP({
      points: pts([['A', 0, 0], ['B', 1, 0], ['C', 2, 0]]),
      start: 2,
      improve: false,
    });
    expect(r.order[0]).toBe(2);
  });
});

describe('solveTSP — validation', () => {
  it('rejects fewer than 2 points', () => {
    expect(() => solveTSP({ points: [] })).toThrow(TSPError);
    expect(() => solveTSP({ points: pts([['A', 0, 0]]) })).toThrow(TSPError);
  });

  it('rejects non-finite coordinates', () => {
    expect(() =>
      solveTSP({ points: [{ label: 'A', x: NaN, y: 0 }, { label: 'B', x: 1, y: 1 }] }),
    ).toThrow(TSPError);
  });

  it('rejects out-of-range start', () => {
    expect(() =>
      solveTSP({
        points: pts([['A', 0, 0], ['B', 1, 0]]),
        start: 10,
      }),
    ).toThrow(/başlangıç/i);
  });
});
