import { describe, it, expect } from 'vitest';
import { solveDecision, DecisionError } from './decision';

// Klasik Render-Stair-Hanna örneği (Thompson Lumber).
// Alternatifler: large plant, small plant, do nothing
// Durumlar: favorable, unfavorable
const THOMPSON = {
  payoffs: [
    [200_000, -180_000],
    [100_000, -20_000],
    [0, 0],
  ],
  alternatives: ['Büyük tesis', 'Küçük tesis', 'Hiçbir şey yapma'],
  states: ['Talep yüksek', 'Talep düşük'],
};

describe('solveDecision — belirsizlik altında kriterler', () => {
  it('Thompson Lumber — Maximax / Maximin / Laplace tutarlılığı', () => {
    const r = solveDecision(THOMPSON);
    // Maximax: büyük tesis 200k.
    expect(r.maximax.value).toBe(200_000);
    expect(r.maximax.index).toBe(0);
    // Maximin (Wald): "hiçbir şey yapma" — en kötüsü 0, hâlâ en iyi.
    expect(r.maximin.value).toBe(0);
    expect(r.maximin.index).toBe(2);
    // Laplace: ortalama. Büyük: 10_000, Küçük: 40_000, Hiçbir şey: 0 → küçük tesis kazanır.
    expect(r.laplace.value).toBe(40_000);
    expect(r.laplace.index).toBe(1);
  });

  it('Hurwicz α=0.8 — iyimser ağırlıkla büyük tesis kazanır', () => {
    const r = solveDecision({ ...THOMPSON, alpha: 0.8 });
    // Büyük: 0.8·200_000 + 0.2·(-180_000) = 160_000 - 36_000 = 124_000.
    // Küçük: 0.8·100_000 + 0.2·(-20_000) = 80_000 - 4_000 = 76_000.
    // Hiçbir şey: 0.
    expect(r.hurwicz.value).toBeCloseTo(124_000, 6);
    expect(r.hurwicz.index).toBe(0);
    expect(r.hurwicz.alpha).toBe(0.8);
  });

  it('Hurwicz α=0.2 — kötümser ağırlıkla "hiçbir şey yapma" kazanır', () => {
    const r = solveDecision({ ...THOMPSON, alpha: 0.2 });
    // Büyük: 0.2·200_000 + 0.8·(-180_000) = 40_000 - 144_000 = -104_000.
    // Küçük: 0.2·100_000 + 0.8·(-20_000) = 20_000 - 16_000 = 4_000.
    // Hiçbir şey: 0.
    expect(r.hurwicz.value).toBeCloseTo(4_000, 6);
    expect(r.hurwicz.index).toBe(1);
  });

  it('Savage Regret matrisi ve minimax regret seçimi doğru', () => {
    const r = solveDecision(THOMPSON);
    // Sütun max: durum 1 → 200_000, durum 2 → 0.
    // Regret = colBest − payoff (max modu).
    expect(r.regret.regretMatrix).toEqual([
      [0, 180_000],
      [100_000, 20_000],
      [200_000, 0],
    ]);
    // Satır max regret'leri: 180_000, 100_000, 200_000.
    // Min(maxRegret) → küçük tesis (100_000).
    expect(r.regret.value).toBe(100_000);
    expect(r.regret.index).toBe(1);
  });
});

describe('solveDecision — risk altında (olasılıklarla)', () => {
  const PROB = [0.5, 0.5];

  it('Thompson Lumber, p=(0.5, 0.5) → EMV ve EVPI', () => {
    const r = solveDecision({ ...THOMPSON, probabilities: PROB });
    // EMV: büyük = 10_000, küçük = 40_000, hiçbir şey = 0.
    expect(r.emv).toEqual([10_000, 40_000, 0]);
    expect(r.emvBest!.value).toBe(40_000);
    expect(r.emvBest!.index).toBe(1);
    // EVwPI = 0.5·200_000 + 0.5·0 = 100_000.
    expect(r.evWithPi).toBeCloseTo(100_000, 6);
    // EVPI = EVwPI − EMV* = 100_000 - 40_000 = 60_000.
    expect(r.evpi).toBeCloseTo(60_000, 6);
  });

  it('EOL minimize sonucu EMV maximize ile aynı alternatife götürür', () => {
    const r = solveDecision({ ...THOMPSON, probabilities: PROB });
    expect(r.eol).not.toBeNull();
    expect(r.eolBest!.index).toBe(r.emvBest!.index);
    // EOL* + EMV* = EVwPI sağlaması.
    expect(r.eolBest!.value + r.emvBest!.value).toBeCloseTo(r.evWithPi!, 6);
    // EVPI ≡ min EOL (klasik özdeşlik).
    expect(r.evpi).toBeCloseTo(r.eolBest!.value, 6);
  });

  it('olasılık verilmezse risk altı alanlar null kalır', () => {
    const r = solveDecision(THOMPSON);
    expect(r.hasProbabilities).toBe(false);
    expect(r.emv).toBeNull();
    expect(r.emvBest).toBeNull();
    expect(r.eol).toBeNull();
    expect(r.eolBest).toBeNull();
    expect(r.evWithPi).toBeNull();
    expect(r.evpi).toBeNull();
  });
});

