/**
 * Bimatris (genel toplamlı) oyunlarda Lemke-Howson tamamlayıcı pivot
 * algoritması — TEK Nash dengesi bulucu.
 *
 * Support enumeration ({@link findNashEquilibria}, bimatrix.ts) küçük
 * oyunlarda (m + n ≤ 12) tüm dengeleri tarar; büyük oyunda 2^m · 2^n
 * patlar. Lemke-Howson polinom-yakın pratik sürede tek bir dengeyi
 * bulur (worst case üstel, pratikte küçük m + n'de hızlı).
 *
 * Polytope formülasyonu (Nisan vd., AGT 2007, Bölüm 3.5):
 *   P = { x ∈ R^m, x ≥ 0 : Bᵀ x ≤ 1 }   (sütun oyuncusunun en-iyi-yanıt)
 *   Q = { y ∈ R^n, y ≥ 0 : A y ≤ 1 }    (satır oyuncusunun en-iyi-yanıt)
 *
 * Etiketler 0..m+n-1:
 *   Etiket i ∈ [0..m): P'de x_i = 0  veya  Q'da (A y)_i = 1 ile karşılanır.
 *   Etiket m+j ∈ [m..m+n): P'de (Bᵀ x)_j = 1  veya  Q'da y_j = 0 ile karşılanır.
 *
 * Yapay tepe (0, 0) bütün etiketleri kapsar (her etiket tam bir tarafta).
 * "Drop label k" → P (k < m ise) veya Q (k ≥ m ise) tarafında k. değişkeni
 * temele sokmaya başla. Min-oran testi bir taban değişkenini bırakır;
 * bırakılan değişkenin etiketi yeni "duplicate" olur. Karşı poliyedrayla
 * alternatif pivotlar yapılır; duplicate = k olunca dengeyi bul.
 *
 * Şu anki desteklenen sınıf: nondejenere bimatris oyunlar. Dejenere
 * durumda 'degenerate' status'u döner (kullanıcı farklı dropLabel
 * denemesi önerilir). Bland kuralı min-oran eşitliklerinde küçük taban
 * indeksini seçer (Lemke-Howson döngüsüzlüğü).
 *
 * Pozitiflik ön-koşulu: A ve B kesin pozitif olmalı. Değilse her giriş
 * için min A ve min B'den 1 daha az olacak biçimde kaydırılır (etkisi
 * sadece kazançta sabit; denge stratejisi değişmez).
 */

import {
  validateBimatrix,
  BimatrixError,
  type BimatrixInput,
  type Equilibrium,
} from './bimatrix';

export type LemkeStatus = 'found' | 'degenerate' | 'maxiter' | 'invalid-drop';

export interface LemkeInput extends BimatrixInput {
  /**
   * Başlangıçta düşürülecek etiket — 1-tabanlı (kullanıcıya gösterilen).
   * 1 ≤ dropLabel ≤ m + n. Varsayılan: 1.
   *
   * Pratik gözlem: farklı dropLabel'lar farklı denge bulabilir; küçük
   * oyunlarda 1..m+n hepsi denenebilir, ortak çıktı sayısı ≤ denge sayısı.
   */
  dropLabel?: number;
  /** Pivot üst sınırı (sonsuz döngü emniyeti). Varsayılan: 10000. */
  maxPivots?: number;
}

export interface LemkePivotStep {
  /** Pivot hangi poliyedrada — 'P' (sütun en-iyi-yanıt) veya 'Q' (satır). */
  side: 'P' | 'Q';
  /** Temele giren değişkenin sütun indeksi (0..m+n-1). */
  enteringCol: number;
  /** Tabloda hangi satırdan çıktı (0-tabanlı). */
  leavingRow: number;
  /** Temelden çıkan değişkenin sütun indeksi = yeni duplicate etiket. */
  leavingCol: number;
}

export interface LemkeResult {
  status: LemkeStatus;
  /** Bulunan denge — status === 'found' ise dolu. */
  equilibrium: Equilibrium | null;
  /** Pivot adımları (rapor için). */
  steps: LemkePivotStep[];
  /** Başlangıçta düşürülen etiket (0-tabanlı). */
  dropLabel0: number;
  /** Yapılan pivot sayısı. */
  pivots: number;
  /** Pozitiflik için A, B'ye uygulanan kaydırma. */
  shift: { a: number; b: number };
  m: number;
  n: number;
}

const EPS = 1e-9;
const RATIO_EPS = 1e-10;
const POSITIVE_EPS = 1e-12;

export class LemkeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LemkeError';
  }
}

/**
 * Tek bir Lemke-Howson çalıştırması. Belirtilen dropLabel ile yapay (0,0)
 * tepesinden tamamlayıcı pivot yolu izlenir; ulaşılan tepedeki strateji
 * çiftini denge olarak döner.
 */
