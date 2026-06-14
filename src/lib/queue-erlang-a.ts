/**
 * Erlang-A (M/M/c + abandonment) queue performance metrics.
 *
 * Kendall'ın klasik M/M/c modeli "sabırlı müşteri" varsayar — bekleyenler
 * sonsuza kadar bekler. Modern çağrı merkezi / acil servis modellemesi
 * için bu çok iyimserdir: bekleyen müşteriler **bırakır** (abandon).
 * Erlang-A bu davranışı, kuyrukta bekleyen her müşterinin θ oranında
 * üstel zaman içinde bağımsız olarak bırakacağı varsayımıyla modeller.
 *
 *   λ      Poisson geliş hızı
 *   μ      üstel hizmet hızı (sunucu başına)
 *   c      paralel sunucu sayısı
 *   θ      kuyrukta bekleyen müşteri başına bırakma (abandonment) hızı
 *   a = λ/μ  offered load (Erlang)
 *   ρ = a/c  sunucu başına yoğunluk
 *
 * Doğum-ölüm zinciri (sonsuz buffer, sürekli kararlı):
 *
 *   Doğum oranı  n. durumda:  λ            (her zaman)
 *   Ölüm oranı   n. durumda:  n·μ          (n ≤ c — n sunucu meşgul)
 *                              c·μ + (n−c)·θ (n > c — c sunucu + (n−c) bekleyen)
 *
 *   q_0 = 1
 *   q_n = q_{n-1} · λ / (n·μ)              (n ≤ c)
 *   q_n = q_{n-1} · λ / (c·μ + (n−c)·θ)    (n > c)
 *   P_n = q_n / Σ q
 *
 * θ > 0 olduğunda zincir her ρ için kararlıdır — bırakmalar drift sağlar.
 * θ = 0 hâlinde model M/M/c'ye indirgenir ve ρ < 1 olmalıdır.
 *
 * Çıkış metrikleri:
 *
 *   P(W > 0)        = Σ_{n ≥ c} P_n
 *   Lq              = Σ_{n > c} (n − c) P_n
 *   λ_aban          = θ · Lq                     (PASTA + Little)
 *   P(abandon)      = λ_aban / λ
 *   λ_served        = λ − λ_aban
 *   L               = Σ_{n ≥ 0} n P_n            = Lq + λ_served / μ
 *   Wq (girenler)   = Lq / λ
 *   W  (girenler)   = L  / λ
 *
 * Referans: Garnett, Mandelbaum & Reiman (2002), "Designing a Call
 * Center with Impatient Customers", QED regime.
 *
 * Pure: no DOM, no I/O.
 */

export interface ErlangAInput {
  /** Geliş hızı λ. */
  arrivalRate: number;
  /** Hizmet hızı μ (sunucu başına). */
  serviceRate: number;
  /** Paralel sunucu sayısı c (pozitif tam sayı). */
  servers: number;
  /** Bireysel bırakma hızı θ. 0 ise model M/M/c'ye indirgenir. */
  abandonmentRate: number;
}

export interface ErlangAResult {
  servers: number;             // c
  offeredLoad: number;         // a = λ/μ
  utilisation: number;         // ρ = a/c (bilgi amaçlı; sistem her zaman kararlı)
  probEmpty: number;           // P0
  probWait: number;            // P(W > 0) = Σ_{n ≥ c} P_n
  avgInSystem: number;         // L
  avgInQueue: number;          // Lq
  avgTimeInSystem: number;     // W (giren müşteriler için, Little üzerinden)
  avgTimeInQueue: number;      // Wq
  abandonRate: number;         // λ_aban = θ · Lq
  probAbandon: number;         // P(abandon) = λ_aban / λ
  effectiveServedRate: number; // λ_served = λ − λ_aban
  /** Durum olasılıkları P_n, n = 0 .. nMax (kuyruk tail kesildiği yer). */
  stateProbabilities: number[];
  /** stateProbabilities dizisinin son indeksi (= dağılımın efektif maks n'i). */
  nMax: number;
}

export class ErlangAError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErlangAError';
  }
}

const MAX_SERVERS = 200;
const MAX_STATES = 5000;
const DEFAULT_TAIL = 1e-12;

