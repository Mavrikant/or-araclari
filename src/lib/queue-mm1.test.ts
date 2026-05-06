import { describe, it, expect } from 'vitest';
import { analyzeMm1, Mm1Error } from './queue-mm1';

describe('analyzeMm1 — textbook examples', () => {
  it('λ=4, μ=5 → ρ=0.8, L=4, Lq=3.2', () => {
    const r = analyzeMm1({ arrivalRate: 4, serviceRate: 5 });
    expect(r.utilisation).toBeCloseTo(0.8);
    expect(r.avgInSystem).toBeCloseTo(4);
    expect(r.avgInQueue).toBeCloseTo(3.2);
    expect(r.avgTimeInSystem).toBeCloseTo(1);
    expect(r.avgTimeInQueue).toBeCloseTo(0.8);
    expect(r.probEmpty).toBeCloseTo(0.2);
  });

  it('low utilisation (ρ=0.1) → near-empty queue', () => {
    const r = analyzeMm1({ arrivalRate: 1, serviceRate: 10 });
    expect(r.utilisation).toBeCloseTo(0.1);
    expect(r.avgInSystem).toBeCloseTo(0.111, 2);
    expect(r.probEmpty).toBeCloseTo(0.9);
  });

  it('Little\'s Law holds: L = λW, Lq = λWq', () => {
    const r = analyzeMm1({ arrivalRate: 6, serviceRate: 10 });
    expect(r.avgInSystem).toBeCloseTo(6 * r.avgTimeInSystem);
    expect(r.avgInQueue).toBeCloseTo(6 * r.avgTimeInQueue);
  });

  it('state probabilities sum close to 1 over enough states', () => {
    const r = analyzeMm1({ arrivalRate: 4, serviceRate: 5 }, 50);
    const sum = r.stateProbabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.99);
  });

  it('P(0) equals 1 - ρ', () => {
    const r = analyzeMm1({ arrivalRate: 7, serviceRate: 10 });
    expect(r.stateProbabilities[0]).toBeCloseTo(0.3);
  });
});

describe('analyzeMm1 — validation', () => {
  it('rejects non-positive rates', () => {
    expect(() => analyzeMm1({ arrivalRate: 0, serviceRate: 5 })).toThrow(Mm1Error);
    expect(() => analyzeMm1({ arrivalRate: 4, serviceRate: -1 })).toThrow(Mm1Error);
  });

  it('rejects unstable system (λ >= μ)', () => {
    expect(() => analyzeMm1({ arrivalRate: 5, serviceRate: 5 })).toThrow(/karasız|Sistem/i);
    expect(() => analyzeMm1({ arrivalRate: 6, serviceRate: 5 })).toThrow(Mm1Error);
  });

  it('rejects non-finite input', () => {
    expect(() => analyzeMm1({ arrivalRate: NaN, serviceRate: 5 })).toThrow(Mm1Error);
  });
});
