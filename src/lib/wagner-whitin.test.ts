import { describe, it, expect } from 'vitest';
import { solveWagnerWhitin, solveSilverMeal, WagnerWhitinError, type WagnerWhitinInput } from './wagner-whitin';

describe('solveWagnerWhitin — forward DP correctness', () => {
  it('3-period textbook: d=[10,20,30], K=50, h=1 → optimum 120 with lots {1-2},{3-3}', () => {
    const r = solveWagnerWhitin({ demands: [10, 20, 30], setupCost: 50, holdingCost: 1 });
    expect(r.totalCost).toBeCloseTo(120, 9);
    expect(r.lots).toHaveLength(2);
    expect(r.lots[0]).toMatchObject({ startPeriod: 1, endPeriod: 2, quantity: 30 });
    expect(r.lots[1]).toMatchObject({ startPeriod: 3, endPeriod: 3, quantity: 30 });
    expect(r.totalSetupCost).toBeCloseTo(100);
    expect(r.totalHoldingCost).toBeCloseTo(20);
  });

  it('single-period problem: only one setup, no holding', () => {
    const r = solveWagnerWhitin({ demands: [100], setupCost: 50, holdingCost: 1 });
    expect(r.totalCost).toBeCloseTo(50);
    expect(r.lots).toEqual([
      expect.objectContaining({ startPeriod: 1, endPeriod: 1, quantity: 100 }),
    ]);
  });

  it('very high setup vs demand collapses to one big lot', () => {
    const r = solveWagnerWhitin({ demands: [10, 10, 10, 10, 10], setupCost: 10000, holdingCost: 1 });
    expect(r.lots).toHaveLength(1);
    expect(r.lots[0]).toMatchObject({ startPeriod: 1, endPeriod: 5, quantity: 50 });
    expect(r.setupCount).toBe(1);
  });

  it('h=0 makes any partition cost equal to k·K + 0; algorithm picks single lot', () => {
    const r = solveWagnerWhitin({ demands: [5, 15, 25, 35], setupCost: 100, holdingCost: 0 });
    expect(r.lots).toHaveLength(1);
    expect(r.totalCost).toBeCloseTo(100);
    expect(r.totalHoldingCost).toBe(0);
  });

  it('very high h vs setup forces lot-for-lot (one setup per non-zero-demand period)', () => {
    const r = solveWagnerWhitin({ demands: [10, 10, 10, 10], setupCost: 1, holdingCost: 1000 });
    expect(r.lots).toHaveLength(4);
    for (let t = 0; t < 4; t++) {
      expect(r.lots[t]).toMatchObject({ startPeriod: t + 1, endPeriod: t + 1, quantity: 10 });
    }
    expect(r.totalCost).toBeCloseTo(4);
  });

  it('period with zero demand extends the previous lot rather than creating a new setup', () => {
    const r = solveWagnerWhitin({ demands: [10, 0, 20], setupCost: 50, holdingCost: 1 });
    expect(r.lots).toHaveLength(1);
    expect(r.lots[0]).toMatchObject({ startPeriod: 1, endPeriod: 3, quantity: 30 });
    expect(r.totalHoldingCost).toBeCloseTo(40); // 0·10 + 1·0 + 2·20
    expect(r.totalCost).toBeCloseTo(90);
  });

  it('unit-production cost is a plan-invariant when c is constant', () => {
    const base = { demands: [10, 20, 30], setupCost: 50, holdingCost: 1 };
    const r0 = solveWagnerWhitin(base);
    const rC = solveWagnerWhitin({ ...base, unitCost: 5 });
    expect(rC.lots.map((l) => [l.startPeriod, l.endPeriod]))
      .toEqual(r0.lots.map((l) => [l.startPeriod, l.endPeriod]));
    expect(rC.totalUnitCost).toBeCloseTo(5 * 60);
    expect(rC.totalCost - r0.totalCost).toBeCloseTo(5 * 60);
  });

  it('period-varying setup / holding costs are honored', () => {
    const r = solveWagnerWhitin({
      demands: [10, 20, 30],
      setupCost: [50, 200, 50],
      holdingCost: [1, 1, 1],
    });
    // Middle-period setup is prohibitive → should avoid a setup in period 2.
    expect(r.lots.every((l) => l.startPeriod !== 2)).toBe(true);
  });
});

