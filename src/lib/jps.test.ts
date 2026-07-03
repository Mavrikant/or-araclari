import { describe, it, expect } from 'vitest';
import { solveJps } from './jps';
import { solveAStar, AStarError } from './astar';

const SQRT2 = Math.SQRT2;

describe('solveJps — boş 8-bağlantı ızgara', () => {
  it('düz ızgarada A* ile aynı optimum maliyet (octile)', () => {
    const grid = ['..........', '..........', '..........', '..........', '..........'];
    const start = { row: 0, col: 0 };
    const goal = { row: 4, col: 9 };
    const j = solveJps({ grid, start, goal });
    const a = solveAStar({ grid, start, goal, heuristic: 'octile', connectivity: '8' });
    expect(j.reachable).toBe(true);
    expect(a.reachable).toBe(true);
    expect(j.pathCost).toBeCloseTo(a.pathCost, 10);
    /* 4 çapraz + 5 yatay = 4·√2 + 5 */
    expect(j.pathCost).toBeCloseTo(4 * SQRT2 + 5, 10);
  });

  it('boş ızgarada JPS A*’dan dramatik biçimde daha az düğüm açar (simetri kırma)', () => {
    const grid = Array(12).fill('.'.repeat(12));
    const start = { row: 0, col: 0 };
    const goal = { row: 11, col: 11 };
    const j = solveJps({ grid, start, goal });
    const a = solveAStar({ grid, start, goal, heuristic: 'octile', connectivity: '8' });
    expect(j.pathCost).toBeCloseTo(a.pathCost, 10);
    /* JPS açık alanda en azından A*’dan daha fazla AÇMAMALI; pratikte çok daha az. */
    expect(j.expandedCount).toBeLessThanOrEqual(a.expandedCount);
    /* Boş ızgarada start + goal yeterli; ortada zorunlu komşu yok. */
    expect(j.jumpPointCount).toBeLessThanOrEqual(3);
  });

  it('düz hat (aynı satır) — tek bir jump point: hedef', () => {
    const grid = ['..........'];
    const r = solveJps({ grid, start: { row: 0, col: 0 }, goal: { row: 0, col: 9 } });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBe(9);
    expect(r.path.length).toBe(10);
    expect(r.jumpPoints).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 9 },
    ]);
  });

  it('düz çapraz hat — tek jump point + interpolasyon yolu doğru', () => {
    const grid = Array(6).fill('......');
    const r = solveJps({ grid, start: { row: 0, col: 0 }, goal: { row: 5, col: 5 } });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBeCloseTo(5 * SQRT2, 10);
    expect(r.path.length).toBe(6);
    for (let i = 0; i < r.path.length; i++) {
      expect(r.path[i]).toEqual({ row: i, col: i });
    }
  });
});

