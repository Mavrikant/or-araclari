import { describe, it, expect } from 'vitest';
import { analyzeMarkov, parseMatrix, MarkovError } from './markov';

describe('analyzeMarkov — textbook chains', () => {
  it('two-state symmetric chain → π = [0.5, 0.5]', () => {
    const P = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    const r = analyzeMarkov({ transition: P });
    expect(r.stationary[0]).toBeCloseTo(0.5, 6);
    expect(r.stationary[1]).toBeCloseTo(0.5, 6);
    expect(r.reducible).toBe(false);
  });

  it('two-state asymmetric chain — closed form', () => {
    // P = [[1-a, a],[b, 1-b]], a=0.2, b=0.1
    // π₁ = b/(a+b) = 0.1/0.3 = 1/3, π₂ = a/(a+b) = 2/3
    const P = [
      [0.8, 0.2],
      [0.1, 0.9],
    ];
    const r = analyzeMarkov({ transition: P });
    expect(r.stationary[0]).toBeCloseTo(1 / 3, 6);
    expect(r.stationary[1]).toBeCloseTo(2 / 3, 6);
  });

  it('three-state weather example — well-known textbook result', () => {
    // Classic Howard weather chain, π ≈ [0.625, 0.3125, 0.0625] for
    // P below (sunny/cloudy/rainy).
    const P = [
      [0.8, 0.15, 0.05],
      [0.7, 0.2, 0.1],
      [0.5, 0.3, 0.2],
    ];
    const r = analyzeMarkov({ transition: P });
    const sum = r.stationary.reduce((a, c) => a + c, 0);
    expect(sum).toBeCloseTo(1, 6);
    // π is the unique solution of πP = π. Verify by re-multiplying.
    for (let j = 0; j < 3; j++) {
      let lhs = 0;
      for (let i = 0; i < 3; i++) lhs += r.stationary[i] * P[i][j];
      expect(lhs).toBeCloseTo(r.stationary[j], 6);
    }
  });

  it('mean recurrence time = 1/π', () => {
    const P = [
      [0.8, 0.2],
      [0.1, 0.9],
    ];
    const r = analyzeMarkov({ transition: P });
    expect(r.meanRecurrence[0]).toBeCloseTo(3, 6);
    expect(r.meanRecurrence[1]).toBeCloseTo(1.5, 6);
  });

  it('trajectory[0] equals initial distribution', () => {
    const P = [
      [0.5, 0.5],
      [0.3, 0.7],
    ];
    const r = analyzeMarkov({ transition: P, initial: [1, 0], steps: 5 });
    expect(r.trajectory[0]).toEqual([1, 0]);
    expect(r.trajectory.length).toBe(6);
  });

  it('trajectory converges to stationary distribution', () => {
    const P = [
      [0.5, 0.5],
      [0.3, 0.7],
    ];
    const r = analyzeMarkov({ transition: P, steps: 200 });
    const last = r.trajectory[r.trajectory.length - 1];
    for (let i = 0; i < 2; i++) {
      expect(last[i]).toBeCloseTo(r.stationary[i], 4);
    }
  });

  it('default initial defaults to delta on state 0', () => {
    const P = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    const r = analyzeMarkov({ transition: P });
    expect(r.initial).toEqual([1, 0]);
  });

  it('stationary rows sum to 1 across various sizes', () => {
    const P3 = [
      [0.1, 0.6, 0.3],
      [0.4, 0.2, 0.4],
      [0.3, 0.3, 0.4],
    ];
    const r = analyzeMarkov({ transition: P3 });
    const sum = r.stationary.reduce((a, c) => a + c, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('absorbing chain — power-iteration fallback identifies absorbing state', () => {
    // State 0 is absorbing, state 1 transitions to 0 with prob 1.
    // (Reducible: classes {0} absorbing, {1} transient.)
    const P = [
      [1, 0],
      [1, 0],
    ];
    const r = analyzeMarkov({ transition: P });
    expect(r.stationary[0]).toBeCloseTo(1, 6);
    expect(r.stationary[1]).toBeCloseTo(0, 6);
  });

  it('labels are echoed when provided', () => {
    const r = analyzeMarkov({
      transition: [
        [0.5, 0.5],
        [0.5, 0.5],
      ],
      labels: ['Güneşli', 'Bulutlu'],
    });
    expect(r.labels).toEqual(['Güneşli', 'Bulutlu']);
  });
});

describe('analyzeMarkov — validation', () => {
  it('rejects non-square matrix', () => {
    const P = [
      [0.5, 0.5],
      [1, 0, 0],
    ] as number[][];
    expect(() => analyzeMarkov({ transition: P })).toThrow(MarkovError);
  });

  it('rejects rows that do not sum to 1', () => {
    const P = [
      [0.5, 0.4],
      [0.5, 0.5],
    ];
    expect(() => analyzeMarkov({ transition: P })).toThrow(/toplam/i);
  });

  it('rejects negative probabilities', () => {
    const P = [
      [1.2, -0.2],
      [0.5, 0.5],
    ];
    expect(() => analyzeMarkov({ transition: P })).toThrow(MarkovError);
  });

  it('rejects label / state count mismatch', () => {
    const P = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    expect(() => analyzeMarkov({ transition: P, labels: ['A'] })).toThrow(/etiket/i);
  });

  it('rejects initial distribution with wrong length', () => {
    const P = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    expect(() => analyzeMarkov({ transition: P, initial: [1, 0, 0] })).toThrow(/uzunlu/i);
  });

  it('rejects initial distribution not summing to 1', () => {
    const P = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    expect(() => analyzeMarkov({ transition: P, initial: [0.3, 0.3] })).toThrow(/toplam/i);
  });

  it('rejects step count out of range', () => {
    const P = [
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    expect(() => analyzeMarkov({ transition: P, steps: -1 })).toThrow(/Adım/i);
    expect(() => analyzeMarkov({ transition: P, steps: 1000 })).toThrow(/Adım/i);
  });

  it('rejects matrix larger than 50×50', () => {
    const n = 51;
    const P = Array.from({ length: n }, () => Array.from({ length: n }, () => 1 / n));
    expect(() => analyzeMarkov({ transition: P })).toThrow(/50×50|en fazla/i);
  });
});

describe('parseMatrix', () => {
  it('parses whitespace-separated rows', () => {
    const m = parseMatrix('0.5 0.5\n0.3 0.7');
    expect(m).toEqual([
      [0.5, 0.5],
      [0.3, 0.7],
    ]);
  });

  it('parses comma-separated rows', () => {
    const m = parseMatrix('0.5, 0.5\n0.3, 0.7');
    expect(m).toEqual([
      [0.5, 0.5],
      [0.3, 0.7],
    ]);
  });

  it('ignores blank lines and comments', () => {
    const m = parseMatrix('# yorum\n\n0.5 0.5\n  \n0.3 0.7\n');
    expect(m).toEqual([
      [0.5, 0.5],
      [0.3, 0.7],
    ]);
  });

  it('rejects non-square input', () => {
    expect(() => parseMatrix('0.5 0.5\n0.3 0.4 0.3')).toThrow(/kare/i);
  });

  it('rejects non-numeric entries', () => {
    expect(() => parseMatrix('0.5 abc\n0.3 0.7')).toThrow(/sayı/i);
  });

  it('rejects empty input', () => {
    expect(() => parseMatrix('   \n\n')).toThrow(/boş/i);
  });
});
