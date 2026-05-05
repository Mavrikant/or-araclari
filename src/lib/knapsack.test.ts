import { describe, it, expect } from 'vitest';
import {
  solveKnapsack,
  parseItems,
  KnapsackError,
  type KnapsackItem,
} from './knapsack';

const items = (defs: Array<[string, number, number]>): KnapsackItem[] =>
  defs.map(([name, value, weight], i) => ({
    id: String(i),
    name,
    value,
    weight,
  }));

describe('parseItems', () => {
  it('parses tab-separated items with Turkish decimals', () => {
    const result = parseItems('Altın\t100\t2,5\nGümüş\t60\t1,5');
    expect(result).toEqual([
      { id: '0', name: 'Altın', value: 100, weight: 2.5 },
      { id: '1', name: 'Gümüş', value: 60, weight: 1.5 },
    ]);
  });

  it('rejects rows with fewer than 3 cells', () => {
    expect(() => parseItems('Altın\t100')).toThrow(/biçimi/i);
  });

  it('rejects non-numeric values', () => {
    expect(() => parseItems('Altın\tabc\t2')).toThrow(/değer/i);
  });
});

describe('solveKnapsack — fractional', () => {
  it('classic example: high-ratio items first', () => {
    const r = solveKnapsack({
      items: items([
        ['A', 60, 10],
        ['B', 100, 20],
        ['C', 120, 30],
      ]),
      capacity: 50,
      variant: 'fractional',
    });
    // Optimal fractional: take A (60/10 ratio = 6), B (100/20 = 5),
    // 2/3 of C → 60 + 100 + 80 = 240
    expect(r.totalValue).toBeCloseTo(240, 5);
    expect(r.totalWeight).toBeCloseTo(50, 5);
  });

  it('takes whole high-ratio items before fractional ones', () => {
    const r = solveKnapsack({
      items: items([
        ['expensive small', 100, 1],
        ['cheap big', 10, 100],
      ]),
      capacity: 50,
      variant: 'fractional',
    });
    expect(r.selected[0].item.name).toBe('expensive small');
    expect(r.selected[0].fraction).toBe(1);
  });

  it('fits within capacity exactly when sum equals it', () => {
    const r = solveKnapsack({
      items: items([
        ['A', 10, 5],
        ['B', 10, 5],
      ]),
      capacity: 10,
      variant: 'fractional',
    });
    expect(r.totalWeight).toBeCloseTo(10);
  });
});

describe('solveKnapsack — binary (0/1)', () => {
  it('classic textbook example', () => {
    const r = solveKnapsack({
      items: items([
        ['A', 60, 10],
        ['B', 100, 20],
        ['C', 120, 30],
      ]),
      capacity: 50,
      variant: 'binary',
    });
    // Optimal 0/1: B + C = 100 + 120 = 220 (weight 50)
    expect(r.totalValue).toBe(220);
    expect(r.totalWeight).toBe(50);
    expect(r.selected.map((s) => s.item.name).sort()).toEqual(['B', 'C']);
  });

  it('skips items that cannot fit individually', () => {
    const r = solveKnapsack({
      items: items([
        ['too heavy', 1000, 100],
        ['light gem', 50, 5],
      ]),
      capacity: 10,
      variant: 'binary',
    });
    expect(r.selected.length).toBe(1);
    expect(r.selected[0].item.name).toBe('light gem');
    expect(r.totalValue).toBe(50);
  });

  it('takes nothing if capacity is too small for every item', () => {
    const r = solveKnapsack({
      items: items([
        ['A', 100, 50],
        ['B', 200, 100],
      ]),
      capacity: 10,
      variant: 'binary',
    });
    expect(r.selected.length).toBe(0);
    expect(r.totalValue).toBe(0);
  });

  it('handles fractional weights via internal scaling', () => {
    const r = solveKnapsack({
      items: items([
        ['A', 10, 1.5],
        ['B', 15, 2.5],
        ['C', 8, 1.0],
      ]),
      capacity: 4,
      variant: 'binary',
    });
    // Best: A (1.5) + B (2.5) = 4, value 25
    expect(r.totalValue).toBe(25);
    expect(r.scaled).toBe(true);
  });

  it('binary value is at most fractional value for same input', () => {
    const def = items([
      ['A', 60, 10],
      ['B', 100, 20],
      ['C', 120, 30],
    ]);
    const f = solveKnapsack({ items: def, capacity: 50, variant: 'fractional' });
    const b = solveKnapsack({ items: def, capacity: 50, variant: 'binary' });
    expect(b.totalValue).toBeLessThanOrEqual(f.totalValue);
  });
});

describe('solveKnapsack — validation', () => {
  it('rejects empty item list', () => {
    expect(() =>
      solveKnapsack({ items: [], capacity: 10, variant: 'binary' }),
    ).toThrow(KnapsackError);
  });

  it('rejects non-positive capacity', () => {
    expect(() =>
      solveKnapsack({
        items: items([['A', 1, 1]]),
        capacity: 0,
        variant: 'binary',
      }),
    ).toThrow(/kapasite/i);
  });

  it('rejects items with negative value', () => {
    expect(() =>
      solveKnapsack({
        items: items([['A', -5, 1]]),
        capacity: 10,
        variant: 'binary',
      }),
    ).toThrow(/değeri/i);
  });

  it('rejects items with zero or negative weight', () => {
    expect(() =>
      solveKnapsack({
        items: items([['A', 5, 0]]),
        capacity: 10,
        variant: 'binary',
      }),
    ).toThrow(/ağırlığı/i);
  });

  it('rejects too-large capacity for binary DP', () => {
    expect(() =>
      solveKnapsack({
        items: items([['A', 1, 1]]),
        capacity: 1_000_000,
        variant: 'binary',
      }),
    ).toThrow(/DP/i);
  });
});