function validate(input: ErlangAInput): void {
  const { arrivalRate: lambda, serviceRate: mu, servers: c, abandonmentRate: theta } = input;
  if (typeof lambda !== 'number' || !Number.isFinite(lambda) || lambda <= 0) {
    throw new ErlangAError(`Geliş hızı (λ) pozitif bir sayı olmalı (${lambda} verildi).`);
  }
  if (typeof mu !== 'number' || !Number.isFinite(mu) || mu <= 0) {
    throw new ErlangAError(`Hizmet hızı (μ) pozitif bir sayı olmalı (${mu} verildi).`);
  }
  if (typeof c !== 'number' || !Number.isInteger(c) || c < 1) {
    throw new ErlangAError(`Sunucu sayısı (c) en az 1 tam sayı olmalı (${c} verildi).`);
  }
  if (c > MAX_SERVERS) {
    throw new ErlangAError(`Sunucu sayısı (c) en fazla ${MAX_SERVERS} olabilir (${c} verildi).`);
  }
  if (typeof theta !== 'number' || !Number.isFinite(theta) || theta < 0) {
    throw new ErlangAError(`Bırakma hızı (θ) sıfır veya pozitif bir sayı olmalı (${theta} verildi).`);
  }
  if (theta === 0 && lambda >= c * mu) {
    throw new ErlangAError(
      `θ = 0 (bırakma yok) iken sistem M/M/c'ye indirgenir ve ρ < 1 gerekir. ` +
        `λ (${lambda}) ≥ c·μ (${c}·${mu} = ${c * mu}); kuyruk sınırsız büyür.`,
    );
  }
}

/**
 * Birth/death zincirini özyinelemeli olarak hesapla, normalize et,
 * tail < tail eşiğine düşünce kes.
 */
function steadyStateA(a: number, c: number, thetaPerMu: number, tail: number): number[] {
  const q: number[] = [1];
  let cumSum = 1;
  let n = 0;
  while (n < MAX_STATES) {
    n++;
    const denom = n <= c ? n : c + (n - c) * thetaPerMu;
    const next = q[n - 1] * (a / denom);
    q.push(next);
    cumSum += next;
    /* Durum c'den sonra tail küçüldüğünde dur — n ≤ c bölgesi monoton
     * artabildiği için kesme yalnızca queue bölgesinde uygulanır. */
    if (n > c && next / cumSum < tail) break;
  }
  return q.map((v) => v / cumSum);
}

export function analyzeErlangA(
  input: ErlangAInput,
  options: { tail?: number } = {},
): ErlangAResult {
  validate(input);
  const { arrivalRate: lambda, serviceRate: mu, servers: c, abandonmentRate: theta } = input;
  const a = lambda / mu;
  const rho = a / c;
  const thetaPerMu = theta / mu;
  const tail = options.tail ?? DEFAULT_TAIL;

  const P = steadyStateA(a, c, thetaPerMu, tail);
  const nMax = P.length - 1;

  let probWait = 0;
  for (let n = c; n <= nMax; n++) probWait += P[n];

  let Lq = 0;
  for (let n = c + 1; n <= nMax; n++) Lq += (n - c) * P[n];

  const abandonRate = theta * Lq;
  const probAbandon = abandonRate / lambda;
  const effectiveServedRate = lambda - abandonRate;

  /* L: bekleyen + hizmet alan. Σ n P_n ile doğrudan hesapla — Lq + λ_served/μ
   * eşdeğer (Little + sunucu yoğunluğu) ama burada toplam P olduğu için
   * doğrudan tabloyu kullan. */
  let L = 0;
  for (let n = 1; n <= nMax; n++) L += n * P[n];

  /* Wq, W: giren tüm müşteriler üzerinden Little Yasası (terk edenler
   * dahil — kuyrukta geçirdikleri zaman da L_q'yu beslemiştir). */
  const Wq = Lq / lambda;
  const W = L / lambda;

  return {
    servers: c,
    offeredLoad: a,
    utilisation: rho,
    probEmpty: P[0],
    probWait,
    avgInSystem: L,
    avgInQueue: Lq,
    avgTimeInSystem: W,
    avgTimeInQueue: Wq,
    abandonRate,
    probAbandon,
    effectiveServedRate,
    stateProbabilities: P,
    nMax,
  };
}
