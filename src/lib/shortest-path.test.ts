import { describe, it, expect } from 'vitest';
import { solveShortestPath, ShortestPathError } from './shortest-path';

describe('solveShortestPath — Dijkstra klasik örnekler', () => {
  it('CLRS 24.3 (Dijkstra) örneği — 5 düğüm, tüm uzaklıklar doğru', () => {
    /* Cormen et al. "Introduction to Algorithms" Ch. 24.3 — Dijkstra'nın
     * ders kitabı örneği. Kaynak s=A; beklenen distances:
     *   A=0, B=8, C=9, D=5, E=7. */
    const r = solveShortestPath({
      edges: [
        { from: 'A', to: 'B', weight: 10 },
        { from: 'A', to: 'D', weight: 5 },
        { from: 'B', to: 'C', weight: 1 },
        { from: 'B', to: 'D', weight: 2 },
        { from: 'D', to: 'B', weight: 3 },
        { from: 'D', to: 'C', weight: 9 },
        { from: 'D', to: 'E', weight: 2 },
        { from: 'C', to: 'E', weight: 4 },
        { from: 'E', to: 'A', weight: 7 },
        { from: 'E', to: 'C', weight: 6 },
      ],
      source: 'A',
    });
    expect(r.algorithm).toBe('dijkstra');
    const byNode = Object.fromEntries(r.nodes.map((n) => [n.node, n.distance]));
    expect(byNode.A).toBe(0);
    expect(byNode.B).toBe(8);
    expect(byNode.C).toBe(9);
    expect(byNode.D).toBe(5);
    expect(byNode.E).toBe(7);
  });

  it('basit 3 kenarlı zincir: s→a→b ile ağırlıklar toplanır', () => {
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 'a', weight: 4 },
        { from: 'a', to: 'b', weight: 6 },
      ],
      source: 's',
      target: 'b',
    });
    expect(r.targetDistance).toBe(10);
    expect(r.targetPath).not.toBeNull();
    expect(r.targetPath!.length).toBe(2);
    expect(r.targetPath![1].cumulative).toBe(10);
  });

  it('alternatif kısa yol seçilir — direkt s→t (kapasite 10) yerine s→a→t (3+4=7)', () => {
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 't', weight: 10 },
        { from: 's', to: 'a', weight: 3 },
        { from: 'a', to: 't', weight: 4 },
      ],
      source: 's',
      target: 't',
    });
    expect(r.targetDistance).toBe(7);
    expect(r.targetPath!.map((p) => p.from + '→' + p.to)).toEqual(['s→a', 'a→t']);
  });

  it('paralel kenarlar arasında en küçük ağırlık seçilir', () => {
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 't', weight: 5 },
        { from: 's', to: 't', weight: 2 },
        { from: 's', to: 't', weight: 8 },
      ],
      source: 's',
      target: 't',
    });
    expect(r.targetDistance).toBe(2);
    expect(r.targetPath![0].weight).toBe(2);
  });

  it('ulaşılamayan düğüm — reachable=false ve distance=Infinity', () => {
    const r = solveShortestPath({
      edges: [
        { from: 'a', to: 'b', weight: 1 },
        { from: 'c', to: 'd', weight: 1 },
      ],
      source: 'a',
      target: 'd',
    });
    const d = r.nodes.find((n) => n.node === 'd')!;
    expect(d.reachable).toBe(false);
    expect(d.distance).toBe(Infinity);
    expect(r.targetDistance).toBe(Infinity);
    expect(r.targetPath).toBeNull();
  });
});

