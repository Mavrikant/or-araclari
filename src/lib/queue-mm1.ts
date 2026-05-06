/**
 * M/M/1 single-server queue performance metrics.
 *
 * Notation (Kendall): M (memoryless arrivals — Poisson), M (memoryless
 * service — exponential), 1 (one server). Steady-state results assume
 * the system has been running long enough for the warm-up to wash out
 * and that ρ < 1 (otherwise the queue grows without bound).
 *
 * All formulas are textbook standard; see Kleinrock vol. 1 or Gross/Harris
 * for derivations.
 *
 * Pure: no DOM, no I/O.
 */

export interface Mm1Input {
  /** Arrival rate λ (units per time unit). */
  arrivalRate: number;
  /** Service rate μ (units per time unit, μ > λ for stability). */
  serviceRate: number;
}

export interface Mm1Result {
  utilisation: number;       // ρ = λ/μ
  avgInSystem: number;       // L  = ρ/(1-ρ)
  avgInQueue: number;        // Lq = ρ²/(1-ρ)
  avgTimeInSystem: number;   // W  = 1/(μ-λ)
  avgTimeInQueue: number;    // Wq = ρ/(μ-λ)
  probEmpty: number;         // P0 = 1-ρ
  /** Probability that exactly n customers are in the system, for n=0..nmax. */
  stateProbabilities: number[];
}

export class Mm1Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Mm1Error';
  }
}

function validate(input: Mm1Input): void {
  for (const [k, label] of [
    ['arrivalRate', 'Geliş hızı (λ)'],
    ['serviceRate', 'Hizmet hızı (μ)'],
  ] as const) {
    const v = input[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Mm1Error(`${label} geçerli bir sayı olmalı.`);
    }
    if (v <= 0) {
      throw new Mm1Error(`${label} pozitif olmalı (${v} verildi).`);
    }
  }
  if (input.arrivalRate >= input.serviceRate) {
    throw new Mm1Error(
      `Sistem kararsız: λ (${input.arrivalRate}) ≥ μ (${input.serviceRate}). ` +
        `Steady-state için μ > λ olmalı; aksi hâlde kuyruk sınırsız büyür.`,
    );
  }
}

export function analyzeMm1(input: Mm1Input, nMax = 15): Mm1Result {
  validate(input);
  const { arrivalRate: lambda, serviceRate: mu } = input;

  const rho = lambda / mu;
  const utilisation = rho;
  const avgInSystem = rho / (1 - rho);
  const avgInQueue = (rho * rho) / (1 - rho);
  const avgTimeInSystem = 1 / (mu - lambda);
  const avgTimeInQueue = rho / (mu - lambda);
  const probEmpty = 1 - rho;

  const stateProbabilities: number[] = [];
  for (let n = 0; n <= nMax; n++) {
    stateProbabilities.push((1 - rho) * Math.pow(rho, n));
  }

  return {
    utilisation,
    avgInSystem,
    avgInQueue,
    avgTimeInSystem,
    avgTimeInQueue,
    probEmpty,
    stateProbabilities,
  };
}
