/**
 * Yeniden Sipariş Noktası (Reorder Point) & Emniyet Stoğu (Safety Stock).
 *
 * Sürekli-izleme (Q, R) modelinde: talep sürekli izlenir, stok R'ye düştüğünde
 * sabit Q kadar sipariş verilir. Sipariş, sabit veya rasgele tedarik süresi L
 * sonrasında ulaşır. Amaç: talep tedarik süresi boyunca da rasgele iken,
 * hedef servis seviyesini karşılayacak minimum stok tampon eşiği R'yi bulmak.
 *
 * Normal yaklaşım (yaygın ders kitabı — Silver, Nahmias, Chopra-Meindl):
 *   E[DL]  = μ_d · L                              (tedarik süresi boyunca beklenen talep)
 *   σ_DL   = √( L · σ_d²  +  μ_d² · σ_L² )         (kombine varyans — L rasgele ise)
 *   R      = E[DL] + z_α · σ_DL                    (Type-I cycle service level α)
 *   SS     = z_α · σ_DL                            (emniyet stoğu)
 *
 * σ_L = 0 alınırsa L deterministik olur ve σ_DL = √L · σ_d klasik hâline döner.
 *
 * Type-I  (cycle service level, α):  P(DL ≤ R) = α  → z = Φ⁻¹(α)
 * Type-II (fill rate, β):  β = 1 − (σ_DL · L(z)) / Q  ;  L(z) = φ(z) − z(1 − Φ(z))
 *
 * Pure: no DOM, no I/O.
 */

export type ServiceMode = 'type1' | 'type2';

export interface RopInput {
  /** Ortalama günlük (dönem başı) talep μ_d. */
  demandMean: number;
  /** Talep standart sapması σ_d (aynı zaman biriminde). */
  demandStdDev: number;
  /** Ortalama tedarik süresi L (talep birimi ile aynı zaman biriminde). */
  leadTimeMean: number;
  /**
   * Tedarik süresinin standart sapması σ_L (opsiyonel, default 0 = deterministik).
   * Aynı zaman biriminde verilmelidir.
   */
  leadTimeStdDev?: number;
  /**
   * Hedef servis seviyesi ∈ (0, 1). Type-I için P(stoksuz-kalmama) = α;
   * Type-II için fill rate β.
   */
  serviceLevel: number;
  serviceMode: ServiceMode;
  /**
   * Sipariş miktarı Q (opsiyonel). Type-II servis modu için gereklidir.
   * Verilmezse annualDemand + orderCost + holdingCost üzerinden EOQ türetilir.
   */
  orderQty?: number;
  /** Yıllık talep D (opsiyonel — EOQ türetimi için). */
  annualDemand?: number;
  /** Sipariş başı sabit maliyet K (opsiyonel — EOQ türetimi için). */
  orderCost?: number;
  /** Birim yıllık taşıma maliyeti h (opsiyonel — EOQ + SS taşıma için). */
  holdingCost?: number;
}

export interface RopResult {
  /** Tedarik süresi boyunca beklenen talep E[DL] = μ_d · L. */
  leadTimeDemand: number;
  /** Kombine tedarik süresi talep standart sapması σ_DL. */
  leadTimeStdDev: number;
  /** z_α = Φ⁻¹(α) (Type-I) veya Type-II için özel türetilen z. */
  z: number;
  /** Emniyet stoğu SS = z · σ_DL. */
  safetyStock: number;
  /** Yeniden sipariş noktası R = E[DL] + SS. */
  reorderPoint: number;
  /** Ulaşılan cycle service level (Type-I): P(DL ≤ R) = Φ(z). */
  cycleServiceLevel: number;
  /**
   * Ulaşılan fill rate (Type-II) β = 1 − (σ_DL · L(z)) / Q. Q verilmemişse null.
   */
  fillRate: number | null;
  /** Beklenen stoksuz-kalma miktarı — sipariş çevrimi başına: E[shortage] = σ_DL · L(z). */
  expectedShortagePerCycle: number;
  /** EOQ formülünden türetilen Q (D, K, h üçü de verilmişse). */
  eoq: number | null;
  /** Kullanılan Q (input.orderQty veya eoq). */
  orderQty: number | null;
  /** Beklenen sipariş sayısı yıl başına = D / Q. */
  ordersPerYear: number | null;
  /** Beklenen çevrim uzunluğu (gün) = Q / μ_d (aynı zaman biriminde). */
  cycleLength: number | null;
  /** Yıllık emniyet stoğu taşıma maliyeti = SS · h. */
  safetyStockCost: number | null;
  /** Yıllık toplam envanter maliyeti = (D/Q)·K + (Q/2)·h + SS·h. */
  totalAnnualCost: number | null;
  input: RopInput;
}

