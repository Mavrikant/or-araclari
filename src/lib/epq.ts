/**
 * Economic Production Quantity (EPQ / EBQ) — the production-rate variant
 * of the classic EOQ. Items are produced at a finite rate p (units / year)
 * while being consumed at rate d (units / year), with p > d so that
 * inventory builds during the production phase and depletes during the
 * pure-consumption phase. The optimal batch size minimises the sum of
 * annual setup and holding costs and has a closed-form solution:
 *
 *     Q* = sqrt(2 * D * S / (H * (1 - d/p)))
 *
 * which reduces to the Wilson formula when p → ∞ (instant replenishment).
 *
 * Pure: no DOM, no I/O.
 */

export interface EpqInput {
  /** Annual demand D (units / year). */
  demand: number;
  /** Setup / changeover cost per production run S (currency). */
  setupCost: number;
  /** Holding cost per unit per year H (currency). */
  holdingCost: number;
  /** Annual production rate p (units / year). Must satisfy p > demand. */
  productionRate: number;
  /** Optional working days per year for cycle-length output. Default 365. */
  daysPerYear?: number;
}

export interface EpqResult {
  /** Optimal production batch size Q*. */
  optimalQty: number;
  /** Peak inventory level Imax = Q* · (1 - d/p). */
  maxInventory: number;
  /** Average inventory at the optimum = Imax / 2. */
  averageInventory: number;
  /** Annual setup cost at Q* (= D · S / Q*). */
  annualSetupCost: number;
  /** Annual holding cost at Q* (= Imax · H / 2). */
  annualHoldingCost: number;
  /** Total annual cost at Q* (= setup + holding). */
  totalAnnualCost: number;
  /** Number of production runs per year (= D / Q*). */
  runsPerYear: number;
  /** Cycle length in days (= daysPerYear / runsPerYear). */
  cycleDays: number;
  /** Production-phase length in days (= Q over p, scaled by daysPerYear). */
  productionDays: number;
  /** Pure-consumption phase length in days (= cycleDays − productionDays). */
  consumptionDays: number;
  /** Convenience pass-through of the inputs. */
  input: Required<EpqInput>;
}

export class EpqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpqError';
  }
}

function validate(input: EpqInput): void {
  for (const [name, label] of [
    ['demand', 'yıllık talep'],
    ['setupCost', 'kurulum maliyeti'],
    ['holdingCost', 'taşıma maliyeti'],
    ['productionRate', 'üretim hızı'],
  ] as const) {
    const v = input[name];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new EpqError(`${label} sayı olmalıdır.`);
    }
    if (v <= 0) {
      throw new EpqError(`${label} pozitif olmalıdır (${v} verildi).`);
    }
  }
  if (input.productionRate <= input.demand) {
    throw new EpqError(
      `Üretim hızı talepten büyük olmalıdır (p=${input.productionRate}, D=${input.demand}). Aksi hâlde talep karşılanamaz.`,
    );
  }
  if (input.daysPerYear !== undefined) {
    if (!Number.isFinite(input.daysPerYear) || input.daysPerYear <= 0) {
      throw new EpqError('Yıllık çalışma günü pozitif olmalıdır.');
    }
  }
}

export function computeEpq(input: EpqInput): EpqResult {
  validate(input);
  const daysPerYear = input.daysPerYear ?? 365;
  const D = input.demand;
  const S = input.setupCost;
  const H = input.holdingCost;
  const p = input.productionRate;

  const factor = 1 - D / p;
  const optimalQty = Math.sqrt((2 * D * S) / (H * factor));
  const maxInventory = optimalQty * factor;
  const averageInventory = maxInventory / 2;
  const annualSetupCost = (D * S) / optimalQty;
  const annualHoldingCost = (maxInventory * H) / 2;
  const totalAnnualCost = annualSetupCost + annualHoldingCost;
  const runsPerYear = D / optimalQty;
  const cycleDays = daysPerYear / runsPerYear;
  const productionDays = (optimalQty / p) * daysPerYear;
  const consumptionDays = cycleDays - productionDays;

  return {
    optimalQty,
    maxInventory,
    averageInventory,
    annualSetupCost,
    annualHoldingCost,
    totalAnnualCost,
    runsPerYear,
    cycleDays,
    productionDays,
    consumptionDays,
    input: { demand: D, setupCost: S, holdingCost: H, productionRate: p, daysPerYear },
  };
}

/**
 * Returns sample (Q, totalCost) pairs spanning 0.1·Q* to 3·Q* for plotting
 * the U-shaped EPQ cost curve. Mirrors the EOQ helper so the chart
 * implementation can be shared.
 */
export interface EpqCostCurvePoint {
  q: number;
  setup: number;
  holding: number;
  total: number;
}

export function epqCostCurve(
  input: EpqInput,
  steps = 60,
  qMinFactor = 0.1,
  qMaxFactor = 3,
): EpqCostCurvePoint[] {
  const result = computeEpq(input);
  const qStar = result.optimalQty;
  const D = input.demand;
  const S = input.setupCost;
  const H = input.holdingCost;
  const factor = 1 - D / input.productionRate;
  const qMin = qStar * qMinFactor;
  const qMax = qStar * qMaxFactor;

  const points: EpqCostCurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = qMin + ((qMax - qMin) * i) / steps;
    const setup = (D * S) / q;
    const holding = (q * factor * H) / 2;
    points.push({ q, setup, holding, total: setup + holding });
  }
  return points;
}
