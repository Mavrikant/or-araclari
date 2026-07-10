/**
 * Newsvendor (Tek-Dönem Envanter) modeli — critical fractile çözümü.
 *
 * Sabit-talep EOQ'nun stokastik-talep karşılığı: tek dönemlik bir
 * ürün için (gazete, taze meyve, sezonluk giyim, konser bileti) alım
 * kararı **talep gerçekleşmeden** verilir. Fazla stok kalırsa
 * per-unit `Co` (overage) maliyet, eksik stok yaşanırsa per-unit `Cu`
 * (underage) fırsat maliyeti oluşur.
 *
 * Klasik sonuç: F(Q*) = Cu / (Cu + Co) — critical ratio (kritik fraksiyon).
 * Ayrık ise Q* en küçük Q'dur ki F(Q) ≥ Cu/(Cu+Co).
 *
 * Pure: no DOM, no I/O.
 */

export type NewsvendorCostMode = 'direct' | 'priced';
export type NewsvendorDistribution = 'normal' | 'uniform';

export interface DirectCosts {
  mode: 'direct';
  /** Per-unit underage cost (fırsat maliyeti — birim başına eksik). */
  underage: number;
  /** Per-unit overage cost (satılamayan stok — birim başına fazla). */
  overage: number;
}

export interface PricedCosts {
  mode: 'priced';
  /** Satış fiyatı p (birim gelir). */
  price: number;
  /** Alım maliyeti c (birim maliyet). */
  cost: number;
  /** Kalan stok için hurda değeri s (opsiyonel, default 0). s ≤ c. */
  salvage?: number;
  /** Stok yetmezliği başına ek ceza g (opsiyonel — goodwill kaybı, default 0). */
  shortagePenalty?: number;
}

export type NewsvendorCosts = DirectCosts | PricedCosts;

export interface NormalDemand {
  kind: 'normal';
  mean: number;
  stdDev: number;
}
export interface UniformDemand {
  kind: 'uniform';
  min: number;
  max: number;
}
export type NewsvendorDemand = NormalDemand | UniformDemand;

export interface NewsvendorInput {
  costs: NewsvendorCosts;
  demand: NewsvendorDemand;
}

export interface NewsvendorResult {
  /** Effective per-unit underage cost Cu. */
  underage: number;
  /** Effective per-unit overage cost Co. */
  overage: number;
  /** Critical ratio Cu / (Cu + Co). */
  criticalRatio: number;
  /** Optimum sipariş miktarı Q*. */
  optimalQty: number;
  /** F(Q*) — gerçekleşen ulaşılan servis seviyesi. */
  serviceLevel: number;
  /** E[max(Q* − D, 0)] — beklenen satılamayan birim. */
  expectedLeftover: number;
  /** E[max(D − Q*, 0)] — beklenen eksik. */
  expectedShortage: number;
  /** E[min(Q*, D)] — beklenen satış. */
  expectedSales: number;
  /** Fill rate (Type II) = E[min(Q,D)] / E[D]. */
  fillRate: number;
  /** Beklenen kâr (yalnız `priced` modda; direct modda null). */
  expectedProfit: number | null;
  /** Beklenen maliyet TC(Q*) = Cu·E[shortage] + Co·E[leftover]. */
  expectedCost: number;
  input: NewsvendorInput;
}

export class NewsvendorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsvendorError';
  }
}

/* ---------- helpers: standard normal ---------- */

/** Standard normal PDF φ(z). */
export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal CDF Φ(z) using Abramowitz & Stegun 7.1.26 error
 * function approximation. Absolute error < 1.5e-7 for all z.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Inverse standard normal Φ⁻¹(p) — Beasley-Springer-Moro (1988) yaklaşımı.
 * p ∈ (0, 1) için |ε| < 1e-9. p = 0 → -∞, p = 1 → +∞.
 */
