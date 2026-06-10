/**
 * Belirsizlik ve risk altında karar analizi — payoff tablosundan klasik
 * karar kriterlerinin hepsini tek geçişte hesaplar.
 *
 * Giriş: m alternatif × n doğa durumu olmak üzere payoff matrisi (her hücre
 * o alternatif × o durumda gerçekleşen getiri). Doğa durumlarının
 * olasılıkları biliniyorsa risk altında karar (EMV, EVPI, EOL); değilse
 * belirsizlik altında karar (Maximax, Maximin, Laplace, Hurwicz, Savage
 * regret) kriterleri uygulanır.
 *
 * Algoritma saf JS — DOM yok, I/O yok, browser ve test ortamında aynı
 * çıktıyı verir.
 *
 * Notasyon (Render-Stair-Hanna, Quantitative Analysis for Management):
 *   - A_i: alternatif i (i = 1..m)
 *   - S_j: doğa durumu j (j = 1..n)
 *   - V_{ij}: A_i seçildiğinde S_j gerçekleşirse getiri (kâr veya maliyet)
 *   - p_j: P(S_j); Σ p_j = 1 (eğer verildiyse)
 *
 * Optimizasyon yönü:
 *   - 'max' (varsayılan): getiriler kâr; daha büyük daha iyi
 *   - 'min': getiriler maliyet; daha küçük daha iyi
 *
 * Min modunda Maximax / Maximin / Hurwicz / Regret işaretlerin doğru
 * tarafta kalması için içsel olarak ters çevrilir; tüm değerler orijinal
 * yönde raporlanır.
 */

export type DecisionDirection = 'max' | 'min';

export interface DecisionInput {
  /** Payoff matrisi V[i][j]; m × n. */
  payoffs: number[][];
  /** Opsiyonel: alternatif adları (uzunluk m). */
  alternatives?: string[];
  /** Opsiyonel: doğa durumu adları (uzunluk n). */
  states?: string[];
  /** Opsiyonel: durum olasılıkları (uzunluk n, Σ = 1). Verilirse risk altı kriterler de çalışır. */
  probabilities?: number[];
  /** Hurwicz iyimserlik katsayısı α ∈ [0, 1]. Varsayılan 0.5. */
  alpha?: number;
  /** 'max' (kâr, varsayılan) ya da 'min' (maliyet). */
  direction?: DecisionDirection;
}

export interface CriterionPick {
  /** En iyi alternatifin (0-tabanlı) indeksi. */
  index: number;
  /** Kriterin bu alternatifte aldığı değer (orijinal yönde). */
  value: number;
  /** Birden fazla alternatif aynı en-iyi değere bağlı kalıyorsa hepsi. */
  tiedIndices: number[];
}

export interface DecisionResult {
  /** m, n boyutları. */
  m: number;
  n: number;
  /** Yön (giriş echo). */
  direction: DecisionDirection;
  /** Olasılıklar verildi mi? (false ise EMV/EVPI/EOL null). */
  hasProbabilities: boolean;

  // --- Belirsizlik altında kriterler ---
  /** Maximax: her satırın en iyisi, sonra en iyi olan satır. */
  maximax: CriterionPick;
  /** Maximin (Wald): her satırın en kötüsü, sonra en iyi olan satır. */
  maximin: CriterionPick;
  /** Laplace (eşit-olası): her satırın aritmetik ortalaması. */
  laplace: CriterionPick;
  /** Hurwicz α·best + (1−α)·worst; α giriş ile. */
  hurwicz: CriterionPick & { alpha: number };
  /** Savage minimax regret — regret matrisini de döndürür. */
  regret: CriterionPick & { regretMatrix: number[][] };

  // --- Risk altında kriterler (sadece olasılıklar verildiyse) ---
  /** EMV — Beklenen Parasal Değer Σ p_j V_{ij}; tüm alternatifler için. */
  emv: number[] | null;
  /** EMV'ye göre en iyi alternatif. */
  emvBest: CriterionPick | null;
  /** EOL — Beklenen Fırsat Kaybı Σ p_j R_{ij}; tüm alternatifler için. */
  eol: number[] | null;
  /** EOL'a göre en iyi alternatif (EMV ile aynı çıkar, sağlama). */
  eolBest: CriterionPick | null;
  /** EVwPI — Mükemmel Bilgi Altında Beklenen Değer = Σ p_j · max_i V_{ij}. */
  evWithPi: number | null;
  /** EVPI — Mükemmel Bilginin Beklenen Değeri = EVwPI − EMV*. */
  evpi: number | null;
}

export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionError';
  }
}

const EPS = 1e-9;

function validate(input: DecisionInput): void {
  const { payoffs, probabilities, alpha, direction } = input;
  if (!Array.isArray(payoffs) || payoffs.length === 0) {
    throw new DecisionError('En az bir alternatif satırı gerekli.');
  }
  const n = payoffs[0]?.length ?? 0;
  if (n === 0) {
    throw new DecisionError('En az bir doğa durumu sütunu gerekli.');
  }
  for (let i = 0; i < payoffs.length; i++) {
    const row = payoffs[i];
    if (!Array.isArray(row) || row.length !== n) {
      throw new DecisionError(
        `Alternatif ${i + 1} sütun sayısı diğerleriyle eşleşmeli (${n} bekleniyor).`,
      );
    }
    for (let j = 0; j < n; j++) {
      const v = row[j];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new DecisionError(`Getiri hücresi [${i + 1},${j + 1}] sonlu sayı olmalı.`);
      }
    }
  }
  if (probabilities !== undefined) {
    if (!Array.isArray(probabilities) || probabilities.length !== n) {
      throw new DecisionError(`Olasılık sayısı doğa durumu sayısına eşit olmalı (${n}).`);
    }
    let s = 0;
    for (let j = 0; j < n; j++) {
      const p = probabilities[j];
      if (typeof p !== 'number' || !Number.isFinite(p) || p < -EPS) {
        throw new DecisionError(`Olasılık [${j + 1}] negatif olamaz.`);
      }
      s += p;
    }
    if (Math.abs(s - 1) > 1e-6) {
      throw new DecisionError(`Olasılıklar 1'e toplanmalı (verilen toplam: ${s.toFixed(6)}).`);
    }
  }
  if (alpha !== undefined) {
    if (typeof alpha !== 'number' || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      throw new DecisionError(`Hurwicz α değeri 0 ile 1 arasında olmalı (${alpha} verildi).`);
    }
  }
  if (direction !== undefined && direction !== 'max' && direction !== 'min') {
    throw new DecisionError(`Yön 'max' ya da 'min' olmalı (${direction} verildi).`);
  }
}

