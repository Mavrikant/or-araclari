/**
 * İki kişilik sıfır toplamlı oyun çözümü — payoff matrisinden saf strateji
 * (saddle point) tespiti, dominant strateji elemesi, 2×2 kapalı form çözümü
 * ve genel m×n karışık strateji için LP formülasyon yardımcıları.
 *
 * Konvansiyon: payoff[i][j] = satır oyuncusunun (R) j sütun stratejisi
 * karşısında i satır stratejisini oynamasının getirisi. Sıfır toplamlı
 * varsayımı gereği sütun oyuncusunun (C) kazancı negatifidir.
 *
 * Saf strateji (saddle point) varsa oyunun değeri v* = maximin = minimax,
 * her iki oyuncu da deterministik strateji oynar. Yoksa karışık strateji
 * gerekir: en az bir oyuncu rastgeleleştirmeli.
 *
 * Algoritma saf JS — DOM yok, glpk yok; karışık strateji LP'sini metin
 * olarak üretir, UI katmanı `lp.ts`'in `parseLp`+`solveLp`'sine besler.
 */

export interface GameInput {
  /** Payoff matrisi V[i][j]; m satır × n sütun, satır oyuncusunun getirisi. */
  payoff: number[][];
  /** Opsiyonel satır strateji adları (uzunluk m). */
  rowNames?: string[];
  /** Opsiyonel sütun strateji adları (uzunluk n). */
  colNames?: string[];
}

export interface SaddlePoint {
  /** Saddle hücresinin (0-tabanlı) konumu. */
  row: number;
  col: number;
  /** Oyunun değeri (payoff[row][col]). */
  value: number;
}

export interface PureAnalysis {
  m: number;
  n: number;
  /** Her satırın minimumu (satır oyuncusu en kötü durum). */
  rowMinima: number[];
  /** Her sütunun maksimumu (sütun oyuncusu en kötü durum). */
  colMaxima: number[];
  /** maximin = max_i row_min_i (oyunun alt değeri, v_). */
  maximin: number;
  /** minimax = min_j col_max_j (oyunun üst değeri, v⁻). */
  minimax: number;
  /** Tüm saddle noktaları (maximin == minimax ise hücreler). */
  saddlePoints: SaddlePoint[];
  /** maximin == minimax. */
  hasSaddlePoint: boolean;
}

export interface DominanceStep {
  /** 'row' veya 'col'. */
  kind: 'row' | 'col';
  /** Elenenin orijinal (denetim öncesi) indeksi. */
  removedIndex: number;
  /** Elemeyi yapan baskın stratejinin indeksi. */
  dominatorIndex: number;
}

export interface DominanceResult {
  /** İndirgeme sonrası payoff matrisi. */
  reduced: number[][];
  /** Kalan satırların orijinal indeks haritası (uzunluk = reduced.length). */
  rowMap: number[];
  /** Kalan sütunların orijinal indeks haritası (uzunluk = reduced[0].length). */
  colMap: number[];
  /** Uygulanan eleme adımları (sırayla). */
  steps: DominanceStep[];
}

export interface MixedSolution {
  /** Oyunun değeri (satır oyuncusu lehine). */
  value: number;
  /** Satır oyuncusu karışık stratejisi (uzunluk m, toplam = 1). */
  rowStrategy: number[];
  /** Sütun oyuncusu karışık stratejisi (uzunluk n, toplam = 1). */
  colStrategy: number[];
}

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}

const EPS = 1e-9;

export function validateGame(input: GameInput): void {
  const { payoff, rowNames, colNames } = input;
  if (!Array.isArray(payoff) || payoff.length === 0) {
    throw new GameError('En az bir satır stratejisi gerekli.');
  }
  const n = payoff[0]?.length ?? 0;
  if (n === 0) {
    throw new GameError('En az bir sütun stratejisi gerekli.');
  }
  for (let i = 0; i < payoff.length; i++) {
    const row = payoff[i];
    if (!Array.isArray(row) || row.length !== n) {
      throw new GameError(
        `Satır ${i + 1} sütun sayısı diğerleriyle eşleşmeli (${n} bekleniyor, ${row?.length ?? 0} verildi).`,
      );
    }
    for (let j = 0; j < n; j++) {
      const v = row[j];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new GameError(`Getiri hücresi [${i + 1},${j + 1}] sonlu sayı olmalı.`);
      }
    }
  }
  if (rowNames && rowNames.length !== payoff.length) {
    throw new GameError(`Satır adı sayısı satır sayısına eşit olmalı (${payoff.length}).`);
  }
  if (colNames && colNames.length !== n) {
    throw new GameError(`Sütun adı sayısı sütun sayısına eşit olmalı (${n}).`);
  }
}

