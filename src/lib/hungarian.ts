/**
 * Hungarian (Munkres) algorithm for the linear assignment problem.
 *
 * Given an N×M cost matrix C, find an assignment of rows to columns
 * (each row to exactly one column, each column to at most one row) that
 * minimises (or maximises) the sum of selected entries.
 *
 * Complexity: O(N³). Comfortable for N up to a few hundred in the browser.
 *
 * Implementation follows the classic step-by-step Munkres algorithm with
 * row/column reductions and zero-covering iterations. Pure: no DOM, no I/O.
 */

export const MIN_DIM = 1;
export const MAX_DIM = 32;
export const INF = Number.POSITIVE_INFINITY;

export interface AssignmentInput {
  /** Cost matrix; rows = agents, columns = tasks. */
  costs: ReadonlyArray<ReadonlyArray<number>>;
  /** When true, maximises total instead of minimising. */
  maximize?: boolean;
  /** Optional row labels (e.g. agent names) for the result. */
  rowLabels?: ReadonlyArray<string>;
  /** Optional column labels (e.g. task names) for the result. */
  colLabels?: ReadonlyArray<string>;
}

export interface Assignment {
  row: number;
  col: number;
  rowLabel?: string;
  colLabel?: string;
  cost: number;
}

export interface AssignmentResult {
  assignments: Assignment[];
  totalCost: number;
  rows: number;
  cols: number;
  square: boolean;
}

export class AssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssignmentError';
  }
}

function validate(input: AssignmentInput): void {
  const { costs } = input;
  if (!costs.length) {
    throw new AssignmentError('Maliyet matrisi boş olamaz.');
  }
  const rows = costs.length;
  const cols = costs[0].length;
  if (rows < MIN_DIM || cols < MIN_DIM) {
    throw new AssignmentError(`Matris en az ${MIN_DIM}×${MIN_DIM} olmalıdır.`);
  }
  if (rows > MAX_DIM || cols > MAX_DIM) {
    throw new AssignmentError(
      `Bu sürümde matris en fazla ${MAX_DIM}×${MAX_DIM} desteklenir.`,
    );
  }
  for (let i = 0; i < rows; i++) {
    if (costs[i].length !== cols) {
      throw new AssignmentError(
        `Her satır aynı sayıda sütuna sahip olmalıdır (satır ${i + 1} ${costs[i].length} sütun, beklenen ${cols}).`,
      );
    }
    for (let j = 0; j < cols; j++) {
      if (!Number.isFinite(costs[i][j])) {
        throw new AssignmentError(
          `Maliyet sayı olmalıdır (satır ${i + 1}, sütun ${j + 1}).`,
        );
      }
    }
  }
  if (input.rowLabels && input.rowLabels.length !== rows) {
    throw new AssignmentError(
      `Satır etiketi sayısı (${input.rowLabels.length}) satır sayısına (${rows}) eşit olmalıdır.`,
    );
  }
  if (input.colLabels && input.colLabels.length !== cols) {
    throw new AssignmentError(
      `Sütun etiketi sayısı (${input.colLabels.length}) sütun sayısına (${cols}) eşit olmalıdır.`,
    );
  }
}

/**
 * Pads a matrix to square dimensions with a large constant. The original
 * orientation is preserved; padded rows/cols are removed from the final
 * assignment list before returning.
 */
function padToSquare(
  costs: ReadonlyArray<ReadonlyArray<number>>,
  pad: number,
): { matrix: number[][]; size: number } {
  const rows = costs.length;
  const cols = costs[0].length;
  const size = Math.max(rows, cols);
  const matrix: number[][] = [];
  for (let i = 0; i < size; i++) {
    const row = new Array<number>(size);
    for (let j = 0; j < size; j++) {
      row[j] = i < rows && j < cols ? costs[i][j] : pad;
    }
    matrix.push(row);
  }
  return { matrix, size };
}

/**
 * Munkres step. Returns an array of length N where assignment[r] = c
 * means row r is matched to column c.
 */