export function lemkeHowson(input: LemkeInput): LemkeResult {
  validateBimatrix(input);
  const m = input.payoffA.length;
  const n = input.payoffA[0].length;
  const totalLabels = m + n;
  const userDrop = input.dropLabel ?? 1;
  if (!Number.isInteger(userDrop) || userDrop < 1 || userDrop > totalLabels) {
    throw new LemkeError(
      `dropLabel 1..${totalLabels} aralığında tam sayı olmalı (verilen: ${userDrop}).`,
    );
  }
  const dropLabel0 = userDrop - 1;
  const maxPivots = input.maxPivots ?? 10000;

  /* Pozitiflik kaydırması — A, B kesin pozitif yapılır. Strateji vektörü
   * değişmez; payoff orijinal A, B ile hesaplanır. */
  let minA = Infinity;
  let minB = Infinity;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (input.payoffA[i][j] < minA) minA = input.payoffA[i][j];
      if (input.payoffB[i][j] < minB) minB = input.payoffB[i][j];
    }
  }
  const shiftA = minA <= 0 ? 1 - minA : 0;
  const shiftB = minB <= 0 ? 1 - minB : 0;

  const A: number[][] = new Array(m);
  const B: number[][] = new Array(m);
  for (let i = 0; i < m; i++) {
    A[i] = new Array(n);
    B[i] = new Array(n);
    for (let j = 0; j < n; j++) {
      A[i][j] = input.payoffA[i][j] + shiftA;
      B[i][j] = input.payoffB[i][j] + shiftB;
    }
  }

  /* Tablo sütun düzeni — her iki poliyedrada da etiketle birebir:
   *   col 0..m-1     → P'de x_i;        Q'da r_i (slack of (Ay)_i ≤ 1)
   *   col m..m+n-1   → P'de s_{j-m} (slack of (Bᵀx)_{j-m} ≤ 1); Q'da y_{j-m}
   * Etiket = sütun indeksi. Non-basic sütun = o etiketi karşılıyor.
   * Tablonun en sağ sütunu rhs.
   */
  const cols = totalLabels;
  const RHS = cols;

  /* P tablosu: n satır. Row j: (Bᵀ x)_j + s_j = 1 → Σ_i B[i,j] x_i + s_j = 1. */
  const tabP: number[][] = new Array(n);
  const basicP: number[] = new Array(n);
  for (let j = 0; j < n; j++) {
    const row = new Array<number>(cols + 1).fill(0);
    for (let i = 0; i < m; i++) row[i] = B[i][j];
    row[m + j] = 1;
    row[RHS] = 1;
    tabP[j] = row;
    basicP[j] = m + j;
  }

  /* Q tablosu: m satır. Row i: r_i + (A y)_i = 1 → r_i + Σ_j A[i,j] y_j = 1. */
  const tabQ: number[][] = new Array(m);
  const basicQ: number[] = new Array(m);
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(cols + 1).fill(0);
    row[i] = 1;
    for (let j = 0; j < n; j++) row[m + j] = A[i][j];
    row[RHS] = 1;
    tabQ[i] = row;
    basicQ[i] = i;
  }

  const steps: LemkePivotStep[] = [];

  /* Başlangıçta P 0..m-1 etiketlerini, Q m..m+n-1 etiketlerini karşılar.
   * dropLabel hangi tarafta basacaksa orası giriş yapar. */
  let side: 'P' | 'Q' = dropLabel0 < m ? 'P' : 'Q';
  let entering = dropLabel0;
  let pivots = 0;

  while (pivots < maxPivots) {
    pivots++;
    const tab = side === 'P' ? tabP : tabQ;
    const basic = side === 'P' ? basicP : basicQ;
    const numRows = tab.length;

    /* Min-oran testi. Pozitif girişli satırlar arasında en küçük rhs / a
     * oranını bul. Eşitlikte Bland kuralı: en küçük taban indeksi. */
    let bestRow = -1;
    let bestRatio = Infinity;
    for (let r = 0; r < numRows; r++) {
      const a = tab[r][entering];
      if (a <= POSITIVE_EPS) continue;
      const ratio = tab[r][RHS] / a;
      if (ratio < bestRatio - RATIO_EPS) {
        bestRatio = ratio;
        bestRow = r;
      } else if (Math.abs(ratio - bestRatio) <= RATIO_EPS) {
        if (bestRow === -1 || basic[r] < basic[bestRow]) bestRow = r;
      }
    }

    if (bestRow === -1) {
      /* Ray termination — giren değişken sınırsız artabilir. Dejenere ya
       * da bu dropLabel'dan ulaşılabilir denge yok. */
      return {
        status: 'degenerate',
        equilibrium: null,
        steps,
        dropLabel0,
        pivots,
        shift: { a: shiftA, b: shiftB },
        m,
        n,
      };
    }

    const leavingCol = basic[bestRow];
    const pivotVal = tab[bestRow][entering];

    /* Gauss-Jordan: pivot satırını normalize et, diğer satırlardan çıkar. */
    for (let c = 0; c <= RHS; c++) tab[bestRow][c] /= pivotVal;
    tab[bestRow][entering] = 1;
    for (let r = 0; r < numRows; r++) {
      if (r === bestRow) continue;
      const factor = tab[r][entering];
      if (factor === 0) continue;
      for (let c = 0; c <= RHS; c++) {
        tab[r][c] -= factor * tab[bestRow][c];
      }
      tab[r][entering] = 0;
    }
    basic[bestRow] = entering;

    steps.push({ side, enteringCol: entering, leavingRow: bestRow, leavingCol });

    /* Çıkan etiket başlangıçta düşürdüğümüz etiketse — döngü kapandı,
     * denge bulundu. */
    if (leavingCol === dropLabel0) {
      return finalizeEquilibrium(
        input,
        m,
        n,
        tabP,
        basicP,
        tabQ,
        basicQ,
        steps,
        dropLabel0,
        pivots,
        { a: shiftA, b: shiftB },
        RHS,
      );
    }

    /* Aksi halde diğer poliyedrada duplicate etiketi (= leavingCol) düşür. */
    side = side === 'P' ? 'Q' : 'P';
    entering = leavingCol;
  }

  return {
    status: 'maxiter',
    equilibrium: null,
    steps,
    dropLabel0,
    pivots,
    shift: { a: shiftA, b: shiftB },
    m,
    n,
  };
}

