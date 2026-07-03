/**
 * JPS — Jump Point Search (Harabor & Grastien 2011).
 *
 * Eş-maliyetli (uniform-cost) 8-bağlantılı ızgaralarda A*'ın simetriyi
 * tanıyıp yüzlerce gereksiz düğüm açımını atlayan bir varyantıdır.
 * Optimum garantisi A* ile aynıdır (octile heuristic admissible olduğu
 * sürece) — fakat heap'e koyduğu düğüm sayısı dramatik olarak düşer,
 * büyük açık alanda 10×+ hızlanma vaat eder.
 *
 * Anahtar fikir: A*'ın açtığı çoğu düğüm "simetrik" — aynı çapraz yolu
 * farklı sıralarla katederek. JPS, parent → child yönünden gelirken
 * "doğal" (natural) komşuları (yön devamı) ve "zorunlu" (forced)
 * komşuları (engelin yarattığı sapma noktaları) ayırt eder; geri kalan
 * komşuları budar (prune).
 *
 * `jump(dx, dy)`: verilen yönde "atlamak"; durup heap'e konacak bir
 * **jump point** bulunana kadar duvardan, hedeften, zorunlu komşulu
 * hücreden ya da (çapraz hareketse) komponent kardinal yönlerden birinin
 * jump point bulmasından birine kadar ilerler. Aksi hâlde aynı yönde
 * yürümeye devam eder.
 *
 * Çapraz adımda corner-cutting kuralı A* ile aynı semantikle uygulanır:
 *   - `allowCornerCutting=false`: çapraz adımın iki kardinal komşusu da
 *     duvar ise adım reddedilir. (A*'ın varsayılan davranışı.)
 *   - `allowCornerCutting=true`: çapraz adım her durumda izinli.
 *
 * Yalnızca 8-bağlantı için anlamlı; 4-bağlantıda zorunlu komşu kavramı
 * boşalır (A* aynı işi yapar).
 *
 * Pure: no DOM, no I/O.
 *
 * Kaynak: Harabor & Grastien (2011), "Online Graph Pruning for
 * Pathfinding on Grid Maps", AAAI-11.
 */

import type { AStarCell, AStarHeuristic } from './astar';
import { AStarError } from './astar';

export interface JpsInput {
  grid: string[];
  start: AStarCell;
  goal: AStarCell;
  /** Varsayılan: 'octile' (8-bağlantı için doğal seçim). */
  heuristic?: AStarHeuristic;
  /** Varsayılan: false. true ise çapraz adım iki duvar arasında bile izinli. */
  allowCornerCutting?: boolean;
}

export interface JpsStep extends AStarCell {
  /** Heap'ten çıkış sırası (jump point'in açılma sırası). 0'dan başlar. */
  order: number;
  g: number;
  h: number;
  f: number;
}

export interface JpsResult {
  reachable: boolean;
  /** Tam yol — jump point'ler arası düz çizgide interpolasyon. */
  path: AStarCell[];
  pathCost: number;
  /** Yoldaki jump point'ler (path'in alt kümesi; start ve goal dahil). */
  jumpPoints: AStarCell[];
  jumpPointCount: number;
  /** Heap'ten çıkarılan jump point'ler — A*'ın "expanded" karşılığı. */
  expanded: JpsStep[];
  expandedCount: number;
  initialHeuristic: number;
  heuristic: AStarHeuristic;
  rows: number;
  cols: number;
}

const MAX_ROWS = 80;
const MAX_COLS = 80;
const SQRT2 = Math.SQRT2;

const PASSABLE_CHARS = new Set(['.', ' ', 'S', 'G', 's', 'g', 'o', 'O', '0']);

function isPassableChar(c: string): boolean {
  return PASSABLE_CHARS.has(c);
}