/**
 * Saddle point analizi — maximin (alt değer) ve minimax (üst değer) eşitse
 * oyun saf strateji ile çözülür ve her saf optimum hücre bir saddle'dır.
 */
export function analyzePureStrategy(payoff: number[][]): PureAnalysis {
  validateGame({ payoff });
  const m = payoff.length;
  const n = payoff[0].length;

  const rowMinima: number[] = new Array(m);
  for (let i = 0; i < m; i++) {
    let mn = payoff[i][0];
    for (let j = 1; j < n; j++) if (payoff[i][j] < mn) mn = payoff[i][j];
    rowMinima[i] = mn;
  }

  const colMaxima: number[] = new Array(n);
  for (let j = 0; j < n; j++) {
    let mx = payoff[0][j];
    for (let i = 1; i < m; i++) if (payoff[i][j] > mx) mx = payoff[i][j];
    colMaxima[j] = mx;
  }

  let maximin = rowMinima[0];
  for (let i = 1; i < m; i++) if (rowMinima[i] > maximin) maximin = rowMinima[i];
  let minimax = colMaxima[0];
  for (let j = 1; j < n; j++) if (colMaxima[j] < minimax) minimax = colMaxima[j];

  const hasSaddlePoint = Math.abs(maximin - minimax) < EPS;
  const saddlePoints: SaddlePoint[] = [];
  if (hasSaddlePoint) {
    for (let i = 0; i < m; i++) {
      if (Math.abs(rowMinima[i] - maximin) > EPS) continue;
      for (let j = 0; j < n; j++) {
        if (Math.abs(colMaxima[j] - minimax) < EPS && Math.abs(payoff[i][j] - maximin) < EPS) {
          saddlePoints.push({ row: i, col: j, value: payoff[i][j] });
        }
      }
    }
  }

  return { m, n, rowMinima, colMaxima, maximin, minimax, saddlePoints, hasSaddlePoint };
}

/**
 * Baskın olunan (dominated) satırlar (R için kötü) ve sütunlar (C için
 * kötü) elenir. Kural:
 *   - Satır i, satır k tarafından zayıf baskınlanır ⇔ payoff[i][j] ≤
 *     payoff[k][j] ∀j ve en az birinde sıkı küçük. (R, hep daha kötü ya
 *     da eşit getiri veren stratejiyi atar.)
 *   - Sütun j, sütun l tarafından baskınlanır ⇔ payoff[i][j] ≥
 *     payoff[i][l] ∀i ve en az birinde sıkı büyük. (C, R'a hep daha çok
 *     ya da eşit veren stratejiyi atar.)
 *
 * Eleme sırası: önce baskın satırlar (varsa), sonra baskın sütunlar,
 * kararsız nokta gelene kadar tekrar. Sonuç oyunun değerini değiştirmez.
 */