describe('solveWagnerWhitin — Zero Inventory Ordering (ZIO) property', () => {
  const cases: Array<{ name: string; input: WagnerWhitinInput }> = [
    { name: '3-period small', input: { demands: [10, 20, 30], setupCost: 50, holdingCost: 1 } },
    { name: 'Nahmias 10-period', input: { demands: [10, 62, 12, 130, 154, 129, 88, 52, 124, 160], setupCost: 100, holdingCost: 1 } },
    { name: 'Silver-Peterson 12-period', input: { demands: [69, 29, 36, 61, 61, 26, 34, 67, 45, 67, 79, 56], setupCost: 54, holdingCost: 0.4 } },
    { name: 'time-varying costs', input: { demands: [40, 30, 20, 10, 50, 60], setupCost: [80, 40, 120, 80, 40, 80], holdingCost: [0.5, 1, 2, 1, 0.5, 0.5] } },
  ];
  for (const c of cases) {
    it(`${c.name}: production only when I_{t-1} = 0`, () => {
      const r = solveWagnerWhitin(c.input);
      let prevEnding = 0;
      for (const p of r.periods) {
        if (p.produce > 0) {
          expect(prevEnding).toBe(0);
        }
        prevEnding = p.endingInventory;
      }
    });
  }
});

describe('solveWagnerWhitin — accounting identities', () => {
  it('lot totals sum to reported grand total', () => {
    const r = solveWagnerWhitin({ demands: [69, 29, 36, 61, 61, 26, 34, 67, 45, 67, 79, 56], setupCost: 54, holdingCost: 0.4 });
    const s = r.lots.reduce((a, l) => a + l.setupCost, 0);
    const h = r.lots.reduce((a, l) => a + l.holdingCost, 0);
    const u = r.lots.reduce((a, l) => a + l.unitCost, 0);
    expect(s).toBeCloseTo(r.totalSetupCost, 9);
    expect(h).toBeCloseTo(r.totalHoldingCost, 9);
    expect(u).toBeCloseTo(r.totalUnitCost, 9);
    expect(r.totalCost).toBeCloseTo(s + h + u, 9);
  });

  it('total production equals total demand', () => {
    const r = solveWagnerWhitin({ demands: [10, 62, 12, 130, 154, 129, 88, 52, 124, 160], setupCost: 100, holdingCost: 1 });
    const produced = r.periods.reduce((a, p) => a + p.produce, 0);
    const demanded = r.periods.reduce((a, p) => a + p.demand, 0);
    expect(produced).toBeCloseTo(demanded);
  });

  it('final ending inventory is 0 (no leftover at horizon end)', () => {
    const r = solveWagnerWhitin({ demands: [10, 62, 12, 130, 154, 129, 88, 52, 124, 160], setupCost: 100, holdingCost: 1 });
    expect(r.periods[r.periods.length - 1].endingInventory).toBeCloseTo(0);
  });

  it('reconstructed holding equals lot-level holding', () => {
    const r = solveWagnerWhitin({ demands: [40, 30, 20, 10, 50, 60], setupCost: 80, holdingCost: 1 });
    const perPeriodHolding = r.periods.reduce((a, p) => a + p.holdingChargedHere, 0);
    expect(perPeriodHolding).toBeCloseTo(r.totalHoldingCost, 6);
  });

  it('setupCount = number of lots = number of periods flagged isSetup', () => {
    const r = solveWagnerWhitin({ demands: [10, 62, 12, 130, 154, 129, 88, 52, 124, 160], setupCost: 100, holdingCost: 1 });
    const flagged = r.periods.filter((p) => p.isSetup).length;
    expect(r.setupCount).toBe(r.lots.length);
    expect(flagged).toBe(r.lots.length);
  });
});