describe('solveShortestPath — Bellman-Ford ve negatif ağırlıklar', () => {
  it('auto modu negatif ağırlık görünce Bellman-Ford\'a düşer', () => {
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 'a', weight: 5 },
        { from: 'a', to: 'b', weight: -3 },
        { from: 's', to: 'b', weight: 4 },
      ],
      source: 's',
    });
    expect(r.algorithm).toBe('bellman-ford');
    const byNode = Object.fromEntries(r.nodes.map((n) => [n.node, n.distance]));
    /* s→a→b = 5 + (−3) = 2; s→b doğrudan = 4 → en kısa 2. */
    expect(byNode.b).toBe(2);
  });

  it('CLRS 24.1 Bellman-Ford örneği — negatif ağırlıklı 5 düğüm', () => {
    /* CLRS Ch. 24.1 — kaynak s, beklenen distances: s=0, t=2, x=4, y=7, z=-2 */
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 't', weight: 6 },
        { from: 's', to: 'y', weight: 7 },
        { from: 't', to: 'x', weight: 5 },
        { from: 't', to: 'y', weight: 8 },
        { from: 't', to: 'z', weight: -4 },
        { from: 'x', to: 't', weight: -2 },
        { from: 'y', to: 'x', weight: -3 },
        { from: 'y', to: 'z', weight: 9 },
        { from: 'z', to: 's', weight: 2 },
        { from: 'z', to: 'x', weight: 7 },
      ],
      source: 's',
    });
    expect(r.algorithm).toBe('bellman-ford');
    expect(r.hasNegativeCycle).toBe(false);
    const byNode = Object.fromEntries(r.nodes.map((n) => [n.node, n.distance]));
    expect(byNode.s).toBe(0);
    expect(byNode.t).toBe(2);
    expect(byNode.x).toBe(4);
    expect(byNode.y).toBe(7);
    expect(byNode.z).toBe(-2);
  });

  it('negatif çevrim tespiti — hasNegativeCycle=true, döngüde düğümler raporlanır', () => {
    /* s → a → b → a (çevrim toplam = -1, sonsuza dek azalır) */
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 'a', weight: 1 },
        { from: 'a', to: 'b', weight: 2 },
        { from: 'b', to: 'a', weight: -3 },
      ],
      source: 's',
    });
    expect(r.hasNegativeCycle).toBe(true);
    expect(r.negativeCycleNodes.length).toBeGreaterThan(0);
    /* a ve b çevrim üzerinde olmalı. */
    const setNc = new Set(r.negativeCycleNodes);
    expect(setNc.has('a') || setNc.has('b')).toBe(true);
  });

  it('erişilemez negatif çevrim algılanmaz (kaynaktan ulaşılamıyorsa sayılmaz)', () => {
    /* s → a normal; b → c → b ayrı bileşende negatif çevrim olsa bile
     * s'den erişilemez, raporlanmaz. */
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 'a', weight: 4 },
        { from: 'b', to: 'c', weight: 1 },
        { from: 'c', to: 'b', weight: -5 },
      ],
      source: 's',
      algorithm: 'bellman-ford',
    });
    expect(r.hasNegativeCycle).toBe(false);
    const byNode = Object.fromEntries(r.nodes.map((n) => [n.node, n.distance]));
    expect(byNode.a).toBe(4);
    expect(byNode.b).toBe(Infinity);
  });

  it('Dijkstra negatif ağırlıkla zorlanırsa hata atar', () => {
    expect(() =>
      solveShortestPath({
        edges: [
          { from: 's', to: 'a', weight: 1 },
          { from: 'a', to: 'b', weight: -2 },
        ],
        source: 's',
        algorithm: 'dijkstra',
      }),
    ).toThrow(ShortestPathError);
  });
});