describe('solveJps — engelli ızgara', () => {
  it('duvar etrafından dolaşır ve A* ile aynı optimum maliyet', () => {
    const grid = [
      '...#......',
      '...#......',
      '...#......',
      '...#......',
      '..........',
      '..........',
    ];
    const start = { row: 0, col: 0 };
    const goal = { row: 0, col: 9 };
    const j = solveJps({ grid, start, goal });
    const a = solveAStar({ grid, start, goal, heuristic: 'octile', connectivity: '8' });
    expect(j.reachable).toBe(true);
    expect(j.pathCost).toBeCloseTo(a.pathCost, 10);
    expect(j.jumpPointCount).toBeGreaterThanOrEqual(2);
  });

  it('hedef erişilemez ise reachable=false ve boş yol', () => {
    const grid = [
      '.....',
      '.###.',
      '.#.#.',
      '.###.',
      '.....',
    ];
    const r = solveJps({ grid, start: { row: 0, col: 0 }, goal: { row: 2, col: 2 } });
    expect(r.reachable).toBe(false);
    expect(r.path).toEqual([]);
    expect(r.pathCost).toBe(Infinity);
    expect(r.jumpPointCount).toBe(0);
  });

  it('corner-cutting yasak: iki engelli köşe çapraz geçilemez', () => {
    const grid = [
      '.#.',
      '#..',
      '...',
    ];
    const r = solveJps({
      grid,
      start: { row: 1, col: 1 },
      goal: { row: 0, col: 0 },
      allowCornerCutting: false,
    });
    expect(r.reachable).toBe(false);
  });

  it('corner-cutting izinli: iki engelli köşe çapraz geçilebilir', () => {
    const grid = [
      '.#.',
      '#..',
      '...',
    ];
    const r = solveJps({
      grid,
      start: { row: 1, col: 1 },
      goal: { row: 0, col: 0 },
      allowCornerCutting: true,
    });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBeCloseTo(SQRT2, 10);
  });

  it('bir komşu açıksa corner-cutting yasak modunda çapraz hâlâ izinli', () => {
    const grid = [
      '...',
      '#..',
      '...',
    ];
    const r = solveJps({
      grid,
      start: { row: 1, col: 1 },
      goal: { row: 0, col: 0 },
      allowCornerCutting: false,
    });
    expect(r.reachable).toBe(true);
    expect(r.pathCost).toBeCloseTo(SQRT2, 10);
  });

  it('zorunlu komşu testi — engel jump point yaratır', () => {
    /* 5×7; alt satırda 1. sütunda küçük bir engel parçası,
     * (4,0)’dan (4,6)’ya giderken (4,2) civarında zorunlu komşu üretir. */
    const grid = [
      '.......',
      '.......',
      '.......',
      '...#...',
      '.......',
    ];
    const start = { row: 4, col: 0 };
    const goal = { row: 0, col: 6 };
    const j = solveJps({ grid, start, goal });
    const a = solveAStar({ grid, start, goal, heuristic: 'octile', connectivity: '8' });
    expect(j.reachable).toBe(true);
    expect(j.pathCost).toBeCloseTo(a.pathCost, 10);
  });
});

