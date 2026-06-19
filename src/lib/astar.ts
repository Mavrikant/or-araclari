/**
 * A* (A-yıldız) — bilgili (informed) ızgara üzerinde en kısa yol arayışı.
 *
 * 2D ızgarada bir başlangıç hücresinden hedef hücreye en kısa yolu
 * heuristic (sezgisel) bir tahmin fonksiyonu yardımıyla bulur:
 *
 *   f(n) = g(n) + h(n)
 *
 * g(n): başlangıçtan n'e bilinen en kısa yol maliyeti
 * h(n): n'den hedefe sezgisel (admissible) alt sınır
 *
 * Heuristic **kabul edilebilir** (admissible) ise — yani gerçek
 * uzaklığı asla aşırı tahmin etmiyorsa — A* her zaman optimum yolu
 * bulur. **Tutarlı** (consistent / monotonic) ise zaten kapatılmış
 * (closed) bir düğüm bir daha açılmaz; tüm yaygın grid heuristic'leri
 * (Manhattan, Euclidean, Chebyshev, Octile) bağlantı türü ile uyumlu
 * seçildiğinde hem admissible hem consistent'tır.
 *
 * Bağlantı (connectivity):
 *   - "4": dört yön (N, S, E, W) — her hareket maliyeti 1.
 *   - "8": sekiz yön (köşeleri de dahil) — kardinal 1, çapraz √2.
 *     Çapraz hareket bir engelin köşesinden geçemez (corner-cutting
 *     yasak): kaynak hücreden çapraz komşusuna giderken aradaki iki
 *     kardinal komşudan en az biri açık olmalıdır.
 *
 * Heuristic seçimi:
 *   - "manhattan": |dx| + |dy| — 4 bağlantıda admissible.
 *   - "chebyshev": max(|dx|, |dy|) — 8 bağlantıda eşit maliyet için.
 *   - "octile": max(|dx|, |dy|) + (√2 − 1) · min(|dx|, |dy|) — 8 bağlantı
 *     (kardinal 1, çapraz √2) için optimal sınır.
 *   - "euclidean": √(dx² + dy²) — her bağlantı için admissible, ama 4
 *     bağlantıda gevşek (genelde Manhattan daha sıkı).
 *   - "zero": h(n) = 0 — A* Dijkstra'ya indirgenir; doğrulama için.
 *
 * Çıktı: bulunan yol (hücre listesi), maliyeti, A*'ın gerçekten
 * "kapattığı" (closed list) hücre sayısı ve hangi sırayla genişletildiği —
 * heuristic'in iyiliği bu sayıyla ölçülür: bilgili arama, körlemeden çok
 * daha az hücre açmalı.
 *
 * Pure: no DOM, no I/O.
 */

export type AStarHeuristic = 'manhattan' | 'euclidean' | 'chebyshev' | 'octile' | 'zero';

export type AStarConnectivity = '4' | '8';

export interface AStarCell {
  row: number;
  col: number;
}

export interface AStarInput {
  /**
   * Izgara satırları — her satır eşit uzunlukta bir string.
   * '.' veya ' ' geçilebilir; '#' veya 'X' engel. Diğer karakterler engel sayılır.
   * 'S' ve 'G' işaretleri start/goal yerine de kullanılabilir (ama parametre öncelikli).
   */
  grid: string[];
  start: AStarCell;
  goal: AStarCell;
  heuristic?: AStarHeuristic;
  connectivity?: AStarConnectivity;
  /**
   * "8" bağlantıda iki engel arasında çapraz geçişe izin verilsin mi?
   * Varsayılan false (corner-cutting yasak — daha gerçekçi).
   */
  allowCornerCutting?: boolean;
}

export interface AStarStep extends AStarCell {
  /** Genişletme sırası — 0'dan başlar. */
  order: number;
  g: number;
  h: number;
  f: number;
}

export interface AStarResult {
  reachable: boolean;
  path: AStarCell[];
  pathCost: number;
  expanded: AStarStep[];
  expandedCount: number;
  /**
   * Heuristic'in başlangıç noktasından hedefe verdiği alt sınır —
   * gerçek yol maliyetinden ne kadar gevşek olduğu kullanıcıya rapor edilir.
   */
  initialHeuristic: number;
  heuristic: AStarHeuristic;
  connectivity: AStarConnectivity;
  rows: number;
  cols: number;
}

export class AStarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AStarError';
  }
}

const MAX_ROWS = 80;
const MAX_COLS = 80;
const SQRT2 = Math.SQRT2;

const PASSABLE_CHARS = new Set(['.', ' ', 'S', 'G', 's', 'g', 'o', 'O', '0']);

