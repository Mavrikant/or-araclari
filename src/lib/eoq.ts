/**
 * Economic Order Quantity (EOQ) — Wilson formula and total-cost curve.
 *
 * The EOQ model assumes constant deterministic demand, instantaneous
 * replenishment (no lead time), no shortages, and order-volume-independent
 * costs. Under those assumptions the order quantity that minimises the
 * sum of annual ordering and holding costs has a closed-form solution:
 *
 *     Q* = sqrt(2 * D * S / H)
 *
 * Pure: no DOM, no I/O.
 */

export interface EoqInput {
  /** Annual demand (units / year). */
  demand: number;
  /** Fixed ordering cost per order (currency). */
  orderCost: number;
  /** Holding cost per unit per year (currency). */
  holdingCost: number;
  /** Optional working days per year for cycle-length output. Default 365. */
  daysPerYear?: number;
}

export interface EoqResult {
  /** Optimal order quantity Q*. */
  optimalQty: number;
  /** Annual ordering cost at Q* (= D * S / Q*). */
  annualOrderingCost: number;
  /** Annual holding cost at Q* (= Q* * H / 2). */
  annualHoldingCost: number;
  /** Total annual cost at Q* (= ordering + holding). */
  totalAnnualCost: number;
  /** How many orders per year (= D / Q*). */
  ordersPerYear: number;
  /** Days between orders (= daysPerYear / ordersPerYear). */
  cycleDays: number;
  /** Convenience pass-through of the inputs for downstream consumers. */
  input: Required<EoqInput>;
}

export class EoqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EoqError';
  }
}

function validate(input: EoqInput): void {
  for (const [name, label] of [
    ['demand', 'yıllık talep'],
    ['orderCost', 'sipariş maliyeti'],
    ['holdingCost', 'taşıma maliyeti'],
  ] as const) {
    const v = input[name];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new EoqError(`${label} sayı olmalıdır.`);
    }
    if (v <= 0) {
      throw new EoqError(`${label} pozitif olmalıdır (${v} verildi).`);
    }
  }
  if (input.daysPerYear !== undefined) {
    if (!Number.isFinite(input.daysPerYear) || input.daysPerYear <= 0) {
      throw new EoqError('Yıllık çalışma günü pozitif olmalıdır.');
    }
  }
}

export function computeEoq(input: EoqInput): EoqResult {
  validate(input);
  const daysPerYear = input.daysPerYear ?? 365;
  const D = input.demand;
  const S = input.orderCost;
  const H = input.holdingCost;

  const optimalQty = Math.sqrt((2 * D * S) / H);
  const annualOrderingCost = (D * S) / optimalQty;
  const annualHoldingCost = (optimalQty * H) / 2;
  const totalAnnualCost = annualOrderingCost + annualHoldingCost;
  const ordersPerYear = D / optimalQty;
  const cycleDays = daysPerYear / ordersPerYear;

  return {
    optimalQty,
    annualOrderingCost,
    annualHoldingCost,
    totalAnnualCost,
    ordersPerYear,
    cycleDays,
    input: { demand: D, orderCost: S, holdingCost: H, daysPerYear },
  };
}

/**
 * Returns sample (Q, totalCost) pairs spanning a useful range around Q*
 * for plotting the classic U-shaped EOQ cost curve. The default range
 * covers 0.1·Q* to 3·Q* in 60 evenly-spaced steps.
 */
export interface CostCurvePoint {
  q: number;
  ordering: number;
  holding: number;
  total: number;
}

export function eoqCostCurve(
  input: EoqInput,
  steps = 60,
  qMinFactor = 0.1,
  qMaxFactor = 3,
): CostCurvePoint[] {
  const result = computeEoq(input);
  const qStar = result.optimalQty;
  const D = input.demand;
  const S = input.orderCost;
  const H = input.holdingCost;
  const qMin = qStar * qMinFactor;
  const qMax = qStar * qMaxFactor;

  const points: CostCurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = qMin + ((qMax - qMin) * i) / steps;
    const ordering = (D * S) / q;
    const holding = (q * H) / 2;
    points.push({ q, ordering, holding, total: ordering + holding });
  }
  return points;
}
