/**
 * Discrete-time Markov chain — stationary distribution and transient
 * evolution.
 *
 * Given an n×n row-stochastic transition matrix P (P[i][j] = P(X_{t+1}=j | X_t=i))
 * and an optional initial distribution π₀, compute:
 *
 *   - the stationary distribution π such that π = π·P and Σπᵢ = 1
 *   - mean recurrence time for each state (1/πᵢ when πᵢ > 0)
 *   - transient trajectory π₀·Pᵗ for t = 0..steps (for charting)
 *
 * Method for π: solve the linear system πᵀ·(P − I) = 0 together with the
 * normalization Σπᵢ = 1. We replace the last equation with the
 * normalization row and run plain Gaussian elimination with partial
 * pivoting — this is robust for irreducible aperiodic chains (the typical
 * teaching example) and small n (≤ ~30).
 *
 * For irreducibility / aperiodicity we don't try to be exhaustive — if the
 * solver runs into a singular matrix (reducible chain), we report it; for
 * periodic chains the linear-system solution is still well-defined (the
 * unique time-average distribution) even though power iteration would
 * oscillate.
 *
 * Pure: no DOM, no I/O.
 */

export interface MarkovInput {
  /** n×n row-stochastic matrix. Each row must sum to 1 (tolerance 1e-6). */
  transition: number[][];
  /** Optional state labels (length n). Defaults to "S1".."Sn". */
  labels?: string[];
  /** Optional initial distribution π₀ (length n, sums to 1). Defaults to a delta on state 0. */
  initial?: number[];
  /** Number of transient steps to compute for the trajectory. Defaults to 20. */
  steps?: number;
}

export interface MarkovResult {
  /** State labels (echoed back for convenience). */
  labels: string[];
  /** Stationary distribution π (length n). */
  stationary: number[];
  /** Mean recurrence time 1/πᵢ; Infinity for transient states (πᵢ = 0). */
  meanRecurrence: number[];
  /**
   * Trajectory π^(t) for t = 0..steps. trajectory[t] is the distribution
   * after t transitions starting from `initial`. trajectory[0] === initial.
   */
  trajectory: number[][];
  /** Initial distribution used (echoed for convenience). */
  initial: number[];
  /** True if the linear-system solver detected a singular matrix → chain likely reducible. */
  reducible: boolean;
}

export class MarkovError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkovError';
  }
}

const ROW_SUM_TOL = 1e-6;

function validate(input: MarkovInput): void {
  const P = input.transition;
  if (!Array.isArray(P) || P.length === 0) {
    throw new MarkovError('Geçiş matrisi boş olamaz.');
  }
  const n = P.length;
  if (n > 50) {
    throw new MarkovError(`Geçiş matrisi en fazla 50×50 olabilir (verilen: ${n}).`);
  }
  for (let i = 0; i < n; i++) {
    const row = P[i];
    if (!Array.isArray(row) || row.length !== n) {
      throw new MarkovError(`Satır ${i + 1} ${n} sütun içermeli (mevcut: ${row?.length ?? 0}).`);
    }
    let s = 0;
    for (let j = 0; j < n; j++) {
      const v = row[j];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new MarkovError(`Hücre [${i + 1}, ${j + 1}] geçerli sayı değil.`);
      }
      if (v < -ROW_SUM_TOL || v > 1 + ROW_SUM_TOL) {
        throw new MarkovError(`Hücre [${i + 1}, ${j + 1}] = ${v}; olasılık 0 ile 1 arasında olmalı.`);
      }
      s += v;
    }
    if (Math.abs(s - 1) > 1e-3) {
      throw new MarkovError(`Satır ${i + 1} olasılık toplamı 1 olmalı (mevcut: ${s.toFixed(4)}).`);
    }
  }
  if (input.labels && input.labels.length !== n) {
    throw new MarkovError(`Etiket sayısı (${input.labels.length}) durum sayısına (${n}) eşit olmalı.`);
  }
  if (input.initial) {
    if (input.initial.length !== n) {
      throw new MarkovError(`Başlangıç dağılımı uzunluğu ${n} olmalı.`);
    }
    let s = 0;
    for (const v of input.initial) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < -ROW_SUM_TOL) {
        throw new MarkovError('Başlangıç dağılımı negatif olmayan sayılardan oluşmalı.');
      }
      s += v;
    }
    if (Math.abs(s - 1) > 1e-3) {
      throw new MarkovError(`Başlangıç dağılımı toplamı 1 olmalı (mevcut: ${s.toFixed(4)}).`);
    }
  }
}