export function normalInverse(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0,
    4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

/**
 * Standart normal loss function L(z) = φ(z) - z·(1 - Φ(z)).
 * σ·L(z_Q) = E[max(D − Q, 0)] normal talep için.
 */
export function standardNormalLoss(z: number): number {
  return normalPdf(z) - z * (1 - normalCdf(z));
}

/* ---------- costs ---------- */

function resolveCosts(costs: NewsvendorCosts): { underage: number; overage: number } {
  if (costs.mode === 'direct') {
    return { underage: costs.underage, overage: costs.overage };
  }
  const salvage = costs.salvage ?? 0;
  const penalty = costs.shortagePenalty ?? 0;
  const underage = costs.price - costs.cost + penalty;
  const overage = costs.cost - salvage;
  return { underage, overage };
}

function validate(input: NewsvendorInput): { underage: number; overage: number } {
  const c = input.costs;
  const finiteOrThrow = (v: unknown, label: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new NewsvendorError(`${label} sayı olmalıdır.`);
    }
    return v;
  };
  if (c.mode === 'direct') {
    finiteOrThrow(c.underage, 'eksik maliyeti (Cu)');
    finiteOrThrow(c.overage, 'fazla maliyeti (Co)');
    if (c.underage < 0) throw new NewsvendorError('Cu negatif olamaz.');
    if (c.overage < 0) throw new NewsvendorError('Co negatif olamaz.');
    if (c.underage + c.overage <= 0) {
      throw new NewsvendorError('Cu + Co > 0 olmalıdır.');
    }
  } else {
    finiteOrThrow(c.price, 'satış fiyatı (p)');
    finiteOrThrow(c.cost, 'alım maliyeti (c)');
    if (c.salvage !== undefined) finiteOrThrow(c.salvage, 'hurda değeri (s)');
    if (c.shortagePenalty !== undefined) finiteOrThrow(c.shortagePenalty, 'eksik cezası (g)');
    if (c.price <= c.cost) {
      throw new NewsvendorError('Satış fiyatı alım maliyetinden büyük olmalıdır.');
    }
    if ((c.salvage ?? 0) > c.cost) {
      throw new NewsvendorError('Hurda değeri alım maliyetini aşamaz.');
    }
    if ((c.salvage ?? 0) < 0) throw new NewsvendorError('Hurda değeri negatif olamaz.');
    if ((c.shortagePenalty ?? 0) < 0) throw new NewsvendorError('Eksik cezası negatif olamaz.');
  }
  const d = input.demand;
  if (d.kind === 'normal') {
    finiteOrThrow(d.mean, 'ortalama talep');
    finiteOrThrow(d.stdDev, 'standart sapma');
    if (d.stdDev <= 0) throw new NewsvendorError('Standart sapma pozitif olmalıdır.');
    if (d.mean < 0) throw new NewsvendorError('Ortalama talep negatif olamaz.');
  } else if (d.kind === 'uniform') {
    finiteOrThrow(d.min, 'alt sınır');
    finiteOrThrow(d.max, 'üst sınır');
    if (d.max <= d.min) {
      throw new NewsvendorError('Üst sınır alt sınırdan büyük olmalıdır.');
    }
    if (d.min < 0) throw new NewsvendorError('Alt sınır negatif olamaz.');
  } else {
    throw new NewsvendorError('Bilinmeyen talep dağılımı.');
  }
  return resolveCosts(c);
}

/* ---------- main ---------- */