describe('solveWagnerWhitin — vs alternative partitions', () => {
  function costOfPartition(input: WagnerWhitinInput, partition: number[]): number {
    // partition is array of production start periods (1-indexed, must include 1)
    const T = input.demands.length;
    const K = typeof input.setupCost === 'number' ? new Array(T).fill(input.setupCost) : input.setupCost;
    const h = typeof input.holdingCost === 'number' ? new Array(T).fill(input.holdingCost) : input.holdingCost;
    const c = input.unitCost === undefined ? new Array(T).fill(0) : typeof input.unitCost === 'number' ? new Array(T).fill(input.unitCost) : input.unitCost;
    let total = 0;
    const starts = [...partition, T + 1];
    for (let i = 0; i < starts.length - 1; i++) {
      const j = starts[i];
      const kEnd = starts[i + 1] - 1;
      total += K[j - 1];
      let cumHold = 0;
      let qty = 0;
      for (let p = j; p <= kEnd; p++) {
        const d = input.demands[p - 1];
        qty += d;
        if (p > j) {
          cumHold += h[p - 2];
          total += cumHold * d;
        }
      }
      total += c[j - 1] * qty;
    }
    return total;
  }

  it('WW cost ≤ any alternative partition (5-period exhaustive)', () => {
    const input: WagnerWhitinInput = { demands: [30, 40, 50, 20, 60], setupCost: 100, holdingCost: 1 };
    const T = input.demands.length;
    const wwCost = solveWagnerWhitin(input).totalCost;
    // Enumerate all 2^(T-1) partitions (subsets of {2..T} determine cut points).
    for (let mask = 0; mask < 1 << (T - 1); mask++) {
      const partition = [1];
      for (let b = 0; b < T - 1; b++) {
        if (mask & (1 << b)) partition.push(b + 2);
      }
      const c = costOfPartition(input, partition);
      expect(wwCost).toBeLessThanOrEqual(c + 1e-9);
    }
  });

  it('WW cost ≤ Silver-Meal cost (dominance over the heuristic)', () => {
    const inputs: WagnerWhitinInput[] = [
      { demands: [10, 62, 12, 130, 154, 129, 88, 52, 124, 160], setupCost: 100, holdingCost: 1 },
      { demands: [69, 29, 36, 61, 61, 26, 34, 67, 45, 67, 79, 56], setupCost: 54, holdingCost: 0.4 },
      { demands: [40, 30, 20, 10, 50, 60], setupCost: 80, holdingCost: 1 },
    ];
    for (const inp of inputs) {
      const ww = solveWagnerWhitin(inp);
      const sm = solveSilverMeal(inp);
      expect(ww.totalCost).toBeLessThanOrEqual(sm.totalCost + 1e-9);
    }
  });
});

describe('solveWagnerWhitin — validation', () => {
  it('rejects empty demand array', () => {
    expect(() => solveWagnerWhitin({ demands: [], setupCost: 50, holdingCost: 1 })).toThrow(WagnerWhitinError);
  });
  it('rejects negative demand', () => {
    expect(() => solveWagnerWhitin({ demands: [10, -1, 20], setupCost: 50, holdingCost: 1 })).toThrow(WagnerWhitinError);
  });
  it('rejects non-numeric demand', () => {
    expect(() => solveWagnerWhitin({ demands: [10, Number.NaN, 20], setupCost: 50, holdingCost: 1 })).toThrow(WagnerWhitinError);
  });
  it('rejects zero-total demand', () => {
    expect(() => solveWagnerWhitin({ demands: [0, 0, 0], setupCost: 50, holdingCost: 1 })).toThrow(WagnerWhitinError);
  });
  it('rejects zero or negative setup cost', () => {
    expect(() => solveWagnerWhitin({ demands: [10, 20], setupCost: 0, holdingCost: 1 })).toThrow(WagnerWhitinError);
    expect(() => solveWagnerWhitin({ demands: [10, 20], setupCost: -5, holdingCost: 1 })).toThrow(WagnerWhitinError);
  });
  it('rejects negative holding cost', () => {
    expect(() => solveWagnerWhitin({ demands: [10, 20], setupCost: 50, holdingCost: -0.1 })).toThrow(WagnerWhitinError);
  });
  it('rejects mismatched array length', () => {
    expect(() => solveWagnerWhitin({ demands: [10, 20, 30], setupCost: [50, 50], holdingCost: 1 })).toThrow(WagnerWhitinError);
  });
  it('rejects horizon length > 240', () => {
    const long = new Array(241).fill(1);
    expect(() => solveWagnerWhitin({ demands: long, setupCost: 50, holdingCost: 1 })).toThrow(WagnerWhitinError);
  });
});
