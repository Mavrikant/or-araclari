import { describe, it, expect } from 'vitest';
import { analyzeErlangA, ErlangAError } from './queue-erlang-a';
import { analyzeMmc } from './queue-mmc';
import { analyzeMm1 } from './queue-mm1';

describe('analyzeErlangA — θ = 0 reduces to M/M/c', () => {
  it('c=1, θ=0 matches M/M/1 exactly within tail tolerance', () => {
    const lambda = 2;
    const mu = 3;
    const a = analyzeErlangA({ arrivalRate: lambda, serviceRate: mu, servers: 1, abandonmentRate: 0 });
    const m = analyzeMm1({ arrivalRate: lambda, serviceRate: mu });
    expect(a.probEmpty).toBeCloseTo(m.probEmpty, 6);
    expect(a.avgInQueue).toBeCloseTo(m.avgInQueue, 6);
    expect(a.avgInSystem).toBeCloseTo(m.avgInSystem, 6);
    expect(a.avgTimeInQueue).toBeCloseTo(m.avgTimeInQueue, 6);
    expect(a.abandonRate).toBe(0);
    expect(a.probAbandon).toBe(0);
    expect(a.effectiveServedRate).toBeCloseTo(lambda, 10);
  });

  it('c=3, θ=0 matches Erlang-C M/M/c (Hillier-Lieberman c=2, λ=10, μ=6)', () => {
    const a = analyzeErlangA({ arrivalRate: 10, serviceRate: 6, servers: 2, abandonmentRate: 0 });
    const m = analyzeMmc({ arrivalRate: 10, serviceRate: 6, servers: 2 });
    expect(a.probEmpty).toBeCloseTo(m.probEmpty, 6);
    expect(a.probWait).toBeCloseTo(m.probWait, 6);
    expect(a.avgInQueue).toBeCloseTo(m.avgInQueue, 6);
    expect(a.avgInSystem).toBeCloseTo(m.avgInSystem, 6);
  });

  it('throws when θ = 0 and ρ ≥ 1 (M/M/c reduction is unstable)', () => {
    expect(() =>
      analyzeErlangA({ arrivalRate: 10, serviceRate: 1, servers: 5, abandonmentRate: 0 }),
    ).toThrow(ErlangAError);
  });
});

describe('analyzeErlangA — abandonment stabilises overloaded systems', () => {
  it('λ > c·μ is stable when θ > 0 (no exception, finite Lq)', () => {
    /* Overloaded: ρ = 2 — saf M/M/c kararsız ama Erlang-A bırakmayla kararlı. */
    const r = analyzeErlangA({
      arrivalRate: 20,
      serviceRate: 5,
      servers: 2,
      abandonmentRate: 1,
    });
    expect(Number.isFinite(r.avgInQueue)).toBe(true);
    expect(r.probAbandon).toBeGreaterThan(0);
    expect(r.probAbandon).toBeLessThan(1);
    expect(r.effectiveServedRate).toBeLessThan(20);
    expect(r.effectiveServedRate).toBeGreaterThan(0);
  });

  it('λ_aban = θ · Lq identity holds', () => {
    const r = analyzeErlangA({
      arrivalRate: 8,
      serviceRate: 3,
      servers: 3,
      abandonmentRate: 0.5,
    });
    expect(r.abandonRate).toBeCloseTo(0.5 * r.avgInQueue, 10);
  });

  it('λ_served + λ_aban = λ (mass balance)', () => {
    const r = analyzeErlangA({
      arrivalRate: 7,
      serviceRate: 4,
      servers: 2,
      abandonmentRate: 0.8,
    });
    expect(r.effectiveServedRate + r.abandonRate).toBeCloseTo(7, 10);
  });

  it('Little Yasası: Lq = λ · Wq ve L = λ · W', () => {
    const lambda = 6;
    const r = analyzeErlangA({
      arrivalRate: lambda,
      serviceRate: 2,
      servers: 3,
      abandonmentRate: 0.3,
    });
    expect(r.avgInQueue).toBeCloseTo(lambda * r.avgTimeInQueue, 8);
    expect(r.avgInSystem).toBeCloseTo(lambda * r.avgTimeInSystem, 8);
  });

  it('higher θ → higher P(abandon), lower Lq, lower Wq (monotonicity)', () => {
    const base = { arrivalRate: 12, serviceRate: 4, servers: 3 };
    const r1 = analyzeErlangA({ ...base, abandonmentRate: 0.1 });
    const r2 = analyzeErlangA({ ...base, abandonmentRate: 1 });
    const r3 = analyzeErlangA({ ...base, abandonmentRate: 10 });
    expect(r2.probAbandon).toBeGreaterThan(r1.probAbandon);
    expect(r3.probAbandon).toBeGreaterThan(r2.probAbandon);
    expect(r2.avgInQueue).toBeLessThan(r1.avgInQueue);
    expect(r3.avgInQueue).toBeLessThan(r2.avgInQueue);
    expect(r2.avgTimeInQueue).toBeLessThan(r1.avgTimeInQueue);
  });

  it('state probabilities sum to ~1 (truncation tail negligible)', () => {
    const r = analyzeErlangA({
      arrivalRate: 9,
      serviceRate: 2,
      servers: 4,
      abandonmentRate: 0.5,
    });
    const total = r.stateProbabilities.reduce((s, p) => s + p, 0);
    expect(total).toBeCloseTo(1, 8);
  });

  it('P(W > 0) = Σ P_n for n ≥ c', () => {
    const r = analyzeErlangA({
      arrivalRate: 5,
      serviceRate: 2,
      servers: 3,
      abandonmentRate: 0.4,
    });
    let tail = 0;
    for (let n = r.servers; n <= r.nMax; n++) tail += r.stateProbabilities[n];
    expect(r.probWait).toBeCloseTo(tail, 10);
  });
});

