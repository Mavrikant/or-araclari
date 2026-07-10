import { describe, it, expect } from 'vitest';
import {
  computeRop,
  serviceLevelSweep,
  normalCdf,
  normalInverse,
  normalPdf,
  standardNormalLoss,
  RopError,
} from './rop';

describe('normalCdf — Abramowitz-Stegun', () => {
  it('Φ(0) = 0.5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });
  it('Φ(1.645) ≈ 0.95', () => {
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 3);
  });
  it('simetri: Φ(z) + Φ(−z) = 1', () => {
    for (const z of [0.4, 1.0, 2.3, 3.1]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6);
    }
  });
});

describe('normalInverse — Beasley-Springer-Moro', () => {
  it('Φ⁻¹(0.5) = 0', () => {
    expect(normalInverse(0.5)).toBeCloseTo(0, 5);
  });
  it('Φ⁻¹(0.95) ≈ 1.6449', () => {
    expect(normalInverse(0.95)).toBeCloseTo(1.6449, 3);
  });
  it('Φ⁻¹(0.99) ≈ 2.3263', () => {
    expect(normalInverse(0.99)).toBeCloseTo(2.3263, 3);
  });
  it('round-trip', () => {
    for (const p of [0.05, 0.2, 0.5, 0.8, 0.99]) {
      expect(normalCdf(normalInverse(p))).toBeCloseTo(p, 4);
    }
  });
});