function isPassableChar(c: string): boolean {
  return PASSABLE_CHARS.has(c);
}

function validate(input: AStarInput): { rows: number; cols: number } {
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

function computeHeuristic(
  dr: number,
  dc: number,
  type: AStarHeuristic,
): number {
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

/* Min-heap; anahtar f, tie-break h (FIFO benzeri davranış için ikincil). */
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

interface Neighbor {
  dr: number;
  dc: number;
  cost: number;
}
const NEIGH_4: Neighbor[] = [
  { dr: -1, dc: 0, cost: 1 },
  { dr: 1, dc: 0, cost: 1 },
  { dr: 0, dc: -1, cost: 1 },
  { dr: 0, dc: 1, cost: 1 },
];
const NEIGH_8: Neighbor[] = [
  { dr: -1, dc: 0, cost: 1 },
  { dr: 1, dc: 0, cost: 1 },
  { dr: 0, dc: -1, cost: 1 },
  { dr: 0, dc: 1, cost: 1 },
  { dr: -1, dc: -1, cost: SQRT2 },
  { dr: -1, dc: 1, cost: SQRT2 },
  { dr: 1, dc: -1, cost: SQRT2 },
  { dr: 1, dc: 1, cost: SQRT2 },
];

export function solveAStar(input: AStarInput): AStarResult {
  const { rows, cols } = validate(input);
  const heuristic = input.heuristic ?? 'manhattan';
  const connectivity = input.connectivity ?? '4';
  const allowCornerCut = input.allowCornerCutting ?? false;
  const neighbors = connectivity === '8' ? NEIGH_8 : NEIGH_4;

  /* Engel ızgarası — true = açık. */
  const n = rows * cols;
  const passable = new Uint8Array(n);
  for (let r = 0; r < rows; r++) {
    const row = input.grid[r];
    for (let c = 0; c < cols; c++) {
      if (isPassableChar(row[c])) passable[r * cols + c] = 1;
    }
  }

  const goalIdx = input.goal.row * cols + input.goal.col;
  const startIdx = input.start.row * cols + input.start.col;
  const initialH = computeHeuristic(
    input.start.row - input.goal.row,
    input.start.col - input.goal.col,
    heuristic,
  );

  const gScore = new Float64Array(n).fill(Infinity);
  const pred = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  gScore[startIdx] = 0;

  const heap = new MinHeap();
  heap.push({ f: initialH, h: initialH, idx: startIdx });
  const expanded: AStarStep[] = [];

  let found = false;
  while (heap.size() > 0) {
    const top = heap.pop()!;
    const u = top.idx;
    if (closed[u]) continue;
    closed[u] = 1;
    const ur = (u / cols) | 0;
    const uc = u - ur * cols;
    const hU = computeHeuristic(ur - input.goal.row, uc - input.goal.col, heuristic);
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
    for (const nb of neighbors) {
      const vr = ur + nb.dr;
      const vc = uc + nb.dc;
      if (vr < 0 || vc < 0 || vr >= rows || vc >= cols) continue;
      const v = vr * cols + vc;
      if (!passable[v]) continue;
      /* Çapraz hareket — corner-cutting yasak ise iki kardinal komşudan en az biri açık olmalı. */
      if (nb.dr !== 0 && nb.dc !== 0 && !allowCornerCut) {
        const side1 = ur * cols + (uc + nb.dc); /* yatay komşu */
        const side2 = (ur + nb.dr) * cols + uc; /* dikey komşu */
        if (!passable[side1] && !passable[side2]) continue;
      }
      const tentativeG = gScore[u] + nb.cost;
      if (tentativeG < gScore[v]) {
        gScore[v] = tentativeG;
        pred[v] = u;
        const hV = computeHeuristic(vr - input.goal.row, vc - input.goal.col, heuristic);
        heap.push({ f: tentativeG + hV, h: hV, idx: v });
      }
    }
  }

  let path: AStarCell[] = [];
  let pathCost = Infinity;
  if (found) {
    pathCost = gScore[goalIdx];
    /* Predecessor zincirini geri izle. */
    const buf: AStarCell[] = [];
    let cur = goalIdx;
    let safety = n + 1;
    while (cur !== -1) {
      if (safety-- <= 0) throw new AStarError('Yol geri izlemede iç hata: döngü.');
      const r = (cur / cols) | 0;
      const c = cur - r * cols;
      buf.push({ row: r, col: c });
      if (cur === startIdx) break;
      cur = pred[cur];
    }
    buf.reverse();
    path = buf;
  }

  return {
    reachable: found,
    path,
    pathCost,
    expanded,
    expandedCount: expanded.length,
    initialHeuristic: initialH,
    heuristic,
    connectivity,
    rows,
    cols,
  };
}
