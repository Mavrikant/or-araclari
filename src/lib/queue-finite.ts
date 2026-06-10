/**
 * Finite-capacity M/M queue performance metrics.
 *
 * Complement to `queue-mm1.ts` (M/M/1) and `queue-mmc.ts` (M/M/c with
 * infinite buffer). Here we cover two finite-capacity Kendall variants:
 *
 *   M/M/1/K   — one server, system holds at most K customers
 *   M/M/c/K   — c servers, system holds at most K (≥ c) customers
 *
 * In both cases an arrival that finds the system full is lost (blocked).
 * The chain is finite, so the system is always steady-state stable —
 * even when λ > μ. The interesting quantities are the blocking
 * probability P_K and the effective accepted arrival rate λ_eff.
 *
 * Notation (Gross/Harris, Kleinrock vol. 1):
 *
 *   λ          arrival rate (Poisson)
 *   μ          service rate per server (exponential)
 *   c          number of parallel servers
 *   K          system capacity (incl. in-service customers); K ≥ c
 *   a = λ/μ    offered load
 *   ρ = a/c    per-server utilisation
 *   P_n        steady-state P(N = n) for n = 0…K
 *   P_K        blocking probability
 *   λ_eff      λ · (1 − P_K)
 *   L, Lq      mean number in system / queue
 *   W, Wq      mean time in system / queue (Little's law on λ_eff)
 *
 * Special cases:
 *   K = c          M/M/c/c — Erlang-B loss system
 *   ρ = 1, c = 1   uniform P_n = 1/(K+1)
 *   K → ∞          converges to M/M/c (Erlang-C)
 *
 * Pure: no DOM, no I/O.
 */

export type FiniteQueueModel = 'mm1k' | 'mmck';

export interface FiniteQueueInput {
  model: FiniteQueueModel;
  arrivalRate: number;
  serviceRate: number;
  /** Servers c. Forced to 1 for M/M/1/K. */
  servers?: number;
  /** System capacity K (incl. in-service). Required. */
  capacity: number;
}

export interface FiniteQueueResult {
  model: FiniteQueueModel;
  servers: number;
  capacity: number;
  offeredLoad: number;       // a = λ/μ
  utilisation: number;       // ρ = a/c — informational; system stays stable either way
  blockingProbability: number; // P_K
  effectiveArrivalRate: number; // λ_eff = λ · (1 − P_K)
  avgInSystem: number;       // L
  avgInQueue: number;        // Lq
  avgTimeInSystem: number;   // W  (Little's law on λ_eff)
  avgTimeInQueue: number;    // Wq
  probEmpty: number;         // P_0
  /** Full distribution P_n for n = 0…K. */
  stateProbabilities: number[];
}

export class FiniteQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FiniteQueueError';
  }
}

function validate(input: FiniteQueueInput): { c: number; K: number } {
  const { model, arrivalRate, serviceRate } = input;
  if (model !== 'mm1k' && model !== 'mmck') {
    throw new FiniteQueueError(`Bilinmeyen model: ${String(model)}.`);
  }
  if (typeof arrivalRate !== 'number' || !Number.isFinite(arrivalRate) || arrivalRate <= 0) {
    throw new FiniteQueueError(`Geliş hızı (λ) pozitif bir sayı olmalı (${arrivalRate} verildi).`);
  }
  if (typeof serviceRate !== 'number' || !Number.isFinite(serviceRate) || serviceRate <= 0) {
    throw new FiniteQueueError(`Hizmet hızı (μ) pozitif bir sayı olmalı (${serviceRate} verildi).`);
  }
  let c = model === 'mm1k' ? 1 : (input.servers ?? 1);
  if (!Number.isInteger(c) || c < 1) {
    throw new FiniteQueueError(`Sunucu sayısı (c) en az 1 olmalı (${c} verildi).`);
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    throw new FiniteQueueError(`Sistem kapasitesi (K) pozitif bir tamsayı olmalı (${input.capacity} verildi).`);
  }
  if (input.capacity < c) {
    throw new FiniteQueueError(
      `Sistem kapasitesi (K=${input.capacity}) sunucu sayısından (c=${c}) küçük olamaz.`,
    );
  }
  return { c, K: input.capacity };
}

/**
 * Birth/death recurrence for the finite chain:
 *   q_0 = 1
 *   q_n = q_{n-1} · a / min(n, c)        for n = 1…K
 *   P_n = q_n / Σ q
 *
 * Sidesteps factorial overflow even for large c, K.
 */
function steadyState(a: number, c: number, K: number): number[] {
  const q: number[] = [1];
  for (let n = 1; n <= K; n++) q.push(q[n - 1] * (a / Math.min(n, c)));
  let sum = 0;
  for (const v of q) sum += v;
  return q.map((v) => v / sum);
}

export function analyzeFiniteQueue(input: FiniteQueueInput): FiniteQueueResult {
  const { c, K } = validate(input);
  const lambda = input.arrivalRate;
  const mu = input.serviceRate;
  const a = lambda / mu;
  const rho = a / c;

  const P = steadyState(a, c, K);

  const blockingProbability = P[K] ?? 0;
  const effectiveArrivalRate = lambda * (1 - blockingProbability);

  // Lq via Σ_{n>c} (n−c) P_n.
  let Lq = 0;
  for (let n = c + 1; n <= K; n++) Lq += (n - c) * P[n];

  // L: avg number in service = λ_eff/μ (effective served rate divided by μ).
  const avgInService = effectiveArrivalRate / mu;
  const L = Lq + avgInService;

  const Wq = effectiveArrivalRate > 0 ? Lq / effectiveArrivalRate : 0;
  const W = effectiveArrivalRate > 0 ? L / effectiveArrivalRate : 0;

  return {
    model: input.model,
    servers: c,
    capacity: K,
    offeredLoad: a,
    utilisation: rho,
    blockingProbability,
    effectiveArrivalRate,
    avgInSystem: L,
    avgInQueue: Lq,
    avgTimeInSystem: W,
    avgTimeInQueue: Wq,
    probEmpty: P[0],
    stateProbabilities: P,
  };
}

/**
 * Erlang-B loss formula B(c, a) for the M/M/c/c kayıp sistemi.
 * Closed form via the standard recurrence, numerically stable for
 * large c. Exposed for content cross-checks and external use.
 */
export function erlangB(servers: number, offeredLoad: number): number {
  if (!Number.isInteger(servers) || servers < 1) {
    throw new FiniteQueueError('Sunucu sayısı pozitif bir tamsayı olmalı.');
  }
  if (!Number.isFinite(offeredLoad) || offeredLoad <= 0) {
    throw new FiniteQueueError('Offered load (a = λ/μ) pozitif olmalı.');
  }
  let B = 1;
  for (let n = 1; n <= servers; n++) {
    B = (offeredLoad * B) / (n + offeredLoad * B);
  }
  return B;
}
