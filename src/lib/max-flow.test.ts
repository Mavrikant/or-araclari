import { describe, it, expect } from 'vitest';
import { solveMaxFlow, MaxFlowError } from './max-flow';

describe('solveMaxFlow — klasik örnekler', () => {
  it('CLRS 26.1 örneği: maks akış = 23', () => {
    /* Cormen/Leiserson/Rivest/Stein "Introduction to Algorithms" 3rd ed.
     * Ch. 26.1 — Lucky Puck Co. ağı. Beklenen max-flow = 23. */
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'v1', capacity: 16 },
        { from: 's', to: 'v2', capacity: 13 },
        { from: 'v1', to: 'v3', capacity: 12 },
        { from: 'v2', to: 'v1', capacity: 4 },
        { from: 'v2', to: 'v4', capacity: 14 },
        { from: 'v3', to: 'v2', capacity: 9 },
        { from: 'v3', to: 't', capacity: 20 },
        { from: 'v4', to: 'v3', capacity: 7 },
        { from: 'v4', to: 't', capacity: 4 },
      ],
      source: 's',
      sink: 't',
    });
    expect(r.maxFlow).toBeCloseTo(23, 6);
    expect(r.iterations).toBeGreaterThan(0);
    /* Akış korunumu: s'den çıkan = t'ye giren = 23. */
    const fromS = r.edges.filter((e) => e.from === 's').reduce((sum, e) => sum + e.flow, 0);
    const toT = r.edges.filter((e) => e.to === 't').reduce((sum, e) => sum + e.flow, 0);
    expect(fromS).toBeCloseTo(23, 6);
    expect(toT).toBeCloseTo(23, 6);
  });

  it('basit 2 kenarlı bottleneck: min(s→a, a→t) = max-flow', () => {
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'a', capacity: 5 },
        { from: 'a', to: 't', capacity: 3 },
      ],
      source: 's',
      sink: 't',
    });
    expect(r.maxFlow).toBe(3);
    expect(r.edges[0].flow).toBeCloseTo(3, 8);
    expect(r.edges[1].flow).toBeCloseTo(3, 8);
    expect(r.edges[1].saturated).toBe(true);
  });

  it('s ile t bağlantısız → max-flow = 0', () => {
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'a', capacity: 5 },
        { from: 'b', to: 't', capacity: 7 },
      ],
      source: 's',
      sink: 't',
    });
    expect(r.maxFlow).toBe(0);
    expect(r.iterations).toBe(0);
  });

  it('paralel kenarlar (aynı u→v birden fazla) toplam kapasiteyle çalışır', () => {
    /* s→t: 2 kenar, 3 + 4 = 7 toplam kapasite. Max-flow = 7. */
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 't', capacity: 3 },
        { from: 's', to: 't', capacity: 4 },
      ],
      source: 's',
      sink: 't',
    });
    expect(r.maxFlow).toBe(7);
    /* Akış paralel kenarlara kapasiteyle orantılı paylaştırılır. */
    const total = r.edges.reduce((s, e) => s + e.flow, 0);
    expect(total).toBeCloseTo(7, 8);
  });
});

describe('solveMaxFlow — min-cut özellikleri', () => {
  it('min-cut max-flow teoremi: cut kapasiteleri toplamı = max-flow', () => {
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'a', capacity: 10 },
        { from: 's', to: 'b', capacity: 5 },
        { from: 'a', to: 't', capacity: 8 },
        { from: 'b', to: 't', capacity: 7 },
        { from: 'a', to: 'b', capacity: 3 },
      ],
      source: 's',
      sink: 't',
    });
    const cutCap = r.cutEdges.reduce((sum, e) => sum + e.capacity, 0);
    expect(cutCap).toBeCloseTo(r.maxFlow, 6);
  });

  it('s cut S tarafında, t cut T tarafında', () => {
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'a', capacity: 4 },
        { from: 'a', to: 't', capacity: 4 },
      ],
      source: 's',
      sink: 't',
    });
    expect(r.cutSourceSide).toContain('s');
    expect(r.cutSinkSide).toContain('t');
    expect(r.cutSourceSide).not.toContain('t');
    expect(r.cutSinkSide).not.toContain('s');
  });

  it('cut kenarları yalnızca S→T yönündedir (T→S yönündekiler dahil değil)', () => {
    /* Köprü yapısı: cut kesinlikle s→middle veya middle→t olur. */
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'm', capacity: 5 },
        { from: 'm', to: 't', capacity: 5 },
      ],
      source: 's',
      sink: 't',
    });
    for (const ce of r.cutEdges) {
      expect(r.cutSourceSide).toContain(ce.from);
      expect(r.cutSinkSide).toContain(ce.to);
    }
  });
});

