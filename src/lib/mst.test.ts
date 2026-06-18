import { describe, it, expect } from 'vitest';
import { solveMst, MstError, type MstEdge } from './mst';

describe('solveMst — Prim klasik örnekler', () => {
  it('CLRS 23 (MST) ders kitabı örneği — 9 düğüm, toplam ağırlık 37', () => {
    /* Cormen et al. "Introduction to Algorithms" Ch. 23 — MST'nin
     * standart örnek grafı. Beklenen MST toplam ağırlığı 37. */
    const edges: MstEdge[] = [
      { from: 'a', to: 'b', weight: 4 },
      { from: 'a', to: 'h', weight: 8 },
      { from: 'b', to: 'c', weight: 8 },
      { from: 'b', to: 'h', weight: 11 },
      { from: 'c', to: 'd', weight: 7 },
      { from: 'c', to: 'f', weight: 4 },
      { from: 'c', to: 'i', weight: 2 },
      { from: 'd', to: 'e', weight: 9 },
      { from: 'd', to: 'f', weight: 14 },
      { from: 'e', to: 'f', weight: 10 },
      { from: 'f', to: 'g', weight: 2 },
      { from: 'g', to: 'h', weight: 1 },
      { from: 'g', to: 'i', weight: 6 },
      { from: 'h', to: 'i', weight: 7 },
    ];
    const r = solveMst({ edges, algorithm: 'prim', startNode: 'a' });
    expect(r.algorithm).toBe('prim');
    expect(r.totalWeight).toBe(37);
    expect(r.treeEdges.length).toBe(8);
    expect(r.components).toBe(1);
  });

  it('üçgen — 3 düğüm, en pahalı kenar atılır', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 2 },
        { from: 'A', to: 'C', weight: 10 },
      ],
    });
    expect(r.totalWeight).toBe(3);
    expect(r.treeEdges.length).toBe(2);
    const weights = r.treeEdges.map((e) => e.weight).sort((a, b) => a - b);
    expect(weights).toEqual([1, 2]);
  });

  it('tek kenar — 2 düğüm', () => {
    const r = solveMst({
      edges: [{ from: 'X', to: 'Y', weight: 5 }],
    });
    expect(r.totalWeight).toBe(5);
    expect(r.treeEdges.length).toBe(1);
    expect(r.components).toBe(1);
  });

  it('zincir — n düğüm n−1 kenar, hepsi MST', () => {
    const r = solveMst({
      edges: [
        { from: 'a', to: 'b', weight: 1 },
        { from: 'b', to: 'c', weight: 2 },
        { from: 'c', to: 'd', weight: 3 },
        { from: 'd', to: 'e', weight: 4 },
      ],
    });
    expect(r.totalWeight).toBe(10);
    expect(r.treeEdges.length).toBe(4);
  });

  it('kare + köşegen — köşegen atılır', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 1 },
        { from: 'C', to: 'D', weight: 1 },
        { from: 'D', to: 'A', weight: 1 },
        { from: 'A', to: 'C', weight: 5 },
      ],
    });
    expect(r.totalWeight).toBe(3);
    expect(r.treeEdges.length).toBe(3);
    /* Köşegen MST'de olmamalı. */
    const hasAC = r.treeEdges.some(
      (e) => (e.from === 'A' && e.to === 'C') || (e.from === 'C' && e.to === 'A'),
    );
    expect(hasAC).toBe(false);
  });

  it('başlangıç düğümü Prim sonucunu değiştirmez (MST toplamı sabit)', () => {
    const edges: MstEdge[] = [
      { from: 'a', to: 'b', weight: 4 },
      { from: 'a', to: 'h', weight: 8 },
      { from: 'b', to: 'c', weight: 8 },
      { from: 'c', to: 'd', weight: 7 },
      { from: 'c', to: 'i', weight: 2 },
      { from: 'd', to: 'e', weight: 9 },
      { from: 'd', to: 'f', weight: 14 },
      { from: 'e', to: 'f', weight: 10 },
      { from: 'f', to: 'g', weight: 2 },
      { from: 'g', to: 'h', weight: 1 },
      { from: 'g', to: 'i', weight: 6 },
      { from: 'c', to: 'f', weight: 4 },
      { from: 'h', to: 'i', weight: 7 },
      { from: 'b', to: 'h', weight: 11 },
    ];
    const ra = solveMst({ edges, algorithm: 'prim', startNode: 'a' });
    const re = solveMst({ edges, algorithm: 'prim', startNode: 'e' });
    expect(ra.totalWeight).toBe(re.totalWeight);
  });
});

describe('solveMst — Kruskal', () => {
  it('CLRS örneği — Kruskal Prim ile aynı toplam (37) verir', () => {
    const edges: MstEdge[] = [
      { from: 'a', to: 'b', weight: 4 },
      { from: 'a', to: 'h', weight: 8 },
      { from: 'b', to: 'c', weight: 8 },
      { from: 'b', to: 'h', weight: 11 },
      { from: 'c', to: 'd', weight: 7 },
      { from: 'c', to: 'f', weight: 4 },
      { from: 'c', to: 'i', weight: 2 },
      { from: 'd', to: 'e', weight: 9 },
      { from: 'd', to: 'f', weight: 14 },
      { from: 'e', to: 'f', weight: 10 },
      { from: 'f', to: 'g', weight: 2 },
      { from: 'g', to: 'h', weight: 1 },
      { from: 'g', to: 'i', weight: 6 },
      { from: 'h', to: 'i', weight: 7 },
    ];
    const r = solveMst({ edges, algorithm: 'kruskal' });
    expect(r.algorithm).toBe('kruskal');
    expect(r.totalWeight).toBe(37);
    expect(r.treeEdges.length).toBe(8);
  });

  it('Kruskal sıralı seçim — en küçük ağırlık önce alınır', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 5 },
        { from: 'B', to: 'C', weight: 1 },
        { from: 'A', to: 'C', weight: 3 },
      ],
      algorithm: 'kruskal',
    });
    expect(r.treeEdges[0].weight).toBe(1);
    expect(r.treeEdges[1].weight).toBe(3);
    expect(r.totalWeight).toBe(4);
  });
});

