import { describe, it, expect } from 'vitest';
import { solveMinCostFlow, MinCostFlowError } from './min-cost-flow';

describe('solveMinCostFlow — temel doğrulamalar', () => {
  it('tek yol: zorunlu maliyet pathCost · flow', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 10, cost: 2 },
        { from: 'a', to: 't', capacity: 10, cost: 3 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 7,
    });
    expect(r.totalFlow).toBeCloseTo(7, 8);
    expect(r.totalCost).toBeCloseTo(7 * (2 + 3), 8);
    expect(r.infeasible).toBe(false);
  });

  it('iki paralel yol: ucuz olan önce dolar', () => {
    /* s→a→t (cost 1+1=2, cap 5) ucuz; s→b→t (cost 4+4=8, cap 5) pahalı.
     * d=8 istenirse 5 ucuz + 3 pahalı = 5·2 + 3·8 = 34. */
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 5, cost: 1 },
        { from: 'a', to: 't', capacity: 5, cost: 1 },
        { from: 's', to: 'b', capacity: 5, cost: 4 },
        { from: 'b', to: 't', capacity: 5, cost: 4 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 8,
    });
    expect(r.totalFlow).toBeCloseTo(8, 8);
    expect(r.totalCost).toBeCloseTo(34, 6);
  });

  it('hedef akış belirtilmezse maks akış kadar akıtılır', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 5, cost: 1 },
        { from: 'a', to: 't', capacity: 5, cost: 1 },
        { from: 's', to: 'b', capacity: 3, cost: 4 },
        { from: 'b', to: 't', capacity: 3, cost: 4 },
      ],
      source: 's',
      sink: 't',
    });
    expect(r.totalFlow).toBeCloseTo(8, 8);
    expect(r.totalCost).toBeCloseTo(5 * 2 + 3 * 8, 6);
    expect(r.infeasible).toBe(false);
  });

  it('infeasible: hedef akış maks akıştan büyük', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 3, cost: 1 },
        { from: 'a', to: 't', capacity: 3, cost: 1 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 10,
    });
    expect(r.totalFlow).toBeCloseTo(3, 8);
    expect(r.infeasible).toBe(true);
  });

  it('s ile t bağlantısız → akış 0, maliyet 0, infeasible (d > 0 ise)', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 5, cost: 1 },
        { from: 'b', to: 't', capacity: 5, cost: 1 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 2,
    });
    expect(r.totalFlow).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.infeasible).toBe(true);
  });
});

describe('solveMinCostFlow — geri çağırma (cancellation) gerektiren örnek', () => {
  it('açgözlü seçim kötüydüyse SSP geri çağırır ve global optimum bulur', () => {
    /* Klasik "açgözlük tuzağı":
     *   s→a cap 2 cost 0
     *   s→b cap 2 cost 1
     *   a→b cap 1 cost 100   (bu kullanılmamalı — pahalı)
     *   a→t cap 2 cost 1
     *   b→t cap 2 cost 0
     *
     * d=4 istiyoruz. Optimum: s→a→t (2 birim, cost 2), s→b→t (2 birim,
     * cost 2). Toplam 4 birim, 4 maliyet. a→b hiç kullanılmamalı. */
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 2, cost: 0 },
        { from: 's', to: 'b', capacity: 2, cost: 1 },
        { from: 'a', to: 'b', capacity: 1, cost: 100 },
        { from: 'a', to: 't', capacity: 2, cost: 1 },
        { from: 'b', to: 't', capacity: 2, cost: 0 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 4,
    });
    expect(r.totalFlow).toBeCloseTo(4, 8);
    expect(r.totalCost).toBeCloseTo(4, 6);
    /* Pahalı a→b kenarı kullanılmamış olmalı. */
    const expensiveEdge = r.edges.find((e) => e.from === 'a' && e.to === 'b');
    expect(expensiveEdge?.flow).toBeCloseTo(0, 8);
  });
});