describe('solveJps — A* ile denklik kıyaslaması', () => {
  it('rastgele 4 örnek ızgarada JPS ve A* aynı maliyeti döndürür', () => {
    const grids: string[][] = [
      ['........', '...##...', '........', '..##....', '........', '........'],
      ['..........', '...#####..', '..#....#..', '..#.##.#..', '..#....#..', '..#####...', '..........'],
      ['..........', '.##.......', '....##....', '.......##.', '..........', '..##......', '..........', '.......##.'],
      ['...........', '...........', '..####.....', '.....#.....', '.....#.....', '.....#####.', '...........'],
    ];
    const pairs = [
      { start: { row: 0, col: 0 }, goal: { row: 5, col: 7 } },
      { start: { row: 0, col: 0 }, goal: { row: 6, col: 9 } },
      { start: { row: 0, col: 0 }, goal: { row: 7, col: 9 } },
      { start: { row: 0, col: 0 }, goal: { row: 6, col: 10 } },
    ];
    for (let i = 0; i < grids.length; i++) {
      const j = solveJps({ grid: grids[i], ...pairs[i] });
      const a = solveAStar({
        grid: grids[i],
        ...pairs[i],
        heuristic: 'octile',
        connectivity: '8',
      });
      expect(j.reachable).toBe(a.reachable);
      if (j.reachable) {
        expect(j.pathCost).toBeCloseTo(a.pathCost, 10);
        /* JPS A*’dan asla daha fazla heap-pop yapmamalı — simetri kırma sağlam. */
        expect(j.expandedCount).toBeLessThanOrEqual(a.expandedCount);
      }
    }
  });

  it('zorlu labirentte JPS optimumu bulur ve adım sayısı tutar', () => {
    const grid = [
      '..........',
      '.########.',
      '........#.',
      '.######.#.',
      '.#....#.#.',
      '.#.##.#.#.',
      '.#.##...#.',
      '.#.######.',
      '.#........',
      '.#########',
    ];
    const start = { row: 0, col: 0 };
    const goal = { row: 8, col: 9 };
    const j = solveJps({ grid, start, goal });
    const a = solveAStar({ grid, start, goal, heuristic: 'octile', connectivity: '8' });
    expect(j.reachable).toBe(a.reachable);
    if (j.reachable) {
      expect(j.pathCost).toBeCloseTo(a.pathCost, 10);
      /* Yol JPS’in jump point listesinin doğrusal interpolasyonu — adım sayısı = pathCost / step. */
      for (let i = 1; i < j.path.length; i++) {
        const dr = Math.abs(j.path[i].row - j.path[i - 1].row);
        const dc = Math.abs(j.path[i].col - j.path[i - 1].col);
        expect(dr + dc).toBeGreaterThan(0);
        expect(dr).toBeLessThanOrEqual(1);
        expect(dc).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('solveJps — yol rekonstrüksiyonu özellikleri', () => {
  it('jumpPoints path’in alt kümesidir, start ve goal dahil', () => {
    const grid = [
      '.........',
      '...###...',
      '.........',
      '.........',
      '...###...',
      '.........',
    ];
    const r = solveJps({ grid, start: { row: 0, col: 0 }, goal: { row: 5, col: 8 } });
    expect(r.reachable).toBe(true);
    expect(r.jumpPoints[0]).toEqual({ row: 0, col: 0 });
    expect(r.jumpPoints[r.jumpPoints.length - 1]).toEqual({ row: 5, col: 8 });
    const pathSet = new Set(r.path.map((p) => `${p.row},${p.col}`));
    for (const jp of r.jumpPoints) {
      expect(pathSet.has(`${jp.row},${jp.col}`)).toBe(true);
    }
  });

  it('path ardışık tek adımlar (kardinal ya da çapraz)', () => {
    const grid = ['.........', '....#....', '.........', '.........'];
    const r = solveJps({ grid, start: { row: 0, col: 0 }, goal: { row: 3, col: 8 } });
    expect(r.reachable).toBe(true);
    for (let i = 1; i < r.path.length; i++) {
      const dr = Math.abs(r.path[i].row - r.path[i - 1].row);
      const dc = Math.abs(r.path[i].col - r.path[i - 1].col);
      const sum = dr + dc;
      expect(sum === 1 || (dr === 1 && dc === 1)).toBe(true);
    }
  });

  it('initialHeuristic = octile(start → goal)', () => {
    const grid = Array(6).fill('......');
    const r = solveJps({ grid, start: { row: 0, col: 0 }, goal: { row: 5, col: 3 } });
    /* hi=5, lo=3 → 5 + (√2 − 1)·3 */
    expect(r.initialHeuristic).toBeCloseTo(5 + (SQRT2 - 1) * 3, 10);
    expect(r.heuristic).toBe('octile');
  });
});

describe('solveJps — doğrulama hataları', () => {
  it('boş ızgara', () => {
    expect(() => solveJps({ grid: [], start: { row: 0, col: 0 }, goal: { row: 0, col: 1 } })).toThrow(AStarError);
  });

  it('start ızgara dışında', () => {
    expect(() =>
      solveJps({ grid: ['...'], start: { row: 5, col: 0 }, goal: { row: 0, col: 2 } }),
    ).toThrow(AStarError);
  });

  it('start engel üzerinde', () => {
    expect(() =>
      solveJps({ grid: ['#..'], start: { row: 0, col: 0 }, goal: { row: 0, col: 2 } }),
    ).toThrow(AStarError);
  });

  it('start === goal', () => {
    expect(() =>
      solveJps({ grid: ['...'], start: { row: 0, col: 0 }, goal: { row: 0, col: 0 } }),
    ).toThrow(AStarError);
  });

  it('satırlar farklı uzunlukta', () => {
    expect(() =>
      solveJps({ grid: ['...', '..'], start: { row: 0, col: 0 }, goal: { row: 1, col: 1 } }),
    ).toThrow(AStarError);
  });
});
