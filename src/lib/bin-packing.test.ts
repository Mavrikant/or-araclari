import { describe, it, expect } from 'vitest';
import {
  solveBinPacking,
  parseItems,
  BinPackingError,
  ALGORITHM_LABELS,
  type BinPackingItem,
  type BinPackingAlgorithm,
} from './bin-packing';

const items = (...sizes: number[]): BinPackingItem[] =>
  sizes.map((s, i) => ({ name: `X${i + 1}`, size: s }));

describe('Bin Packing — genel özellikler', () => {
  it.each<BinPackingAlgorithm>([
    'next-fit',
    'first-fit',
    'first-fit-decreasing',
    'best-fit',
    'best-fit-decreasing',
  ])('%s her ögeyi tam olarak bir kutuya atar ve toplam boyutu korur', (algorithm) => {
    const inp = items(4, 5, 3, 6, 2, 7, 1);
    const res = solveBinPacking({ items: inp, capacity: 10, algorithm });

    const seen = new Set<number>();
    let sum = 0;
    for (const bin of res.bins) {
      let binSum = 0;
      for (const it of bin.items) {
        expect(seen.has(it.originalIndex)).toBe(false);
        seen.add(it.originalIndex);
        binSum += it.size;
      }
      expect(binSum).toBeCloseTo(bin.used, 9);
      expect(bin.used).toBeLessThanOrEqual(res.capacity + 1e-9);
      sum += binSum;
    }
    expect(seen.size).toBe(inp.length);
    expect(sum).toBeCloseTo(res.totalSize, 9);
    expect(res.binCount).toBe(res.bins.length);
    expect(res.ratio).toBeGreaterThanOrEqual(1);
  });
});

describe('Next Fit', () => {
  it('sadece son kutuya bakar — 6,5,4,6,7 kapasite 10 → 3 kutu (6|5+4|6+7 x, aslında 6|5,4|6|7 = 4)', () => {
    // Ögeler: 6, 5, 4, 6, 7. Kap = 10.
    // NF: aç kutu1=6 (kalan 4). 5>4 → kutu2=5+4=9. 6>1 → kutu3=6. 7>4 → kutu4=7.
    const res = solveBinPacking({ items: items(6, 5, 4, 6, 7), capacity: 10, algorithm: 'next-fit' });
    expect(res.binCount).toBe(4);
    expect(res.bins[0].items.map((i) => i.size)).toEqual([6]);
    expect(res.bins[1].items.map((i) => i.size)).toEqual([5, 4]);
    expect(res.bins[2].items.map((i) => i.size)).toEqual([6]);
    expect(res.bins[3].items.map((i) => i.size)).toEqual([7]);
  });

  it('boyutu kapasiteye eşit öge tek başına kutu tutar', () => {
    const res = solveBinPacking({ items: items(10, 10, 10), capacity: 10, algorithm: 'next-fit' });
    expect(res.binCount).toBe(3);
    for (const bin of res.bins) expect(bin.used).toBe(10);
  });
});

describe('First Fit', () => {
  it('geriye dönüp önceki kutuları tarar — NF üstünde iyileşme', () => {
    // Aynı input 6,5,4,6,7 kap 10.
    // FF: kutu1=6. 5→kutu1 dolmaz kutu2=5. 4→kutu1 kalan 4=uyar, kutu1=6+4=10.
    //     6→kutu2 kalan 5 uymaz kutu3=6. 7→kutu3 kalan 4 uymaz kutu4=7.
    // Sonuç: {6,4}, {5}, {6}, {7} = 4 kutu.
    // Aslında FF burada NF ile aynı sayıyı verir ama farklı dağılım.
    const res = solveBinPacking({ items: items(6, 5, 4, 6, 7), capacity: 10, algorithm: 'first-fit' });
    expect(res.binCount).toBe(4);
    expect(res.bins[0].items.map((i) => i.size).sort()).toEqual([4, 6]);
  });

  it('Vazirani ders kitabı örneği: 8 öge 0.5..0.7 aralığında', () => {
    // 6 tane 0.6 → her ikisi bir kutuya sığmaz (0.6+0.6=1.2>1); 6 kutu.
    const inp = items(0.6, 0.6, 0.6, 0.6, 0.6, 0.6);
    const res = solveBinPacking({ items: inp, capacity: 1, algorithm: 'first-fit' });
    expect(res.binCount).toBe(6);
    expect(res.lowerBoundL1).toBe(Math.ceil((6 * 0.6) / 1)); // ⌈3.6⌉ = 4
    expect(res.lowerBoundL2).toBe(6); // 0.6 > 0.5 hepsi
    expect(res.lowerBound).toBe(6);
    expect(res.ratio).toBe(1);
  });
});