export function reduceByDominance(payoff: number[][]): DominanceResult {
  validateGame({ payoff });
  let reduced = payoff.map((r) => r.slice());
  let rowMap = payoff.map((_, i) => i);
  let colMap = payoff[0].map((_, j) => j);
  const steps: DominanceStep[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    /* Satırlar — i, k tarafından dominate olur mu? */
    outerRow: for (let i = 0; i < reduced.length; i++) {
      for (let k = 0; k < reduced.length; k++) {
        if (i === k) continue;
        let allLeq = true;
        let anyLt = false;
        for (let j = 0; j < reduced[0].length; j++) {
          if (reduced[i][j] > reduced[k][j] + EPS) {
            allLeq = false;
            break;
          }
          if (reduced[i][j] < reduced[k][j] - EPS) anyLt = true;
        }
        if (allLeq && anyLt) {
          steps.push({ kind: 'row', removedIndex: rowMap[i], dominatorIndex: rowMap[k] });
          reduced = reduced.filter((_, ii) => ii !== i);
          rowMap = rowMap.filter((_, ii) => ii !== i);
          changed = true;
          break outerRow;
        }
      }
    }
    if (changed) continue;

    /* Sütunlar — j, l tarafından dominate olur mu? (C için küçük daha iyi) */
    outerCol: for (let j = 0; j < reduced[0].length; j++) {
      for (let l = 0; l < reduced[0].length; l++) {
        if (j === l) continue;
        let allGeq = true;
        let anyGt = false;
        for (let i = 0; i < reduced.length; i++) {
          if (reduced[i][j] < reduced[i][l] - EPS) {
            allGeq = false;
            break;
          }
          if (reduced[i][j] > reduced[i][l] + EPS) anyGt = true;
        }
        if (allGeq && anyGt) {
          steps.push({ kind: 'col', removedIndex: colMap[j], dominatorIndex: colMap[l] });
          reduced = reduced.map((row) => row.filter((_, jj) => jj !== j));
          colMap = colMap.filter((_, jj) => jj !== j);
          changed = true;
          break outerCol;
        }
      }
    }
  }

  return { reduced, rowMap, colMap, steps };
}

/**
 * Saddle olmayan 2×2 oyunun kapalı form karışık strateji çözümü.
 *
 *   payoff = [[a, b], [c, d]]
 *   D = a − b − c + d
 *   p1 = (d − c) / D,   v = (ad − bc) / D
 *
 * D = 0 ise saddle point vardır (analyzePureStrategy ile yakalanır) ya da
 * dejenere durumdur; bu fonksiyon o hâlde hata fırlatır.
 */
