import { describe, it, expect } from 'vitest';
import { analyzeMmc, MmcError } from './queue-mmc';
import { analyzeMm1 } from './queue-mm1';

describe('analyzeMmc — collapses to M/M/1 when c=1', () => {
  it('λ=4, μ=5, c=1 matches analyzeMm1', () => {
    const a = analyzeMmc({ arrivalRate: 4, serviceRate: 5, servers: 1 });
    const b = analyzeMm1({ arrivalRate: 4, serviceRate: 5 });
    expect(a.utilisation).toBeCloseTo(b.utilisation, 8);
    expect(a.avgInSystem).toBeCloseTo(b.avgInSystem, 8);
    expect(a.avgInQueue).toBeCloseTo(b.avgInQueue, 8);
    expect(a.avgTimeInSystem).toBeCloseTo(b.avgTimeInSystem, 8);
    expect(a.avgTimeInQueue).toBeCloseTo(b.avgTimeInQueue, 8);
    expect(a.probEmpty).toBeCloseTo(b.probEmpty, 8);
    // For M/M/1, Erlang-C = ρ
    expect(a.probWait).toBeCloseTo(b.utilisation, 8);
  });

  it('λ=7, μ=10, c=1: state probabilities match M/M/1 geometric', () => {
    const r = analyzeMmc({ arrivalRate: 7, serviceRate: 10, servers: 1 }, 5);
    const rho = 0.7;
    for (let n = 0; n <= 5; n++) {
      expect(r.stateProbabilities[n]).toBeCloseTo((1 - rho) * Math.pow(rho, n), 8);
    }
  });
});

describe('analyzeMmc — textbook examples', () => {
  // Gross & Harris, "Fundamentals of Queueing Theory", classic M/M/c example
  // c=3, a=2 (λ=2, μ=1): P0=1/9, C(3,2)=4/9, Lq=8/9
  it('c=3, λ=2, μ=1: P0=1/9, C(3,2)=4/9, Lq=8/9', () => {
    const r = analyzeMmc({ arrivalRate: 2, serviceRate: 1, servers: 3 });
    expect(r.offeredLoad).toBeCloseTo(2, 8);
    expect(r.utilisation).toBeCloseTo(2 / 3, 8);
    expect(r.probEmpty).toBeCloseTo(1 / 9, 6);
    expect(r.probWait).toBeCloseTo(4 / 9, 6);
    expect(r.avgInQueue).toBeCloseTo(8 / 9, 6);
    expect(r.avgInSystem).toBeCloseTo(8 / 9 + 2, 6); // Lq + a
    // Little's Law: Wq = Lq/λ, W = L/λ
    expect(r.avgTimeInQueue).toBeCloseTo(r.avgInQueue / 2, 8);
    expect(r.avgTimeInSystem).toBeCloseTo(r.avgInSystem / 2, 8);
  });

  // Hillier & Lieberman Example: c=2, λ=10/hr, μ=6/hr → a=5/3, ρ=5/6
  // P0 = 1/[1 + 5/3 + (25/9)/(2·(1−5/6))] = 1/[1 + 5/3 + 25/3] = 1/11
  // C = (25/9)/(2·1/6)·(1/11) = (25/9)·3·(1/11) = 75/(9·11) = 75/99 = 25/33
  // Lq = C · ρ/(1−ρ) = (25/33) · (5/6)/(1/6) = (25/33) · 5 = 125/33 ≈ 3.7879
  it('c=2, λ=10, μ=6: hand-verified Lq and Erlang-C', () => {
    const r = analyzeMmc({ arrivalRate: 10, serviceRate: 6, servers: 2 });
    expect(r.offeredLoad).toBeCloseTo(5 / 3, 8);
    expect(r.utilisation).toBeCloseTo(5 / 6, 8);
    expect(r.probEmpty).toBeCloseTo(1 / 11, 6);
    expect(r.probWait).toBeCloseTo(25 / 33, 6);
    expect(r.avgInQueue).toBeCloseTo(125 / 33, 5);
    expect(r.avgInSystem).toBeCloseTo(125 / 33 + 5 / 3, 5);
  });

  it("Little's Law holds: L = λW, Lq = λWq", () => {
    const r = analyzeMmc({ arrivalRate: 8, serviceRate: 5, servers: 3 });
    expect(r.avgInSystem).toBeCloseTo(8 * r.avgTimeInSystem, 8);
    expect(r.avgInQueue).toBeCloseTo(8 * r.avgTimeInQueue, 8);
  });

  it('more servers → lower Lq at fixed load', () => {
    const r3 = analyzeMmc({ arrivalRate: 9, serviceRate: 4, servers: 3 });
    const r4 = analyzeMmc({ arrivalRate: 9, serviceRate: 4, servers: 4 });
    const r5 = analyzeMmc({ arrivalRate: 9, serviceRate: 4, servers: 5 });
    expect(r4.avgInQueue).toBeLessThan(r3.avgInQueue);
    expect(r5.avgInQueue).toBeLessThan(r4.avgInQueue);
    expect(r4.probWait).toBeLessThan(r3.probWait);
  });

  it('state probabilities sum near 1 with enough states', () => {
    const r = analyzeMmc({ arrivalRate: 6, serviceRate: 4, servers: 2 }, 60);
    const sum = r.stateProbabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.999);
  });

  it('state probabilities monotone-decreasing past the saturation point (n ≥ c)', () => {
    const r = analyzeMmc({ arrivalRate: 4, serviceRate: 3, servers: 2 }, 12);
    // for n ≥ c the ratio P(n+1)/P(n) = a/c = ρ < 1, so strictly decreasing.
    for (let n = 2; n < 12; n++) {
      expect(r.stateProbabilities[n + 1]).toBeLessThan(r.stateProbabilities[n]);
    }
  });

  it('high utilisation: c=5, λ=4.5, μ=1 → ρ=0.9', () => {
    const r = analyzeMmc({ arrivalRate: 4.5, serviceRate: 1, servers: 5 });
    expect(r.utilisation).toBeCloseTo(0.9, 8);
    expect(r.probEmpty).toBeGreaterThan(0);
    expect(r.probWait).toBeGreaterThan(0.6);
    expect(r.probWait).toBeLessThan(1);
    expect(r.avgInQueue).toBeGreaterThan(r.offeredLoad);
  });
});

