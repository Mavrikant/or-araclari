import { describe, it, expect } from 'vitest';
import { solveAStar, AStarError, type AStarInput } from './astar';

const SQRT2 = Math.SQRT2;

describe('solveAStar — boş ızgara', () => {
  it('4-bağlantı düz ızgarada Manhattan = gerçek maliyet (heuristic mükemmel)', () => {
    const grid = ['.....', '.....', '.....'];
    const r = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 2, col: 4 },
      heuristic: 'manhattan',
      connectivity: '4',
    });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBe(6);
    expect(r.path[0]).toEqual({ row: 0, col: 0 });
    expect(r.path[r.path.length - 1]).toEqual({ row: 2, col: 4 });
    expect(r.path.length).toBe(7); /* 6 adım = 7 hücre */
    expect(r.initialHeuristic).toBe(6);
  });

  it('8-bağlantı düz ızgarada Octile = √2·min + max·(1)', () => {
    const grid = ['.....', '.....', '.....'];
    const r = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 2, col: 4 },
      heuristic: 'octile',
      connectivity: '8',
    });
    expect(r.reachable).toBe(true);
    /* dr=2, dc=4 → 2 çapraz + 2 yatay = 2√2 + 2 */
    expect(r.pathCost).toBeCloseTo(2 * SQRT2 + 2, 10);
  });

  it('Manhattan ile zero heuristic aynı yolu bulur (zero ⇒ Dijkstra)', () => {
    const grid = ['.....', '.....', '.....'];
    const a = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 2, col: 3 },
      heuristic: 'manhattan',
      connectivity: '4',
    });
    const b = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 2, col: 3 },
      heuristic: 'zero',
      connectivity: '4',
    });
    expect(a.pathCost).toBe(b.pathCost);
    expect(a.pathCost).toBe(5);
    /* Zero heuristic daha çok hücre genişletir (Dijkstra körleme). */
    expect(b.expandedCount).toBeGreaterThanOrEqual(a.expandedCount);
  });
});

describe('solveAStar — engelli ızgara', () => {
  it('duvar etrafından dolaşır (klasik labirent)', () => {
    /* 5×5; ortada 3 hücrelik dikey duvar — start (0,0), goal (0,4) */
    const grid = [
      '...#.',
      '...#.',
      '...#.',
      '.....',
      '.....',
    ];
    const r = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 0, col: 4 },
      heuristic: 'manhattan',
      connectivity: '4',
    });
    expect(r.reachable).toBe(true);
    /* En kısa yol: aşağı 3, sağa 4, yukarı 3 = 10 */
    expect(r.pathCost).toBe(10);
  });

  it('hedef erişilemez ise reachable=false ve boş yol', () => {
    /* Hedef duvar ile çevrelenmiş — start ulaşamaz */
    const grid = [
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ];
    const r = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 2, col: 2 },
      heuristic: 'manhattan',
      connectivity: '4',
    });
    expect(r.reachable).toBe(false);
    expect(r.path).toEqual([]);
    expect(r.pathCost).toBe(Infinity);
  });

  it('8-bağlantı corner-cutting yasak — köşe geçilemez', () => {
    /* Tek diyagonal engel: (0,1) ve (1,0) engelli; (1,1) → (0,0) çapraz */
    const grid = [
      '.#.',
      '#..',
      '...',
    ];
    const r = solveAStar({
      grid,
      start: { row: 1, col: 1 },
      goal: { row: 0, col: 0 },
      heuristic: 'octile',
      connectivity: '8',
      allowCornerCutting: false,
    });
    /* Çapraz (1,1)→(0,0) yasak çünkü her iki kardinal komşu engelli.
     * Başka yol da yok (sadece dört yön açık ama (0,0)'a giden tüm yollar (0,1) ya da (1,0)'dan geçer). */
    expect(r.reachable).toBe(false);
  });

  it('8-bağlantı corner-cutting izinli — köşe kesilebilir', () => {
    const grid = [
      '.#.',
      '#..',
      '...',
    ];
    const r = solveAStar({
      grid,
      start: { row: 1, col: 1 },
      goal: { row: 0, col: 0 },
      heuristic: 'octile',
      connectivity: '8',
      allowCornerCutting: true,
    });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBeCloseTo(SQRT2, 10);
  });

  it('bir engel açık ise corner-cutting yasak modunda çapraz hâlâ geçer', () => {
    /* (0,1) açık → çapraz (1,1)→(0,0) izinli */
    const grid = [
      '...',
      '#..',
      '...',
    ];
    const r = solveAStar({
      grid,
      start: { row: 1, col: 1 },
      goal: { row: 0, col: 0 },
      heuristic: 'octile',
      connectivity: '8',
      allowCornerCutting: false,
    });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBeCloseTo(SQRT2, 10);
  });
});

describe('solveAStar — heuristic etkinliği', () => {
  it('Manhattan engelsiz ızgarada minimum genişletme yapar', () => {
    /* Düz hat hedefte (sadece sağa git) — Manhattan g+h sabit, A* tek yol açar */
    const grid = ['.........'];
    const r = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 0, col: 8 },
      heuristic: 'manhattan',
      connectivity: '4',
    });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBe(8);
    /* Tüm hücreler aynı f-değerinde olduğundan en fazla 9 hücre açılır
     * (tüm yol); pratikte tam yol kadardır. */
    expect(r.expandedCount).toBeLessThanOrEqual(9);
  });

  it('zero heuristic engelsiz ızgarada Manhattan\'dan çok daha fazla hücre açar', () => {
    const grid = Array(7).fill('.......');
    const a = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 6, col: 6 },
      heuristic: 'manhattan',
      connectivity: '4',
    });
    const b = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 6, col: 6 },
      heuristic: 'zero',
      connectivity: '4',
    });
    expect(a.pathCost).toBe(12);
    expect(b.pathCost).toBe(12);
    /* Bilgili arama körlemeden çok daha az açar. */
    expect(b.expandedCount).toBeGreaterThan(a.expandedCount);
  });
});