function munkres(matrix: number[][]): number[] {
  const n = matrix.length;
  const m = matrix.map((row) => [...row]);

  // Step 1: row reduction.
  for (let i = 0; i < n; i++) {
    let min = m[i][0];
    for (let j = 1; j < n; j++) if (m[i][j] < min) min = m[i][j];
    for (let j = 0; j < n; j++) m[i][j] -= min;
  }

  // Step 2: column reduction.
  for (let j = 0; j < n; j++) {
    let min = m[0][j];
    for (let i = 1; i < n; i++) if (m[i][j] < min) min = m[i][j];
    for (let i = 0; i < n; i++) m[i][j] -= min;
  }

  // Mask: 0 = none, 1 = starred zero, 2 = primed zero.
  const mask: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0),
  );
  const rowCovered = new Array<boolean>(n).fill(false);
  const colCovered = new Array<boolean>(n).fill(false);

  // Step 3: star zeros (one per row and column).
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (m[i][j] === 0 && !rowCovered[i] && !colCovered[j]) {
        mask[i][j] = 1;
        rowCovered[i] = true;
        colCovered[j] = true;
      }
    }
  }
  rowCovered.fill(false);
  colCovered.fill(false);

  const coverColumnsWithStars = (): number => {
    let count = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (mask[i][j] === 1) {
          colCovered[j] = true;
          count++;
          break;
        }
      }
    }
    return count;
  };

  const findUncoveredZero = (): [number, number] | null => {
    for (let i = 0; i < n; i++) {
      if (rowCovered[i]) continue;
      for (let j = 0; j < n; j++) {
        if (!colCovered[j] && m[i][j] === 0) return [i, j];
      }
    }
    return null;
  };

  const findStarInRow = (row: number): number => {
    for (let j = 0; j < n; j++) if (mask[row][j] === 1) return j;
    return -1;
  };

  const findStarInCol = (col: number): number => {
    for (let i = 0; i < n; i++) if (mask[i][col] === 1) return i;
    return -1;
  };

  const findPrimeInRow = (row: number): number => {
    for (let j = 0; j < n; j++) if (mask[row][j] === 2) return j;
    return -1;
  };

  const findSmallestUncovered = (): number => {
    let min = INF;
    for (let i = 0; i < n; i++) {
      if (rowCovered[i]) continue;
      for (let j = 0; j < n; j++) {
        if (!colCovered[j] && m[i][j] < min) min = m[i][j];
      }
    }
    return min;
  };

  let coveredCols = coverColumnsWithStars();
  let safetyIterations = 0;
  const maxSafetyIterations = n * n * n + 100;

  while (coveredCols < n) {
    if (++safetyIterations > maxSafetyIterations) {
      throw new AssignmentError(
        'Algoritma yakınsamadı. Bu durum tipik olarak sayısal bir hatadan kaynaklanır.',
      );
    }

    let uncovered = findUncoveredZero();

    if (!uncovered) {
      // Step 6: adjust matrix.
      const min = findSmallestUncovered();
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (rowCovered[i]) m[i][j] += min;
          if (!colCovered[j]) m[i][j] -= min;
        }
      }
      continue;
    }

    const [r, c] = uncovered;
    mask[r][c] = 2; // prime
    const starCol = findStarInRow(r);
    if (starCol !== -1) {
      rowCovered[r] = true;
      colCovered[starCol] = false;
      continue;
    }

    // Step 5: alternating path.
    const path: Array<[number, number]> = [[r, c]];
    let curRow: number;
    let curCol = c;
    while (true) {
      const starInCol = findStarInCol(curCol);
      if (starInCol === -1) break;
      path.push([starInCol, curCol]);
      curRow = starInCol;
      const primeInRow = findPrimeInRow(curRow);
      path.push([curRow, primeInRow]);
      curCol = primeInRow;
    }

    for (const [pi, pj] of path) {
      mask[pi][pj] = mask[pi][pj] === 1 ? 0 : 1;
    }

    rowCovered.fill(false);
    colCovered.fill(false);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (mask[i][j] === 2) mask[i][j] = 0;
      }
    }

    coveredCols = coverColumnsWithStars();
  }

  const result = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (mask[i][j] === 1) {
        result[i] = j;
        break;
      }
    }
  }
  return result;
}

export function solveAssignment(input: AssignmentInput): AssignmentResult {
  validate(input);
  const rows = input.costs.length;
  const cols = input.costs[0].length;
  const square = rows === cols;

  // For maximisation, negate so the standard min-cost solver works.
  let working: number[][] = input.costs.map((r) => [...r]);
  if (input.maximize) {
    let max = -INF;
    for (const row of working) for (const v of row) if (v > max) max = v;
    working = working.map((row) => row.map((v) => max - v));
  }

  // Shift to non-negative for stability when negative costs are present.
  let minVal = INF;
  for (const row of working) for (const v of row) if (v < minVal) minVal = v;
  if (minVal < 0) {
    for (let i = 0; i < working.length; i++) {
      for (let j = 0; j < working[i].length; j++) {
        working[i][j] -= minVal;
      }
    }
  }

  // Pick a pad value larger than any cell so dummy assignments are never
  // chosen over real ones.
  let maxVal = 0;
  for (const row of working) for (const v of row) if (v > maxVal) maxVal = v;
  const pad = maxVal * (Math.max(rows, cols) + 1) + 1;

  const { matrix } = padToSquare(working, pad);
  const result = munkres(matrix);

  const assignments: Assignment[] = [];
  let total = 0;
  for (let i = 0; i < rows; i++) {
    const j = result[i];
    if (j === -1 || j >= cols) continue;
    const realCost = input.costs[i][j];
    total += realCost;
    assignments.push({
      row: i,
      col: j,
      cost: realCost,
      ...(input.rowLabels ? { rowLabel: input.rowLabels[i] } : {}),
      ...(input.colLabels ? { colLabel: input.colLabels[j] } : {}),
    });
  }

  return {
    assignments,
    totalCost: total,
    rows,
    cols,
    square,
  };
}

/**
 * Parse a cost matrix from a textarea string. Rows separated by newlines,
 * cells by tab, semicolon, or whitespace. Comma is reserved as the Turkish
 * decimal separator (e.g. "1,5" → 1.5) — use tabs/semicolons for cell
 * separation.
 */
export function parseCostMatrix(input: string): number[][] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line) => {
    const cells = line.split(/[\t;\s]+/).filter((c) => c.length > 0);
    return cells.map((c) => {
      const n = Number(c.replace(',', '.'));
      if (Number.isNaN(n)) {
        throw new AssignmentError(`"${c}" geçerli bir sayı değil.`);
      }
      return n;
    });
  });
}