function validate(input: JpsInput): { rows: number; cols: number } {
  if (!Array.isArray(input.grid) || input.grid.length === 0) {
    throw new AStarError('Izgara en az bir satır içermeli.');
  }
  if (input.grid.length > MAX_ROWS) {
    throw new AStarError(`Satır sayısı en fazla ${MAX_ROWS} olabilir (${input.grid.length} verildi).`);
  }
  const cols = input.grid[0].length;
  if (cols === 0) {
    throw new AStarError('Izgara satırları boş olamaz.');
  }
  if (cols > MAX_COLS) {
    throw new AStarError(`Sütun sayısı en fazla ${MAX_COLS} olabilir (${cols} verildi).`);
  }
  for (let r = 0; r < input.grid.length; r++) {
    if (input.grid[r].length !== cols) {
      throw new AStarError(
        `Satır ${r + 1} uzunluğu ${input.grid[r].length}; tüm satırlar ${cols} sütun olmalı.`,
      );
    }
  }
  const rows = input.grid.length;
  const validCell = (cell: AStarCell, name: string): void => {
    if (
      !Number.isInteger(cell.row) ||
      !Number.isInteger(cell.col) ||
      cell.row < 0 ||
      cell.col < 0 ||
      cell.row >= rows ||
      cell.col >= cols
    ) {
      throw new AStarError(
        `${name} hücresi ızgaranın dışında: (${cell.row}, ${cell.col}). Geçerli aralık [0..${rows - 1}] × [0..${cols - 1}].`,
      );
    }
    const ch = input.grid[cell.row][cell.col];
    if (!isPassableChar(ch)) {
      throw new AStarError(
        `${name} hücresi (${cell.row}, ${cell.col}) bir engelin üstünde ('${ch}'). Boş bir hücre seçin.`,
      );
    }
  };
  validCell(input.start, 'Başlangıç');
  validCell(input.goal, 'Hedef');
  if (input.start.row === input.goal.row && input.start.col === input.goal.col) {
    throw new AStarError('Başlangıç ve hedef aynı hücre olamaz.');
  }
  return { rows, cols };
}

function heuristicOf(dr: number, dc: number, type: AStarHeuristic): number {
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  switch (type) {
    case 'manhattan':
      return adr + adc;
    case 'chebyshev':
      return Math.max(adr, adc);
    case 'octile': {
      const lo = Math.min(adr, adc);
      const hi = Math.max(adr, adc);
      return hi + (SQRT2 - 1) * lo;
    }
    case 'euclidean':
      return Math.hypot(adr, adc);
    case 'zero':
      return 0;
  }
}

interface HeapNode {
  f: number;
  h: number;
  idx: number;
}
class MinHeap {
  private heap: HeapNode[] = [];
  size(): number {
    return this.heap.length;
  }
  push(node: HeapNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }
  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }
  private lessThan(a: HeapNode, b: HeapNode): boolean {
    if (a.f !== b.f) return a.f < b.f;
    return a.h < b.h;
  }
  private bubbleUp(i: number): void {
    const h = this.heap;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.lessThan(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  private sinkDown(i: number): void {
    const h = this.heap;
    const n = h.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let best = i;
      if (l < n && this.lessThan(h[l], h[best])) best = l;
      if (r < n && this.lessThan(h[r], h[best])) best = r;
      if (best === i) break;
      [h[i], h[best]] = [h[best], h[i]];
      i = best;
    }
  }
}

