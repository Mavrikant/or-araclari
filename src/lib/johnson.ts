/**
 * Johnson's Rule (1954) — optimal makespan sequencing for the two-machine
 * flow-shop problem F2 || Cmax, and its Johnson-Bellman extension for
 * three machines when the special-structure condition holds.
 *
 * Two-machine flow shop: every job visits M1 then M2. Given n jobs with
 * processing times (a_i, b_i), find a permutation that minimizes makespan
 * (completion time of the last job on M2). Johnson (1954) proved that the
 * SPT-style rule below is optimal:
 *
 *   1. Split jobs into set U = {i : a_i ≤ b_i} and V = {i : a_i > b_i}.
 *   2. Sort U by a_i ascending; sort V by b_i descending.
 *   3. Optimal sequence is U followed by V.
 *
 * Ties are broken arbitrarily but consistently (input order). All optimal
 * sequences share the same makespan, but the *set* of optimal sequences
 * may contain more than one — this implementation returns one of them.
 *
 * Three-machine flow shop F3 || Cmax is NP-hard in general, but Johnson
 * (1954) showed that if EITHER
 *   min a_i ≥ max b_i    OR    min c_i ≥ max b_i
 * holds, then the problem reduces to a two-machine flow shop with
 * pseudo-times (a_i + b_i, b_i + c_i) and can be solved optimally by the
 * same rule. Otherwise the reduction is only a heuristic (still very
 * commonly used in textbooks); we report the makespan on the real three
 * machines and flag whether the reduction was exact or heuristic.
 *
 * Pure: no DOM, no I/O.
 */

export interface JohnsonJob {
  /** Human-facing label for the job (e.g. "İş 1", "A"). */
  label: string;
  /** Processing time on machine 1. Must be ≥ 0 (0 means "skip M1"). */
  p1: number;
  /** Processing time on machine 2. Must be ≥ 0. */
  p2: number;
  /**
   * Optional processing time on machine 3. If provided for at least one
   * job, ALL jobs must have p3 defined and the three-machine flow-shop
   * variant is solved.
   */
  p3?: number;
}

export interface JohnsonScheduleEntry {
  /** Position in the optimal sequence (1-indexed). */
  order: number;
  /** Original job label. */
  label: string;
  /** Original job index (0-indexed). */
  jobIndex: number;
  /** Start / end on machine 1. */
  m1Start: number;
  m1End: number;
  /** Start / end on machine 2. */
  m2Start: number;
  m2End: number;
  /**
   * Idle time on M2 immediately before this job starts (m2Start − previous
   * m2End, first job in sequence uses m1End as the "previous m2 end").
   */
  m2IdleBefore: number;
  /** Machine 3 fields; present only for three-machine problems. */
  m3Start?: number;
  m3End?: number;
  m3IdleBefore?: number;
}

export interface JohnsonResult {
  /** Number of machines the problem was solved on (2 or 3). */
  machines: 2 | 3;
  /** Optimal sequence (list of job indices in permutation order). */
  sequence: number[];
  /** Rich per-slot schedule with start/end on each machine. */
  schedule: JohnsonScheduleEntry[];
  /** Cmax — total time until the last job finishes on the last machine. */
  makespan: number;
  /** Sum of idle time on M1 (only at the tail, if any). */
  m1Idle: number;
  /** Sum of idle time on M2. */
  m2Idle: number;
  /** Sum of idle time on M3 (three-machine only, else 0). */
  m3Idle: number;
  /**
   * For the three-machine variant:
   *   - 'exact' means Johnson's reduction condition holds and the plan is
   *     provably optimal.
   *   - 'heuristic' means the condition fails; we still report the
   *     Johnson-Bellman schedule as a well-known heuristic and its
   *     makespan is a valid upper bound.
   * For the two-machine variant this is always 'exact'.
   */
  optimality: 'exact' | 'heuristic';
  /**
   * Human-readable reason for the optimality label. Empty for the
   * two-machine variant.
   */
  reductionNote: string;
  /**
   * The virtual (α, β) times used by Johnson's Rule internally. For the
   * two-machine case α = p1, β = p2. For the three-machine case
   * α = p1 + p2, β = p2 + p3. Exposed so the UI can show the reduction.
   */
  virtualTimes: { label: string; alpha: number; beta: number; group: 'U' | 'V' }[];
}

export class JohnsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JohnsonError';
  }
}

function validate(jobs: JohnsonJob[]): 2 | 3 {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new JohnsonError('En az bir iş girilmelidir.');
  }
  if (jobs.length > 200) {
    throw new JohnsonError('İş sayısı 200 ile sınırlıdır (tarayıcı UX).');
  }
  const hasP3 = jobs.some((j) => j.p3 !== undefined);
  const allHaveP3 = jobs.every((j) => j.p3 !== undefined);
  if (hasP3 && !allHaveP3) {
    throw new JohnsonError('Bazı işlerde M3 süresi verilmiş, bazılarında verilmemiş — hepsi için doldurun ya da hepsini boş bırakın.');
  }
  const check = (name: string, v: number, i: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new JohnsonError(`İş ${i + 1} için ${name} sonlu bir sayı olmalıdır.`);
    }
    if (v < 0) {
      throw new JohnsonError(`İş ${i + 1} için ${name} negatif olamaz (${v} verildi).`);
    }
  };
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    if (typeof j.label !== 'string' || j.label.trim() === '') {
      throw new JohnsonError(`İş ${i + 1} için etiket boş olamaz.`);
    }
    check('M1 süresi', j.p1, i);
    check('M2 süresi', j.p2, i);
    if (allHaveP3) check('M3 süresi', j.p3 as number, i);
  }
  return allHaveP3 ? 3 : 2;
}