describe('solveMinCostFlow — akış korunumu', () => {
  it('ara düğümlerde Σ giren = Σ çıkan', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 8, cost: 2 },
        { from: 's', to: 'b', capacity: 6, cost: 3 },
        { from: 'a', to: 'c', capacity: 7, cost: 1 },
        { from: 'b', to: 'c', capacity: 5, cost: 2 },
        { from: 'a', to: 'b', capacity: 2, cost: 5 },
        { from: 'c', to: 't', capacity: 12, cost: 1 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 10,
    });
    for (const node of ['a', 'b', 'c']) {
      const inFlow = r.edges.filter((e) => e.to === node).reduce((sum, e) => sum + e.flow, 0);
      const outFlow = r.edges.filter((e) => e.from === node).reduce((sum, e) => sum + e.flow, 0);
      expect(inFlow).toBeCloseTo(outFlow, 6);
    }
  });

  it('akış her kenarda kapasiteyi aşmaz', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 100, cost: 1 },
        { from: 'a', to: 'b', capacity: 3, cost: 1 },
        { from: 'b', to: 't', capacity: 100, cost: 1 },
      ],
      source: 's',
      sink: 't',
    });
    for (const e of r.edges) {
      expect(e.flow).toBeLessThanOrEqual(e.capacity + 1e-9);
      expect(e.flow).toBeGreaterThanOrEqual(0);
    }
    expect(r.totalFlow).toBeCloseTo(3, 8);
  });

  it('kaynaktan çıkan toplam = hedefe giren toplam = totalFlow', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 4, cost: 1 },
        { from: 's', to: 'b', capacity: 4, cost: 2 },
        { from: 'a', to: 't', capacity: 4, cost: 2 },
        { from: 'b', to: 't', capacity: 4, cost: 1 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 5,
    });
    const fromS = r.edges.filter((e) => e.from === 's').reduce((s, e) => s + e.flow, 0);
    const toT = r.edges.filter((e) => e.to === 't').reduce((s, e) => s + e.flow, 0);
    expect(fromS).toBeCloseTo(r.totalFlow, 6);
    expect(toT).toBeCloseTo(r.totalFlow, 6);
  });
});

