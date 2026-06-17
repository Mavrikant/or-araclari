/**
 * İki kişilik bimatris (genel toplamlı) oyunlar için Nash dengesi araması —
 * Support Enumeration algoritması.
 *
 * Girdi: iki payoff matrisi A (satır oyuncusu R), B (sütun oyuncusu C);
 * her ikisi m × n boyutunda. A[i][j] = R'ın i. satırı, j. sütun oynanırken
 * kazancı. B[i][j] = C'nin kazancı. Sıfır toplamlı oyunlardan farklı olarak
 * A + B genelde 0 değildir (genel toplam).
 *
 * Karışık strateji Nash dengesi (x, y): x ∈ Δ^m, y ∈ Δ^n öyle ki
 *   - R için: (A y)_i = u  her i ∈ supp(x)'te; (A y)_i ≤ u  her i ∉ supp(x)'te
 *   - C için: (x^T B)_j = v her j ∈ supp(y)'de; (x^T B)_j ≤ v her j ∉ supp(y)'de
 *
 * Support Enumeration: m küçükken (≤ ~6) tüm (S₁, S₂) destek çiftlerini
 * sırasıyla dene. Nondejenere oyunlarda her dengede |S₁| = |S₂| (Shapley
 * lemma); algoritma aynı boyutlu çiftleri tarar. Her çift için lineer
 * sistem çözülür; çözüm geçerliyse (olasılıklar non-negatif + off-support
 * indifference) liste başına eklenir.
 *
 * Avantaj: tüm denge noktalarını bulur (saf + karışık), basit ve şeffaf.
 * Sınır: m ya da n çok büyükse (m+n > 16 civarı) 2^m·2^n patlar.
 */

export interface BimatrixInput {
  /** Satır oyuncusu R'ın payoff matrisi (m × n). */
  payoffA: number[][];
  /** Sütun oyuncusu C'nin payoff matrisi (m × n). */
  payoffB: number[][];
  /** Opsiyonel satır strateji adları. */
  rowNames?: string[];
  /** Opsiyonel sütun strateji adları. */
  colNames?: string[];
}

export type EquilibriumKind = 'pure' | 'mixed';

export interface Equilibrium {
  /** 'pure' (her ikisi de delta strateji) veya 'mixed'. */
  kind: EquilibriumKind;
  /** R'ın karışık stratejisi (uzunluk m, toplam ≈ 1). */
  rowStrategy: number[];
  /** C'nin karışık stratejisi (uzunluk n, toplam ≈ 1). */
  colStrategy: number[];
  /** R'ın beklenen kazancı u = x^T A y. */
  payoffRow: number;
  /** C'nin beklenen kazancı v = x^T B y. */
  payoffCol: number;
  /** supp(x) — R'ın pozitif olasılıkla oynadığı satır indeksleri (artan). */
  supportRow: number[];
  /** supp(y) — C'nin pozitif olasılıkla oynadığı sütun indeksleri (artan). */
  supportCol: number[];
}

export interface BimatrixResult {
  m: number;
  n: number;
  equilibria: Equilibrium[];
  /** Tarama tarafından test edilen destek çifti sayısı. */
  scanned: number;
  /** Boyut limitinin aşılıp aşılmadığı (çok büyük matriste durdurma). */
  truncated: boolean;
}

export class BimatrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BimatrixError';
  }
}

const EPS = 1e-9;
/** Destekleri taramak için boyut sınırı (m + n). Üzeri reddedilir. */
export const MAX_DIM_SUM = 12;