function finalizeEquilibrium(
  input: BimatrixInput,
  m: number,
  n: number,
  tabP: number[][],
  basicP: number[],
  tabQ: number[][],
  basicQ: number[],
  steps: LemkePivotStep[],
  dropLabel0: number,
  pivots: number,
  shift: { a: number; b: number },
  RHS: number,
): LemkeResult {
  /* P'de basic x_i (col < m) varsa x̄_i = rhs satırı. Q'de basic y_j
   * (col ≥ m) varsa ȳ_j = rhs. Sonra Σ = 1 normalize. */
  const xRaw = new Array<number>(m).fill(0);
  const yRaw = new Array<number>(n).fill(0);

  for (let r = 0; r < n; r++) {
    const col = basicP[r];
    if (col < m) xRaw[col] = Math.max(0, tabP[r][RHS]);
  }
  for (let r = 0; r < m; r++) {
    const col = basicQ[r];
    if (col >= m) yRaw[col - m] = Math.max(0, tabQ[r][RHS]);
  }

  let xSum = 0;
  let ySum = 0;
  for (const v of xRaw) xSum += v;
  for (const v of yRaw) ySum += v;

  if (xSum <= EPS || ySum <= EPS) {
    /* Bütün koordinatlar 0 — yapay (0,0) tepesinde kaldık veya dejenere
     * geri dönüş. Denge çıkaramayız. */
    return {
      status: 'degenerate',
      equilibrium: null,
      steps,
      dropLabel0,
      pivots,
      shift,
      m,
      n,
    };
  }

  const x = xRaw.map((v) => v / xSum);
  const y = yRaw.map((v) => v / ySum);

  /* Payoff orijinal (kaydırmasız) A, B ile. */
  let payoffRow = 0;
  let payoffCol = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      payoffRow += x[i] * input.payoffA[i][j] * y[j];
      payoffCol += x[i] * input.payoffB[i][j] * y[j];
    }
  }

  const supportRow: number[] = [];
  const supportCol: number[] = [];
  for (let i = 0; i < m; i++) if (x[i] > 1e-7) supportRow.push(i);
  for (let j = 0; j < n; j++) if (y[j] > 1e-7) supportCol.push(j);

  const kind: 'pure' | 'mixed' =
    supportRow.length === 1 && supportCol.length === 1 ? 'pure' : 'mixed';

  return {
    status: 'found',
    equilibrium: {
      kind,
      rowStrategy: x,
      colStrategy: y,
      payoffRow,
      payoffCol,
      supportRow,
      supportCol,
    },
    steps,
    dropLabel0,
    pivots,
    shift,
    m,
    n,
  };
}

/**
 * Sıralı denemelerle birden çok dengeye ulaşma — k = 1..m+n için
 * Lemke-Howson koş, bulunan dengeleri (deduplicate) topla. Garanti
 * değildir: bazı Nash dengelerine yapay (0,0)'dan ulaşılamayabilir;
 * pratikte çoğu denge yakalanır.
 */
export function lemkeHowsonAllDrops(input: LemkeInput): {
  results: LemkeResult[];
  equilibria: Equilibrium[];
} {
  validateBimatrix(input);
  const m = input.payoffA.length;
  const n = input.payoffA[0].length;
  const totalLabels = m + n;

  const results: LemkeResult[] = [];
  const equilibria: Equilibrium[] = [];
  const seen = new Set<string>();

  for (let k = 1; k <= totalLabels; k++) {
    const res = lemkeHowson({ ...input, dropLabel: k });
    results.push(res);
    if (res.status === 'found' && res.equilibrium) {
      const key = strategyKey(res.equilibrium.rowStrategy, res.equilibrium.colStrategy);
      if (!seen.has(key)) {
        seen.add(key);
        equilibria.push(res.equilibrium);
      }
    }
  }

  return { results, equilibria };
}

function strategyKey(x: number[], y: number[]): string {
  const r = (z: number): string => z.toFixed(6);
  return x.map(r).join(',') + '|' + y.map(r).join(',');
}

export { BimatrixError };