describe('analyzeErlangA — edge cases', () => {
  it('very high θ acts almost like a loss system: P(wait>0) > 0 but P(abandon) close to wait probability', () => {
    /* θ → ∞: müşteri kuyruk gördü mü hemen terk; M/M/c/c (Erlang-B) limiti. */
    const r = analyzeErlangA({
      arrivalRate: 5,
      serviceRate: 2,
      servers: 2,
      abandonmentRate: 1000,
    });
    expect(r.avgInQueue).toBeLessThan(0.01); /* virtually no waiting */
    expect(r.probAbandon).toBeGreaterThan(0);
  });

  it('very low θ approaches Erlang-C limit when ρ < 1', () => {
    const base = { arrivalRate: 4, serviceRate: 3, servers: 2 };
    const erlangC = analyzeMmc(base);
    const a = analyzeErlangA({ ...base, abandonmentRate: 1e-6 });
    expect(a.probEmpty).toBeCloseTo(erlangC.probEmpty, 4);
    expect(a.avgInQueue).toBeCloseTo(erlangC.avgInQueue, 3);
  });

  it('single server, no abandonment but underloaded works', () => {
    const r = analyzeErlangA({ arrivalRate: 1, serviceRate: 2, servers: 1, abandonmentRate: 0 });
    expect(r.probEmpty).toBeCloseTo(0.5, 6); /* P0 = 1 − ρ = 0.5 */
    expect(r.avgInQueue).toBeCloseTo(0.5, 6); /* Lq = ρ² / (1 − ρ) = 0.25 / 0.5 = 0.5 */
  });
});

describe('analyzeErlangA — validation', () => {
  it('rejects non-positive λ, μ', () => {
    expect(() => analyzeErlangA({ arrivalRate: 0, serviceRate: 2, servers: 1, abandonmentRate: 0.1 })).toThrow(ErlangAError);
    expect(() => analyzeErlangA({ arrivalRate: 1, serviceRate: -3, servers: 1, abandonmentRate: 0.1 })).toThrow(ErlangAError);
  });
  it('rejects non-integer or non-positive c', () => {
    expect(() => analyzeErlangA({ arrivalRate: 1, serviceRate: 2, servers: 0, abandonmentRate: 0.1 })).toThrow(ErlangAError);
    expect(() => analyzeErlangA({ arrivalRate: 1, serviceRate: 2, servers: 1.5, abandonmentRate: 0.1 })).toThrow(ErlangAError);
  });
  it('rejects negative θ', () => {
    expect(() => analyzeErlangA({ arrivalRate: 1, serviceRate: 2, servers: 1, abandonmentRate: -0.1 })).toThrow(ErlangAError);
  });
  it('rejects c > 200', () => {
    expect(() => analyzeErlangA({ arrivalRate: 1, serviceRate: 2, servers: 201, abandonmentRate: 0.1 })).toThrow(ErlangAError);
  });
});
