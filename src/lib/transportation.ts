/**
 * Classical Transportation Problem solver.
 *
 *   minimize   ∑_{i,j} c_ij · x_ij
 *   subject to ∑_j x_ij = a_i     (supply at source i)
 *              ∑_i x_ij = b_j     (demand at destination j)
 *              x_ij ≥ 0
 *
 * Method: North-West Corner rule for an initial basic feasible solution,
 * then MODI (u-v / stepping-stone) iterations until the reduced cost of
 * every non-basic cell is ≥ 0.
 *
 * Unbalanced problems (∑a ≠ ∑b) are auto-balanced internally with a dummy
 * source or destination at zero cost; the dummy column/row is reported back
 * in the result so the UI can label undelivered demand / unused supply.
 *
 * Pure: no DOM, no I/O. Safe to call from the browser or Node tests.
 */

export type Direction = 'min' | 'max';

export interface TransportationInput {
  /** Supply at each source, length m. All values must be ≥ 0. */
  supply: number[];
  /** Demand at each destination, length n. All values must be ≥ 0. */
  demand: number[];
  /** Cost matrix c[i][j], m × n. Non-negative real entries. */
  cost: number[][];
  /** 'min' (default) or 'max'. Max is solved via c' = M − c. */
  direction?: Direction;
}

export interface TransportationCell {
  i: number;
  j: number;
  /** Shipment amount on this lane. */
  amount: number;
  /** Unit cost from the original input matrix (0 for dummy lanes). */
  unitCost: number;
  /** Whether this cell is in the dummy row/column. */
  isDummy: boolean;
}

export interface TransportationResult {
  /** Total cost (in original problem direction; for 'max' this is the objective value). */
  totalCost: number;
  /** Allocation matrix in the BALANCED size (mB × nB). */
  allocation: number[][];
  /** Non-zero shipments, sorted by (i, j). */
  shipments: TransportationCell[];
  /** Effective balanced dimensions (mB, nB) after dummy padding. */
  balancedSize: { m: number; n: number };
  /** Index of the dummy source if one was added; null otherwise. */
  dummySource: number | null;
  /** Index of the dummy destination if one was added; null otherwise. */
  dummyDestination: number | null;
  /** MODI iterations performed (0 = initial solution was already optimal). */
  iterations: number;
  /** Total supply (before balancing). */
  totalSupply: number;
  /** Total demand (before balancing). */
  totalDemand: number;
  /** Effective problem direction. */
  direction: Direction;
}

export class TransportationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportationError';
  }
}

const EPS = 1e-9;
/** Soft cap on MODI iterations — well above what real-world problems need. */
const MAX_ITER = 1000;

function validate(input: TransportationInput): void {
  const { supply, demand, cost } = input;
  if (!Array.isArray(supply) || supply.length === 0) {
    throw new TransportationError('En az bir kaynak (supply) tanımlanmalıdır.');
  }
  if (!Array.isArray(demand) || demand.length === 0) {
    throw new TransportationError('En az bir hedef (demand) tanımlanmalıdır.');
  }
  if (!Array.isArray(cost) || cost.length !== supply.length) {
    throw new TransportationError(
      `Maliyet matrisinin satır sayısı kaynak sayısına eşit olmalıdır (${supply.length} bekleniyor, ${Array.isArray(cost) ? cost.length : '?'} verildi).`,
    );
  }
  for (let i = 0; i < supply.length; i++) {
    const row = cost[i];
    if (!Array.isArray(row) || row.length !== demand.length) {
      throw new TransportationError(
        `Satır ${i + 1} sütun sayısı hedef sayısına eşit olmalıdır (${demand.length} bekleniyor).`,
      );
    }
    for (let j = 0; j < demand.length; j++) {
      const v = row[j];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new TransportationError(`Maliyet hücresi [${i + 1},${j + 1}] sayı olmalıdır.`);
      }
      if (v < 0) {
        throw new TransportationError(
          `Maliyet hücresi [${i + 1},${j + 1}] negatif olamaz (${v} verildi).`,
        );
      }
    }
  }
  for (let i = 0; i < supply.length; i++) {
    const v = supply[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TransportationError(`Kaynak ${i + 1} kapasitesi 0 veya pozitif olmalıdır.`);
    }
  }
  for (let j = 0; j < demand.length; j++) {
    const v = demand[j];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TransportationError(`Hedef ${j + 1} talebi 0 veya pozitif olmalıdır.`);
    }
  }
  const totalS = supply.reduce((s, v) => s + v, 0);
  const totalD = demand.reduce((s, v) => s + v, 0);
  if (totalS <= 0 || totalD <= 0) {
    throw new TransportationError('Toplam arz ve toplam talep sıfırdan büyük olmalıdır.');
  }
}