describe('First Fit Decreasing', () => {
  it('Johnson 1974 klasik örnek: 6 öge {6,5,4,3,2,1} kap 10 → 3 kutu {6+4=10, 5+3+2=10, 1}', () => {
    // FFD: azalan sıra 6,5,4,3,2,1. kutu1=6 kalan 4. 5>4 kutu2=5. 4→kutu1 kalan 0. 3→kutu2 kalan 2. 2→kutu2 kalan 0. 1→kutu3.
    const res = solveBinPacking({ items: items(6, 5, 4, 3, 2, 1), capacity: 10, algorithm: 'first-fit-decreasing' });
    expect(res.binCount).toBe(3);
    expect(res.bins[0].items.map((i) => i.size)).toEqual([6, 4]);
    expect(res.bins[1].items.map((i) => i.size)).toEqual([5, 3, 2]);
    expect(res.bins[2].items.map((i) => i.size)).toEqual([1]);
    expect(res.lowerBoundL1).toBe(Math.ceil((6 + 5 + 4 + 3 + 2 + 1) / 10));
    expect(res.binCount).toBe(res.lowerBoundL1); // Optimum
  });

  it('FFD, aynı input üzerinde FF ya da NF\'ye kıyasla ≤ kutu sayısı verir', () => {
    const inp = items(2, 5, 4, 7, 1, 3, 8);
    const cap = 10;
    const nf = solveBinPacking({ items: inp, capacity: cap, algorithm: 'next-fit' }).binCount;
    const ff = solveBinPacking({ items: inp, capacity: cap, algorithm: 'first-fit' }).binCount;
    const ffd = solveBinPacking({ items: inp, capacity: cap, algorithm: 'first-fit-decreasing' }).binCount;
    expect(ffd).toBeLessThanOrEqual(ff);
    expect(ff).toBeLessThanOrEqual(nf);
  });

  it('kararlı sıralama — aynı boyutlu ögelerin göreli sırası orijinal indekse göre korunur', () => {
    const res = solveBinPacking({
      items: [
        { name: 'A', size: 5 },
        { name: 'B', size: 5 },
        { name: 'C', size: 5 },
        { name: 'D', size: 5 },
      ],
      capacity: 10,
      algorithm: 'first-fit-decreasing',
    });
    // 4 öge, her kutuya 2 sığar → 2 kutu; sıralama azalan (tümü 5) ama orijinal sıra korunur.
    expect(res.binCount).toBe(2);
    expect(res.bins[0].items.map((i) => i.name)).toEqual(['A', 'B']);
    expect(res.bins[1].items.map((i) => i.name)).toEqual(['C', 'D']);
  });
});

describe('Best Fit', () => {
  it('en dolu kutuyu seçer — First Fit\'ten farklı dağılım verebilir', () => {
    // Ögeler: 5, 8, 4, 7, 3. Kap 10.
    // FF: kutu1=5 (kalan 5). 8→kutu2=8 (kalan 2). 4→kutu1=5+4=9 (kalan 1). 7→kutu3=7. 3→kutu3=7+3=10.
    //   sonuç: {5,4},{8},{7,3} = 3 kutu.
    // BF: kutu1=5 (kalan 5). 8→kutu2=8 (kalan 2). 4→uygun kutular: kutu1 (kalan 5) — kutu2 (kalan 2, 4 sığmaz).
    //     en küçük yeter kalan → kutu1. 7→kutu3=7. 3→uygun: kutu2 (kalan 2, uymaz), kutu3 (kalan 3) — kutu3.
    //   sonuç: {5,4},{8},{7,3} = 3 kutu. Aynı.
    const inp = items(5, 8, 4, 7, 3);
    const cap = 10;
    const ff = solveBinPacking({ items: inp, capacity: cap, algorithm: 'first-fit' });
    const bf = solveBinPacking({ items: inp, capacity: cap, algorithm: 'best-fit' });
    expect(ff.binCount).toBe(3);
    expect(bf.binCount).toBe(3);
  });

  it('best-fit avantajı: küçük ögeler sonda gelen dizide', () => {
    // Ögeler: 4, 7, 3, 6. Kap 10.
    // FF: kutu1=4 (6). 7→kutu2=7 (3). 3→kutu1=4+3=7 (3). 6→kutu2=7 kalan 3, uymaz; kutu1 kalan 3 uymaz. kutu3=6. Sonuç 3 kutu.
    // BF: kutu1=4 (6). 7→kutu2=7 (3). 3→kutu2 kalan 3 daha küçük yeter → kutu2=10. 6→kutu1 kalan 6 uyar → kutu1=10. Sonuç 2 kutu.
    const inp = items(4, 7, 3, 6);
    const cap = 10;
    const ff = solveBinPacking({ items: inp, capacity: cap, algorithm: 'first-fit' }).binCount;
    const bf = solveBinPacking({ items: inp, capacity: cap, algorithm: 'best-fit' }).binCount;
    expect(bf).toBe(2);
    expect(ff).toBe(3);
  });
});