describe('analyzeMmc — validation', () => {
  it('rejects non-positive rates', () => {
    expect(() => analyzeMmc({ arrivalRate: 0, serviceRate: 5, servers: 2 })).toThrow(MmcError);
    expect(() => analyzeMmc({ arrivalRate: 4, serviceRate: -1, servers: 2 })).toThrow(MmcError);
  });

  it('rejects non-integer or non-positive c', () => {
    expect(() => analyzeMmc({ arrivalRate: 4, serviceRate: 5, servers: 0 })).toThrow(MmcError);
    expect(() => analyzeMmc({ arrivalRate: 4, serviceRate: 5, servers: 2.5 })).toThrow(MmcError);
    expect(() => analyzeMmc({ arrivalRate: 4, serviceRate: 5, servers: -1 })).toThrow(MmcError);
  });

  it('rejects unstable system (λ ≥ c·μ)', () => {
    expect(() => analyzeMmc({ arrivalRate: 10, serviceRate: 5, servers: 2 })).toThrow(/karasız|Sistem/i);
    expect(() => analyzeMmc({ arrivalRate: 11, serviceRate: 5, servers: 2 })).toThrow(MmcError);
  });

  it('rejects non-finite input', () => {
    expect(() => analyzeMmc({ arrivalRate: NaN, serviceRate: 5, servers: 2 })).toThrow(MmcError);
    expect(() => analyzeMmc({ arrivalRate: 4, serviceRate: Infinity, servers: 2 })).toThrow(MmcError);
  });

  it('rejects unreasonably large c', () => {
    expect(() => analyzeMmc({ arrivalRate: 4, serviceRate: 5, servers: 1000 })).toThrow(MmcError);
  });
});