describe('standardNormalLoss L(z)', () => {
  it('L(0) = φ(0) = 1/√(2π) ≈ 0.3989', () => {
    expect(standardNormalLoss(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 5);
  });
  it('L(1.645) ≈ 0.02066 (ders kitabı z-tablosu)', () => {
    expect(standardNormalLoss(1.645)).toBeCloseTo(0.02066, 3);
  });
  it('L(1.5) ≈ 0.0293 (Nahmias z-tablosu)', () => {
    expect(standardNormalLoss(1.5)).toBeCloseTo(0.0293, 3);
  });
  it('L(z) → 0 as z → +∞', () => {
    expect(standardNormalLoss(5)).toBeLessThan(1e-5);
  });
  it('Cachon-Terwiesch: L(−z) = L(z) + z', () => {
    for (const z of [0.5, 1.2, 2.4]) {
      expect(standardNormalLoss(-z)).toBeCloseTo(standardNormalLoss(z) + z, 4);
    }
  });
  it('φ(0) sağlaması', () => {
    expect(normalPdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 6);
  });
});

describe('computeRop — Type-I, σ_L = 0 (deterministik tedarik süresi)', () => {
  it('Silver-Peterson stili örnek: μ=100, σ=10, L=4, α=0.95', () => {
    // Klasik hand-verified: σ_DL = √4 · 10 = 20; z_{0.95} ≈ 1.6449;
    // SS = 1.6449 · 20 ≈ 32.9; R = 400 + 32.9 = 432.9
    const r = computeRop({
      demandMean: 100,
      demandStdDev: 10,
      leadTimeMean: 4,
      serviceLevel: 0.95,
      serviceMode: 'type1',
    });
    expect(r.leadTimeDemand).toBeCloseTo(400, 5);
    expect(r.leadTimeStdDev).toBeCloseTo(20, 5);
    expect(r.z).toBeCloseTo(1.6449, 3);
    expect(r.safetyStock).toBeCloseTo(32.9, 1);
    expect(r.reorderPoint).toBeCloseTo(432.9, 1);
  });

  it('α = 0.5 → z = 0 → R = E[DL], SS = 0', () => {
    const r = computeRop({
      demandMean: 50,
      demandStdDev: 8,
      leadTimeMean: 3,
      serviceLevel: 0.5,
      serviceMode: 'type1',
    });
    expect(r.z).toBeCloseTo(0, 4);
    expect(r.safetyStock).toBeCloseTo(0, 4);
    expect(r.reorderPoint).toBeCloseTo(150, 4);
  });

  it('α = 0.99 → z ≈ 2.326, SS önemli ölçüde büyür', () => {
    const r = computeRop({
      demandMean: 200,
      demandStdDev: 30,
      leadTimeMean: 5,
      serviceLevel: 0.99,
      serviceMode: 'type1',
    });
    // σ_DL = √5 · 30 ≈ 67.08
    expect(r.leadTimeStdDev).toBeCloseTo(67.082, 2);
    // SS = 2.3263 · 67.082 ≈ 156.0
    expect(r.safetyStock).toBeCloseTo(156.06, 1);
    expect(r.reorderPoint).toBeCloseTo(1156.06, 1);
  });

  it('σ = 0 → SS = 0, R = μ·L (belirsizlik yoksa emniyet stoğu gereksiz)', () => {
    const r = computeRop({
      demandMean: 20,
      demandStdDev: 0,
      leadTimeMean: 7,
      serviceLevel: 0.95,
      serviceMode: 'type1',
    });
    expect(r.leadTimeStdDev).toBeCloseTo(0, 6);
    expect(r.safetyStock).toBeCloseTo(0, 6);
    expect(r.reorderPoint).toBeCloseTo(140, 6);
    expect(r.expectedShortagePerCycle).toBeCloseTo(0, 6);
  });
});

describe('computeRop — Type-I, σ_L > 0 (rasgele tedarik süresi)', () => {
  it('Chopra-Meindl örneği: μ=2500, σ=500, L=2, σ_L=0.5, α=0.9', () => {
    // Kombine varyans: 2·500² + 2500²·0.5² = 500000 + 1562500 = 2062500
    // σ_DL = √2062500 ≈ 1436.14 → σ_L talep birimine göre baskın
    const r = computeRop({
      demandMean: 2500,
      demandStdDev: 500,
      leadTimeMean: 2,
      leadTimeStdDev: 0.5,
      serviceLevel: 0.9,
      serviceMode: 'type1',
    });
    expect(r.leadTimeDemand).toBeCloseTo(5000, 5);
    expect(r.leadTimeStdDev).toBeCloseTo(1436.14, 1);
    // z_{0.9} ≈ 1.2816
    expect(r.z).toBeCloseTo(1.2816, 3);
    // SS ≈ 1.2816 · 1436.14 ≈ 1840.5
    expect(r.safetyStock).toBeCloseTo(1840.5, 0);
  });

  it('σ_L artışı σ_DL üzerinde μ² katsayısı ile hızla dominant olur', () => {
    const base = computeRop({
      demandMean: 100,
      demandStdDev: 5,
      leadTimeMean: 10,
      leadTimeStdDev: 0,
      serviceLevel: 0.95,
      serviceMode: 'type1',
    });
    const withVarL = computeRop({
      demandMean: 100,
      demandStdDev: 5,
      leadTimeMean: 10,
      leadTimeStdDev: 2,
      serviceLevel: 0.95,
      serviceMode: 'type1',
    });
    // sadece σ_d ile: √10 · 5 ≈ 15.81
    expect(base.leadTimeStdDev).toBeCloseTo(15.811, 2);
    // kombine: √(10·25 + 10000·4) = √40250 ≈ 200.62
    expect(withVarL.leadTimeStdDev).toBeCloseTo(200.62, 1);
    expect(withVarL.safetyStock).toBeGreaterThan(base.safetyStock * 10);
  });
});

describe('computeRop — Type-II fill rate', () => {
  it('β = 0.95, Q = 100, σ_DL = 20 → z solve edilir', () => {
    const r = computeRop({
      demandMean: 100,
      demandStdDev: 10,
      leadTimeMean: 4,
      serviceLevel: 0.95,
      serviceMode: 'type2',
      orderQty: 100,
    });
    // Hedef L(z) = (1 − 0.95) · 100 / 20 = 0.25; L⁻¹(0.25) ≈ 0.35
    expect(r.z).toBeCloseTo(0.35, 1);
    // Gerçekleşen fill rate hedefe eşit olmalı
    expect(r.fillRate).toBeCloseTo(0.95, 3);
  });

  it('Q büyüdükçe aynı β için gereken z (SS) küçülür — büyük lot koruyor', () => {
    const small = computeRop({
      demandMean: 50,
      demandStdDev: 8,
      leadTimeMean: 3,
      serviceLevel: 0.98,
      serviceMode: 'type2',
      orderQty: 50,
    });
    const large = computeRop({
      demandMean: 50,
      demandStdDev: 8,
      leadTimeMean: 3,
      serviceLevel: 0.98,
      serviceMode: 'type2',
      orderQty: 500,
    });
    expect(large.z).toBeLessThan(small.z);
    expect(large.safetyStock).toBeLessThan(small.safetyStock);
    expect(small.fillRate).toBeCloseTo(0.98, 3);
    expect(large.fillRate).toBeCloseTo(0.98, 3);
  });

  it('Type-I ≠ Type-II: aynı %95 hedef genelde farklı SS verir', () => {
    const t1 = computeRop({
      demandMean: 100,
      demandStdDev: 20,
      leadTimeMean: 4,
      serviceLevel: 0.95,
      serviceMode: 'type1',
      orderQty: 200,
    });
    const t2 = computeRop({
      demandMean: 100,
      demandStdDev: 20,
      leadTimeMean: 4,
      serviceLevel: 0.95,
      serviceMode: 'type2',
      orderQty: 200,
    });
    // Fill rate (Type-II) genelde cycle service level'dan daha gevşek bir kısıttır
    // aynı numerik hedef → Type-II daha az SS gerektirir
    expect(t2.safetyStock).toBeLessThan(t1.safetyStock);
  });
});

describe('computeRop — EOQ + toplam maliyet entegrasyonu', () => {
  it('EOQ türetimi: D=10000, K=100, h=2 → Q = 1000', () => {
    const r = computeRop({
      demandMean: 27.4,
      demandStdDev: 5,
      leadTimeMean: 7,
      serviceLevel: 0.95,
      serviceMode: 'type1',
      annualDemand: 10000,
      orderCost: 100,
      holdingCost: 2,
    });
    expect(r.eoq).toBeCloseTo(1000, 3);
    expect(r.orderQty).toBeCloseTo(1000, 3);
    expect(r.ordersPerYear).toBeCloseTo(10, 4);
    expect(r.cycleLength).toBeCloseTo(1000 / 27.4, 3);
  });

  it('Toplam yıllık maliyet = (D/Q)·K + (Q/2)·h + SS·h', () => {
    const r = computeRop({
      demandMean: 27.4,
      demandStdDev: 5,
      leadTimeMean: 7,
      serviceLevel: 0.95,
      serviceMode: 'type1',
      annualDemand: 10000,
      orderCost: 100,
      holdingCost: 2,
    });
    const expected =
      (10000 / (r.orderQty as number)) * 100 +
      ((r.orderQty as number) / 2) * 2 +
      r.safetyStock * 2;
    expect(r.totalAnnualCost).toBeCloseTo(expected, 3);
    expect(r.safetyStockCost).toBeCloseTo(r.safetyStock * 2, 3);
  });

  it('Q override — kullanıcının verdiği Q EOQ yerine kullanılır', () => {
    const r = computeRop({
      demandMean: 10,
      demandStdDev: 2,
      leadTimeMean: 5,
      serviceLevel: 0.9,
      serviceMode: 'type1',
      annualDemand: 3650,
      orderCost: 50,
      holdingCost: 1,
      orderQty: 500,
    });
    expect(r.eoq).toBeCloseTo(Math.sqrt(2 * 3650 * 50), 3);
    expect(r.orderQty).toBe(500);
    expect(r.ordersPerYear).toBeCloseTo(3650 / 500, 4);
  });
});

describe('computeRop — muhasebe kimlikleri', () => {
  it('R = E[DL] + SS = μL + zσ_DL', () => {
    const r = computeRop({
      demandMean: 30,
      demandStdDev: 5,
      leadTimeMean: 6,
      leadTimeStdDev: 1,
      serviceLevel: 0.975,
      serviceMode: 'type1',
    });
    expect(r.reorderPoint).toBeCloseTo(r.leadTimeDemand + r.safetyStock, 6);
    expect(r.safetyStock).toBeCloseTo(r.z * r.leadTimeStdDev, 6);
  });

  it('Type-I cycle service level = Φ(z) = α', () => {
    for (const alpha of [0.8, 0.9, 0.95, 0.99]) {
      const r = computeRop({
        demandMean: 40,
        demandStdDev: 6,
        leadTimeMean: 4,
        serviceLevel: alpha,
        serviceMode: 'type1',
      });
      expect(r.cycleServiceLevel).toBeCloseTo(alpha, 3);
    }
  });

  it('Fill rate: β = 1 − σ_DL·L(z)/Q', () => {
    const r = computeRop({
      demandMean: 100,
      demandStdDev: 15,
      leadTimeMean: 4,
      serviceLevel: 0.95,
      serviceMode: 'type1',
      orderQty: 250,
    });
    const expectedBeta = 1 - r.expectedShortagePerCycle / 250;
    expect(r.fillRate).toBeCloseTo(expectedBeta, 6);
  });

  it('Yüksek α → yüksek SS ve yüksek fill rate (monotoni)', () => {
    let prev = -1;
    let prevBeta = -1;
    for (const alpha of [0.5, 0.8, 0.9, 0.95, 0.99, 0.995]) {
      const r = computeRop({
        demandMean: 60,
        demandStdDev: 8,
        leadTimeMean: 5,
        serviceLevel: alpha,
        serviceMode: 'type1',
        orderQty: 300,
      });
      expect(r.safetyStock).toBeGreaterThan(prev);
      expect(r.fillRate as number).toBeGreaterThan(prevBeta);
      prev = r.safetyStock;
      prevBeta = r.fillRate as number;
    }
  });
});

describe('serviceLevelSweep', () => {
  it('Standart α listesinde tabloyu üretir; z monoton artar', () => {
    const rows = serviceLevelSweep({
      demandMean: 100,
      demandStdDev: 15,
      leadTimeMean: 4,
      serviceLevel: 0.95, // sweep'te overrid ediliyor
      serviceMode: 'type1',
    });
    expect(rows.length).toBe(8);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].z).toBeGreaterThan(rows[i - 1].z);
      expect(rows[i].safetyStock).toBeGreaterThan(rows[i - 1].safetyStock);
      expect(rows[i].reorderPoint).toBeGreaterThan(rows[i - 1].reorderPoint);
    }
  });

  it('Geçersiz α (≤0 veya ≥1) atlanır', () => {
    const rows = serviceLevelSweep(
      {
        demandMean: 10,
        demandStdDev: 2,
        leadTimeMean: 3,
        serviceLevel: 0.9,
        serviceMode: 'type1',
      },
      [0, 0.5, 0.9, 1, 1.5],
    );
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.serviceLevel)).toEqual([0.5, 0.9]);
  });
});

