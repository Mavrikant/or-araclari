import { describe, expect, it } from 'vitest';
import { lemkeHowson, lemkeHowsonAllDrops, LemkeError } from './lemke-howson';

const APPROX = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

function arrApprox(x: number[], y: number[], eps = 1e-6): boolean {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (!APPROX(x[i], y[i], eps)) return false;
  return true;
}

function probValid(x: number[]): boolean {
  if (x.length === 0) return false;
  let s = 0;
  for (const v of x) {
    if (!Number.isFinite(v) || v < -1e-9) return false;
    s += v;
  }
  return APPROX(s, 1, 1e-6);
}

describe('lemkeHowson — temel doğru oyunlar', () => {
  it('Tutuklu Açmazı: tek baskın denge (D, D)', () => {
    /* Standart pozitif PD: yıllar yerine "swap aldığın yıl" payoff. */
    const A = [
      [3, 0],
      [5, 1],
    ];
    const B = [
      [3, 5],
      [0, 1],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.status).toBe('found');
    expect(res.equilibrium).not.toBeNull();
    expect(res.equilibrium!.kind).toBe('pure');
    expect(arrApprox(res.equilibrium!.rowStrategy, [0, 1])).toBe(true);
    expect(arrApprox(res.equilibrium!.colStrategy, [0, 1])).toBe(true);
    expect(APPROX(res.equilibrium!.payoffRow, 1)).toBe(true);
    expect(APPROX(res.equilibrium!.payoffCol, 1)).toBe(true);
  });

  it('Cinsiyet Savaşı: dropLabel=1 saf dengelerden birini bulur', () => {
    const A = [
      [2, 0],
      [0, 1],
    ];
    const B = [
      [1, 0],
      [0, 2],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.status).toBe('found');
    expect(res.equilibrium).not.toBeNull();
    /* dropLabel 1 → R'ın x_1 etiketi düşer, (R1, C1) saf dengesine ulaşır. */
    expect(res.equilibrium!.kind).toBe('pure');
    const eq = res.equilibrium!;
    /* Pure NE'nin biri: (R0, C0) ya da (R1, C1). */
    const isFirst = arrApprox(eq.rowStrategy, [1, 0]) && arrApprox(eq.colStrategy, [1, 0]);
    const isSecond = arrApprox(eq.rowStrategy, [0, 1]) && arrApprox(eq.colStrategy, [0, 1]);
    expect(isFirst || isSecond).toBe(true);
  });

  it('Matching Pennies: tek karışık denge (1/2, 1/2)', () => {
    const A = [
      [1, -1],
      [-1, 1],
    ];
    const B = [
      [-1, 1],
      [1, -1],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.status).toBe('found');
    expect(res.equilibrium!.kind).toBe('mixed');
    expect(arrApprox(res.equilibrium!.rowStrategy, [0.5, 0.5])).toBe(true);
    expect(arrApprox(res.equilibrium!.colStrategy, [0.5, 0.5])).toBe(true);
    expect(APPROX(res.equilibrium!.payoffRow, 0)).toBe(true);
    expect(APPROX(res.equilibrium!.payoffCol, 0)).toBe(true);
  });

  it('Stag Hunt: dropLabel ile saf dengelerden birine ulaşılır', () => {
    const A = [
      [3, 0],
      [2, 2],
    ];
    const B = [
      [3, 2],
      [0, 2],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.status).toBe('found');
    expect(res.equilibrium!.kind).toBe('pure');
  });

  it('Tavuk Oyunu: dropLabel ile asimetrik saf denge bulunur', () => {
    const A = [
      [0, -1],
      [1, -10],
    ];
    const B = [
      [0, 1],
      [-1, -10],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.status).toBe('found');
    const eq = res.equilibrium!;
    /* Saf dengelerin biri: (R0, C1) veya (R1, C0). */
    const isS_D = arrApprox(eq.rowStrategy, [1, 0]) && arrApprox(eq.colStrategy, [0, 1]);
    const isD_S = arrApprox(eq.rowStrategy, [0, 1]) && arrApprox(eq.colStrategy, [1, 0]);
    expect(isS_D || isD_S).toBe(true);
  });

  it('Sıfır-toplamlı 2x2 (negatif girişli): kaydırma sonrası doğru karışık denge', () => {
    /* Same as matching pennies but ensure shift doesn't alter strategy. */
    const A = [
      [2, -2],
      [-2, 2],
    ];
    const B = [
      [-2, 2],
      [2, -2],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 2 });
    expect(res.status).toBe('found');
    expect(arrApprox(res.equilibrium!.rowStrategy, [0.5, 0.5])).toBe(true);
    expect(arrApprox(res.equilibrium!.colStrategy, [0.5, 0.5])).toBe(true);
    expect(res.shift.a).toBeGreaterThan(0);
    expect(res.shift.b).toBeGreaterThan(0);
    expect(APPROX(res.equilibrium!.payoffRow, 0)).toBe(true);
  });
});