export function computeNewsvendor(input: NewsvendorInput): NewsvendorResult {
  const { underage, overage } = validate(input);
  const criticalRatio = underage / (underage + overage);

  let optimalQty: number;
  let expectedShortage: number;
  let expectedLeftover: number;
  let expectedDemand: number;
  let serviceLevel: number;

  const d = input.demand;
  if (d.kind === 'normal') {
    const z = normalInverse(criticalRatio);
    optimalQty = Math.max(0, d.mean + z * d.stdDev);
    const zQ = (optimalQty - d.mean) / d.stdDev;
    expectedShortage = d.stdDev * standardNormalLoss(zQ);
    expectedLeftover = optimalQty - d.mean + expectedShortage;
    expectedDemand = d.mean;
    serviceLevel = normalCdf(zQ);
  } else {
    const span = d.max - d.min;
    optimalQty = d.min + span * criticalRatio;
    expectedShortage = ((d.max - optimalQty) * (d.max - optimalQty)) / (2 * span);
    expectedLeftover = ((optimalQty - d.min) * (optimalQty - d.min)) / (2 * span);
    expectedDemand = (d.min + d.max) / 2;
    serviceLevel = criticalRatio;
  }

  const expectedSales = expectedDemand - expectedShortage;
  const fillRate = expectedDemand > 0 ? expectedSales / expectedDemand : 1;
  const expectedCost = underage * expectedShortage + overage * expectedLeftover;

  let expectedProfit: number | null = null;
  if (input.costs.mode === 'priced') {
    const p = input.costs.price;
    const c = input.costs.cost;
    const s = input.costs.salvage ?? 0;
    const g = input.costs.shortagePenalty ?? 0;
    expectedProfit =
      p * expectedSales + s * expectedLeftover - c * optimalQty - g * expectedShortage;
  }

  return {
    underage,
    overage,
    criticalRatio,
    optimalQty,
    serviceLevel,
    expectedLeftover,
    expectedShortage,
    expectedSales,
    fillRate,
    expectedProfit,
    expectedCost,
    input,
  };
}

/* ---------- sensitivity curve ---------- */

export interface SensitivityPoint {
  q: number;
  expectedShortage: number;
  expectedLeftover: number;
  expectedCost: number;
  expectedProfit: number | null;
}

/**
 * Q sensitivity: fixed cost structure and demand, sweeps Q around Q*
 * so the UI can plot E[cost](Q) or E[profit](Q) curves.
 */
export function newsvendorSensitivity(
  input: NewsvendorInput,
  steps = 60,
  qMinFactor = 0.5,
  qMaxFactor = 1.5,
): SensitivityPoint[] {
  const { underage, overage } = validate(input);
  const base = computeNewsvendor(input);
  const qStar = base.optimalQty;
  const d = input.demand;

  const qMin = Math.max(0, qStar * qMinFactor);
  const qMax = qStar * qMaxFactor > 0 ? qStar * qMaxFactor : (d.kind === 'normal' ? d.mean + 4 * d.stdDev : d.max);
  const points: SensitivityPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const q = qMin + ((qMax - qMin) * i) / steps;
    let eShort: number;
    let eLeft: number;
    let eSales: number;
    let eDemand: number;
    if (d.kind === 'normal') {
      const zQ = (q - d.mean) / d.stdDev;
      eShort = d.stdDev * standardNormalLoss(zQ);
      eLeft = q - d.mean + eShort;
      eDemand = d.mean;
      eSales = eDemand - eShort;
    } else {
      const span = d.max - d.min;
      if (q <= d.min) {
        eShort = (d.min + d.max) / 2 - q;
        eLeft = 0;
      } else if (q >= d.max) {
        eShort = 0;
        eLeft = q - (d.min + d.max) / 2;
      } else {
        eShort = ((d.max - q) * (d.max - q)) / (2 * span);
        eLeft = ((q - d.min) * (q - d.min)) / (2 * span);
      }
      eDemand = (d.min + d.max) / 2;
      eSales = eDemand - eShort;
    }
    const expectedCost = underage * eShort + overage * eLeft;
    let expectedProfit: number | null = null;
    if (input.costs.mode === 'priced') {
      const p = input.costs.price;
      const c = input.costs.cost;
      const s = input.costs.salvage ?? 0;
      const g = input.costs.shortagePenalty ?? 0;
      expectedProfit = p * eSales + s * eLeft - c * q - g * eShort;
    }
    points.push({
      q,
      expectedShortage: eShort,
      expectedLeftover: eLeft,
      expectedCost,
      expectedProfit,
    });
  }
  return points;
}
