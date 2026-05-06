/**
 * Traveling Salesman Problem (TSP) solver using nearest-neighbor heuristic
 * followed by 2-opt local search.
 *
 * Optimal solution is NP-hard; this approach trades exact optimality for
 * fast, "good enough" tours. For typical inputs (N ≤ 200) finishes in
 * milliseconds and produces tours within a few percent of optimal.
 *
 * Pure: no DOM, no I/O, deterministic for a given seed.
 */

export const MIN_POINTS = 2;
export const MAX_POINTS = 200;

export interface Point {
  /** Display label (e.g. city name). */
  label: string;
  x: number;
  y: number;
}

export interface TSPInput {
  points: ReadonlyArray<Point>;
  /** Whether the tour returns to the starting point (default true). */
  closed?: boolean;
  /** Run 2-opt improvement after nearest-neighbor (default true). */
  improve?: boolean;
  /** Starting point index (default 0). */
  start?: number;
}

export interface TSPResult {
  /** Order in which the points are visited (indices into the input). */
  order: number[];
  /** Total tour length (Euclidean distance). */
  totalDistance: number;
  closed: boolean;
  /** Per-leg distances between consecutive stops. */
  legDistances: number[];
  /** Algorithm phase that produced the final tour. */
  improvedBy2Opt: boolean;
  /** Number of 2-opt swaps applied. */
  swaps: number;
}

export class TSPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TSPError';
  }
}

function validate(input: TSPInput): void {
  const n = input.points.length;
  if (n < MIN_POINTS) {
    throw new TSPError(`En az ${MIN_POINTS} nokta gereklidir.`);
  }
  if (n > MAX_POINTS) {
    throw new TSPError(
      `Bu sürümde en fazla ${MAX_POINTS} nokta desteklenir (${n} verildi).`,
    );
  }
  for (const p of input.points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new TSPError(`Nokta koordinatları sayı olmalı: "${p.label}".`);
    }
  }
  if (input.start !== undefined && (input.start < 0 || input.start >= n)) {
    throw new TSPError(`Başlangıç noktası geçersiz: ${input.start}`);
  }
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function tourLength(
  points: ReadonlyArray<Point>,
  order: ReadonlyArray<number>,
  closed: boolean,
): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += distance(points[order[i]], points[order[i + 1]]);
  }
  if (closed && order.length > 1) {
    total += distance(points[order[order.length - 1]], points[order[0]]);
  }
  return total;
}

function nearestNeighbor(
  points: ReadonlyArray<Point>,
  start: number,
): number[] {
  const n = points.length;
  const visited = new Array<boolean>(n).fill(false);
  const order = [start];
  visited[start] = true;
  let current = start;

  for (let step = 1; step < n; step++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = distance(points[current], points[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    order.push(bestIdx);
    visited[bestIdx] = true;
    current = bestIdx;
  }
  return order;
}

/**
 * 2-opt local search: repeatedly reverses sub-tours that decrease total
 * tour length. Stops when no improvement is found in a full pass.
 */
function twoOpt(
  points: ReadonlyArray<Point>,
  initialOrder: ReadonlyArray<number>,
  closed: boolean,
): { order: number[]; swaps: number } {
  const n = initialOrder.length;
  const order = [...initialOrder];
  let swaps = 0;
  let improved = true;
  let safety = 0;
  const maxIterations = n * n * 4 + 100;

  while (improved && safety++ < maxIterations) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      const iEnd = closed ? n : n - 1;
      for (let j = i + 1; j < iEnd; j++) {
        if (j === i + 1) continue;
        const a = order[i];
        const b = order[(i + 1) % n];
        const c = order[j];
        const d = order[(j + 1) % n];
        const before = distance(points[a], points[b]) + distance(points[c], points[d]);
        const after = distance(points[a], points[c]) + distance(points[b], points[d]);
        if (after + 1e-9 < before) {
          // Reverse segment [i+1..j]
          let left = i + 1;
          let right = j;
          while (left < right) {
            const tmp = order[left];
            order[left] = order[right];
            order[right] = tmp;
            left++;
            right--;
          }
          improved = true;
          swaps++;
        }
      }
    }
  }
  return { order, swaps };
}

export function solveTSP(input: TSPInput): TSPResult {
  validate(input);
  const { points, closed = true, improve = true, start = 0 } = input;

  let order = nearestNeighbor(points, start);
  let swaps = 0;
  if (improve) {
    const opt = twoOpt(points, order, closed);
    order = opt.order;
    swaps = opt.swaps;
  }

  const legDistances: number[] = [];
  for (let i = 0; i < order.length - 1; i++) {
    legDistances.push(distance(points[order[i]], points[order[i + 1]]));
  }
  if (closed && order.length > 1) {
    legDistances.push(
      distance(points[order[order.length - 1]], points[order[0]]),
    );
  }

  return {
    order,
    totalDistance: tourLength(points, order, closed),
    closed,
    legDistances,
    improvedBy2Opt: improve && swaps > 0,
    swaps,
  };
}

/**
 * Serialise points back into the textual format that `parsePoints` accepts.
 * Round-trip stable: parsePoints(pointsToText(p)) reconstructs an equivalent
 * Point[] (modulo float formatting at very high precision).
 *
 * Numbers are rendered with a `.` decimal separator. parsePoints accepts both
 * `.` and `,`, so the textual editor stays Turkish-comma friendly while the
 * generated text is unambiguous.
 */
export function pointsToText(points: ReadonlyArray<Point>): string {
  return points
    .map((p) => `${p.label}\t${formatNum(p.x)}\t${formatNum(p.y)}`)
    .join('\n');
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  /* Avoid trailing zeros from naive toString. */
  return n.toString();
}

/**
 * Parse "label<TAB>x<TAB>y" lines into Points. Comma reserved as Turkish
 * decimal separator.
 */
export function parsePoints(input: string): Point[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line, idx) => {
    const cells = line.split(/[\t;]+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3) {
      throw new TSPError(
        `Satır ${idx + 1}: "etiket<TAB>x<TAB>y" biçimi gerekli (${cells.length} alan).`,
      );
    }
    const [label, xStr, yStr] = cells;
    const x = Number(xStr.replace(',', '.'));
    const y = Number(yStr.replace(',', '.'));
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new TSPError(`Satır ${idx + 1}: koordinatlar sayı olmalı.`);
    }
    return { label, x, y };
  });
}
