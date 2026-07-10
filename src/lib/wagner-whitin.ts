/**
 * Wagner-Whitin (1958) — dynamic lot-sizing by forward DP.
 *
 * Given a T-period horizon with deterministic but time-varying demand,
 * period-specific setup cost K_t and per-unit-per-period holding cost h_t,
 * find the production plan that minimizes total cost = Σ setup + Σ holding
 * ( + Σ unit-production if provided ).
 *
 * Optimal-policy property (Wagner-Whitin, 1958): production only occurs
 * when inventory is zero. Equivalently, if the optimal plan produces in
 * period j to cover demand through period k, then it does not produce
 * again until period k + 1. This turns the search into a partition of
 * 1..T into contiguous "lot blocks" and yields a forward DP in O(T²).
 *
 * Pure: no DOM, no I/O.
 */

export interface WagnerWhitinInput {
  /** Demand per period, d_1..d_T. Must be non-negative. */
  demands: number[];
  /**
   * Setup cost. A single number = constant K for every period. An array
   * of length T = period-specific K_t. Must be > 0 (setup is only paid
   * when producing, so a zero-K problem trivializes to per-period lots).
   */
  setupCost: number | number[];
  /**
   * Per-unit-per-period holding cost. Constant h or per-period h_t.
   * Interpretation: a unit produced in period j to satisfy demand in
   * period k incurs holding cost (h_j + h_{j+1} + ... + h_{k-1}). For
   * constant h that reduces to (k - j) · h. Must be ≥ 0.
   */
  holdingCost: number | number[];
  /**
   * Optional unit-production cost c_t. If omitted, unit cost is treated
   * as zero everywhere (only setup + holding are minimized). When c_t is
   * constant, it adds a constant Σ c · d_t to every feasible plan and
   * does not change the optimum; the tool still reports it as a
   * separate line item for the ledger.
   */
  unitCost?: number | number[];
}

export interface WagnerWhitinLot {
  /** Period where production happens (1-indexed). */
  startPeriod: number;
  /** Last period this lot covers (inclusive, 1-indexed). */
  endPeriod: number;
  /** Total quantity produced at startPeriod (= Σ d_k for k in [start..end]). */
  quantity: number;
  /** Setup cost incurred at startPeriod (K_start). */
  setupCost: number;
  /** Holding cost for this lot: Σ h·d for each period held. */
  holdingCost: number;
  /** Unit-production cost for this lot: c_start · quantity. */
  unitCost: number;
  /** Total cost of this lot = setup + holding + unit. */
  totalCost: number;
}

export interface WagnerWhitinPeriod {
  /** 1-indexed period label. */
  period: number;
  /** Demand for this period. */
  demand: number;
  /** Production quantity in this period (0 unless a lot starts here). */
  produce: number;
  /** Inventory at the end of the period (after demand is satisfied). */
  endingInventory: number;
  /** True iff a production lot starts at this period. */
  isSetup: boolean;
  /** Holding cost charged for inventory carried into next period: h_t · I_t. */
  holdingChargedHere: number;
}

export interface WagnerWhitinResult {
  /** Optimal total cost = Σ setup + Σ holding + Σ unit. */
  totalCost: number;
  /** Total setup cost of the plan. */
  totalSetupCost: number;
  /** Total holding cost of the plan. */
  totalHoldingCost: number;
  /** Total unit-production cost of the plan. */
  totalUnitCost: number;
  /** Number of production runs (= number of lots). */
  setupCount: number;
  /** The optimal partition into lot blocks, left to right. */
  lots: WagnerWhitinLot[];
  /** Per-period ledger reconstructed from the lot plan. */
  periods: WagnerWhitinPeriod[];
  /** Forward-DP min-cost values f[t] for t = 0..T. f[0] = 0 by convention. */
  dpValues: number[];
  /** For each t ≥ 1, the optimal "j" (start of last lot). */
  dpArgmin: number[];
  /** Convenience pass-through of resolved (K, h, c) arrays. */
  resolvedInput: {
    demands: number[];
    setup: number[];
    holding: number[];
    unit: number[];
  };
}

export class WagnerWhitinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WagnerWhitinError';
  }
}

