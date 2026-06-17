import { describe, expect, it } from 'vitest';
import {
  BimatrixError,
  MAX_DIM_SUM,
  findNashEquilibria,
  findPureNash,
  validateBimatrix,
} from './bimatrix';

const close = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps;

describe('findPureNash', () => {
  it('Prisoner\'s Dilemma — tek saf Nash (defect, defect)', () => {
    /* Klasik PD: C/D = (1) Cooperate, (2) Defect.
     * A (Row):   [(C,C)=3, (C,D)=0; (D,C)=5, (D,D)=1]
     * B (Col):   [(C,C)=3, (C,D)=5; (D,C)=0, (D,D)=1]
     * Tek Nash: (D, D) = (1, 1). */
    const A = [
      [3, 0],
      [5, 1],
    ];
    const B = [
      [3, 5],
      [0, 1],
    ];
    const pure = findPureNash(A, B);
    expect(pure).toHaveLength(1);
    expect(pure[0].row).toBe(1);
    expect(pure[0].col).toBe(1);
    expect(pure[0].payoffRow).toBe(1);
    expect(pure[0].payoffCol).toBe(1);
  });

  it('Cinsiyet Savaşı (Battle of Sexes) — iki saf Nash', () => {
    /* (Bach, Bach) ve (Stravinsky, Stravinsky). */
    const A = [
      [3, 0],
      [0, 2],
    ];
    const B = [
      [2, 0],
      [0, 3],
    ];
    const pure = findPureNash(A, B);
    expect(pure).toHaveLength(2);
    const cells = pure.map((p) => `${p.row}-${p.col}`).sort();
    expect(cells).toEqual(['0-0', '1-1']);
  });

  it('Matching Pennies — sıfır toplam, saf Nash yok', () => {
    const A = [
      [1, -1],
      [-1, 1],
    ];
    const B = [
      [-1, 1],
      [1, -1],
    ];
    expect(findPureNash(A, B)).toHaveLength(0);
  });

  it('Şahin-Güvercin — iki asimetrik saf Nash', () => {
    /* (Şahin, Güvercin) ve (Güvercin, Şahin) — Şahin=0, Güvercin=1.
     * V = 4 (ödül), C = 6 (yaralanma maliyeti).
     * A: payoff[Hawk, Hawk] = (V-C)/2 = -1, payoff[Hawk, Dove] = V = 4,
     *    payoff[Dove, Hawk] = 0, payoff[Dove, Dove] = V/2 = 2.
     * B simetrik (genel toplam ≠ sıfır). */
    const A = [
      [-1, 4],
      [0, 2],
    ];
    const B = [
      [-1, 0],
      [4, 2],
    ];
    const pure = findPureNash(A, B);
    expect(pure).toHaveLength(2);
    const cells = new Set(pure.map((p) => `${p.row}-${p.col}`));
    expect(cells.has('0-1')).toBe(true);
    expect(cells.has('1-0')).toBe(true);
  });
});

