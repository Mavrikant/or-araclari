/**
 * m-Makina Akış-Tipi Çizelgeleme (Permutation Flow-Shop, Fm || Cmax) —
 * CDS (Campbell-Dudek-Smith 1970) ve NEH (Nawaz-Enscore-Ham 1983)
 * sezgiselleri, ve genelleştirilmiş m-makina permütasyon simülatörü.
 *
 * F2 || Cmax'ta Johnson kuralı kapalı-form optimum verir. F3 || Cmax
 * genel hâlde NP-zor, özel bir koşulda Johnson-Bellman indirgemesiyle
 * optimum. m ≥ 4 için problem güçlü NP-zor; tarihi sezgiseller iki
 * ailede kümelenir:
 *
 *   1) CDS (1970) — m-1 alt problem üretir. k = 1..m-1 için
 *      α_i^k = Σ_{r=1..k} p_{i,r}    (ilk k makinanın toplamı)
 *      β_i^k = Σ_{r=m-k+1..m} p_{i,r}(son k makinanın toplamı)
 *      Johnson kuralı ile π_k permütasyonu; orijinal m makinada
 *      Cmax hesaplanır, en iyisi seçilir. O(m · n log n).
 *
 *   2) NEH (1983) — en iyi bilinen inşa sezgiseli.
 *      • İşleri Σ_r p_{i,r} azalan sırayla sırala.
 *      • İlk iki işi iki permütasyondan Cmax'ı küçük olanla başlat.
 *      • Kalan her iş için, kısmi çizelgede tüm |π|+1 pozisyona
 *        ekleme dene; Cmax'ı en küçüğüne yerleştir. Beraberlikte ilk
 *        (en erken) pozisyon kazanır → deterministik. O(n² · m).
 *
 * Pure: no DOM, no I/O.
 *
 * Kaynaklar:
 *   Campbell, Dudek, Smith (1970) "A Heuristic Algorithm for the n Job,
 *     m Machine Sequencing Problem", Management Science 16(10).
 *   Nawaz, Enscore, Ham (1983) "A heuristic algorithm for the m-machine,
 *     n-job flow-shop sequencing problem", Omega 11(1).
 */

export interface FlowShopMJob {
  label: string;
  /** Uzunluk m; her makina için işlem süresi, ≥ 0. */
  times: number[];
}

export interface FlowShopMScheduleEntry {
  order: number;
  label: string;
  jobIndex: number;
  starts: number[];
  ends: number[];
  idleBefore: number[];
}

export interface FlowShopMResult {
  machines: number;
  sequence: number[];
  schedule: FlowShopMScheduleEntry[];
  makespan: number;
  /** Makina başına toplam boş süre. Uzunluk m. */
  machineIdle: number[];
}

export class FlowShopMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowShopMError';
  }
}

function validate(jobs: FlowShopMJob[]): number {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new FlowShopMError('En az bir iş girilmelidir.');
  }
  if (jobs.length > 200) {
    throw new FlowShopMError('İş sayısı 200 ile sınırlıdır (tarayıcı UX).');
  }
  const m = jobs[0].times.length;
  if (m < 2) {
    throw new FlowShopMError('En az 2 makina olmalıdır.');
  }
  if (m > 20) {
    throw new FlowShopMError('Makina sayısı 20 ile sınırlıdır (tarayıcı UX).');
  }
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    if (typeof j.label !== 'string' || j.label.trim() === '') {
      throw new FlowShopMError(`İş ${i + 1} için etiket boş olamaz.`);
    }
    if (!Array.isArray(j.times) || j.times.length !== m) {
      throw new FlowShopMError(`İş ${i + 1} için ${m} makina süresi olmalıdır (${j.times?.length ?? 0} verildi).`);
    }
    for (let r = 0; r < m; r++) {
      const p = j.times[r];
      if (typeof p !== 'number' || !Number.isFinite(p)) {
        throw new FlowShopMError(`İş ${i + 1}, M${r + 1} süresi sonlu bir sayı olmalıdır.`);
      }
      if (p < 0) {
        throw new FlowShopMError(`İş ${i + 1}, M${r + 1} süresi negatif olamaz (${p} verildi).`);
      }
    }
  }
  return m;
}