describe('validation', () => {
  it('demandMean ≤ 0 → hata', () => {
    expect(() =>
      computeRop({
        demandMean: 0,
        demandStdDev: 1,
        leadTimeMean: 1,
        serviceLevel: 0.9,
        serviceMode: 'type1',
      }),
    ).toThrow(RopError);
  });
  it('demandStdDev < 0 → hata', () => {
    expect(() =>
      computeRop({
        demandMean: 10,
        demandStdDev: -1,
        leadTimeMean: 1,
        serviceLevel: 0.9,
        serviceMode: 'type1',
      }),
    ).toThrow(/negatif/);
  });
  it('L ≤ 0 → hata', () => {
    expect(() =>
      computeRop({
        demandMean: 10,
        demandStdDev: 1,
        leadTimeMean: 0,
        serviceLevel: 0.9,
        serviceMode: 'type1',
      }),
    ).toThrow(/tedarik süresi/i);
  });
  it('serviceLevel dışarıda (0,1) → hata', () => {
    expect(() =>
      computeRop({
        demandMean: 10,
        demandStdDev: 1,
        leadTimeMean: 1,
        serviceLevel: 1,
        serviceMode: 'type1',
      }),
    ).toThrow(/servis seviyesi/i);
    expect(() =>
      computeRop({
        demandMean: 10,
        demandStdDev: 1,
        leadTimeMean: 1,
        serviceLevel: 0,
        serviceMode: 'type1',
      }),
    ).toThrow();
  });
  it('Type-II ama Q yok → hata', () => {
    expect(() =>
      computeRop({
        demandMean: 10,
        demandStdDev: 1,
        leadTimeMean: 1,
        serviceLevel: 0.95,
        serviceMode: 'type2',
      }),
    ).toThrow(/Q/);
  });
  it('NaN input reddedilir', () => {
    expect(() =>
      computeRop({
        demandMean: Number.NaN,
        demandStdDev: 1,
        leadTimeMean: 1,
        serviceLevel: 0.9,
        serviceMode: 'type1',
      }),
    ).toThrow();
  });
  it('holdingCost ≤ 0 → hata (EOQ modu)', () => {
    expect(() =>
      computeRop({
        demandMean: 10,
        demandStdDev: 1,
        leadTimeMean: 1,
        serviceLevel: 0.9,
        serviceMode: 'type1',
        annualDemand: 100,
        orderCost: 10,
        holdingCost: 0,
      }),
    ).toThrow();
  });
});