describe('solveMinCostFlow — totalCost = Σ flow · cost', () => {
  it('raporlanan toplam maliyet kenar bazlı toplamla tutarlıdır', () => {
    const r = solveMinCostFlow({
      edges: [
        { from: 's', to: 'a', capacity: 5, cost: 2 },
        { from: 's', to: 'b', capacity: 5, cost: 3 },
        { from: 'a', to: 't', capacity: 5, cost: 1 },
        { from: 'b', to: 't', capacity: 5, cost: 4 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 7,
    });
    const sumPerEdge = r.edges.reduce((sum, e) => sum + e.flow * e.cost, 0);
    expect(sumPerEdge).toBeCloseTo(r.totalCost, 6);
  });
});

describe('solveMinCostFlow — validation', () => {
  it('boş kenar listesi reddedilir', () => {
    expect(() =>
      solveMinCostFlow({ edges: [], source: 's', sink: 't' }),
    ).toThrow(MinCostFlowError);
  });
  it('source = sink reddedilir', () => {
    expect(() =>
      solveMinCostFlow({
        edges: [{ from: 's', to: 't', capacity: 1, cost: 1 }],
        source: 's',
        sink: 's',
      }),
    ).toThrow(MinCostFlowError);
  });
  it('negatif kapasite reddedilir', () => {
    expect(() =>
      solveMinCostFlow({
        edges: [{ from: 's', to: 't', capacity: -1, cost: 1 }],
        source: 's',
        sink: 't',
      }),
    ).toThrow(MinCostFlowError);
  });
  it('negatif maliyet reddedilir', () => {
    expect(() =>
      solveMinCostFlow({
        edges: [{ from: 's', to: 't', capacity: 5, cost: -1 }],
        source: 's',
        sink: 't',
      }),
    ).toThrow(MinCostFlowError);
  });
  it('negatif hedef akış reddedilir', () => {
    expect(() =>
      solveMinCostFlow({
        edges: [{ from: 's', to: 't', capacity: 5, cost: 1 }],
        source: 's',
        sink: 't',
        requiredFlow: -1,
      }),
    ).toThrow(MinCostFlowError);
  });
  it('self-loop reddedilir', () => {
    expect(() =>
      solveMinCostFlow({
        edges: [{ from: 'a', to: 'a', capacity: 5, cost: 1 }],
        source: 's',
        sink: 't',
      }),
    ).toThrow(MinCostFlowError);
  });
});

describe('solveMinCostFlow — determinism', () => {
  it('aynı girdi aynı çıktıyı verir', () => {
    const input = {
      edges: [
        { from: 's', to: 'a', capacity: 5, cost: 1 },
        { from: 's', to: 'b', capacity: 5, cost: 2 },
        { from: 'a', to: 't', capacity: 5, cost: 2 },
        { from: 'b', to: 't', capacity: 5, cost: 1 },
      ],
      source: 's',
      sink: 't',
      requiredFlow: 6,
    };
    const r1 = solveMinCostFlow(input);
    const r2 = solveMinCostFlow(input);
    expect(r1.totalFlow).toBe(r2.totalFlow);
    expect(r1.totalCost).toBe(r2.totalCost);
    expect(r1.iterations).toBe(r2.iterations);
  });
});

describe('solveMinCostFlow — Transportation problemi (klasik indirgeme)', () => {
  it('2x3 ulaştırma problemi min-cost flow olarak çözülür', () => {
    /* Arzlar: S1 (15), S2 (25); Talepler: D1 (10), D2 (15), D3 (15).
     * Maliyet matrisi:
     *           D1  D2  D3
     *   S1:      8   6  10
     *   S2:      9  12  13
     *
     * Optimum minimum maliyet = 380:
     *   S1→D1: 0,  S1→D2: 15, S1→D3: 0  →  90
     *   S2→D1: 10, S2→D2: 0,  S2→D3: 15 →  90 + 195 = 285
     *   Toplam: 90 + 285 = 375 (north-west corner ile gerçek optimum hesaplanır)
     *
     * Daha basit doğrulama: super-source → S_i (cap = arz), S_i → D_j
     * (cap = ∞, cost = c_ij), D_j → super-sink (cap = talep). Toplam
     * akış 40 olmalı; toplam maliyet bilinen LP optimumuna eşit. */
    const r = solveMinCostFlow({
      edges: [
        /* Super-source → arz düğümleri. */
        { from: 'SRC', to: 'S1', capacity: 15, cost: 0 },
        { from: 'SRC', to: 'S2', capacity: 25, cost: 0 },
        /* Arz → talep, birim maliyetlerle. */
        { from: 'S1', to: 'D1', capacity: 40, cost: 8 },
        { from: 'S1', to: 'D2', capacity: 40, cost: 6 },
        { from: 'S1', to: 'D3', capacity: 40, cost: 10 },
        { from: 'S2', to: 'D1', capacity: 40, cost: 9 },
        { from: 'S2', to: 'D2', capacity: 40, cost: 12 },
        { from: 'S2', to: 'D3', capacity: 40, cost: 13 },
        /* Talep → super-sink. */
        { from: 'D1', to: 'SNK', capacity: 10, cost: 0 },
        { from: 'D2', to: 'SNK', capacity: 15, cost: 0 },
        { from: 'D3', to: 'SNK', capacity: 15, cost: 0 },
      ],
      source: 'SRC',
      sink: 'SNK',
      requiredFlow: 40,
    });
    expect(r.totalFlow).toBeCloseTo(40, 6);
    expect(r.infeasible).toBe(false);
    /* LP optimumu: S1→D2 (15·6=90), S2→D1 (10·9=90), S2→D3 (15·13=195),
     * toplam = 375. */
    expect(r.totalCost).toBeCloseTo(375, 6);
  });
});