export function solve2x2NoSaddle(payoff: number[][]): MixedSolution {
  validateGame({ payoff });
  if (payoff.length !== 2 || payoff[0].length !== 2) {
    throw new GameError('solve2x2NoSaddle yalnızca 2×2 oyunlarda çalışır.');
  }
  const [[a, b], [c, d]] = payoff as [[number, number], [number, number]];
  const D = a - b - c + d;
  if (Math.abs(D) < EPS) {
    throw new GameError(
      '2×2 kapalı form uygulanamaz: payoff[0][0] − payoff[0][1] − payoff[1][0] + payoff[1][1] = 0. Saddle point arayın.',
    );
  }
  const p1 = (d - c) / D;
  const q1 = (d - b) / D;
  const v = (a * d - b * c) / D;
  /* Olasılıkların [0,1] aralığında olduğunu doğrula — değilse saddle var demektir. */
  if (p1 < -EPS || p1 > 1 + EPS || q1 < -EPS || q1 > 1 + EPS) {
    throw new GameError(
      '2×2 kapalı form negatif/aşan olasılık üretti — oyunun saf strateji çözümü var, önce analyzePureStrategy çağırın.',
    );
  }
  return {
    value: v,
    rowStrategy: [clamp01(p1), clamp01(1 - p1)],
    colStrategy: [clamp01(q1), clamp01(1 - q1)],
  };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Karışık strateji LP'leri için gerekli pozitiflik kaydırması — tüm
 * payoff hücreleri pozitif olacak şekilde sabit bir k eklenir; orijinal
 * oyunun değeri = LP'den dönen v_shift − k.
 *
 * Konvansiyon: k = max(0, 1 − min(payoff)). 0'dan büyük tutmamızın sebebi
 * LP değişkenlerinin x_i = p_i / v olabilmesi için v > 0 gerekmesi.
 */
export function payoffShift(payoff: number[][]): number {
  let mn = payoff[0][0];
  for (const row of payoff) for (const v of row) if (v < mn) mn = v;
  return mn <= 0 ? 1 - mn : 0;
}

/**
 * Satır oyuncusu LP'sini (max v ⇒ min Σ x_i) metin olarak üretir.
 *
 * Pozitiflik için A'ya k eklenir: A'_{ij} = A_{ij} + k. LP:
 *   min  Σ_i x_i
 *   s.t. Σ_i A'_{ij} · x_i  >=  1   (∀ j)
 *        x_i >= 0
 *
 * Çözüm: x* için v_shift = 1 / Σ x_i*, p_i = x_i* · v_shift, oyunun değeri
 * v* = v_shift − k. Değişken adları `x1, x2, ...`.
 *
 * Not: parseLp varsayılan olarak değişkenleri >= 0 olarak ele aldığı için
 * ek bound satırı yazmamıza gerek yok.
 */
export function buildRowLpText(payoff: number[][], shift: number): string {
  validateGame({ payoff });
  const m = payoff.length;
  const n = payoff[0].length;
  const lines: string[] = [];
  lines.push('min ' + range(m).map((i) => `x${i + 1}`).join(' + '));
  for (let j = 0; j < n; j++) {
    const terms = range(m).map((i) => formatTerm(payoff[i][j] + shift, `x${i + 1}`, i === 0));
    lines.push(terms.join(' ').trim() + ' >= 1');
  }
  return lines.join('\n');
}

/**
 * Sütun oyuncusu LP'si — simetrik dual:
 *   max  Σ_j y_j
 *   s.t. Σ_j A'_{ij} · y_j  <=  1   (∀ i)
 *        y_j >= 0
 *
 * Çözüm: y* için v_shift = 1 / Σ y_j*, q_j = y_j* · v_shift, oyunun değeri
 * v* = v_shift − k (satır LP'siyle aynı v_shift).
 */
export function buildColLpText(payoff: number[][], shift: number): string {
  validateGame({ payoff });
  const m = payoff.length;
  const n = payoff[0].length;
  const lines: string[] = [];
  lines.push('max ' + range(n).map((j) => `y${j + 1}`).join(' + '));
  for (let i = 0; i < m; i++) {
    const terms = range(n).map((j) => formatTerm(payoff[i][j] + shift, `y${j + 1}`, j === 0));
    lines.push(terms.join(' ').trim() + ' <= 1');
  }
  return lines.join('\n');
}

/**
 * LP çözüm değişkenlerini orijinal oyun çözümüne çevir.
 *
 * @param xs satır LP'sinde her x_i (m uzunluk)
 * @param ys sütun LP'sinde her y_j (n uzunluk)
 * @param shift payoffShift'in döndürdüğü k
 */
export function decodeLpSolution(
  xs: number[],
  ys: number[],
  shift: number,
): MixedSolution {
  const sumX = xs.reduce((s, v) => s + v, 0);
  const sumY = ys.reduce((s, v) => s + v, 0);
  if (sumX <= EPS || sumY <= EPS) {
    throw new GameError('LP çözümü dejenere (toplam = 0); pozitiflik kaydırması yetersiz olabilir.');
  }
  const vShiftRow = 1 / sumX;
  const vShiftCol = 1 / sumY;
  /* Strong duality: vShiftRow == vShiftCol; ortalama al ki sayısal gürültüyü dengele. */
  const vShift = (vShiftRow + vShiftCol) / 2;
  const value = vShift - shift;
  const rowStrategy = xs.map((x) => x * vShift);
  const colStrategy = ys.map((y) => y * vShift);
  /* Normalize — sayısal yuvarlamayla toplam 1'den biraz sapabilir. */
  return {
    value,
    rowStrategy: normalize(rowStrategy),
    colStrategy: normalize(colStrategy),
  };
}

/**
 * Yardımcı: saddle point yoksa karışık strateji için satır LP'sini
 * hazırla; UI çağırır.
 */
export function prepareMixedLp(payoff: number[][]): {
  shift: number;
  rowLp: string;
  colLp: string;
} {
  const shift = payoffShift(payoff);
  return {
    shift,
    rowLp: buildRowLpText(payoff, shift),
    colLp: buildColLpText(payoff, shift),
  };
}

function range(n: number): number[] {
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = i;
  return out;
}

function formatTerm(coef: number, variable: string, first: boolean): string {
  if (Math.abs(coef) < EPS) {
    /* 0 katsayılı terim LP'de yer kaplamasın — ama ilk terim ise yine de bırak
     * (boş ifade hatası vermesin). */
    return first ? `0${variable}` : '';
  }
  const sign = coef < 0 ? '-' : first ? '' : '+';
  const abs = Math.abs(coef);
  const num = formatNumber(abs);
  if (first) return `${sign}${num}${variable}`;
  return `${sign} ${num}${variable}`;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(8).replace(/\.?0+$/, '');
}

function normalize(arr: number[]): number[] {
  const s = arr.reduce((a, b) => a + Math.max(0, b), 0);
  if (s <= EPS) return arr.map(() => 0);
  return arr.map((v) => Math.max(0, v) / s);
}
