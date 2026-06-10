/**
 * M/M/c multi-server queue performance metrics.
 *
 * Notation (Kendall): M (memoryless Poisson arrivals), M (memoryless
 * exponential service), c (c identical parallel servers, FIFO, infinite
 * capacity, infinite source). Steady-state assumes ρ = λ/(c·μ) < 1.
 *
 * Closed-form formulas (textbook standard; Gross/Harris "Fundamentals of
 * Queueing Theory" or Kleinrock vol. 1):
 *
 *   a = λ/μ            (offered load, in Erlangs)
 *   ρ = a/c            (per-server utilisation)
 *
 *   P₀ = 1 / [ Σ_{n=0}^{c-1} a^n / n!  +  a^c / (c! · (1 − ρ)) ]
 *
 *   Erlang-C  C(c, a) = a^c / [ c! · (1 − ρ) ] · P₀     (P[wait > 0])
 *
 *   Lq = C(c, a) · ρ / (1 − ρ)
 *   L  = Lq + a
 *   Wq = Lq / λ
 *   W  = L  / λ = Wq + 1/μ
 *
 *   P(n) = a^n / n!         · P₀                for 0 ≤ n ≤ c
 *   P(n) = a^n / (c! · c^(n−c)) · P₀            for n ≥ c
 *
 * For c = 1 these collapse exactly to M/M/1 (Erlang-C → ρ, Lq → ρ²/(1−ρ)).
 *
 * Pure: no DOM, no I/O.
 */

export interface MmcInput {
  /** Arrival rate λ (units per time unit). */
  arrivalRate: number;
  /** Service rate μ per server (units per time unit). */
  serviceRate: number;
  /** Number of identical parallel servers c (positive integer). */
  servers: number;
}

export interface MmcResult {
  servers: number;             // c
  offeredLoad: number;         // a = λ/μ
  utilisation: number;         // ρ = a/c (per-server, system-wide)
  probEmpty: number;           // P0
  probWait: number;            // Erlang-C C(c, a) — probability arriving job must wait
  avgInSystem: number;         // L
  avgInQueue: number;          // Lq
  avgTimeInSystem: number;     // W
  avgTimeInQueue: number;      // Wq
  /** Probability that exactly n customers are in the system, for n=0..nmax. */
  stateProbabilities: number[];
}

export class MmcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MmcError';
  }
}

function validate(input: MmcInput): void {
  for (const [k, label] of [
    ['arrivalRate', 'Geliş hızı (λ)'],
    ['serviceRate', 'Hizmet hızı (μ)'],
    ['servers', 'Sunucu sayısı (c)'],
  ] as const) {
    const v = input[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new MmcError(`${label} geçerli bir sayı olmalı.`);
    }
    if (v <= 0) {
      throw new MmcError(`${label} pozitif olmalı (${v} verildi).`);
    }
  }
  if (!Number.isInteger(input.servers)) {
    throw new MmcError(`Sunucu sayısı (c) tam sayı olmalı (${input.servers} verildi).`);
  }
  if (input.servers > 200) {
    throw new MmcError(`Sunucu sayısı (c) en fazla 200 olabilir (${input.servers} verildi).`);
  }
  if (input.arrivalRate >= input.servers * input.serviceRate) {
    throw new MmcError(
      `Sistem kararsız: λ (${input.arrivalRate}) ≥ c·μ (${input.servers}·${input.serviceRate} = ${input.servers * input.serviceRate}). ` +
        `Steady-state için c·μ > λ olmalı; aksi hâlde kuyruk sınırsız büyür.`,
    );
  }
}

export function analyzeMmc(input: MmcInput, nMax = 20): MmcResult {
  validate(input);
  const { arrivalRate: lambda, serviceRate: mu, servers: c } = input;

  const a = lambda / mu;       // offered load (Erlangs)
  const rho = a / c;           // per-server utilisation

  // P0: 1 / [ Σ_{n=0}^{c-1} a^n/n!  +  a^c / (c! (1-ρ)) ]
  let sumTerm = 0;
  let term = 1; // a^0 / 0! = 1
  for (let n = 0; n < c; n++) {
    if (n > 0) term *= a / n;  // term_n = a^n / n!
    sumTerm += term;
  }
  // tail term a^c / c!
  const aPowC = c === 0 ? 1 : (term * a) / c; // term was a^(c-1)/(c-1)!; ·a/c → a^c/c!
  // when c=1, after the loop term is still 1 (a^0/0!), so a^c/c! = a/1 — handled by formula above with c=1: term=1, *a/1 = a.
  const tail = aPowC / (1 - rho);
  const probEmpty = 1 / (sumTerm + tail);

  // Erlang-C
  const probWait = aPowC / (1 - rho) * probEmpty;

  const avgInQueue = probWait * rho / (1 - rho);
  const avgInSystem = avgInQueue + a;
  const avgTimeInQueue = avgInQueue / lambda;
  const avgTimeInSystem = avgInSystem / lambda;

  // State probabilities P(n)
  const stateProbabilities: number[] = [];
  // Precompute factorials & powers iteratively
  // p_n = a^n / n! * P0  for n <= c
  // p_n = a^n / (c! c^(n-c)) * P0  for n > c
  let pn = probEmpty; // n=0: a^0/0! · P0
  stateProbabilities.push(pn);
  for (let n = 1; n <= nMax; n++) {
    if (n <= c) {
      pn = pn * a / n; // multiply by a/n
    } else {
      pn = pn * a / c; // multiply by a/c
    }
    stateProbabilities.push(pn);
  }

  return {
    servers: c,
    offeredLoad: a,
    utilisation: rho,
    probEmpty,
    probWait,
    avgInSystem,
    avgInQueue,
    avgTimeInSystem,
    avgTimeInQueue,
    stateProbabilities,
  };
}