/**
 * Permütasyon akış-tipi simülasyonu: verilen sıraya göre m makina
 * üzerinde her işin başlangıç/bitiş zamanlarını, makina boş sürelerini
 * ve Cmax'ı hesaplar.
 */
export function simulateFlowShopM(jobs: FlowShopMJob[], sequence: number[]): FlowShopMResult {
  const m = validate(jobs);
  const seen = new Set<number>();
  for (const idx of sequence) {
    if (idx < 0 || idx >= jobs.length || !Number.isInteger(idx)) {
      throw new FlowShopMError(`Sıra içinde geçersiz iş indeksi: ${idx}.`);
    }
    if (seen.has(idx)) {
      throw new FlowShopMError(`Sıra içinde tekrarlanan iş indeksi: ${idx}.`);
    }
    seen.add(idx);
  }

  const machineTime = new Array<number>(m).fill(0);
  const machineIdle = new Array<number>(m).fill(0);
  const schedule: FlowShopMScheduleEntry[] = [];
  for (let k = 0; k < sequence.length; k++) {
    const idx = sequence[k];
    const j = jobs[idx];
    const starts = new Array<number>(m);
    const ends = new Array<number>(m);
    const idleBefore = new Array<number>(m);
    let prevEnd = 0;
    for (let r = 0; r < m; r++) {
      const start = Math.max(prevEnd, machineTime[r]);
      idleBefore[r] = start - machineTime[r];
      machineIdle[r] += idleBefore[r];
      starts[r] = start;
      const end = start + j.times[r];
      ends[r] = end;
      machineTime[r] = end;
      prevEnd = end;
    }
    schedule.push({ order: k + 1, label: j.label, jobIndex: idx, starts, ends, idleBefore });
  }
  return {
    machines: m,
    sequence: sequence.slice(),
    schedule,
    makespan: machineTime[m - 1],
    machineIdle,
  };
}

/**
 * Johnson kuralı (α, β) çiftleri üzerinde: U = { α ≤ β } α artan; V = { α > β }
 * β azalan; sıra U ⊕ V. Beraberlikte orijinal indeks (stable).
 */
function johnsonPermutation(times: { alpha: number; beta: number; index: number }[]): number[] {
  const U: typeof times = [];
  const V: typeof times = [];
  for (const t of times) {
    if (t.alpha <= t.beta) U.push(t);
    else V.push(t);
  }
  U.sort((a, b) => a.alpha - b.alpha || a.index - b.index);
  V.sort((a, b) => b.beta - a.beta || a.index - b.index);
  return [...U, ...V].map((t) => t.index);
}

export interface CDSSubProblem {
  /** 1 ≤ k ≤ m-1. */
  k: number;
  /** Sanal iki-makinalı problem: alpha = ilk k, beta = son k. */
  virtualTimes: { label: string; alpha: number; beta: number; group: 'U' | 'V' }[];
  sequence: number[];
  /** Orijinal m makinada bu permütasyonun Cmax'ı. */
  makespan: number;
}

export interface CDSResult extends FlowShopMResult {
  algorithm: 'cds';
  /** Cmax'ı minimum yapan k değeri. Beraberlikte en küçük k. */
  bestK: number;
  subproblems: CDSSubProblem[];
}

/**
 * Campbell-Dudek-Smith (1970). m-1 alt problem, her biri Johnson kuralı
 * ile çözülür, orijinal Cmax'a göre en iyisi seçilir.
 */
export function solveCDS(jobs: FlowShopMJob[]): CDSResult {
  const m = validate(jobs);
  const subproblems: CDSSubProblem[] = [];
  let best: { sequence: number[]; makespan: number; k: number } | null = null;
  for (let k = 1; k <= m - 1; k++) {
    const times = jobs.map((j, i) => {
      let a = 0;
      let b = 0;
      for (let r = 0; r < k; r++) a += j.times[r];
      for (let r = m - k; r < m; r++) b += j.times[r];
      return { alpha: a, beta: b, index: i };
    });
    const sequence = johnsonPermutation(times);
    const sim = simulateFlowShopM(jobs, sequence);
    const virtualTimes = jobs.map((j, i) => {
      const t = times.find((x) => x.index === i)!;
      const group: 'U' | 'V' = t.alpha <= t.beta ? 'U' : 'V';
      return { label: j.label, alpha: t.alpha, beta: t.beta, group };
    });
    subproblems.push({ k, virtualTimes, sequence, makespan: sim.makespan });
    if (!best || sim.makespan < best.makespan) {
      best = { sequence, makespan: sim.makespan, k };
    }
  }
  const final = simulateFlowShopM(jobs, best!.sequence);
  return { ...final, algorithm: 'cds', bestK: best!.k, subproblems };
}