export function validateBimatrix(input: BimatrixInput): void {
  const { payoffA, payoffB, rowNames, colNames } = input;
  if (!Array.isArray(payoffA) || payoffA.length === 0) {
    throw new BimatrixError('En az bir satır stratejisi gerekli.');
  }
  if (!Array.isArray(payoffB) || payoffB.length !== payoffA.length) {
    throw new BimatrixError('A ve B matrisleri aynı satır sayısına sahip olmalı.');
  }
  const n = payoffA[0]?.length ?? 0;
  if (n === 0) {
    throw new BimatrixError('En az bir sütun stratejisi gerekli.');
  }
  for (let i = 0; i < payoffA.length; i++) {
    if (!Array.isArray(payoffA[i]) || payoffA[i].length !== n) {
      throw new BimatrixError(
        `A matrisi satır ${i + 1} sütun sayısı eşleşmeli (${n} bekleniyor).`,
      );
    }
    if (!Array.isArray(payoffB[i]) || payoffB[i].length !== n) {
      throw new BimatrixError(
        `B matrisi satır ${i + 1} sütun sayısı eşleşmeli (${n} bekleniyor).`,
      );
    }
    for (let j = 0; j < n; j++) {
      if (!Number.isFinite(payoffA[i][j])) {
        throw new BimatrixError(`A[${i + 1},${j + 1}] sonlu sayı olmalı.`);
      }
      if (!Number.isFinite(payoffB[i][j])) {
        throw new BimatrixError(`B[${i + 1},${j + 1}] sonlu sayı olmalı.`);
      }
    }
  }
  if (rowNames && rowNames.length !== payoffA.length) {
    throw new BimatrixError(`Satır adı sayısı satır sayısına eşit olmalı (${payoffA.length}).`);
  }
  if (colNames && colNames.length !== n) {
    throw new BimatrixError(`Sütun adı sayısı sütun sayısına eşit olmalı (${n}).`);
  }
}

/**
 * Bütün saf strateji Nash dengelerini bul. (i, j) hücresi saf Nash ⇔
 *   A[i][j] = max_{i'} A[i'][j]  (R için en iyi yanıt)
 *   B[i][j] = max_{j'} B[i][j']  (C için en iyi yanıt)
 */
export function findPureNash(
  payoffA: number[][],
  payoffB: number[][],
): Array<{ row: number; col: number; payoffRow: number; payoffCol: number }> {
  validateBimatrix({ payoffA, payoffB });
  const m = payoffA.length;
  const n = payoffA[0].length;

  /* Her sütun için R'ın en iyi yanıt(lar)ı: max_i A[i][j]. */
  const colMaxA: number[] = new Array(n);
  for (let j = 0; j < n; j++) {
    let mx = payoffA[0][j];
    for (let i = 1; i < m; i++) if (payoffA[i][j] > mx) mx = payoffA[i][j];
    colMaxA[j] = mx;
  }
  /* Her satır için C'nin en iyi yanıt(lar)ı: max_j B[i][j]. */
  const rowMaxB: number[] = new Array(m);
  for (let i = 0; i < m; i++) {
    let mx = payoffB[i][0];
    for (let j = 1; j < n; j++) if (payoffB[i][j] > mx) mx = payoffB[i][j];
    rowMaxB[i] = mx;
  }

  const out: Array<{ row: number; col: number; payoffRow: number; payoffCol: number }> = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (
        Math.abs(payoffA[i][j] - colMaxA[j]) < EPS &&
        Math.abs(payoffB[i][j] - rowMaxB[i]) < EPS
      ) {
        out.push({ row: i, col: j, payoffRow: payoffA[i][j], payoffCol: payoffB[i][j] });
      }
    }
  }
  return out;
}

/**
 * Karışık denge desteği (S₁, S₂) için lineer sistemi çöz:
 *   - Σ_{j ∈ S₂} A[i][j] · y_j = u  her i ∈ S₁ (R'ın indifferent kazancı)
 *   - Σ_{j ∈ S₂} y_j = 1
 *   - Σ_{i ∈ S₁} B[i][j] · x_i = v  her j ∈ S₂ (C'nin indifferent kazancı)
 *   - Σ_{i ∈ S₁} x_i = 1
 *
 * Boyutlar farklıysa (|S₁| ≠ |S₂|) nondejenere oyunda çözüm yoktur; yine
 * de en küçük-kare uyumu için size mismatch'i reddederiz.
 *
 * Döndürür: x (m), y (n), u, v veya çözüm yok ise null.
 */
