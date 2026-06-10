import { describe, it, expect } from 'vitest';
import { analyzeFiniteQueue, erlangB, FiniteQueueError } from './queue-finite';

describe('analyzeFiniteQueue — M/M/1/K', () => {
  it('λ = μ → uniform P_n = 1/(K+1)', () => {
    const r = analyzeFiniteQueue({ model: 'mm1k', arrivalRate: 5, serviceRate: 5, capacity: 3 });
    expect(r.stateProbabilities).toHaveLength(4);
    for (const p of r.stateProbabilities) expect(p).toBeCloseTo(0.25, 6);
    expect(r.blockingProbability).toBeCloseTo(0.25, 6);
    expect(r.avgInSystem).toBeCloseTo(1.5, 6);
    expect(r.avgInQueue).toBeCloseTo(0.75, 6);
    // λ_eff = 5·(1−0.25) = 3.75 → W = 1.5/3.75 = 0.4, Wq = 0.75/3.75 = 0.2.
    expect(r.effectiveArrivalRate).toBeCloseTo(3.75, 6);
    expect(r.avgTimeInSystem).toBeCloseTo(0.4, 6);
    expect(r.avgTimeInQueue).toBeCloseTo(0.2, 6);
  });

  it('λ=2, μ=3, K=4 — hand-computed reference', () => {
    // ρ = 2/3 → P_0 = (1−ρ)/(1−ρ^5) = 81/211 ≈ 0.3839.
    // P_block = ρ^K · P_0 = (16/81)·(81/211) = 16/211 ≈ 0.0758.
    const r = analyzeFiniteQueue({ model: 'mm1k', arrivalRate: 2, serviceRate: 3, capacity: 4 });
    expect(r.probEmpty).toBeCloseTo(81 / 211, 5);
    expect(r.blockingProbability).toBeCloseTo(16 / 211, 5);
    expect(r.avgInSystem).toBeCloseTo(1.2417, 3);
    expect(r.avgInQueue).toBeCloseTo(0.6256, 3);
    // Little's law on the effective rate.
    expect(r.avgInSystem).toBeCloseTo(r.effectiveArrivalRate * r.avgTimeInSystem, 6);
    expect(r.avgInQueue).toBeCloseTo(r.effectiveArrivalRate * r.avgTimeInQueue, 6);
  });

  it('overloaded λ > μ still solves (finite K keeps system stable)', () => {
    // λ/μ = 3 with K = 3 → q_n = 3^n, sum = 1+3+9+27 = 40.
    const r = analyzeFiniteQueue({ model: 'mm1k', arrivalRate: 6, serviceRate: 2, capacity: 3 });
    expect(r.blockingProbability).toBeCloseTo(27 / 40, 6);
    expect(r.probEmpty).toBeCloseTo(1 / 40, 6);
    // No instability — chain is finite.
    expect(r.stateProbabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  it('K = 1 reduces to a single-server loss cell', () => {
    // M/M/1/1 = Erlang-B with c=1: P_block = a/(1+a).
    const a = 0.6;
    const r = analyzeFiniteQueue({ model: 'mm1k', arrivalRate: a, serviceRate: 1, capacity: 1 });
    expect(r.blockingProbability).toBeCloseTo(a / (1 + a), 8);
    expect(r.avgInQueue).toBeCloseTo(0, 8);
  });

  it('rejects bad inputs', () => {
    expect(() => analyzeFiniteQueue({ model: 'mm1k', arrivalRate: 0, serviceRate: 1, capacity: 2 }))
      .toThrow(FiniteQueueError);
    expect(() => analyzeFiniteQueue({ model: 'mm1k', arrivalRate: 1, serviceRate: 0, capacity: 2 }))
      .toThrow(FiniteQueueError);
    expect(() => analyzeFiniteQueue({ model: 'mm1k', arrivalRate: 1, serviceRate: 1, capacity: 0 }))
      .toThrow(FiniteQueueError);
  });
});

describe('analyzeFiniteQueue — M/M/c/K', () => {
  it('K = c reproduces Erlang-B loss system', () => {
    // Erlang-B(c=2, a=1.5) = (a²/2!) / (1 + a + a²/2!)
    //                     = 1.125 / 3.625 ≈ 0.310345.
    const r = analyzeFiniteQueue({
      model: 'mmck',
      arrivalRate: 3,
      serviceRate: 2,
      servers: 2,
      capacity: 2,
    });
    expect(r.blockingProbability).toBeCloseTo(0.310345, 5);
    expect(r.stateProbabilities).toHaveLength(3);
    // No queue can form when K = c.
    expect(r.avgInQueue).toBeCloseTo(0, 8);
    // Cross-check with closed-form erlangB().
    expect(r.blockingProbability).toBeCloseTo(erlangB(2, 1.5), 8);
  });

  it('K = 1 + c — at most one waiting slot', () => {
    const r = analyzeFiniteQueue({
      model: 'mmck',
      arrivalRate: 4,
      serviceRate: 2,
      servers: 2,
      capacity: 3,
    });
    expect(r.stateProbabilities).toHaveLength(4);
    expect(r.blockingProbability).toBe(r.stateProbabilities[3]);
    // Little's law on the effective rate.
    expect(r.avgInSystem).toBeCloseTo(r.effectiveArrivalRate * r.avgTimeInSystem, 6);
    expect(r.avgInQueue).toBeCloseTo(r.effectiveArrivalRate * r.avgTimeInQueue, 6);
  });

  it('large K approximates M/M/c (P_K → 0)', () => {
    // ρ = 5/(3·3) = 0.556. With K = 80 the truncation tail is invisible.
    const r = analyzeFiniteQueue({
      model: 'mmck',
      arrivalRate: 5,
      serviceRate: 3,
      servers: 3,
      capacity: 80,
    });
    expect(r.blockingProbability).toBeLessThan(1e-6);
    expect(r.stateProbabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  it('total probability is exactly 1 across the full table', () => {
    const r = analyzeFiniteQueue({
      model: 'mmck',
      arrivalRate: 7,
      serviceRate: 2,
      servers: 3,
      capacity: 10,
    });
    expect(r.stateProbabilities).toHaveLength(11);
    expect(r.stateProbabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('rejects K < c', () => {
    expect(() =>
      analyzeFiniteQueue({ model: 'mmck', arrivalRate: 1, serviceRate: 1, servers: 4, capacity: 2 }),
    ).toThrow(FiniteQueueError);
  });
});

describe('erlangB closed form', () => {
  it('matches the M/M/c/c loss system', () => {
    // Classical reference: B(3, 2) ≈ 0.210526
    expect(erlangB(3, 2)).toBeCloseTo(0.210526, 5);
  });

  it('numerical stability — large c', () => {
    const v = erlangB(50, 30);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('rejects invalid input', () => {
    expect(() => erlangB(0, 1)).toThrow(FiniteQueueError);
    expect(() => erlangB(2, 0)).toThrow(FiniteQueueError);
  });
});