describe('lemkeHowson — özellikler ve değişmezler', () => {
  it('strateji vektörleri her zaman ∈ Δ (≥0, toplam=1)', () => {
    const games = [
      { A: [[3, 0], [5, 1]], B: [[3, 5], [0, 1]] },
      { A: [[2, 0], [0, 1]], B: [[1, 0], [0, 2]] },
      { A: [[1, -1], [-1, 1]], B: [[-1, 1], [1, -1]] },
      { A: [[5, 4, 3], [1, 2, 6]], B: [[2, 1, 0], [3, 4, 5]] },
    ];
    for (const g of games) {
      for (let k = 1; k <= g.A.length + g.A[0].length; k++) {
        const res = lemkeHowson({ payoffA: g.A, payoffB: g.B, dropLabel: k });
        if (res.status === 'found') {
          expect(probValid(res.equilibrium!.rowStrategy)).toBe(true);
          expect(probValid(res.equilibrium!.colStrategy)).toBe(true);
        }
      }
    }
  });

  it('support indeksleri pozitif olasılıklı koordinatlarla eşleşir', () => {
    const A = [
      [3, 0],
      [5, 1],
    ];
    const B = [
      [3, 5],
      [0, 1],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    const eq = res.equilibrium!;
    for (const i of eq.supportRow) expect(eq.rowStrategy[i]).toBeGreaterThan(1e-7);
    for (const j of eq.supportCol) expect(eq.colStrategy[j]).toBeGreaterThan(1e-7);
  });

  it('payoffRow = x^T A y (kaydırılmamış)', () => {
    const A = [
      [4, 1],
      [0, 3],
    ];
    const B = [
      [3, 0],
      [1, 2],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    const eq = res.equilibrium!;
    let expected = 0;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) expected += eq.rowStrategy[i] * A[i][j] * eq.colStrategy[j];
    expect(APPROX(eq.payoffRow, expected)).toBe(true);
  });

  it('bulunan strateji en-iyi-yanıt indifference koşulunu sağlar (karışık)', () => {
    /* Karışık dengede support'taki tüm satır indeksleri eşit kazanç sağlamalı:
     * (A y)_i = u  ∀ i ∈ supp(x). */
    const A = [
      [2, 0],
      [0, 1],
    ];
    const B = [
      [1, 0],
      [0, 2],
    ];
    /* dropLabel=3 → karışık denge bulunmasını dene. */
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 3 });
    if (res.status === 'found' && res.equilibrium!.kind === 'mixed') {
      const eq = res.equilibrium!;
      let u = 0;
      for (let j = 0; j < 2; j++) u += A[eq.supportRow[0]][j] * eq.colStrategy[j];
      for (const i of eq.supportRow) {
        let val = 0;
        for (let j = 0; j < 2; j++) val += A[i][j] * eq.colStrategy[j];
        expect(APPROX(val, u, 1e-5)).toBe(true);
      }
    }
  });

  it('3x3 simetrik oyun: ulaşılan denge geçerli', () => {
    /* Pozitif 3x3. */
    const A = [
      [3, 1, 1],
      [1, 3, 1],
      [1, 1, 3],
    ];
    const B = [
      [3, 1, 1],
      [1, 3, 1],
      [1, 1, 3],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.status).toBe('found');
    expect(probValid(res.equilibrium!.rowStrategy)).toBe(true);
    expect(probValid(res.equilibrium!.colStrategy)).toBe(true);
  });

  it('asimetrik 2x3 oyun: ulaşılan denge geçerli', () => {
    const A = [
      [1, 2, 3],
      [4, 0, 1],
    ];
    const B = [
      [3, 1, 2],
      [0, 4, 1],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.status).toBe('found');
    const eq = res.equilibrium!;
    expect(probValid(eq.rowStrategy)).toBe(true);
    expect(probValid(eq.colStrategy)).toBe(true);
    expect(eq.rowStrategy.length).toBe(2);
    expect(eq.colStrategy.length).toBe(3);
  });

  it('asimetrik 3x2 oyun: ulaşılan denge geçerli', () => {
    const A = [
      [2, 1],
      [0, 3],
      [4, 0],
    ];
    const B = [
      [1, 2],
      [3, 0],
      [0, 4],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 2 });
    expect(res.status).toBe('found');
    expect(res.equilibrium!.rowStrategy.length).toBe(3);
    expect(res.equilibrium!.colStrategy.length).toBe(2);
  });
});