export class RopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RopError';
  }
}

/* ---------- standart normal ---------- */

export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/**
 * Standart normal CDF Φ(z) — Abramowitz-Stegun 7.1.26 (mutlak hata < 1.5e-7).
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
 * Beasley-Springer-Moro (1988) Φ⁻¹ yaklaşımı — p ∈ (0,1) için |ε| < 1e-9.
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
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

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

/** Standart normal kayıp fonksiyonu L(z) = φ(z) − z(1 − Φ(z)). */
export function standardNormalLoss(z: number): number {
  return normalPdf(z) - z * (1 - normalCdf(z));
}

/**
 * L(z) = k denklemini z için çözer. Type-II fill rate hedefinde
 * gerekli z_β'yi bulmak için kullanılır. Bisection (L monoton azalan).
 */
function inverseLoss(target: number): number {
  if (target <= 0) return Number.POSITIVE_INFINITY;
  // L(z) monotone azalan: z → −∞'da +∞, z → +∞'da 0.
  // Yeterince geniş aralık — L(-30) ≈ 30, L(8) ≈ 1e-16.
  let lo = -30;
  let hi = 8;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const value = standardNormalLoss(mid);
    if (value > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ---------- validation ---------- */

function finiteOrThrow(v: unknown, label: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new RopError(`${label} sayı olmalıdır.`);
  }
  return v;
}

function validate(input: RopInput): {
  sigmaL: number;
  q: number | null;
  eoq: number | null;
} {
  finiteOrThrow(input.demandMean, 'ortalama talep (μ_d)');
  finiteOrThrow(input.demandStdDev, 'talep standart sapması (σ_d)');
  finiteOrThrow(input.leadTimeMean, 'tedarik süresi (L)');
  finiteOrThrow(input.serviceLevel, 'servis seviyesi');
  const sigmaL = input.leadTimeStdDev ?? 0;
  finiteOrThrow(sigmaL, 'tedarik süresi standart sapması (σ_L)');
  if (input.demandMean <= 0) throw new RopError('Ortalama talep pozitif olmalıdır.');
  if (input.demandStdDev < 0) throw new RopError('Talep standart sapması negatif olamaz.');
  if (input.leadTimeMean <= 0) throw new RopError('Tedarik süresi pozitif olmalıdır.');
  if (sigmaL < 0) throw new RopError('Tedarik süresi standart sapması negatif olamaz.');
  if (input.serviceLevel <= 0 || input.serviceLevel >= 1) {
    throw new RopError('Servis seviyesi (0, 1) aralığında olmalıdır.');
  }

  let eoq: number | null = null;
  if (
    input.annualDemand !== undefined &&
    input.orderCost !== undefined &&
    input.holdingCost !== undefined
  ) {
    finiteOrThrow(input.annualDemand, 'yıllık talep (D)');
    finiteOrThrow(input.orderCost, 'sipariş maliyeti (K)');
    finiteOrThrow(input.holdingCost, 'taşıma maliyeti (h)');
    if (input.annualDemand <= 0) throw new RopError('Yıllık talep pozitif olmalıdır.');
    if (input.orderCost <= 0) throw new RopError('Sipariş maliyeti pozitif olmalıdır.');
    if (input.holdingCost <= 0) throw new RopError('Taşıma maliyeti pozitif olmalıdır.');
    eoq = Math.sqrt((2 * input.annualDemand * input.orderCost) / input.holdingCost);
  }

  let q: number | null = null;
  if (input.orderQty !== undefined) {
    finiteOrThrow(input.orderQty, 'sipariş miktarı (Q)');
    if (input.orderQty <= 0) throw new RopError('Sipariş miktarı pozitif olmalıdır.');
    q = input.orderQty;
  } else if (eoq !== null) {
    q = eoq;
  }

  if (input.serviceMode === 'type2' && q === null) {
    throw new RopError('Fill rate (Type-II) hesabı için Q veya (D, K, h) verilmelidir.');
  }

  return { sigmaL, q, eoq };
}

/* ---------- main ---------- */

export function computeRop(input: RopInput): RopResult {
  const { sigmaL, q, eoq } = validate(input);

  const mu = input.demandMean;
  const sd = input.demandStdDev;
  const L = input.leadTimeMean;

  const leadTimeDemand = mu * L;
  const varianceDL = L * sd * sd + mu * mu * sigmaL * sigmaL;
  const leadTimeStdDev = Math.sqrt(varianceDL);

  let z: number;
  if (input.serviceMode === 'type1') {
    z = normalInverse(input.serviceLevel);
  } else {
    const beta = input.serviceLevel;
    const Q = q as number;
    const target = ((1 - beta) * Q) / (leadTimeStdDev > 0 ? leadTimeStdDev : 1);
    z = inverseLoss(target);
  }

  const safetyStock = z * leadTimeStdDev;
  const reorderPoint = leadTimeDemand + safetyStock;
  const cycleServiceLevel = normalCdf(z);
  const expectedShortagePerCycle = leadTimeStdDev * standardNormalLoss(z);

  let fillRate: number | null = null;
  let ordersPerYear: number | null = null;
  let cycleLength: number | null = null;
  let safetyStockCost: number | null = null;
  let totalAnnualCost: number | null = null;

  if (q !== null) {
    fillRate = 1 - expectedShortagePerCycle / q;
    cycleLength = q / mu;
    if (input.annualDemand !== undefined) {
      ordersPerYear = input.annualDemand / q;
      if (input.holdingCost !== undefined) {
        safetyStockCost = safetyStock * input.holdingCost;
        const orderCost = input.orderCost ?? 0;
        totalAnnualCost =
          ordersPerYear * orderCost + (q / 2) * input.holdingCost + safetyStockCost;
      }
    }
  }

  return {
    leadTimeDemand,
    leadTimeStdDev,
    z,
    safetyStock,
    reorderPoint,
    cycleServiceLevel,
    fillRate,
    expectedShortagePerCycle,
    eoq,
    orderQty: q,
    ordersPerYear,
    cycleLength,
    safetyStockCost,
    totalAnnualCost,
    input,
  };
}

/* ---------- servis seviyesi tablosu ---------- */

export interface ServiceLevelRow {
  serviceLevel: number;
  z: number;
  safetyStock: number;
  reorderPoint: number;
  expectedShortagePerCycle: number;
  fillRate: number | null;
  safetyStockCost: number | null;
}

/**
 * Hedef servis seviyesi kaydırıldıkça R ve SS'in nasıl büyüdüğünü
 * gösteren tablo. Aynı σ_DL / Q / h ile yalnız α değişir.
 */
export function serviceLevelSweep(
  input: RopInput,
  alphas: readonly number[] = [0.5, 0.75, 0.9, 0.95, 0.975, 0.99, 0.995, 0.999],
): ServiceLevelRow[] {
  const rows: ServiceLevelRow[] = [];
  for (const alpha of alphas) {
    if (alpha <= 0 || alpha >= 1) continue;
    const r = computeRop({ ...input, serviceLevel: alpha, serviceMode: 'type1' });
    rows.push({
      serviceLevel: alpha,
      z: r.z,
      safetyStock: r.safetyStock,
      reorderPoint: r.reorderPoint,
      expectedShortagePerCycle: r.expectedShortagePerCycle,
      fillRate: r.fillRate,
      safetyStockCost: r.safetyStockCost,
    });
  }
  return rows;
}
