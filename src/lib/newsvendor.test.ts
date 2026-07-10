import { describe, it, expect } from 'vitest';
import {
  computeNewsvendor,
  newsvendorSensitivity,
  normalCdf,
  normalInverse,
  normalPdf,
  standardNormalLoss,
  NewsvendorError,
} from './newsvendor';

describe('normalCdf — Abramowitz-Stegun 7.1.26', () => {
  it('Φ(0) = 0.5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });
  it('Φ(1.96) ≈ 0.975', () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
  });
  it('Φ(-1.96) ≈ 0.025', () => {
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4);
  });
  it('Φ(3) ≈ 0.99865', () => {
    expect(normalCdf(3)).toBeCloseTo(0.99865, 4);
  });
  it('symmetric: Φ(z) + Φ(-z) = 1', () => {
    for (const z of [0.3, 0.7, 1.4, 2.1, 3.5]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6);
    }
  });
});

describe('normalInverse — Beasley-Springer-Moro', () => {
  it('Φ⁻¹(0.5) = 0', () => {
    expect(normalInverse(0.5)).toBeCloseTo(0, 6);
  });
  it('Φ⁻¹(0.975) ≈ 1.959964', () => {
    expect(normalInverse(0.975)).toBeCloseTo(1.959964, 5);
  });
  it('Φ⁻¹(0.025) ≈ -1.959964', () => {
    expect(normalInverse(0.025)).toBeCloseTo(-1.959964, 5);
  });
  it('Φ⁻¹(0.95) ≈ 1.644854', () => {
    expect(normalInverse(0.95)).toBeCloseTo(1.644854, 5);
  });
  it('round-trip Φ(Φ⁻¹(p)) ≈ p for p ∈ (0,1)', () => {
    for (const p of [0.01, 0.1, 0.3, 0.6, 0.85, 0.99]) {
      expect(normalCdf(normalInverse(p))).toBeCloseTo(p, 5);
    }
  });
});

describe('standardNormalLoss L(z) = φ(z) − z(1 − Φ(z))', () => {
  it('L(0) = φ(0) = 1/√(2π)', () => {
    expect(standardNormalLoss(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 5);
  });
  it('L(z) → 0 as z → +∞', () => {
    expect(standardNormalLoss(4)).toBeLessThan(0.001);
  });
  it('L(-z) = L(z) + z (Cachon-Terwiesch identity)', () => {
    for (const z of [0.5, 1.0, 1.5]) {
      expect(standardNormalLoss(-z)).toBeCloseTo(standardNormalLoss(z) + z, 5);
    }
  });
  it('φ(0) sanity', () => {
    expect(normalPdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 6);
  });
});

describe('computeNewsvendor — kritik fraksiyon', () => {
  it('normal talep + direct costs: Cu=4, Co=1 → CR=0.8 → z≈0.842', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 4, overage: 1 },
      demand: { kind: 'normal', mean: 100, stdDev: 20 },
    });
    expect(r.criticalRatio).toBeCloseTo(0.8);
    // z_{0.8} ≈ 0.8416; Q* = 100 + 0.8416 · 20 ≈ 116.83
    expect(r.optimalQty).toBeCloseTo(116.83, 1);
    expect(r.serviceLevel).toBeCloseTo(0.8, 5);
  });

  it('normal talep symmetric: CR=0.5 → Q* = μ', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 5, overage: 5 },
      demand: { kind: 'normal', mean: 200, stdDev: 30 },
    });
    expect(r.criticalRatio).toBeCloseTo(0.5);
    expect(r.optimalQty).toBeCloseTo(200, 5);
  });

  it('uniform talep U(50,150) + CR=0.75 → Q* = 50 + 100·0.75 = 125', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 3, overage: 1 },
      demand: { kind: 'uniform', min: 50, max: 150 },
    });
    expect(r.criticalRatio).toBeCloseTo(0.75);
    expect(r.optimalQty).toBeCloseTo(125, 5);
    // E[shortage] at Q=125: (150-125)² / (2·100) = 625/200 = 3.125
    expect(r.expectedShortage).toBeCloseTo(3.125, 5);
    // E[leftover]: (125-50)² / 200 = 5625/200 = 28.125
    expect(r.expectedLeftover).toBeCloseTo(28.125, 5);
  });

  it('priced modu: p=25, c=10, s=5 → Cu=15, Co=5, CR=0.75', () => {
    const r = computeNewsvendor({
      costs: { mode: 'priced', price: 25, cost: 10, salvage: 5 },
      demand: { kind: 'uniform', min: 50, max: 150 },
    });
    expect(r.underage).toBeCloseTo(15);
    expect(r.overage).toBeCloseTo(5);
    expect(r.criticalRatio).toBeCloseTo(0.75);
    expect(r.optimalQty).toBeCloseTo(125, 5);
    expect(r.expectedProfit).not.toBeNull();
    // E[sales] = 100 - 3.125 = 96.875; profit = 25·96.875 + 5·28.125 − 10·125 − 0
    //         = 2421.875 + 140.625 − 1250 = 1312.5
    expect(r.expectedProfit).toBeCloseTo(1312.5, 3);
  });

  it('priced + salvage default = 0 + shortagePenalty', () => {
    const r = computeNewsvendor({
      costs: { mode: 'priced', price: 20, cost: 12, shortagePenalty: 3 },
      demand: { kind: 'normal', mean: 500, stdDev: 100 },
    });
    // Cu = 20 - 12 + 3 = 11, Co = 12 - 0 = 12, CR = 11/23 ≈ 0.4783
    expect(r.underage).toBeCloseTo(11);
    expect(r.overage).toBeCloseTo(12);
    expect(r.criticalRatio).toBeCloseTo(11 / 23, 6);
  });

  it('direct mode: expectedProfit = null (fiyat bilinmiyor)', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 4, overage: 1 },
      demand: { kind: 'normal', mean: 100, stdDev: 20 },
    });
    expect(r.expectedProfit).toBeNull();
  });

  it('kimlik: E[shortage] + Q = E[leftover] + E[D] (accounting identity)', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 4, overage: 1 },
      demand: { kind: 'normal', mean: 100, stdDev: 20 },
    });
    expect(r.optimalQty - r.expectedLeftover).toBeCloseTo(100 - r.expectedShortage, 4);
  });

  it('kimlik uniform: expected sales = E[D] − E[shortage]', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 3, overage: 1 },
      demand: { kind: 'uniform', min: 50, max: 150 },
    });
    expect(r.expectedSales).toBeCloseTo(100 - 3.125, 5);
    expect(r.fillRate).toBeCloseTo(r.expectedSales / 100, 5);
  });

  it('CR≈1 (Cu≫Co): Q* çok yüksek', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 99, overage: 1 },
      demand: { kind: 'normal', mean: 100, stdDev: 20 },
    });
    expect(r.criticalRatio).toBeCloseTo(0.99);
    expect(r.optimalQty).toBeGreaterThan(140);
  });

  it('CR≈0 (Co≫Cu): Q* çok düşük', () => {
    const r = computeNewsvendor({
      costs: { mode: 'direct', underage: 1, overage: 99 },
      demand: { kind: 'normal', mean: 100, stdDev: 20 },
    });
    expect(r.criticalRatio).toBeCloseTo(0.01);
    expect(r.optimalQty).toBeLessThan(60);
  });

  it('Q* Q ekseni etrafında beklenen maliyet minimum noktasında', () => {
    const input = {
      costs: { mode: 'direct' as const, underage: 4, overage: 1 },
      demand: { kind: 'normal' as const, mean: 100, stdDev: 20 },
    };
    const r = computeNewsvendor(input);
    const points = newsvendorSensitivity(input, 200, 0.6, 1.4);
    const minPt = points.reduce((a, b) => (a.expectedCost < b.expectedCost ? a : b));
    expect(minPt.q).toBeCloseTo(r.optimalQty, 0);
  });
});