describe('findNashEquilibria — saf + karışık', () => {
  it('Prisoner\'s Dilemma — sadece (D,D) bulunur', () => {
    const A = [
      [3, 0],
      [5, 1],
    ];
    const B = [
      [3, 5],
      [0, 1],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    expect(res.equilibria).toHaveLength(1);
    const eq = res.equilibria[0];
    expect(eq.kind).toBe('pure');
    expect(eq.rowStrategy).toEqual([0, 1]);
    expect(eq.colStrategy).toEqual([0, 1]);
    expect(close(eq.payoffRow, 1)).toBe(true);
    expect(close(eq.payoffCol, 1)).toBe(true);
  });

  it('Cinsiyet Savaşı — 3 Nash (2 saf + 1 karışık)', () => {
    const A = [
      [3, 0],
      [0, 2],
    ];
    const B = [
      [2, 0],
      [0, 3],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    expect(res.equilibria).toHaveLength(3);
    const purestrats = res.equilibria.filter((e) => e.kind === 'pure');
    const mixed = res.equilibria.filter((e) => e.kind === 'mixed');
    expect(purestrats).toHaveLength(2);
    expect(mixed).toHaveLength(1);
    /* Karışık: x* = (3/5, 2/5), y* = (2/5, 3/5).
     * R indifference: 3·y₁ + 0·y₂ = 0·y₁ + 2·y₂ ⇒ y₁ = 2/5.
     * C indifference: 2·x₁ + 0·x₂ = 0·x₁ + 3·x₂ ⇒ x₁ = 3/5. */
    const mix = mixed[0];
    expect(close(mix.rowStrategy[0], 3 / 5)).toBe(true);
    expect(close(mix.rowStrategy[1], 2 / 5)).toBe(true);
    expect(close(mix.colStrategy[0], 2 / 5)).toBe(true);
    expect(close(mix.colStrategy[1], 3 / 5)).toBe(true);
    /* Karışık Nash'te beklenen kazanç u = 3·(2/5) = 6/5, v = 2·(3/5) = 6/5. */
    expect(close(mix.payoffRow, 6 / 5)).toBe(true);
    expect(close(mix.payoffCol, 6 / 5)).toBe(true);
  });

  it('Matching Pennies — tek karışık Nash (½, ½)', () => {
    const A = [
      [1, -1],
      [-1, 1],
    ];
    const B = [
      [-1, 1],
      [1, -1],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    expect(res.equilibria).toHaveLength(1);
    const eq = res.equilibria[0];
    expect(eq.kind).toBe('mixed');
    expect(close(eq.rowStrategy[0], 0.5)).toBe(true);
    expect(close(eq.rowStrategy[1], 0.5)).toBe(true);
    expect(close(eq.colStrategy[0], 0.5)).toBe(true);
    expect(close(eq.colStrategy[1], 0.5)).toBe(true);
    expect(close(eq.payoffRow, 0)).toBe(true);
    expect(close(eq.payoffCol, 0)).toBe(true);
  });

  it('Taş-Kağıt-Makas — tek karışık Nash (1/3, 1/3, 1/3)', () => {
    /* Sıfır toplam: B = −A. */
    const A = [
      [0, -1, 1],
      [1, 0, -1],
      [-1, 1, 0],
    ];
    const B = A.map((row) => row.map((v) => -v));
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    const mixed = res.equilibria.filter((e) => e.kind === 'mixed');
    expect(mixed.length).toBeGreaterThanOrEqual(1);
    /* En az birinin (1/3, 1/3, 1/3) olduğunu doğrula. */
    const symmetric = mixed.find(
      (e) =>
        close(e.rowStrategy[0], 1 / 3) &&
        close(e.rowStrategy[1], 1 / 3) &&
        close(e.rowStrategy[2], 1 / 3) &&
        close(e.colStrategy[0], 1 / 3) &&
        close(e.colStrategy[1], 1 / 3) &&
        close(e.colStrategy[2], 1 / 3),
    );
    expect(symmetric).toBeDefined();
    expect(close(symmetric!.payoffRow, 0)).toBe(true);
    expect(close(symmetric!.payoffCol, 0)).toBe(true);
  });

  it('Stag Hunt — iki saf Nash + bir karışık', () => {
    /* Klasik koordinasyon: (Stag, Stag) = (4, 4), (Hare, Hare) = (3, 3),
     * tek başına Stag çok kötü. */
    const A = [
      [4, 0],
      [3, 3],
    ];
    const B = [
      [4, 3],
      [0, 3],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    expect(res.equilibria.length).toBeGreaterThanOrEqual(2);
    const pure = res.equilibria.filter((e) => e.kind === 'pure');
    expect(pure).toHaveLength(2);
  });

  it('Saf Nash beklenen kazançları doğru kodlar', () => {
    const A = [
      [3, 0],
      [5, 1],
    ];
    const B = [
      [3, 5],
      [0, 1],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    const pd = res.equilibria[0];
    /* x^T A y = A[1][1] = 1 (deterministic). */
    let uCheck = 0,
      vCheck = 0;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        uCheck += pd.rowStrategy[i] * A[i][j] * pd.colStrategy[j];
        vCheck += pd.rowStrategy[i] * B[i][j] * pd.colStrategy[j];
      }
    }
    expect(close(uCheck, 1)).toBe(true);
    expect(close(vCheck, 1)).toBe(true);
  });

  it('Strateji olasılıkları toplamı = 1 (her dengede)', () => {
    const A = [
      [3, 0],
      [0, 2],
    ];
    const B = [
      [2, 0],
      [0, 3],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    for (const eq of res.equilibria) {
      const sx = eq.rowStrategy.reduce((s, v) => s + v, 0);
      const sy = eq.colStrategy.reduce((s, v) => s + v, 0);
      expect(close(sx, 1)).toBe(true);
      expect(close(sy, 1)).toBe(true);
      expect(eq.rowStrategy.every((p) => p >= -1e-9)).toBe(true);
      expect(eq.colStrategy.every((p) => p >= -1e-9)).toBe(true);
    }
  });

  it('Off-support best-response koşulu doğrulanır (3×3, asimetrik dominant)', () => {
    /* R için satır 0 strictly dominant ise (R, *) saf denge olmalı. */
    const A = [
      [10, 10, 10],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const B = [
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ];
    /* C için sütun 2 dominant. Tek Nash: (0, 2). */
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    const pureNash = res.equilibria.find((e) => e.kind === 'pure');
    expect(pureNash).toBeDefined();
    expect(pureNash!.rowStrategy[0]).toBe(1);
    expect(pureNash!.colStrategy[2]).toBe(1);
  });

  it('3×3 koordinasyon oyunu — 3 saf denge köşegende', () => {
    const A = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const B = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    const pure = res.equilibria.filter((e) => e.kind === 'pure');
    expect(pure).toHaveLength(3);
    /* Köşegendekiler. */
    const cells = pure.map((p) => `${p.supportRow[0]}-${p.supportCol[0]}`).sort();
    expect(cells).toEqual(['0-0', '1-1', '2-2']);
  });

  it('Determinist: aynı girdi aynı sıralı çıktıyı verir', () => {
    const A = [
      [3, 0],
      [0, 2],
    ];
    const B = [
      [2, 0],
      [0, 3],
    ];
    const a = findNashEquilibria({ payoffA: A, payoffB: B });
    const b = findNashEquilibria({ payoffA: A, payoffB: B });
    expect(a.equilibria.length).toBe(b.equilibria.length);
    for (let i = 0; i < a.equilibria.length; i++) {
      expect(a.equilibria[i].rowStrategy).toEqual(b.equilibria[i].rowStrategy);
      expect(a.equilibria[i].colStrategy).toEqual(b.equilibria[i].colStrategy);
    }
  });

  it('Çok büyük matris truncate edilir (m + n > MAX_DIM_SUM)', () => {
    const big = (m: number, n: number): number[][] =>
      Array.from({ length: m }, () => Array.from({ length: n }, () => 1));
    const res = findNashEquilibria({
      payoffA: big(MAX_DIM_SUM, MAX_DIM_SUM),
      payoffB: big(MAX_DIM_SUM, MAX_DIM_SUM),
    });
    expect(res.truncated).toBe(true);
    expect(res.equilibria).toHaveLength(0);
  });

  it('Support indeksleri artan sıralı', () => {
    const A = [
      [3, 0],
      [0, 2],
    ];
    const B = [
      [2, 0],
      [0, 3],
    ];
    const res = findNashEquilibria({ payoffA: A, payoffB: B });
    for (const eq of res.equilibria) {
      for (let i = 1; i < eq.supportRow.length; i++) {
        expect(eq.supportRow[i]).toBeGreaterThan(eq.supportRow[i - 1]);
      }
      for (let i = 1; i < eq.supportCol.length; i++) {
        expect(eq.supportCol[i]).toBeGreaterThan(eq.supportCol[i - 1]);
      }
    }
  });
});

describe('validateBimatrix — hata durumları', () => {
  it('boş A reddedilir', () => {
    expect(() => validateBimatrix({ payoffA: [], payoffB: [] })).toThrow(BimatrixError);
  });

  it('A ve B farklı satır sayısı reddedilir', () => {
    expect(() =>
      validateBimatrix({
        payoffA: [[1, 2]],
        payoffB: [
          [1, 2],
          [3, 4],
        ],
      }),
    ).toThrow(BimatrixError);
  });

  it('A ve B sütun sayısı uyumsuzluğu reddedilir', () => {
    expect(() =>
      validateBimatrix({
        payoffA: [[1, 2]],
        payoffB: [[1, 2, 3]],
      }),
    ).toThrow(BimatrixError);
  });

  it('Ragged satır reddedilir', () => {
    expect(() =>
      validateBimatrix({
        payoffA: [
          [1, 2],
          [3],
        ],
        payoffB: [
          [1, 2],
          [3, 4],
        ],
      }),
    ).toThrow(BimatrixError);
  });

  it('Sonsuz değer reddedilir', () => {
    expect(() =>
      validateBimatrix({
        payoffA: [[1, Number.POSITIVE_INFINITY]],
        payoffB: [[1, 2]],
      }),
    ).toThrow(BimatrixError);
  });

  it('Mismatch rowNames reddedilir', () => {
    expect(() =>
      validateBimatrix({
        payoffA: [[1, 2]],
        payoffB: [[1, 2]],
        rowNames: ['a', 'b'],
      }),
    ).toThrow(BimatrixError);
  });

  it('Mismatch colNames reddedilir', () => {
    expect(() =>
      validateBimatrix({
        payoffA: [[1, 2]],
        payoffB: [[1, 2]],
        colNames: ['a', 'b', 'c'],
      }),
    ).toThrow(BimatrixError);
  });
});