/**
 * North-West Corner rule. Returns an initial basic feasible solution
 * along with the list of basic cells (length m+n-1, with degenerate
 * problems padded by ε-cells so MODI duals are well-defined).
 */
function northWestCorner(
  supply: number[],
  demand: number[],
): { alloc: number[][]; basics: Array<[number, number]> } {
  const m = supply.length;
  const n = demand.length;
  const s = supply.slice();
  const d = demand.slice();
  const alloc: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  const basics: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    const x = Math.min(s[i], d[j]);
    alloc[i][j] = x;
    basics.push([i, j]);
    s[i] -= x;
    d[j] -= x;
    // Move to the next corner. When both vanish simultaneously, prefer
    // stepping along the row so the next cell still belongs to the active
    // row/col — this is the standard tie-break that keeps |basics| = m+n-1.
    if (s[i] < EPS && d[j] < EPS) {
      // Degenerate step: keep an ε-basic on the next column (if any) so
      // the basic set stays the right size for MODI.
      if (j + 1 < n) {
        j++;
        basics.push([i, j]);
        i++;
      } else if (i + 1 < m) {
        i++;
        basics.push([i, j]);
        j++;
      } else {
        i++;
        j++;
      }
    } else if (s[i] < EPS) {
      i++;
    } else {
      j++;
    }
  }
  return { alloc, basics };
}

/**
 * Compute dual variables u_i, v_j for a basic set via u_0 = 0 and
 * u_i + v_j = c_ij on every basic cell. Propagates iteratively until
 * stable. If the basic set is too small (degenerate after MODI pivots)
 * we patch any unresolved row/col with 0 — the residual reduced costs
 * will still be valid because the patched value only affects unreachable
 * cells of the auxiliary graph.
 */
function computeDuals(
  basics: Array<[number, number]>,
  cost: number[][],
  m: number,
  n: number,
): { u: number[]; v: number[] } {
  const u: number[] = new Array(m).fill(NaN);
  const v: number[] = new Array(n).fill(NaN);
  u[0] = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [i, j] of basics) {
      if (!Number.isNaN(u[i]) && Number.isNaN(v[j])) {
        v[j] = cost[i][j] - u[i];
        progressed = true;
      } else if (Number.isNaN(u[i]) && !Number.isNaN(v[j])) {
        u[i] = cost[i][j] - v[j];
        progressed = true;
      }
    }
  }
  for (let i = 0; i < m; i++) if (Number.isNaN(u[i])) u[i] = 0;
  for (let j = 0; j < n; j++) if (Number.isNaN(v[j])) v[j] = 0;
  return { u, v };
}

/**
 * Find a stepping-stone cycle that starts at `enter` and uses only basic
 * cells otherwise. Returns the cycle as an ordered list of cells
 * [enter, c1, c2, …] with alternating row/column moves; the entering
 * cell is implicitly closed at the end. Returns null if no cycle exists
 * (shouldn't happen for a valid BFS, but we guard against it).
 *
 * Algorithm: the classic "peeling" trick — iteratively drop any cell
 * that is alone in its row or column among the candidate set. What's
 * left is exactly the cycle nodes.
 */
function findCycle(
  basics: Array<[number, number]>,
  enter: [number, number],
): Array<[number, number]> | null {
  const key = (c: [number, number]): string => `${c[0]},${c[1]}`;
  const pool = new Map<string, [number, number]>();
  for (const c of basics) pool.set(key(c), c);
  pool.set(key(enter), enter);

  let changed = true;
  while (changed) {
    changed = false;
    const rowCount = new Map<number, number>();
    const colCount = new Map<number, number>();
    for (const c of pool.values()) {
      rowCount.set(c[0], (rowCount.get(c[0]) ?? 0) + 1);
      colCount.set(c[1], (colCount.get(c[1]) ?? 0) + 1);
    }
    for (const c of Array.from(pool.values())) {
      if ((rowCount.get(c[0]) ?? 0) < 2 || (colCount.get(c[1]) ?? 0) < 2) {
        pool.delete(key(c));
        changed = true;
      }
    }
  }
  if (!pool.has(key(enter))) return null;

  // Order remaining cells into a cycle starting at `enter`, alternating
  // row/column moves.
  const cycle: Array<[number, number]> = [enter];
  pool.delete(key(enter));
  let cur = enter;
  let moveByRow = true;
  while (pool.size > 0) {
    let next: [number, number] | null = null;
    for (const c of pool.values()) {
      if (moveByRow ? c[0] === cur[0] : c[1] === cur[1]) {
        next = c;
        break;
      }
    }
    if (!next) return null;
    cycle.push(next);
    pool.delete(key(next));
    cur = next;
    moveByRow = !moveByRow;
  }
  // Sanity: cycle length must be even and ≥ 4.
  if (cycle.length < 4 || cycle.length % 2 !== 0) return null;
  return cycle;
}