/**
 * Core Johnson's Rule on virtual (α, β) pairs. Returns the permutation of
 * job indices. Ties are broken by original index (stable).
 */
function johnsonPermutation(times: { alpha: number; beta: number; index: number }[]): number[] {
  const U: typeof times = [];
  const V: typeof times = [];
  for (const t of times) {
    if (t.alpha <= t.beta) U.push(t);
    else V.push(t);
  }
  U.sort((a, b) => a.alpha - b.alpha || a.index - b.index);
  V.sort((a, b) => b.beta - a.beta || a.index - b.index);
  return [...U, ...V].map((t) => t.index);
}

/**
 * Simulate a permutation on m machines (m ∈ {2, 3}) in a permutation flow
 * shop — every job visits all machines in the same order. Returns the
 * makespan-aware schedule entries and machine idle totals.
 */
function simulate(jobs: JohnsonJob[], sequence: number[], machines: 2 | 3): {
  schedule: JohnsonScheduleEntry[];
  makespan: number;
  m1Idle: number;
  m2Idle: number;
  m3Idle: number;
} {
  const schedule: JohnsonScheduleEntry[] = [];
  let m1Now = 0;
  let m2Now = 0;
  let m3Now = 0;
  let m1Idle = 0;
  let m2Idle = 0;
  let m3Idle = 0;
  for (let k = 0; k < sequence.length; k++) {
    const idx = sequence[k];
    const j = jobs[idx];

    const m1Start = m1Now;
    const m1End = m1Start + j.p1;
    m1Now = m1End;

    const m2Start = Math.max(m1End, m2Now);
    const m2IdleBefore = m2Start - m2Now;
    m2Idle += m2IdleBefore;
    const m2End = m2Start + j.p2;
    m2Now = m2End;

    const entry: JohnsonScheduleEntry = {
      order: k + 1,
      label: j.label,
      jobIndex: idx,
      m1Start,
      m1End,
      m2Start,
      m2End,
      m2IdleBefore,
    };

    if (machines === 3) {
      const p3 = j.p3 as number;
      const m3Start = Math.max(m2End, m3Now);
      const m3IdleBefore = m3Start - m3Now;
      m3Idle += m3IdleBefore;
      const m3End = m3Start + p3;
      m3Now = m3End;
      entry.m3Start = m3Start;
      entry.m3End = m3End;
      entry.m3IdleBefore = m3IdleBefore;
    }

    schedule.push(entry);
  }
  const makespan = machines === 3 ? m3Now : m2Now;
  return { schedule, makespan, m1Idle, m2Idle, m3Idle };
}

export function solveJohnson(jobs: JohnsonJob[]): JohnsonResult {
  const machines = validate(jobs);

  let times: { alpha: number; beta: number; index: number }[];
  let optimality: 'exact' | 'heuristic' = 'exact';
  let reductionNote = '';

  if (machines === 2) {
    times = jobs.map((j, i) => ({ alpha: j.p1, beta: j.p2, index: i }));
  } else {
    const p1 = jobs.map((j) => j.p1);
    const p2 = jobs.map((j) => j.p2);
    const p3 = jobs.map((j) => j.p3 as number);
    const minA = Math.min(...p1);
    const maxB = Math.max(...p2);
    const minC = Math.min(...p3);
    const condA = minA >= maxB;
    const condB = minC >= maxB;
    if (condA || condB) {
      optimality = 'exact';
      reductionNote = condA
        ? `min(pᵢ₁) = ${minA} ≥ max(pᵢ₂) = ${maxB} olduğundan Johnson-Bellman iki-makina indirgemesi optimum verir.`
        : `min(pᵢ₃) = ${minC} ≥ max(pᵢ₂) = ${maxB} olduğundan Johnson-Bellman iki-makina indirgemesi optimum verir.`;
    } else {
      optimality = 'heuristic';
      reductionNote = `İndirgeme koşulu sağlanmıyor (min(pᵢ₁) = ${minA} ve min(pᵢ₃) = ${minC} < max(pᵢ₂) = ${maxB}). Sonuç Johnson-Bellman sezgiselidir; optimum için genel permütasyon araması gerekir.`;
    }
    times = jobs.map((j, i) => ({ alpha: j.p1 + j.p2, beta: j.p2 + (j.p3 as number), index: i }));
  }

  const sequence = johnsonPermutation(times);
  const sim = simulate(jobs, sequence, machines);

  const virtualTimes = jobs.map((j, i) => {
    const t = times.find((x) => x.index === i)!;
    const group: 'U' | 'V' = t.alpha <= t.beta ? 'U' : 'V';
    return { label: j.label, alpha: t.alpha, beta: t.beta, group };
  });

  return {
    machines,
    sequence,
    schedule: sim.schedule,
    makespan: sim.makespan,
    m1Idle: sim.m1Idle,
    m2Idle: sim.m2Idle,
    m3Idle: sim.m3Idle,
    optimality,
    reductionNote,
    virtualTimes,
  };
}

/**
 * Brute-force optimum permutation makespan on m ∈ {2, 3} machines. Used
 * in tests and as a "provably optimal" fallback the UI can offer for
 * small n (≤ 8). O(n!) — do not call with large n.
 */
export function bruteForceOptimum(jobs: JohnsonJob[]): { sequence: number[]; makespan: number } {
  const machines = validate(jobs);
  const n = jobs.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  let best: { sequence: number[]; makespan: number } = {
    sequence: indices.slice(),
    makespan: Number.POSITIVE_INFINITY,
  };

  const permute = (arr: number[], start: number): void => {
    if (start === arr.length - 1) {
      const m = simulate(jobs, arr, machines).makespan;
      if (m < best.makespan) best = { sequence: arr.slice(), makespan: m };
      return;
    }
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  };
  permute(indices.slice(), 0);
  return best;
}