function solveSupportPair(
  payoffA: number[][],
  payoffB: number[][],
  S1: number[],
  S2: number[],
): { x: number[]; y: number[]; u: number; v: number } | null {
  const m = payoffA.length;
  const n = payoffA[0].length;
  const s1 = S1.length;
  const s2 = S2.length;
  if (s1 === 0 || s2 === 0 || s1 !== s2) return null;
  const k = s1;

  /* R için: A_{S1, S2} y_{S2} = u·1, Σ y_{S2} = 1.
   * (k + 1) × (k + 1) sistem: değişkenler [y_{S2[0]}, ..., y_{S2[k-1]}, u].
   * Satır i (i ∈ S1): Σ_j A[i][S2[j]] · y_{S2[j]} − u = 0
   * Son satır: Σ y_{S2[j]} = 1. */
  const matY: number[][] = [];
  const rhsY: number[] = [];
  for (let r = 0; r < k; r++) {
    const row: number[] = new Array(k + 1).fill(0);
    for (let c = 0; c < k; c++) row[c] = payoffA[S1[r]][S2[c]];
    row[k] = -1;
    matY.push(row);
    rhsY.push(0);
  }
  {
    const row: number[] = new Array(k + 1).fill(0);
    for (let c = 0; c < k; c++) row[c] = 1;
    row[k] = 0;
    matY.push(row);
    rhsY.push(1);
  }
  const solY = gaussianSolve(matY, rhsY);
  if (!solY) return null;
  const yPart = solY.slice(0, k);
  const u = solY[k];
  for (const yp of yPart) if (!Number.isFinite(yp)) return null;

  /* C için: B^T_{S2, S1} x_{S1} = v·1, Σ x_{S1} = 1.
   * (k + 1) × (k + 1) sistem: değişkenler [x_{S1[0]}, ..., x_{S1[k-1]}, v].
   * Satır j (j ∈ S2): Σ_i B[S1[i]][j] · x_{S1[i]} − v = 0
   * Son satır: Σ x_{S1[i]} = 1. */
  const matX: number[][] = [];
  const rhsX: number[] = [];
  for (let r = 0; r < k; r++) {
    const row: number[] = new Array(k + 1).fill(0);
    for (let c = 0; c < k; c++) row[c] = payoffB[S1[c]][S2[r]];
    row[k] = -1;
    matX.push(row);
    rhsX.push(0);
  }
  {
    const row: number[] = new Array(k + 1).fill(0);
    for (let c = 0; c < k; c++) row[c] = 1;
    row[k] = 0;
    matX.push(row);
    rhsX.push(1);
  }
  const solX = gaussianSolve(matX, rhsX);
  if (!solX) return null;
  const xPart = solX.slice(0, k);
  const v = solX[k];
  for (const xp of xPart) if (!Number.isFinite(xp)) return null;

  /* Tam vektörlere geri haritala. */
  const x = new Array<number>(m).fill(0);
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < k; i++) x[S1[i]] = xPart[i];
  for (let j = 0; j < k; j++) y[S2[j]] = yPart[j];

  return { x, y, u, v };
}

/**
 * Gauss eliminasyonu — kısmi pivotlama, n × n sistem. Çözüm yoksa null.
 */
function gaussianSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0 || A[0].length !== n || b.length !== n) return null;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let pivotAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > pivotAbs) {
        pivotAbs = v;
        pivotRow = r;
      }
    }
    if (pivotAbs < 1e-12) return null;
    if (pivotRow !== col) [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    const pivot = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivot;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * Çözümün off-support best-response koşullarını sağladığını doğrula.
 *   - x_i ≥ 0 ∀ i ∈ S₁
 *   - y_j ≥ 0 ∀ j ∈ S₂
 *   - i ∉ S₁ için (A y)_i ≤ u + EPS
 *   - j ∉ S₂ için (x^T B)_j ≤ v + EPS
 */
function verifyEquilibrium(
  payoffA: number[][],
  payoffB: number[][],
  S1: number[],
  S2: number[],
  x: number[],
  y: number[],
  u: number,
  v: number,
): boolean {
  const m = payoffA.length;
  const n = payoffA[0].length;
  const inS1 = new Set(S1);
  const inS2 = new Set(S2);

  /* Olasılıklar non-negatif (ve sıfır olmamalı supportta — değilse dejenere
   * komşu desteklerle örtüşür). */
  for (const i of S1) {
    if (x[i] < -EPS) return false;
    /* Support tanımı: pozitif olasılık — sıfırsa daha küçük destekle
     * çakışıyor, başka iterasyonda yakalanır. */
    if (x[i] <= EPS) return false;
  }
  for (const j of S2) {
    if (y[j] < -EPS) return false;
    if (y[j] <= EPS) return false;
  }

  /* Off-support best response: i ∉ S₁ için R, satır i'yi oynamayı tercih
   * etmemeli — (A y)_i ≤ u. */
  for (let i = 0; i < m; i++) {
    if (inS1.has(i)) continue;
    let val = 0;
    for (let j = 0; j < n; j++) val += payoffA[i][j] * y[j];
    if (val > u + 1e-7) return false;
  }
  /* Off-support best response: j ∉ S₂ için C, sütun j'yi oynamayı tercih
   * etmemeli — (x^T B)_j ≤ v. */
  for (let j = 0; j < n; j++) {
    if (inS2.has(j)) continue;
    let val = 0;
    for (let i = 0; i < m; i++) val += x[i] * payoffB[i][j];
    if (val > v + 1e-7) return false;
  }
  return true;
}

/**
 * Tüm Nash dengelerini bul (saf + karışık). Support enumeration: her
 * (S₁ ⊆ {1..m}, S₂ ⊆ {1..n}) ile |S₁| = |S₂| destek çifti için lineer
 * sistemi çöz, geçerliyse listeye ekle.
 *
 * Aynı denge birden fazla destekte ortaya çıkmaz — daha küçük destekteyse
 * solveSupportPair kalan olasılıkları 0 verir, ancak verifyEquilibrium o
 * indeksleri "support" gerektirdiği için reddeder; daha küçük destek
 * versiyonu kabul edilir.
 */
export function findNashEquilibria(input: BimatrixInput): BimatrixResult {
  validateBimatrix(input);
  const { payoffA, payoffB } = input;
  const m = payoffA.length;
  const n = payoffA[0].length;

  if (m + n > MAX_DIM_SUM) {
    return { m, n, equilibria: [], scanned: 0, truncated: true };
  }

  const equilibria: Equilibrium[] = [];
  const seen = new Set<string>();
  let scanned = 0;

  /* Boyut sırası: k = 1, 2, ..., min(m, n). Aynı dengenin önce küçük
   * destek varyantı tutulur. */
  const maxK = Math.min(m, n);
  for (let k = 1; k <= maxK; k++) {
    const subsetsM = subsetsOfSize(m, k);
    const subsetsN = subsetsOfSize(n, k);
    for (const S1 of subsetsM) {
      for (const S2 of subsetsN) {
        scanned++;
        const sol = solveSupportPair(payoffA, payoffB, S1, S2);
        if (!sol) continue;
        if (!verifyEquilibrium(payoffA, payoffB, S1, S2, sol.x, sol.y, sol.u, sol.v)) continue;
        /* Normalize ve duplikasyon kontrolü (aynı strateji çifti). */
        const x = normalize(sol.x);
        const y = normalize(sol.y);
        const key = strategyKey(x, y);
        if (seen.has(key)) continue;
        seen.add(key);
        equilibria.push({
          kind: k === 1 ? 'pure' : 'mixed',
          rowStrategy: x,
          colStrategy: y,
          payoffRow: sol.u,
          payoffCol: sol.v,
          supportRow: S1.slice(),
          supportCol: S2.slice(),
        });
      }
    }
  }

  return { m, n, equilibria, scanned, truncated: false };
}

function subsetsOfSize(n: number, k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const rec = (start: number, left: number): void => {
    if (left === 0) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i <= n - left; i++) {
      cur.push(i);
      rec(i + 1, left - 1);
      cur.pop();
    }
  };
  rec(0, k);
  return out;
}

function normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += Math.max(0, x);
  if (s <= EPS) return v.map(() => 0);
  return v.map((x) => Math.max(0, x) / s);
}

function strategyKey(x: number[], y: number[]): string {
  const round = (z: number): string => z.toFixed(6);
  return x.map(round).join(',') + '|' + y.map(round).join(',');
}