describe('newsvendorSensitivity — profil eğrisi', () => {
  it('istenen sayıda + 1 nokta üretir', () => {
    const pts = newsvendorSensitivity(
      {
        costs: { mode: 'direct', underage: 4, overage: 1 },
        demand: { kind: 'normal', mean: 100, stdDev: 20 },
      },
      30,
    );
    expect(pts).toHaveLength(31);
  });

  it('priced modda kâr eğrisi maksimum Q* etrafında', () => {
    const input = {
      costs: { mode: 'priced' as const, price: 25, cost: 10, salvage: 5 },
      demand: { kind: 'uniform' as const, min: 50, max: 150 },
    };
    const r = computeNewsvendor(input);
    const pts = newsvendorSensitivity(input, 200, 0.6, 1.4);
    const maxPt = pts.reduce((a, b) => ((a.expectedProfit ?? -Infinity) > (b.expectedProfit ?? -Infinity) ? a : b));
    expect(maxPt.q).toBeCloseTo(r.optimalQty, 0);
  });

  it('direct modda expectedProfit = null', () => {
    const pts = newsvendorSensitivity({
      costs: { mode: 'direct', underage: 4, overage: 1 },
      demand: { kind: 'normal', mean: 100, stdDev: 20 },
    });
    expect(pts.every((p) => p.expectedProfit === null)).toBe(true);
  });
});

describe('computeNewsvendor — validation', () => {
  it('direct: negatif Cu reddedilir', () => {
    expect(() =>
      computeNewsvendor({
        costs: { mode: 'direct', underage: -1, overage: 2 },
        demand: { kind: 'normal', mean: 100, stdDev: 10 },
      }),
    ).toThrow(NewsvendorError);
  });

  it('direct: Cu + Co = 0 reddedilir', () => {
    expect(() =>
      computeNewsvendor({
        costs: { mode: 'direct', underage: 0, overage: 0 },
        demand: { kind: 'normal', mean: 100, stdDev: 10 },
      }),
    ).toThrow(NewsvendorError);
  });

  it('priced: p ≤ c reddedilir', () => {
    expect(() =>
      computeNewsvendor({
        costs: { mode: 'priced', price: 10, cost: 10 },
        demand: { kind: 'normal', mean: 100, stdDev: 10 },
      }),
    ).toThrow(NewsvendorError);
  });

  it('priced: salvage > cost reddedilir', () => {
    expect(() =>
      computeNewsvendor({
        costs: { mode: 'priced', price: 20, cost: 10, salvage: 12 },
        demand: { kind: 'normal', mean: 100, stdDev: 10 },
      }),
    ).toThrow(NewsvendorError);
  });

  it('normal: σ ≤ 0 reddedilir', () => {
    expect(() =>
      computeNewsvendor({
        costs: { mode: 'direct', underage: 4, overage: 1 },
        demand: { kind: 'normal', mean: 100, stdDev: 0 },
      }),
    ).toThrow(NewsvendorError);
  });

  it('uniform: max ≤ min reddedilir', () => {
    expect(() =>
      computeNewsvendor({
        costs: { mode: 'direct', underage: 4, overage: 1 },
        demand: { kind: 'uniform', min: 50, max: 50 },
      }),
    ).toThrow(NewsvendorError);
  });

  it('normal: NaN mean reddedilir', () => {
    expect(() =>
      computeNewsvendor({
        costs: { mode: 'direct', underage: 4, overage: 1 },
        demand: { kind: 'normal', mean: Number.NaN, stdDev: 10 },
      }),
    ).toThrow(NewsvendorError);
  });
});