/** Yön farkını soyutla: 'max' modunda en iyi = en büyük; 'min' modunda en iyi = en küçük. */
function better(a: number, b: number, dir: DecisionDirection): boolean {
  return dir === 'max' ? a > b : a < b;
}

/** Bir değer dizisinde "en iyisi"ni ve berabere kalanları bul. */
function bestOf(values: number[], dir: DecisionDirection): CriterionPick {
  let bestVal = values[0];
  for (let i = 1; i < values.length; i++) {
    if (better(values[i], bestVal, dir)) bestVal = values[i];
  }
  const tied: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (Math.abs(values[i] - bestVal) < EPS) tied.push(i);
  }
  return { index: tied[0], value: bestVal, tiedIndices: tied };
}

export function solveDecision(input: DecisionInput): DecisionResult {
  validate(input);
  const payoffs = input.payoffs.map((r) => r.slice());
  const m = payoffs.length;
  const n = payoffs[0].length;
  const dir: DecisionDirection = input.direction ?? 'max';
  const alpha = input.alpha ?? 0.5;
  const probs = input.probabilities;

  // --- Satır bazlı uç değerler ---
  const rowBest: number[] = [];
  const rowWorst: number[] = [];
  const rowMean: number[] = [];
  for (let i = 0; i < m; i++) {
    let bestV = payoffs[i][0];
    let worstV = payoffs[i][0];
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const v = payoffs[i][j];
      if (better(v, bestV, dir)) bestV = v;
      if (better(worstV, v, dir)) worstV = v;
      sum += v;
    }
    rowBest.push(bestV);
    rowWorst.push(worstV);
    rowMean.push(sum / n);
  }

  // Maximax: satır-bestlerinin en iyisi.
  const maximax = bestOf(rowBest, dir);
  // Maximin (Wald): satır-worstlerinin en iyisi.
  const maximin = bestOf(rowWorst, dir);
  // Laplace: satır ortalamalarının en iyisi.
  const laplace = bestOf(rowMean, dir);
  // Hurwicz: α·best + (1−α)·worst.
  const hurwiczVals = rowBest.map((b, i) => alpha * b + (1 - alpha) * rowWorst[i]);
  const hurwiczPick = bestOf(hurwiczVals, dir);
  const hurwicz = { ...hurwiczPick, alpha };

  // Savage Regret: her sütun için sütun-bestine olan fark.
  // 'max' modunda regret = colBest − V_{ij} (pozitif); 'min' modunda regret = V_{ij} − colBest.
  const colBest: number[] = [];
  for (let j = 0; j < n; j++) {
    let v = payoffs[0][j];
    for (let i = 1; i < m; i++) {
      if (better(payoffs[i][j], v, dir)) v = payoffs[i][j];
    }
    colBest.push(v);
  }
  const regretMatrix: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      regretMatrix[i][j] = dir === 'max' ? colBest[j] - payoffs[i][j] : payoffs[i][j] - colBest[j];
    }
  }
  // Savage: regret'i minimize et → her satırın en yüksek regret'i, sonra en düşüğü olan satır.
  const rowMaxRegret = regretMatrix.map((r) => Math.max(...r));
  // bestOf çağrısı 'min' yönüyle çünkü regret düşük = iyi.
  const regretPick = bestOf(rowMaxRegret, 'min');
  const regret = { ...regretPick, regretMatrix };

  // --- Risk altında (olasılıklar verildiyse) ---
  let emv: number[] | null = null;
  let emvBest: CriterionPick | null = null;
  let eol: number[] | null = null;
  let eolBest: CriterionPick | null = null;
  let evWithPi: number | null = null;
  let evpi: number | null = null;
  if (probs) {
    emv = payoffs.map((row) => row.reduce((s, v, j) => s + v * probs[j], 0));
    emvBest = bestOf(emv, dir);
    // EOL — beklenen fırsat kaybı: satırlar üzerinden Σ p_j · regret_{ij}.
    eol = regretMatrix.map((row) => row.reduce((s, v, j) => s + v * probs[j], 0));
    // Regret pozitif; EOL'da en iyi = en düşük EOL.
    eolBest = bestOf(eol, 'min');
    // EVwPI = Σ p_j · colBest_j (her durumda en iyi alternatife geçebilseydik).
    evWithPi = colBest.reduce((s, v, j) => s + v * probs[j], 0);
    // EVPI ≥ 0: 'max' modda EVwPI − EMV*, 'min' modda EMV* − EVwPI.
    evpi = dir === 'max' ? evWithPi - emvBest.value : emvBest.value - evWithPi;
  }

  return {
    m,
    n,
    direction: dir,
    hasProbabilities: probs !== undefined,
    maximax,
    maximin,
    laplace,
    hurwicz,
    regret,
    emv,
    emvBest,
    eol,
    eolBest,
    evWithPi,
    evpi,
  };
}