describe('lemkeHowson — dropLabel ve adım sayımı', () => {
  it('farklı dropLabel farklı denge bulabilir (BoS)', () => {
    const A = [
      [2, 0],
      [0, 1],
    ];
    const B = [
      [1, 0],
      [0, 2],
    ];
    const eqs = new Set<string>();
    for (let k = 1; k <= 4; k++) {
      const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: k });
      if (res.status === 'found') {
        eqs.add(
          res.equilibrium!.rowStrategy.map((v) => v.toFixed(4)).join(',') +
            '|' +
            res.equilibrium!.colStrategy.map((v) => v.toFixed(4)).join(','),
        );
      }
    }
    /* BoS'ta 3 NE var (2 saf + 1 karışık). Lemke-Howson hepsini bulmak
     * zorunda değil ama en az 2 farklı bulunmalı. */
    expect(eqs.size).toBeGreaterThanOrEqual(2);
  });

  it('pivot adımları sayılır ve doludur', () => {
    const A = [
      [1, -1],
      [-1, 1],
    ];
    const B = [
      [-1, 1],
      [1, -1],
    ];
    const res = lemkeHowson({ payoffA: A, payoffB: B, dropLabel: 1 });
    expect(res.steps.length).toBeGreaterThan(0);
    expect(res.pivots).toBe(res.steps.length);
    expect(res.dropLabel0).toBe(0);
    /* Adımların yan tarafları alternate eder. */
    for (let i = 1; i < res.steps.length; i++) {
      expect(res.steps[i].side).not.toBe(res.steps[i - 1].side);
    }
  });
});

describe('lemkeHowsonAllDrops — birden çok denge bulma', () => {
  it('BoS\'ta birden çok denge bulur', () => {
    const A = [
      [2, 0],
      [0, 1],
    ];
    const B = [
      [1, 0],
      [0, 2],
    ];
    const { equilibria, results } = lemkeHowsonAllDrops({ payoffA: A, payoffB: B });
    expect(results.length).toBe(4);
    expect(equilibria.length).toBeGreaterThanOrEqual(2);
    for (const eq of equilibria) {
      expect(probValid(eq.rowStrategy)).toBe(true);
      expect(probValid(eq.colStrategy)).toBe(true);
    }
  });

  it('PD\'de hepsinde aynı saf dengeye ulaşılır', () => {
    const A = [
      [3, 0],
      [5, 1],
    ];
    const B = [
      [3, 5],
      [0, 1],
    ];
    const { equilibria } = lemkeHowsonAllDrops({ payoffA: A, payoffB: B });
    expect(equilibria.length).toBe(1);
    expect(arrApprox(equilibria[0].rowStrategy, [0, 1])).toBe(true);
    expect(arrApprox(equilibria[0].colStrategy, [0, 1])).toBe(true);
  });
});

describe('lemkeHowson — doğrulama hataları', () => {
  it('dropLabel aralık dışı', () => {
    expect(() =>
      lemkeHowson({ payoffA: [[1, 2], [3, 4]], payoffB: [[1, 2], [3, 4]], dropLabel: 0 }),
    ).toThrow(LemkeError);
    expect(() =>
      lemkeHowson({ payoffA: [[1, 2], [3, 4]], payoffB: [[1, 2], [3, 4]], dropLabel: 5 }),
    ).toThrow(LemkeError);
  });

  it('boş matris reddedilir', () => {
    expect(() => lemkeHowson({ payoffA: [], payoffB: [] })).toThrow();
  });

  it('boyut uyumsuzluğu reddedilir', () => {
    expect(() =>
      lemkeHowson({
        payoffA: [[1, 2]],
        payoffB: [[1, 2], [3, 4]],
      }),
    ).toThrow();
  });

  it('non-finite değer reddedilir', () => {
    expect(() =>
      lemkeHowson({ payoffA: [[1, NaN], [3, 4]], payoffB: [[1, 2], [3, 4]] }),
    ).toThrow();
  });
});