function expand(name: string, value: number | number[] | undefined, T: number, allowZero: boolean, defaultValue = 0): number[] {
  if (value === undefined) return Array(T).fill(defaultValue);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new WagnerWhitinError(`${name} sonlu bir sayı olmalıdır.`);
    }
    if (value < 0) {
      throw new WagnerWhitinError(`${name} negatif olamaz (${value} verildi).`);
    }
    if (!allowZero && value === 0) {
      throw new WagnerWhitinError(`${name} sıfırdan büyük olmalıdır.`);
    }
    return Array(T).fill(value);
  }
  if (!Array.isArray(value)) {
    throw new WagnerWhitinError(`${name} sayı ya da sayı dizisi olmalıdır.`);
  }
  if (value.length !== T) {
    throw new WagnerWhitinError(`${name} dizisinin uzunluğu talep sayısıyla (${T}) eşleşmiyor (${value.length} verildi).`);
  }
  const out: number[] = [];
  for (let i = 0; i < T; i++) {
    const v = value[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new WagnerWhitinError(`${name}[${i + 1}] sonlu bir sayı olmalıdır.`);
    }
    if (v < 0) {
      throw new WagnerWhitinError(`${name}[${i + 1}] negatif olamaz (${v} verildi).`);
    }
    if (!allowZero && v === 0) {
      throw new WagnerWhitinError(`${name}[${i + 1}] sıfırdan büyük olmalıdır.`);
    }
    out.push(v);
  }
  return out;
}

function validateDemands(demands: number[]): void {
  if (!Array.isArray(demands) || demands.length === 0) {
    throw new WagnerWhitinError('En az bir dönemlik talep girilmelidir.');
  }
  if (demands.length > 240) {
    throw new WagnerWhitinError('Dönem sayısı 240 ile sınırlıdır (tarayıcı UX).');
  }
  for (let t = 0; t < demands.length; t++) {
    const d = demands[t];
    if (typeof d !== 'number' || !Number.isFinite(d)) {
      throw new WagnerWhitinError(`d[${t + 1}] sonlu bir sayı olmalıdır.`);
    }
    if (d < 0) {
      throw new WagnerWhitinError(`d[${t + 1}] negatif olamaz (${d} verildi).`);
    }
  }
  let total = 0;
  for (const d of demands) total += d;
  if (total === 0) {
    throw new WagnerWhitinError('Toplam talep sıfır; çözülecek problem yok.');
  }
}

/**
 * Cost of producing at period j (1-indexed) to cover demands d_j..d_k inclusive.
 * K_j paid once; unit-production c_j · Σ d_p; holding accumulates h[j-1..p-2]
 * for each unit d_p held from j to p (only if p > j).
 */
function blockCost(j: number, k: number, demands: number[], setup: number[], holding: number[], unit: number[]): { setup: number; holding: number; unit: number; quantity: number; total: number } {
  let quantity = 0;
  let holdingCost = 0;
  let cumHold = 0;
  for (let p = j; p <= k; p++) {
    const d = demands[p - 1];
    quantity += d;
    if (p > j) {
      cumHold += holding[p - 2];
      holdingCost += cumHold * d;
    }
  }
  const setupCost = setup[j - 1];
  const unitCost = unit[j - 1] * quantity;
  return { setup: setupCost, holding: holdingCost, unit: unitCost, quantity, total: setupCost + holdingCost + unitCost };
}