describe('solveMst — bağlı olmayan graf (orman)', () => {
  it('iki ayrı bileşen — Prim orman döndürür', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 2 },
        { from: 'X', to: 'Y', weight: 3 },
        { from: 'Y', to: 'Z', weight: 4 },
      ],
    });
    expect(r.components).toBe(2);
    expect(r.treeEdges.length).toBe(4);
    expect(r.totalWeight).toBe(10);
  });

  it('iki bileşen Kruskal ile de aynı sonucu verir', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 2 },
        { from: 'X', to: 'Y', weight: 3 },
      ],
      algorithm: 'kruskal',
    });
    expect(r.components).toBe(2);
    expect(r.treeEdges.length).toBe(3);
    expect(r.totalWeight).toBe(6);
  });

  it('izole düğüm — başlangıç düğümü kenarsız bileşene yerleşmez', () => {
    /* Tek bir izole düğüm (Z) startNode olarak verilemez çünkü
     * kenarlarda görünmez — kullanıcı tarafından sezilemez. Bu test
     * sadece her kenarın MST'ye dahil edildiğini doğrular. */
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'C', to: 'D', weight: 2 },
      ],
    });
    expect(r.components).toBe(2);
    expect(r.totalWeight).toBe(3);
  });
});

describe('solveMst — paralel kenar ve negatif ağırlık', () => {
  it('paralel kenarlar — en küçük ağırlık seçilir', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 5 },
        { from: 'A', to: 'B', weight: 2 },
        { from: 'A', to: 'B', weight: 9 },
        { from: 'B', to: 'C', weight: 3 },
      ],
    });
    expect(r.totalWeight).toBe(5); /* 2 + 3 */
    expect(r.treeEdges.length).toBe(2);
  });

  it('yönsüz graf — (A→B) ve (B→A) tek kenar sayılır', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 5 },
        { from: 'B', to: 'A', weight: 5 },
        { from: 'B', to: 'C', weight: 1 },
      ],
    });
    expect(r.treeEdges.length).toBe(2);
    expect(r.totalWeight).toBe(6);
  });

  it('negatif ağırlık — MST tanımı kabul eder, toplama doğru katılır', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: -5 },
        { from: 'B', to: 'C', weight: 2 },
        { from: 'A', to: 'C', weight: 10 },
      ],
    });
    expect(r.totalWeight).toBe(-3);
  });
});

describe('solveMst — bileşen etiketleri', () => {
  it('tek bileşende tüm düğümler component=0', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 2 },
      ],
    });
    const ids = r.nodeComponents.map((nc) => nc.component);
    expect(new Set(ids).size).toBe(1);
  });

  it('iki bileşende düğümler farklı componentlere ayrılır', () => {
    const r = solveMst({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'X', to: 'Y', weight: 2 },
      ],
    });
    const map = Object.fromEntries(r.nodeComponents.map((nc) => [nc.node, nc.component]));
    expect(map.A).toBe(map.B);
    expect(map.X).toBe(map.Y);
    expect(map.A).not.toBe(map.X);
  });
});

describe('solveMst — validation hataları', () => {
  it('boş kenar listesi reddedilir', () => {
    expect(() => solveMst({ edges: [] })).toThrow(MstError);
  });

  it('self-loop reddedilir', () => {
    expect(() =>
      solveMst({ edges: [{ from: 'A', to: 'A', weight: 1 }] }),
    ).toThrow(/self-loop/i);
  });

  it('NaN ağırlık reddedilir', () => {
    expect(() =>
      solveMst({ edges: [{ from: 'A', to: 'B', weight: NaN }] }),
    ).toThrow(MstError);
  });

  it('Infinity ağırlık reddedilir', () => {
    expect(() =>
      solveMst({ edges: [{ from: 'A', to: 'B', weight: Infinity }] }),
    ).toThrow(MstError);
  });

  it('boş düğüm adı reddedilir', () => {
    expect(() =>
      solveMst({ edges: [{ from: '', to: 'B', weight: 1 }] }),
    ).toThrow(MstError);
  });

  it('grafa ait olmayan startNode reddedilir', () => {
    expect(() =>
      solveMst({
        edges: [{ from: 'A', to: 'B', weight: 1 }],
        startNode: 'Z',
      }),
    ).toThrow(/yer almıyor/i);
  });
});

describe('solveMst — Prim ve Kruskal sonuç tutarlılığı', () => {
  it('rastgele küçük graf — iki algoritma aynı toplam ağırlığı verir', () => {
    /* MST tek olmasa da toplam ağırlık tektir (cut property). */
    const edges: MstEdge[] = [
      { from: '1', to: '2', weight: 3 },
      { from: '1', to: '3', weight: 1 },
      { from: '2', to: '3', weight: 2 },
      { from: '2', to: '4', weight: 5 },
      { from: '3', to: '4', weight: 4 },
      { from: '4', to: '5', weight: 6 },
      { from: '3', to: '5', weight: 7 },
    ];
    const p = solveMst({ edges, algorithm: 'prim' });
    const k = solveMst({ edges, algorithm: 'kruskal' });
    expect(p.totalWeight).toBe(k.totalWeight);
    expect(p.treeEdges.length).toBe(k.treeEdges.length);
  });
});