export function solveJps(input: JpsInput): JpsResult {
  const { rows, cols } = validate(input);
  const heuristic = input.heuristic ?? 'octile';
  const allowCornerCut = input.allowCornerCutting ?? false;

  const n = rows * cols;
  const passable = new Uint8Array(n);
  for (let r = 0; r < rows; r++) {
    const row = input.grid[r];
    for (let c = 0; c < cols; c++) {
      if (isPassableChar(row[c])) passable[r * cols + c] = 1;
    }
  }

  const goalR = input.goal.row;
  const goalC = input.goal.col;
  const startR = input.start.row;
  const startC = input.start.col;
  const goalIdx = goalR * cols + goalC;
  const startIdx = startR * cols + startC;

  function walkable(r: number, c: number): boolean {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
    return passable[r * cols + c] === 1;
  }

  /**
   * (r, c) hücresine (dx, dy) yönünden gelinmişken çapraz adım geçerli mi?
   * Yalnızca dx, dy ikisi de sıfırdan farklıysa çağrılır.
   * Çağıran (parent = r-dx, c-dy)'den hedefe (r, c) çapraz hamle yapar.
   */
  function canDiagonalStep(parentR: number, parentC: number, dx: number, dy: number): boolean {
    if (allowCornerCut) return true;
    const side1 = walkable(parentR, parentC + dy); /* yatay komşu */
    const side2 = walkable(parentR + dx, parentC); /* dikey komşu */
    return side1 || side2; /* en az biri açık olmalı */
  }

  /**
   * Iteratif jump: (parentR, parentC)'den (dx, dy) yönünde adım atıp
   * jump point arar. Bulursa hücresini döndürür; sonsuza ya da duvara
   * çarparsa null.
   */
  function jump(parentR: number, parentC: number, dx: number, dy: number): AStarCell | null {
    let r = parentR + dx;
    let c = parentC + dy;
    while (true) {
      if (!walkable(r, c)) return null;
      /* Çapraz hamlede corner-cut kontrolü. */
      if (dx !== 0 && dy !== 0 && !canDiagonalStep(r - dx, c - dy, dx, dy)) return null;
      if (r === goalR && c === goalC) return { row: r, col: c };

      /* Zorunlu komşu (forced neighbor) kontrolü. */
      if (dx !== 0 && dy !== 0) {
        /* Çapraz: parent yönünün tersinde bir kardinal blocked + çaprazı açık. */
        if (!walkable(r - dx, c) && walkable(r - dx, c + dy)) return { row: r, col: c };
        if (!walkable(r, c - dy) && walkable(r + dx, c - dy)) return { row: r, col: c };
        /* Komponent kardinal yönlerinden biri jump point bulursa burası jump point. */
        if (jump(r, c, dx, 0) !== null) return { row: r, col: c };
        if (jump(r, c, 0, dy) !== null) return { row: r, col: c };
      } else if (dx !== 0) {
        /* Kardinal dikey hareket. */
        if (!walkable(r, c - 1) && walkable(r + dx, c - 1)) return { row: r, col: c };
        if (!walkable(r, c + 1) && walkable(r + dx, c + 1)) return { row: r, col: c };
      } else {
        /* Kardinal yatay hareket (dy !== 0). */
        if (!walkable(r - 1, c) && walkable(r - 1, c + dy)) return { row: r, col: c };
        if (!walkable(r + 1, c) && walkable(r + 1, c + dy)) return { row: r, col: c };
      }

      r += dx;
      c += dy;
    }
  }

  /** node için budanmış (pruned) komşu yönleri. Her biri (dx, dy). */
  function prunedDirections(nodeR: number, nodeC: number, parentR: number, parentC: number): Array<[number, number]> {
    const dirs: Array<[number, number]> = [];
    /* Start (parent yok) — 8 yönü de dene. */
    if (parentR < 0) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          /* Yön geçerli mi? Hedef hücre walkable ve çapraz ise corner-cut OK. */
          if (!walkable(nodeR + dx, nodeC + dy)) continue;
          if (dx !== 0 && dy !== 0 && !canDiagonalStep(nodeR, nodeC, dx, dy)) continue;
          dirs.push([dx, dy]);
        }
      }
      return dirs;
    }
    const pdx = Math.sign(nodeR - parentR);
    const pdy = Math.sign(nodeC - parentC);

    if (pdx !== 0 && pdy !== 0) {
      /* Çapraz parent yönü — doğal: 3 yön; zorunlu: 2 yön. */
      const upWalk = walkable(nodeR + pdx, nodeC);
      const sideWalk = walkable(nodeR, nodeC + pdy);
      if (upWalk) dirs.push([pdx, 0]);
      if (sideWalk) dirs.push([0, pdy]);
      /* Çapraz devam — corner-cut kuralı. */
      if (walkable(nodeR + pdx, nodeC + pdy) && canDiagonalStep(nodeR, nodeC, pdx, pdy)) {
        dirs.push([pdx, pdy]);
      }
      /* Zorunlu komşular: parent tersindeki kardinal blocked + arkası açık. */
      if (!walkable(nodeR - pdx, nodeC) && walkable(nodeR - pdx, nodeC + pdy)) {
        if (canDiagonalStep(nodeR, nodeC, -pdx, pdy)) dirs.push([-pdx, pdy]);
      }
      if (!walkable(nodeR, nodeC - pdy) && walkable(nodeR + pdx, nodeC - pdy)) {
        if (canDiagonalStep(nodeR, nodeC, pdx, -pdy)) dirs.push([pdx, -pdy]);
      }
    } else if (pdx !== 0) {
      /* Dikey kardinal — doğal: ileri; zorunlu: 2 olası çapraz. */
      if (walkable(nodeR + pdx, nodeC)) dirs.push([pdx, 0]);
      if (!walkable(nodeR, nodeC - 1) && walkable(nodeR + pdx, nodeC - 1)) {
        if (canDiagonalStep(nodeR, nodeC, pdx, -1)) dirs.push([pdx, -1]);
      }
      if (!walkable(nodeR, nodeC + 1) && walkable(nodeR + pdx, nodeC + 1)) {
        if (canDiagonalStep(nodeR, nodeC, pdx, 1)) dirs.push([pdx, 1]);
      }
    } else {
      /* Yatay kardinal (pdy !== 0). */
      if (walkable(nodeR, nodeC + pdy)) dirs.push([0, pdy]);
      if (!walkable(nodeR - 1, nodeC) && walkable(nodeR - 1, nodeC + pdy)) {
        if (canDiagonalStep(nodeR, nodeC, -1, pdy)) dirs.push([-1, pdy]);
      }
      if (!walkable(nodeR + 1, nodeC) && walkable(nodeR + 1, nodeC + pdy)) {
        if (canDiagonalStep(nodeR, nodeC, 1, pdy)) dirs.push([1, pdy]);
      }
    }
    return dirs;
  }

  /** İki hücre arasındaki straight-line mesafe (kardinal ya da çapraz). */
  function segmentCost(ar: number, ac: number, br: number, bc: number): number {
    const adr = Math.abs(br - ar);
    const adc = Math.abs(bc - ac);
    /* Aynı satır/sütun → kardinal; aksi hâlde adr == adc olmalı (çapraz). */
    if (adr === 0) return adc;
    if (adc === 0) return adr;
    return adr * SQRT2;
  }

  const gScore = new Float64Array(n).fill(Infinity);
  const pred = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  gScore[startIdx] = 0;

  const initialH = heuristicOf(startR - goalR, startC - goalC, heuristic);
  const heap = new MinHeap();
  heap.push({ f: initialH, h: initialH, idx: startIdx });

  const expanded: JpsStep[] = [];
  let found = false;

  while (heap.size() > 0) {
    const top = heap.pop()!;
    const u = top.idx;
    if (closed[u]) continue;
    closed[u] = 1;
    const ur = (u / cols) | 0;
    const uc = u - ur * cols;
    const hU = heuristicOf(ur - goalR, uc - goalC, heuristic);
    expanded.push({
      row: ur,
      col: uc,
      order: expanded.length,
      g: gScore[u],
      h: hU,
      f: gScore[u] + hU,
    });
    if (u === goalIdx) {
      found = true;
      break;
    }
    const pu = pred[u];
    const par = pu === -1 ? -1 : (pu / cols) | 0;
    const pac = pu === -1 ? -1 : pu - par * cols;
    const dirs = prunedDirections(ur, uc, par, pac);
    for (const [dx, dy] of dirs) {
      const jp = jump(ur, uc, dx, dy);
      if (jp === null) continue;
      const v = jp.row * cols + jp.col;
      if (closed[v]) continue;
      const tentativeG = gScore[u] + segmentCost(ur, uc, jp.row, jp.col);
      if (tentativeG < gScore[v]) {
        gScore[v] = tentativeG;
        pred[v] = u;
        const hV = heuristicOf(jp.row - goalR, jp.col - goalC, heuristic);
        heap.push({ f: tentativeG + hV, h: hV, idx: v });
      }
    }
  }

  let path: AStarCell[] = [];
  let pathCost = Infinity;
  const jumpPoints: AStarCell[] = [];
  if (found) {
    pathCost = gScore[goalIdx];
    /* Predecessor zincirini geri izle — sadece jump point'ler. */
    const jpChain: AStarCell[] = [];
    let cur = goalIdx;
    let safety = n + 1;
    while (cur !== -1) {
      if (safety-- <= 0) throw new AStarError('JPS geri izlemede iç hata: döngü.');
      const r = (cur / cols) | 0;
      const c = cur - r * cols;
      jpChain.push({ row: r, col: c });
      if (cur === startIdx) break;
      cur = pred[cur];
    }
    jpChain.reverse();
    jumpPoints.push(...jpChain);

    /* Jump point'ler arasını straight-line interpolasyon ile doldur. */
    if (jpChain.length > 0) {
      path.push(jpChain[0]);
      for (let i = 1; i < jpChain.length; i++) {
        const a = jpChain[i - 1];
        const b = jpChain[i];
        const ddr = Math.sign(b.row - a.row);
        const ddc = Math.sign(b.col - a.col);
        let r = a.row;
        let c = a.col;
        let safety2 = rows * cols + 1;
        while (r !== b.row || c !== b.col) {
          if (safety2-- <= 0) throw new AStarError('JPS interpolasyonunda iç hata: döngü.');
          r += ddr;
          c += ddc;
          path.push({ row: r, col: c });
        }
      }
    }
  }

  return {
    reachable: found,
    path,
    pathCost,
    jumpPoints,
    jumpPointCount: jumpPoints.length,
    expanded,
    expandedCount: expanded.length,
    initialHeuristic: initialH,
    heuristic,
    rows,
    cols,
  };
}
