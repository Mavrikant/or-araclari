import { describe, it, expect } from 'vitest';
import { computeEoq, eoqCostCurve, EoqError } from './eoq';

describe('computeEoq — Wilson formula', () => {
  it('classic textbook example: D=1000 S=10 H=2 → Q*=100', () => {
    const r = computeEoq({ demand: 1000, orderCost: 10, holdingCost: 2 });
    expect(r.optimalQty).toBeCloseTo(100);
    expect(r.annualOrderingCost).toBeCloseTo(100); // D*S/Q = 1000*10/100 = 100
    expect(r.annualHoldingCost).toBeCloseTo(100); // Q*H/2 = 100*2/2 = 100
    expect(r.totalAnnualCost).toBeCloseTo(200);
    expect(r.ordersPerYear).toBeCloseTo(10);
    expect(r.cycleDays).toBeCloseTo(36.5); // 365 / 10
  });

  it('at the optimum, ordering cost equals holding cost', () => {
    const r = computeEoq({ demand: 5000, orderCost: 50, holdingCost: 4 });
    expect(r.annualOrderingCost).toBeCloseTo(r.annualHoldingCost, 5);
  });

  it('respects custom daysPerYear', () => {
    const r = computeEoq({ demand: 1000, orderCost: 10, holdingCost: 2, daysPerYear: 250 });
    expect(r.cycleDays).toBeCloseTo(25); // 250 / 10
  });

  it('Q* scales with sqrt of demand', () => {
    const r1 = computeEoq({ demand: 1000, orderCost: 10, holdingCost: 2 });
    const r4 = computeEoq({ demand: 4000, orderCost: 10, holdingCost: 2 });
    expect(r4.optimalQty).toBeCloseTo(r1.optimalQty * 2);
  });
});

describe('computeEoq — validation', () => {
  it('rejects non-positive demand', () => {
    expect(() => computeEoq({ demand: 0, orderCost: 10, holdingCost: 2 })).toThrow(EoqError);
    expect(() => computeEoq({ demand: -100, orderCost: 10, holdingCost: 2 })).toThrow(EoqError);
  });
  it('rejects non-positive order cost', () => {
    expect(() => computeEoq({ demand: 1000, orderCost: 0, holdingCost: 2 })).toThrow(EoqError);
  });
  it('rejects non-positive holding cost', () => {
    expect(() => computeEoq({ demand: 1000, orderCost: 10, holdingCost: -1 })).toThrow(EoqError);
  });
  it('rejects non-numeric input', () => {
    expect(() =>
      computeEoq({ demand: Number.NaN, orderCost: 10, holdingCost: 2 }),
    ).toThrow(EoqError);
  });
});

describe('eoqCostCurve', () => {
  it('produces requested number of points + 1', () => {
    const pts = eoqCostCurve({ demand: 1000, orderCost: 10, holdingCost: 2 }, 30);
    expect(pts).toHaveLength(31);
  });

  it('total cost reaches its minimum near Q*', () => {
    const pts = eoqCostCurve({ demand: 1000, orderCost: 10, holdingCost: 2 }, 200);
    const minPoint = pts.reduce((a, b) => (a.total < b.total ? a : b));
    expect(minPoint.q).toBeCloseTo(100, 0);
  });

  it('ordering and holding costs are positive throughout', () => {
    const pts = eoqCostCurve({ demand: 1000, orderCost: 10, holdingCost: 2 });
    for (const p of pts) {
      expect(p.ordering).toBeGreaterThan(0);
      expect(p.holding).toBeGreaterThan(0);
    }
  });
});