describe('solveAStar — heuristic fonksiyonları', () => {
  it('initialHeuristic değerleri: Manhattan, Chebyshev, Octile, Euclidean, Zero', () => {
    const grid = Array(5).fill('.....');
    const make = (h: AStarInput['heuristic']) =>
      solveAStar({ grid, start: { row: 0, col: 0 }, goal: { row: 4, col: 3 }, heuristic: h }).initialHeuristic;
    expect(make('manhattan')).toBe(7);
    expect(make('chebyshev')).toBe(4);
    expect(make('octile')).toBeCloseTo(4 + (SQRT2 - 1) * 3, 10);
    expect(make('euclidean')).toBeCloseTo(5, 10);
    expect(make('zero')).toBe(0);
  });
});

describe('solveAStar — yol rekonstrüksiyonu', () => {
  it('yol başlangıçtan hedefe ardışık hücreler içerir (4-bağlantı)', () => {
    const grid = ['...', '...', '...'];
    const r = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 2, col: 2 },
      heuristic: 'manhattan',
      connectivity: '4',
    });
    expect(r.path.length).toBeGreaterThan(0);
    for (let i = 1; i < r.path.length; i++) {
      const dr = Math.abs(r.path[i].row - r.path[i - 1].row);
      const dc = Math.abs(r.path[i].col - r.path[i - 1].col);
      expect(dr + dc).toBe(1); /* 4-bağlantı = tam 1 kardinal adım */
    }
  });

  it('8-bağlantı yolunda çapraz adım olabilir', () => {
    const grid = ['...', '...', '...'];
    const r = solveAStar({
      grid,
      start: { row: 0, col: 0 },
      goal: { row: 2, col: 2 },
      heuristic: 'octile',
      connectivity: '8',
    });
    let diag = 0;
    for (let i = 1; i < r.path.length; i++) {
      const dr = Math.abs(r.path[i].row - r.path[i - 1].row);
      const dc = Math.abs(r.path[i].col - r.path[i - 1].col);
      if (dr === 1 && dc === 1) diag++;
    }
    expect(diag).toBeGreaterThan(0);
    expect(r.pathCost).toBeCloseTo(2 * SQRT2, 10);
  });
});

describe('solveAStar — doğrulama hataları', () => {
  it('boş ızgara hatası', () => {
    expect(() => solveAStar({ grid: [], start: { row: 0, col: 0 }, goal: { row: 0, col: 1 } })).toThrow(AStarError);
  });

  it('start ızgara dışında', () => {
    expect(() =>
      solveAStar({ grid: ['...'], start: { row: 5, col: 0 }, goal: { row: 0, col: 2 } }),
    ).toThrow(AStarError);
  });

  it('start engel üzerinde', () => {
    expect(() =>
      solveAStar({ grid: ['#..'], start: { row: 0, col: 0 }, goal: { row: 0, col: 2 } }),
    ).toThrow(AStarError);
  });

  it('start === goal', () => {
    expect(() =>
      solveAStar({ grid: ['...'], start: { row: 0, col: 0 }, goal: { row: 0, col: 0 } }),
    ).toThrow(AStarError);
  });

  it('satırlar farklı uzunlukta', () => {
    expect(() =>
      solveAStar({ grid: ['...', '..'], start: { row: 0, col: 0 }, goal: { row: 1, col: 1 } }),
    ).toThrow(AStarError);
  });
});

describe('solveAStar — kıyaslama (consistency)', () => {
  it('engelli ızgarada admissible heuristic\'ler aynı optimum maliyeti bulur', () => {
    const grid = [
      '.........',
      '...###...',
      '...#.....',
      '...#.###.',
      '.....#...',
      '##...#...',
      '.....#...',
      '.........',
    ];
    const start = { row: 0, col: 0 };
    const goal = { row: 7, col: 8 };
    const m = solveAStar({ grid, start, goal, heuristic: 'manhattan', connectivity: '4' });
    const z = solveAStar({ grid, start, goal, heuristic: 'zero', connectivity: '4' });
    const e = solveAStar({ grid, start, goal, heuristic: 'euclidean', connectivity: '4' });
    expect(m.reachable).toBe(true);
    expect(z.pathCost).toBe(m.pathCost);
    expect(e.pathCost).toBe(m.pathCost);
  });

  it('8-bağlantıda Octile, Euclidean ve Zero aynı optimum maliyeti bulur', () => {
    const grid = [
      '.........',
      '...###...',
      '.........',
      '...###...',
      '.........',
    ];
    const start = { row: 0, col: 0 };
    const goal = { row: 4, col: 8 };
    const o = solveAStar({ grid, start, goal, heuristic: 'octile', connectivity: '8' });
    const e = solveAStar({ grid, start, goal, heuristic: 'euclidean', connectivity: '8' });
    const z = solveAStar({ grid, start, goal, heuristic: 'zero', connectivity: '8' });
    expect(o.reachable).toBe(true);
    expect(e.pathCost).toBeCloseTo(o.pathCost, 9);
    expect(z.pathCost).toBeCloseTo(o.pathCost, 9);
  });
});
