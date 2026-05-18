import { describe, it, expect } from 'vitest';
import { computeEpq, epqCostCurve, EpqError } from './epq';
import { computeEoq } from './eoq';

describe('computeEpq — closed-form solution', () => {
  it('classic textbook example: D=1000 S=10 H=2 p=4000 → Q* ≈ 115.47', () => {
    const r = computeEpq({ demand: 1000, setupCost: 10, holdingCost: 2, productionRate: 4000 });
    // Q* = sqrt(2*1000*10 / (2 * (1 - 1000/4000))) = sqrt(20000 / 1.5) ≈ 115.4701
    expect(r.optimalQty).toBeCloseTo(115.4701, 3);
    // Imax = Q* * (1 - d/p) = 115.4701 * 0.75 ≈ 86.6025
    expect(r.maxInventory).toBeCloseTo(86.6025, 3);
    // Setup cost = D*S/Q* = 10000 / 115.4701 ≈ 86.6025
    expect(r.annualSetupCost).toBeCloseTo(86.6025, 3);
    // Holding cost = Imax*H/2 = 86.6025 * 2 / 2 ≈ 86.6025
    expect(r.annualHoldingCost).toBeCloseTo(86.6025, 3);
    // Total ≈ 173.205
    expect(r.totalAnnualCost).toBeCloseTo(173.205, 2);
  });

  it('at the optimum, setup cost equals holding cost (EOQ duality)', () => {
    const r = computeEpq({ demand: 5000, setupCost: 50, holdingCost: 4, productionRate: 12000 });
    expect(r.annualSetupCost).toBeCloseTo(r.annualHoldingCost, 5);
  });

  it('reduces to classic EOQ as productionRate → ∞', () => {
    const eoq = computeEoq({ demand: 1000, orderCost: 10, holdingCost: 2 });
    const epq = computeEpq({
      demand: 1000,
      setupCost: 10,
      holdingCost: 2,
      productionRate: 1e9,
    });
    expect(epq.optimalQty).toBeCloseTo(eoq.optimalQty, 2);
    expect(epq.totalAnnualCost).toBeCloseTo(eoq.totalAnnualCost, 2);
  });

  it('cycle splits cleanly into production + consumption phases', () => {
    const r = computeEpq({
      demand: 1000,
      setupCost: 10,
      holdingCost: 2,
      productionRate: 4000,
      daysPerYear: 360,
    });
    expect(r.productionDays + r.consumptionDays).toBeCloseTo(r.cycleDays, 6);
    // Production-phase fraction = d/p = 1/4 of cycle
    expect(r.productionDays / r.cycleDays).toBeCloseTo(0.25, 6);
  });

  it('peak inventory shrinks as production rate approaches demand', () => {
    const fast = computeEpq({ demand: 1000, setupCost: 10, holdingCost: 2, productionRate: 10000 });
    const slow = computeEpq({ demand: 1000, setupCost: 10, holdingCost: 2, productionRate: 1100 });
    // (1 - 1000/10000)=0.9 vs (1 - 1000/1100) ≈ 0.0909
    expect(slow.maxInventory).toBeLessThan(fast.maxInventory);
  });
});

describe('computeEpq — validation', () => {
  it('rejects non-positive demand', () => {
    expect(() =>
      computeEpq({ demand: 0, setupCost: 10, holdingCost: 2, productionRate: 1000 }),
    ).toThrow(EpqError);
  });
  it('rejects non-positive setup cost', () => {
    expect(() =>
      computeEpq({ demand: 100, setupCost: 0, holdingCost: 2, productionRate: 1000 }),
    ).toThrow(EpqError);
  });
  it('rejects non-positive holding cost', () => {
    expect(() =>
      computeEpq({ demand: 100, setupCost: 10, holdingCost: -1, productionRate: 1000 }),
    ).toThrow(EpqError);
  });
  it('rejects production rate ≤ demand (system cannot meet demand)', () => {
    expect(() =>
      computeEpq({ demand: 1000, setupCost: 10, holdingCost: 2, productionRate: 1000 }),
    ).toThrow(EpqError);
    expect(() =>
      computeEpq({ demand: 1000, setupCost: 10, holdingCost: 2, productionRate: 500 }),
    ).toThrow(EpqError);
  });
  it('rejects non-numeric input', () => {
    expect(() =>
      computeEpq({ demand: Number.NaN, setupCost: 10, holdingCost: 2, productionRate: 1000 }),
    ).toThrow(EpqError);
  });
  it('rejects non-positive daysPerYear', () => {
    expect(() =>
      computeEpq({
        demand: 1000,
        setupCost: 10,
        holdingCost: 2,
        productionRate: 4000,
        daysPerYear: 0,
      }),
    ).toThrow(EpqError);
  });
});

describe('epqCostCurve', () => {
  it('produces requested number of points + 1', () => {
    const pts = epqCostCurve(
      { demand: 1000, setupCost: 10, holdingCost: 2, productionRate: 4000 },
      30,
    );
    expect(pts).toHaveLength(31);
  });

  it('total cost reaches its minimum near Q*', () => {
    const input = { demand: 1000, setupCost: 10, holdingCost: 2, productionRate: 4000 };
    const r = computeEpq(input);
    const pts = epqCostCurve(input, 200);
    const minPoint = pts.reduce((a, b) => (a.total < b.total ? a : b));
    expect(minPoint.q).toBeCloseTo(r.optimalQty, 0);
  });

  it('setup and holding costs are positive throughout', () => {
    const pts = epqCostCurve({
      demand: 1000,
      setupCost: 10,
      holdingCost: 2,
      productionRate: 4000,
    });
    for (const p of pts) {
      expect(p.setup).toBeGreaterThan(0);
      expect(p.holding).toBeGreaterThan(0);
    }
  });
});