/** Returns true if (i, j) is in the basic set. */
function inBasics(basics: Array<[number, number]>, i: number, j: number): boolean {
  for (const [bi, bj] of basics) if (bi === i && bj === j) return true;
  return false;
}

export function solveTransportation(input: TransportationInput): TransportationResult {
  validate(input);
  const direction: Direction = input.direction ?? 'min';
  const supplyOrig = input.supply.slice();
  const demandOrig = input.demand.slice();
  const costOrig = input.cost.map((r) => r.slice());

  const totalSupply = supplyOrig.reduce((s, v) => s + v, 0);
  const totalDemand = demandOrig.reduce((s, v) => s + v, 0);

  // Balance with a dummy row or column at zero cost.
  let dummySource: number | null = null;
  let dummyDestination: number | null = null;
  const supply = supplyOrig.slice();
  const demand = demandOrig.slice();
  const cost = costOrig.map((r) => r.slice());

  if (totalSupply > totalDemand + EPS) {
    dummyDestination = demand.length;
    demand.push(totalSupply - totalDemand);
    for (let i = 0; i < supply.length; i++) cost[i].push(0);
  } else if (totalDemand > totalSupply + EPS) {
    dummySource = supply.length;
    supply.push(totalDemand - totalSupply);
    cost.push(new Array(demand.length).fill(0));
  }

  const m = supply.length;
  const n = demand.length;

  // Maximization: flip costs by subtracting from a constant ≥ max(c).
  // The dummy lanes already carry 0 in `cost`; we transform only the
  // real entries (rows/cols outside the dummy) so dummies stay 0.
  let solveCost = cost;
  let maxOriginal = 0;
  if (direction === 'max') {
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (i === dummySource || j === dummyDestination) continue;
        if (cost[i][j] > maxOriginal) maxOriginal = cost[i][j];
      }
    }
    solveCost = cost.map((r, i) =>
      r.map((v, j) => {
        if (i === dummySource || j === dummyDestination) return 0;
        return maxOriginal - v;
      }),
    );
  }

  const { alloc, basics } = northWestCorner(supply, demand);
  let basicSet: Array<[number, number]> = basics;

  let iterations = 0;
  while (iterations < MAX_ITER) {
    const { u, v } = computeDuals(basicSet, solveCost, m, n);

    // Find the most negative reduced cost among non-basic cells.
    let bestI = -1;
    let bestJ = -1;
    let bestDelta = -EPS;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (inBasics(basicSet, i, j)) continue;
        const delta = solveCost[i][j] - (u[i] + v[j]);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI < 0) break; // Optimum reached.

    const cycle = findCycle(basicSet, [bestI, bestJ]);
    if (!cycle) {
      // Should not happen for a valid BFS; fall back to current solution.
      break;
    }

    // theta = min of alloc on "−" cells (odd-indexed in the cycle).
    let theta = Infinity;
    let leaveIdx = -1;
    for (let k = 1; k < cycle.length; k += 2) {
      const [ci, cj] = cycle[k];
      if (alloc[ci][cj] < theta) {
        theta = alloc[ci][cj];
        leaveIdx = k;
      }
    }
    if (!Number.isFinite(theta) || leaveIdx < 0) break;

    // Pivot.
    for (let k = 0; k < cycle.length; k++) {
      const [ci, cj] = cycle[k];
      alloc[ci][cj] += k % 2 === 0 ? theta : -theta;
    }
    const [li, lj] = cycle[leaveIdx];
    // Replace the leaving basic cell with the entering one.
    basicSet = basicSet.filter((b) => !(b[0] === li && b[1] === lj));
    basicSet.push([bestI, bestJ]);

    iterations++;
  }

  // Compute total cost in ORIGINAL direction using the original cost matrix.
  let totalCost = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (alloc[i][j] > EPS) totalCost += alloc[i][j] * cost[i][j];
    }
  }

  // Materialize shipments (skip ε-cells with 0 allocation).
  const shipments: TransportationCell[] = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (alloc[i][j] > EPS) {
        shipments.push({
          i,
          j,
          amount: alloc[i][j],
          unitCost: cost[i][j],
          isDummy: i === dummySource || j === dummyDestination,
        });
      }
    }
  }

  return {
    totalCost,
    allocation: alloc,
    shipments,
    balancedSize: { m, n },
    dummySource,
    dummyDestination,
    iterations,
    totalSupply,
    totalDemand,
    direction,
  };
}