describe('Alt sınırlar (L1, L2)', () => {
  it('L1 = ⌈Σ / B⌉ — hacim alt sınırı', () => {
    // Σ = 17, B = 10 → L1 = 2.
    const res = solveBinPacking({ items: items(3, 4, 5, 5), capacity: 10, algorithm: 'first-fit-decreasing' });
    expect(res.totalSize).toBe(17);
    expect(res.lowerBoundL1).toBe(2);
  });

  it('L2 = |{i : s_i > B/2}| — büyük öge alt sınırı', () => {
    // 4 öge > 5 (B=10). L2 = 4.
    const res = solveBinPacking({ items: items(6, 7, 8, 9, 1, 1), capacity: 10, algorithm: 'first-fit-decreasing' });
    expect(res.lowerBoundL2).toBe(4);
  });

  it('lowerBound = max(L1, L2, 1)', () => {
    // Sadece bir 3'lük öge — L1=1, L2=0, lowerBound=1.
    const res = solveBinPacking({ items: items(3), capacity: 10, algorithm: 'first-fit' });
    expect(res.lowerBoundL1).toBe(1);
    expect(res.lowerBoundL2).toBe(0);
    expect(res.lowerBound).toBe(1);
    expect(res.binCount).toBe(1);
  });

  it('ratio (binCount / lowerBound) = 1 optimum çözüm belirtir', () => {
    // FFD tam L1 sınırına oturuyorsa optimum.
    const res = solveBinPacking({ items: items(5, 5, 5, 5), capacity: 10, algorithm: 'first-fit-decreasing' });
    expect(res.binCount).toBe(2);
    expect(res.lowerBound).toBe(2);
    expect(res.ratio).toBe(1);
  });
});

describe('Validation ve parse', () => {
  it('boş listede hata', () => {
    expect(() => solveBinPacking({ items: [], capacity: 10, algorithm: 'first-fit' })).toThrow(BinPackingError);
  });

  it('kapasiteden büyük öge — hata', () => {
    expect(() =>
      solveBinPacking({ items: items(12), capacity: 10, algorithm: 'first-fit' }),
    ).toThrow(/sığmaz/);
  });

  it('negatif ya da sıfır boyut — hata', () => {
    expect(() =>
      solveBinPacking({ items: items(3, 0, 4), capacity: 10, algorithm: 'first-fit' }),
    ).toThrow(BinPackingError);
    expect(() =>
      solveBinPacking({ items: items(-1), capacity: 10, algorithm: 'first-fit' }),
    ).toThrow(BinPackingError);
  });

  it('parseItems — "ad<TAB>boyut" satırlarını ayrıştırır', () => {
    const parsed = parseItems('Kutu A\t4,5\nKutu B\t3\nKutu C\t7');
    expect(parsed).toEqual([
      { name: 'Kutu A', size: 4.5 },
      { name: 'Kutu B', size: 3 },
      { name: 'Kutu C', size: 7 },
    ]);
  });

  it('parseItems — sayı-yalnız satırlar otomatik adlanır', () => {
    const parsed = parseItems('4\n3\n7');
    expect(parsed).toEqual([
      { name: 'Öge 1', size: 4 },
      { name: 'Öge 2', size: 3 },
      { name: 'Öge 3', size: 7 },
    ]);
  });

  it('parseItems — Türkçe ondalık virgülü kabul eder', () => {
    const parsed = parseItems('A\t1,25\nB\t0,75');
    expect(parsed[0].size).toBe(1.25);
    expect(parsed[1].size).toBe(0.75);
  });

  it('ALGORITHM_LABELS beş kayıt içerir', () => {
    expect(Object.keys(ALGORITHM_LABELS)).toHaveLength(5);
  });
});

describe('Vazirani 1.5-yaklaşım kanıt sezgisine uygun örnek', () => {
  it('FFD (hem de FF) 1.5·OPT sınırında kalır (küçük instans)', () => {
    // 12 öge, hepsi 0.4 → OPT = ⌈12·0.4⌉ = 5.
    // FFD/FF: her kutuya 2 öge sığar (2·0.4=0.8), kalan 0.2 üçüncüyü almaz → 6 kutu.
    // Ratio 6/5 = 1.2 ≤ 1.5.
    const inp: BinPackingItem[] = Array.from({ length: 12 }, (_, i) => ({ name: `X${i + 1}`, size: 0.4 }));
    const cap = 1;
    for (const algo of ['first-fit', 'first-fit-decreasing', 'best-fit', 'best-fit-decreasing'] as const) {
      const r = solveBinPacking({ items: inp, capacity: cap, algorithm: algo });
      expect(r.binCount).toBeLessThanOrEqual(Math.ceil(1.5 * r.lowerBoundL1));
    }
  });
});