/**
 * Solve A·x = b via Gaussian elimination with partial pivoting. A is n×n,
 * b is length n. Modifies copies; returns x. Returns null if singular.
 */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let k = 0; k < n; k++) {
    // partial pivot
    let piv = k;
    let pivVal = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k]);
      if (v > pivVal) {
        pivVal = v;
        piv = i;
      }
    }
    if (pivVal < 1e-12) return null;
    if (piv !== k) [M[k], M[piv]] = [M[piv], M[k]];

    const pivotVal = M[k][k];
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / pivotVal;
      if (factor === 0) continue;
      for (let j = k; j <= n; j++) {
        M[i][j] -= factor * M[k][j];
      }
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * Multiply a row vector v (length n) by matrix P (n×n) → v·P (length n).
 */
function rowMul(v: number[], P: number[][]): number[] {
  const n = P.length;
  const out = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += v[i] * P[i][j];
    out[j] = s;
  }
  return out;
}

export function analyzeMarkov(input: MarkovInput): MarkovResult {
  validate(input);
  const P = input.transition;
  const n = P.length;
  const labels = input.labels?.slice() ?? Array.from({ length: n }, (_, i) => `S${i + 1}`);

  // Build the linear system: π·P = π → πᵀ·(Pᵀ − I) = 0.
  // Concretely: for each j, Σᵢ πᵢ·P[i][j] − πⱼ = 0.
  // Rows of A are the balance equations; replace the last row with Σπᵢ = 1.
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      A[j][i] = P[i][j];
    }
    A[j][j] -= 1;
  }
  for (let i = 0; i < n; i++) A[n - 1][i] = 1;
  const b = new Array<number>(n).fill(0);
  b[n - 1] = 1;

  const solved = solveLinear(A, b);
  let reducible = false;
  let stationary: number[];

  if (solved === null) {
    // Singular → reducible / multiple stationary distributions exist.
    // Fall back to power iteration from uniform start; it converges to *some*
    // stationary distribution (the one reachable from the uniform mix).
    reducible = true;
    let pi = new Array<number>(n).fill(1 / n);
    for (let it = 0; it < 5000; it++) {
      const next = rowMul(pi, P);
      let diff = 0;
      for (let i = 0; i < n; i++) diff += Math.abs(next[i] - pi[i]);
      pi = next;
      if (diff < 1e-12) break;
    }
    stationary = pi;
  } else {
    // Clamp tiny negatives produced by float noise, then renormalize.
    stationary = solved.map((v) => (v < 0 && v > -1e-9 ? 0 : v));
    const total = stationary.reduce((a, c) => a + c, 0);
    if (total > 0) stationary = stationary.map((v) => v / total);
  }

  const meanRecurrence = stationary.map((p) => (p > 0 ? 1 / p : Infinity));

  // Transient trajectory π₀·Pᵗ.
  const steps = input.steps ?? 20;
  if (steps < 0 || steps > 500) {
    throw new MarkovError('Adım sayısı 0 ile 500 arasında olmalı.');
  }
  const initial = input.initial?.slice() ?? (() => {
    const v = new Array<number>(n).fill(0);
    v[0] = 1;
    return v;
  })();
  const trajectory: number[][] = [initial.slice()];
  let current = initial.slice();
  for (let t = 1; t <= steps; t++) {
    current = rowMul(current, P);
    trajectory.push(current.slice());
  }

  return { labels, stationary, meanRecurrence, trajectory, initial, reducible };
}

/**
 * Parse a transition matrix from a plain-text textarea. Rows separated by
 * newline, entries by whitespace or comma. Empty/blank lines are skipped.
 *
 * Throws MarkovError on malformed input. Does NOT validate row-stochastic;
 * that happens in analyzeMarkov.
 */
export function parseMatrix(text: string): number[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) throw new MarkovError('Matris boş.');
  const rows: number[][] = lines.map((line, idx) => {
    const parts = line.split(/[\s,;]+/).filter((p) => p.length > 0);
    if (parts.length === 0) throw new MarkovError(`Satır ${idx + 1} boş.`);
    return parts.map((p) => {
      const v = Number(p);
      if (!Number.isFinite(v)) {
        throw new MarkovError(`Satır ${idx + 1}: "${p}" geçerli sayı değil.`);
      }
      return v;
    });
  });
  const n = rows.length;
  for (let i = 0; i < n; i++) {
    if (rows[i].length !== n) {
      throw new MarkovError(`Satır ${i + 1} ${n} sütun içermeli (mevcut: ${rows[i].length}). Matris kare olmalı.`);
    }
  }
  return rows;
}