describe('solveMaxFlow — akış korunumu (Kirchhoff)', () => {
  it('her ara düğümde Σ giren = Σ çıkan', () => {
    /* Diamond + ekstra kenar. */
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'a', capacity: 8 },
        { from: 's', to: 'b', capacity: 6 },
        { from: 'a', to: 'c', capacity: 7 },
        { from: 'b', to: 'c', capacity: 5 },
        { from: 'a', to: 'b', capacity: 2 },
        { from: 'c', to: 't', capacity: 12 },
      ],
      source: 's',
      sink: 't',
    });
    /* a, b, c hepsi ara düğüm. */
    for (const node of ['a', 'b', 'c']) {
      const inFlow = r.edges.filter((e) => e.to === node).reduce((s, e) => s + e.flow, 0);
      const outFlow = r.edges.filter((e) => e.from === node).reduce((s, e) => s + e.flow, 0);
      expect(inFlow).toBeCloseTo(outFlow, 6);
    }
  });

  it('flow her kenarda kapasiteyi aşmaz', () => {
    const r = solveMaxFlow({
      edges: [
        { from: 's', to: 'a', capacity: 100 },
        { from: 'a', to: 'b', capacity: 3 },
        { from: 'b', to: 't', capacity: 100 },
      ],
      source: 's',
      sink: 't',
    });
    for (const e of r.edges) {
      expect(e.flow).toBeLessThanOrEqual(e.capacity + 1e-9);
      expect(e.flow).toBeGreaterThanOrEqual(0);
    }
    expect(r.maxFlow).toBe(3);
  });
});

describe('solveMaxFlow — validation', () => {
  it('boş kenar listesi reddedilir', () => {
    expect(() => solveMaxFlow({ edges: [], source: 's', sink: 't' })).toThrow(MaxFlowError);
  });
  it('source = sink reddedilir', () => {
    expect(() =>
      solveMaxFlow({ edges: [{ from: 's', to: 't', capacity: 1 }], source: 's', sink: 's' }),
    ).toThrow(MaxFlowError);
  });
  it('negatif kapasite reddedilir', () => {
    expect(() =>
      solveMaxFlow({ edges: [{ from: 's', to: 't', capacity: -1 }], source: 's', sink: 't' }),
    ).toThrow(MaxFlowError);
  });
  it('self-loop reddedilir', () => {
    expect(() =>
      solveMaxFlow({ edges: [{ from: 'a', to: 'a', capacity: 5 }], source: 's', sink: 't' }),
    ).toThrow(MaxFlowError);
  });
  it('boş source/sink adı reddedilir', () => {
    expect(() =>
      solveMaxFlow({ edges: [{ from: 's', to: 't', capacity: 1 }], source: '', sink: 't' }),
    ).toThrow(MaxFlowError);
  });
});

describe('solveMaxFlow — küçük ağda determinism', () => {
  it('aynı girdi aynı çıktıyı verir (deterministic)', () => {
    const input = {
      edges: [
        { from: 's', to: 'a', capacity: 10 },
        { from: 's', to: 'b', capacity: 5 },
        { from: 'a', to: 't', capacity: 8 },
        { from: 'b', to: 't', capacity: 7 },
      ],
      source: 's',
      sink: 't',
    };
    const r1 = solveMaxFlow(input);
    const r2 = solveMaxFlow(input);
    expect(r1.maxFlow).toBe(r2.maxFlow);
    expect(r1.iterations).toBe(r2.iterations);
    expect(r1.cutSourceSide).toEqual(r2.cutSourceSide);
  });

  it('düğüm sırası: source önce, sink ikinci, sonra kenarlardan keşfedildikçe', () => {
    const r = solveMaxFlow({
      edges: [
        { from: 'a', to: 'b', capacity: 1 },
        { from: 's', to: 'a', capacity: 1 },
        { from: 'b', to: 't', capacity: 1 },
      ],
      source: 's',
      sink: 't',
    });
    expect(r.nodes[0]).toBe('s');
    expect(r.nodes[1]).toBe('t');
  });
});