export interface NEHInsertionStep {
  /** 1..n — hangi adımın çıktısı. */
  step: number;
  insertedJobIndex: number;
  insertedLabel: string;
  /** Ekleme pozisyonu 0..prev.length. */
  insertedPos: number;
  /** Her aday pozisyon için Cmax; uzunluk = önceki_sequence.length + 1. */
  candidateMakespans: number[];
  chosenMakespan: number;
  sequenceAfter: number[];
}

export interface NEHResult extends FlowShopMResult {
  algorithm: 'neh';
  orderByTotal: { jobIndex: number; label: string; total: number }[];
  steps: NEHInsertionStep[];
}

/**
 * Nawaz-Enscore-Ham (1983). Σp azalan sırada işleri kısmi permütasyona
 * tek tek yerleştir; her adımda tüm ekleme pozisyonları denenir, Cmax'ı
 * en küçük yapan seçilir (beraberlikte ilk pozisyon).
 */
export function solveNEH(jobs: FlowShopMJob[]): NEHResult {
  validate(jobs);
  const n = jobs.length;
  const totals = jobs.map((j, i) => ({
    jobIndex: i,
    label: j.label,
    total: j.times.reduce((s, x) => s + x, 0),
  }));
  const orderByTotal = [...totals].sort((a, b) => b.total - a.total || a.jobIndex - b.jobIndex);

  let sequence: number[] = [];
  const steps: NEHInsertionStep[] = [];

  for (let step = 0; step < n; step++) {
    const jobIdx = orderByTotal[step].jobIndex;
    const label = orderByTotal[step].label;
    let bestPos = 0;
    let bestMakespan = Number.POSITIVE_INFINITY;
    let bestSeq: number[] = [];
    const cands: number[] = [];
    for (let pos = 0; pos <= sequence.length; pos++) {
      const trial = [...sequence.slice(0, pos), jobIdx, ...sequence.slice(pos)];
      const cmax = simulateFlowShopM(jobs, trial).makespan;
      cands.push(cmax);
      if (cmax < bestMakespan) {
        bestMakespan = cmax;
        bestPos = pos;
        bestSeq = trial;
      }
    }
    sequence = bestSeq;
    steps.push({
      step: step + 1,
      insertedJobIndex: jobIdx,
      insertedLabel: label,
      insertedPos: bestPos,
      candidateMakespans: cands,
      chosenMakespan: bestMakespan,
      sequenceAfter: sequence.slice(),
    });
  }

  const final = simulateFlowShopM(jobs, sequence);
  return { ...final, algorithm: 'neh', orderByTotal, steps };
}

/**
 * Tüm n! permütasyonun Cmax'ı; yalnızca test/küçük-n için. n ≤ 8 sınırı
 * (40320 permütasyon) tarayıcıda güvenli üst sınır.
 */
export function bruteForceOptimumM(jobs: FlowShopMJob[]): { sequence: number[]; makespan: number } {
  validate(jobs);
  const n = jobs.length;
  if (n > 8) throw new FlowShopMError('Brute-force yalnızca n ≤ 8 için desteklenir.');
  const indices = Array.from({ length: n }, (_, i) => i);
  let best: { sequence: number[]; makespan: number } = {
    sequence: indices.slice(),
    makespan: Number.POSITIVE_INFINITY,
  };
  const permute = (arr: number[], start: number): void => {
    if (start === arr.length - 1) {
      const mk = simulateFlowShopM(jobs, arr).makespan;
      if (mk < best.makespan) best = { sequence: arr.slice(), makespan: mk };
      return;
    }
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  };
  permute(indices.slice(), 0);
  return best;
}