describe('solveShortestPath — yol rekonstrüksiyonu', () => {
  it('predecessor zinciri ile kaynaktan hedefe doğru yol döner', () => {
    const r = solveShortestPath({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 1 },
        { from: 'C', to: 'D', weight: 1 },
        { from: 'A', to: 'D', weight: 10 },
      ],
      source: 'A',
      target: 'D',
    });
    expect(r.targetDistance).toBe(3);
    expect(r.targetPath!.length).toBe(3);
    expect(r.targetPath![0].from).toBe('A');
    expect(r.targetPath![r.targetPath!.length - 1].to).toBe('D');
    /* Kümülatif uzaklık monoton artmalı. */
    let prev = 0;
    for (const step of r.targetPath!) {
      expect(step.cumulative).toBeGreaterThanOrEqual(prev);
      prev = step.cumulative;
    }
    expect(prev).toBe(3);
  });

  it('hedef verilmezse targetPath null', () => {
    const r = solveShortestPath({
      edges: [{ from: 'a', to: 'b', weight: 1 }],
      source: 'a',
    });
    expect(r.targetPath).toBeNull();
    expect(r.targetDistance).toBeNull();
  });

  it('kaynaktan kaynağa uzaklık 0', () => {
    const r = solveShortestPath({
      edges: [
        { from: 's', to: 'a', weight: 5 },
        { from: 'a', to: 'b', weight: 3 },
      ],
      source: 's',
    });
    const sNode = r.nodes.find((n) => n.node === 's')!;
    expect(sNode.distance).toBe(0);
    expect(sNode.predecessor).toBeNull();
  });
});

describe('solveShortestPath — validation', () => {
  it('boş kenar listesi reddedilir', () => {
    expect(() => solveShortestPath({ edges: [], source: 's' })).toThrow(ShortestPathError);
  });

  it('boş kaynak adı reddedilir', () => {
    expect(() =>
      solveShortestPath({ edges: [{ from: 's', to: 't', weight: 1 }], source: '' }),
    ).toThrow(ShortestPathError);
  });

  it('source = target reddedilir', () => {
    expect(() =>
      solveShortestPath({
        edges: [{ from: 's', to: 't', weight: 1 }],
        source: 's',
        target: 's',
      }),
    ).toThrow(ShortestPathError);
  });

  it('self-loop reddedilir', () => {
    expect(() =>
      solveShortestPath({
        edges: [{ from: 'a', to: 'a', weight: 1 }],
        source: 's',
      }),
    ).toThrow(ShortestPathError);
  });

  it('sonsuz/NaN ağırlık reddedilir', () => {
    expect(() =>
      solveShortestPath({
        edges: [{ from: 's', to: 't', weight: Infinity }],
        source: 's',
      }),
    ).toThrow(ShortestPathError);
    expect(() =>
      solveShortestPath({
        edges: [{ from: 's', to: 't', weight: Number.NaN }],
        source: 's',
      }),
    ).toThrow(ShortestPathError);
  });
});

describe('solveShortestPath — determinism ve performans', () => {
  it('aynı girdi aynı çıktıyı verir', () => {
    const input = {
      edges: [
        { from: 's', to: 'a', weight: 2 },
        { from: 's', to: 'b', weight: 5 },
        { from: 'a', to: 'c', weight: 4 },
        { from: 'b', to: 'c', weight: 1 },
        { from: 'c', to: 't', weight: 3 },
      ],
      source: 's',
      target: 't',
    };
    const r1 = solveShortestPath(input);
    const r2 = solveShortestPath(input);
    expect(r1.targetDistance).toBe(r2.targetDistance);
    expect(r1.iterations).toBe(r2.iterations);
    expect(r1.nodes.map((n) => n.distance)).toEqual(r2.nodes.map((n) => n.distance));
  });

  it('orta büyüklükte ağ (50 düğüm, 100 kenar) anlık çözülür', () => {
    const edges: Array<{ from: string; to: string; weight: number }> = [];
    /* Zincir: 0→1→2→...→49 + bazı kısa devre kenarları */
    for (let i = 0; i < 49; i++) {
      edges.push({ from: `n${i}`, to: `n${i + 1}`, weight: 1 });
    }
    for (let i = 0; i < 50; i += 5) {
      for (let j = i + 5; j < 50; j += 5) {
        edges.push({ from: `n${i}`, to: `n${j}`, weight: (j - i) * 0.5 + 1 });
      }
    }
    const r = solveShortestPath({ edges, source: 'n0', target: 'n49' });
    expect(r.targetDistance).toBeLessThan(49); /* kısa devreler daha hızlı */
    expect(r.algorithm).toBe('dijkstra');
  });
});