export function solveWagnerWhitin(input: WagnerWhitinInput): WagnerWhitinResult {
  validateDemands(input.demands);
  const T = input.demands.length;
  const demands = input.demands.slice();
  const setup = expand('Kurulum maliyeti', input.setupCost, T, false);
  const holding = expand('Taşıma maliyeti', input.holdingCost, T, true);
  const unit = expand('Birim üretim maliyeti', input.unitCost, T, true, 0);

  const f: number[] = new Array(T + 1).fill(Number.POSITIVE_INFINITY);
  const arg: number[] = new Array(T + 1).fill(-1);
  f[0] = 0;
  arg[0] = 0;

  for (let t = 1; t <= T; t++) {
    let best = Number.POSITIVE_INFINITY;
    let bestJ = t;
    for (let j = 1; j <= t; j++) {
      const c = blockCost(j, t, demands, setup, holding, unit).total;
      const total = f[j - 1] + c;
      if (total < best) {
        best = total;
        bestJ = j;
      }
    }
    f[t] = best;
    arg[t] = bestJ;
  }

  const lots: WagnerWhitinLot[] = [];
  let k = T;
  while (k >= 1) {
    const j = arg[k];
    const bc = blockCost(j, k, demands, setup, holding, unit);
    lots.push({
      startPeriod: j,
      endPeriod: k,
      quantity: bc.quantity,
      setupCost: bc.setup,
      holdingCost: bc.holding,
      unitCost: bc.unit,
      totalCost: bc.total,
    });
    k = j - 1;
  }
  lots.reverse();

  const periods: WagnerWhitinPeriod[] = [];
  let inventory = 0;
  const setupPeriods = new Set(lots.map((l) => l.startPeriod));
  const lotByStart = new Map(lots.map((l) => [l.startPeriod, l]));
  for (let t = 1; t <= T; t++) {
    const lot = lotByStart.get(t);
    const produce = lot ? lot.quantity : 0;
    inventory += produce;
    const d = demands[t - 1];
    inventory -= d;
    const holdingChargedHere = t < T ? holding[t - 1] * inventory : 0;
    periods.push({
      period: t,
      demand: d,
      produce,
      endingInventory: inventory,
      isSetup: setupPeriods.has(t),
      holdingChargedHere,
    });
  }

  let totalSetup = 0;
  let totalHolding = 0;
  let totalUnit = 0;
  for (const l of lots) {
    totalSetup += l.setupCost;
    totalHolding += l.holdingCost;
    totalUnit += l.unitCost;
  }

  return {
    totalCost: totalSetup + totalHolding + totalUnit,
    totalSetupCost: totalSetup,
    totalHoldingCost: totalHolding,
    totalUnitCost: totalUnit,
    setupCount: lots.length,
    lots,
    periods,
    dpValues: f,
    dpArgmin: arg,
    resolvedInput: { demands, setup, holding, unit },
  };
}

/**
 * Silver-Meal heuristic (Silver & Meal, 1973): starting from period j,
 * keep extending the lot to cover more periods while the average cost per
 * period covered decreases. When it would increase, close the lot and
 * start a new one. Provided for comparison / education, not as the main
 * solver. Returns the same-shape result object as `solveWagnerWhitin`.
 */
export function solveSilverMeal(input: WagnerWhitinInput): WagnerWhitinResult {
  validateDemands(input.demands);
  const T = input.demands.length;
  const demands = input.demands.slice();
  const setup = expand('Kurulum maliyeti', input.setupCost, T, false);
  const holding = expand('Taşıma maliyeti', input.holdingCost, T, true);
  const unit = expand('Birim üretim maliyeti', input.unitCost, T, true, 0);

  const lots: WagnerWhitinLot[] = [];
  let j = 1;
  while (j <= T) {
    let bestK = j;
    let bestAvg = Number.POSITIVE_INFINITY;
    for (let k = j; k <= T; k++) {
      const c = blockCost(j, k, demands, setup, holding, unit).total;
      const avg = c / (k - j + 1);
      if (avg <= bestAvg) {
        bestAvg = avg;
        bestK = k;
      } else {
        break;
      }
    }
    const bc = blockCost(j, bestK, demands, setup, holding, unit);
    lots.push({
      startPeriod: j,
      endPeriod: bestK,
      quantity: bc.quantity,
      setupCost: bc.setup,
      holdingCost: bc.holding,
      unitCost: bc.unit,
      totalCost: bc.total,
    });
    j = bestK + 1;
  }

  const periods: WagnerWhitinPeriod[] = [];
  let inventory = 0;
  const setupPeriods = new Set(lots.map((l) => l.startPeriod));
  const lotByStart = new Map(lots.map((l) => [l.startPeriod, l]));
  for (let t = 1; t <= T; t++) {
    const lot = lotByStart.get(t);
    const produce = lot ? lot.quantity : 0;
    inventory += produce;
    const d = demands[t - 1];
    inventory -= d;
    const holdingChargedHere = t < T ? holding[t - 1] * inventory : 0;
    periods.push({
      period: t,
      demand: d,
      produce,
      endingInventory: inventory,
      isSetup: setupPeriods.has(t),
      holdingChargedHere,
    });
  }

  let totalSetup = 0;
  let totalHolding = 0;
  let totalUnit = 0;
  for (const l of lots) {
    totalSetup += l.setupCost;
    totalHolding += l.holdingCost;
    totalUnit += l.unitCost;
  }
  const f: number[] = new Array(T + 1).fill(0);
  const arg: number[] = new Array(T + 1).fill(0);

  return {
    totalCost: totalSetup + totalHolding + totalUnit,
    totalSetupCost: totalSetup,
    totalHoldingCost: totalHolding,
    totalUnitCost: totalUnit,
    setupCount: lots.length,
    lots,
    periods,
    dpValues: f,
    dpArgmin: arg,
    resolvedInput: { demands, setup, holding, unit },
  };
}