describe('solveDecision — min (maliyet) modu', () => {
  // Üç tedarikçi × üç senaryo birim maliyet matrisi (TL/birim).
  // Düşük daha iyi.
  const supply = {
    payoffs: [
      [12, 18, 25], // A
      [10, 22, 20], // B
      [14, 16, 19], // C
    ],
    direction: 'min' as const,
  };

  it('Maximin (min modu) = her satırın en kötüsü, sonra en düşüğü', () => {
    // Her satırın en kötüsü (en yüksek maliyet): 25, 22, 19. Min → C (19).
    const r = solveDecision(supply);
    expect(r.maximin.value).toBe(19);
    expect(r.maximin.index).toBe(2);
  });

  it('Maximax (min modu) = her satırın en iyisi (en düşük maliyet), sonra en düşüğü', () => {
    // En iyi maliyetler: 12, 10, 14. Min → B (10).
    const r = solveDecision(supply);
    expect(r.maximax.value).toBe(10);
    expect(r.maximax.index).toBe(1);
  });

  it('Laplace (min modu) = ortalama maliyet en düşük olan', () => {
    // Ortalamalar: 55/3, 52/3, 49/3 → C kazanır.
    const r = solveDecision(supply);
    expect(r.laplace.value).toBeCloseTo(49 / 3, 6);
    expect(r.laplace.index).toBe(2);
  });

  it('EMV (min modu) ve EVPI sağlaması — eşit olasılık', () => {
    const r = solveDecision({ ...supply, probabilities: [1 / 3, 1 / 3, 1 / 3] });
    // EMV = satır ortalaması.
    expect(r.emv![0]).toBeCloseTo(55 / 3, 6);
    expect(r.emv![1]).toBeCloseTo(52 / 3, 6);
    expect(r.emv![2]).toBeCloseTo(49 / 3, 6);
    // Min EMV → C.
    expect(r.emvBest!.index).toBe(2);
    // EVwPI: her durumda en iyi (en düşük) maliyetin beklentisi.
    // Durum 1: min(12,10,14)=10. Durum 2: min(18,22,16)=16. Durum 3: min(25,20,19)=19.
    // EVwPI = (10+16+19)/3 = 45/3 = 15.
    expect(r.evWithPi).toBeCloseTo(15, 6);
    // EVPI (min modu) = EMV* − EVwPI = 49/3 − 15 = (49−45)/3 ≈ 1.3333.
    expect(r.evpi).toBeCloseTo(4 / 3, 6);
  });
});

describe('solveDecision — kenar durumlar', () => {
  it('tek alternatif × tek durum', () => {
    const r = solveDecision({ payoffs: [[42]] });
    expect(r.maximax.value).toBe(42);
    expect(r.maximin.value).toBe(42);
    expect(r.laplace.value).toBe(42);
    expect(r.hurwicz.value).toBe(42);
    expect(r.regret.regretMatrix).toEqual([[0]]);
  });

  it('tüm satırlar aynı → tüm kriterler beraberlikte buluşur', () => {
    const r = solveDecision({ payoffs: [
      [10, 5],
      [10, 5],
      [10, 5],
    ] });
    expect(r.maximax.tiedIndices).toEqual([0, 1, 2]);
    expect(r.maximin.tiedIndices).toEqual([0, 1, 2]);
    expect(r.laplace.tiedIndices).toEqual([0, 1, 2]);
    expect(r.regret.regretMatrix.every((row) => row.every((v) => v === 0))).toBe(true);
  });

  it('Hurwicz default α = 0.5', () => {
    const r = solveDecision(THOMPSON);
    expect(r.hurwicz.alpha).toBe(0.5);
    // Büyük: 0.5·200_000 + 0.5·(-180_000) = 10_000.
    // Küçük: 0.5·100_000 + 0.5·(-20_000) = 40_000.
    expect(r.hurwicz.value).toBe(40_000);
    expect(r.hurwicz.index).toBe(1);
  });
});

describe('solveDecision — validasyon', () => {
  it('boş payoff matrisini reddeder', () => {
    expect(() => solveDecision({ payoffs: [] })).toThrow(DecisionError);
  });

  it('düzensiz satır uzunluğunu reddeder', () => {
    expect(() => solveDecision({ payoffs: [[1, 2], [3]] })).toThrow(DecisionError);
  });

  it('NaN payoff reddeder', () => {
    expect(() => solveDecision({ payoffs: [[1, Number.NaN]] })).toThrow(DecisionError);
  });

  it('olasılıkların 1 toplamaması durumunu reddeder', () => {
    expect(() =>
      solveDecision({ payoffs: [[1, 2]], probabilities: [0.3, 0.4] }),
    ).toThrow(DecisionError);
  });

  it('negatif olasılığı reddeder', () => {
    expect(() =>
      solveDecision({ payoffs: [[1, 2]], probabilities: [1.1, -0.1] }),
    ).toThrow(DecisionError);
  });

  it('α aralığını [0,1] dışında reddeder', () => {
    expect(() => solveDecision({ payoffs: [[1]], alpha: 1.5 })).toThrow(DecisionError);
    expect(() => solveDecision({ payoffs: [[1]], alpha: -0.1 })).toThrow(DecisionError);
  });

  it('geçersiz yön değerini reddeder', () => {
    // @ts-expect-error — runtime guard testi
    expect(() => solveDecision({ payoffs: [[1]], direction: 'mid' })).toThrow(DecisionError);
  });
});
