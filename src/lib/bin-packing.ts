/**
 * Bin Packing Problem (BPP) — offline sezgisel çözücüler.
 *
 * Giriş: n adet ögenin (item) boyutu s_i (0 < s_i ≤ B) ve kutu kapasitesi B.
 * Çıktı: her ögeyi tam olarak bir kutuya atayan, kullanılan kutu sayısı
 * mümkün olduğunca az bir çözüm.
 *
 * NP-zor. Bu modül klasik "any fit" ailesinin beş sezgiselini uygular:
 *
 *   NF  (Next Fit)             — en son açık kutuya sığmıyorsa yeni kutu.
 *                                 O(n). Asimptotik oran: 2·OPT.
 *   FF  (First Fit)            — açık kutulardan **ilkine** sığıyorsa oraya.
 *                                 O(n log n) balanced-tree veya O(n²) naive.
 *                                 Asimptotik oran: 17/10·OPT.
 *   FFD (First Fit Decreasing) — ögeleri boyutça azalan sırala, sonra FF.
 *                                 Asimptotik oran: 11/9·OPT (Johnson 1974;
 *                                 tight sabit 6/9 Dosa 2007).
 *   BF  (Best Fit)             — sığdıran kutulardan **en dolu** olanına.
 *                                 Aynı asimptotik oran ve teorik davranışta
 *                                 FF ile eş, pratikte küçük farklarla FF'i
 *                                 geçebilir.
 *   BFD (Best Fit Decreasing)  — ögeleri azalan sırala, sonra BF.
 *                                 FFD ile aynı 11/9 sınırında.
 *
 * Alt sınırlar (lower bounds):
 *   L1 = ⌈Σ s_i / B⌉  — hacim korunumu; en sık kullanılan sınır.
 *   L2 = ⌈|{i : s_i > B/2}|⌉ — büyük ögeler tek başına kutu tutar; her
 *        biri diğerlerinden en fazla bir tanesiyle eşleşebilir. Basit
 *        Martello-Toth (1990) alt sınırının azaltılmış hâli.
 *
 * OPT genelde ⌈L1⌉ = L1'e eşit ya da ondan bir fazla; sezgisel çözümün
 * kutu sayısı bu iki alt sınırla karşılaştırılarak "kalite" ölçülebilir.
 *
 * Pure: DOM yok, I/O yok.
 */

export const MAX_ITEMS = 500;

export type BinPackingAlgorithm =
  | 'next-fit'
  | 'first-fit'
  | 'first-fit-decreasing'
  | 'best-fit'
  | 'best-fit-decreasing';

export const ALGORITHM_LABELS: Record<BinPackingAlgorithm, string> = {
  'next-fit': 'Next Fit (NF)',
  'first-fit': 'First Fit (FF)',
  'first-fit-decreasing': 'First Fit Decreasing (FFD)',
  'best-fit': 'Best Fit (BF)',
  'best-fit-decreasing': 'Best Fit Decreasing (BFD)',
};

export interface BinPackingItem {
  name: string;
  size: number;
}

export interface BinPackingInput {
  items: ReadonlyArray<BinPackingItem>;
  capacity: number;
  algorithm: BinPackingAlgorithm;
}

export interface PackedItem {
  /** Original 0-indexed position in the input list. */
  originalIndex: number;
  name: string;
  size: number;
}

export interface Bin {
  /** 1-indexed for display. */
  index: number;
  items: PackedItem[];
  used: number;
  remaining: number;
}

export interface BinPackingResult {
  algorithm: BinPackingAlgorithm;
  capacity: number;
  totalSize: number;
  bins: Bin[];
  /** Number of bins used. */
  binCount: number;
  /** L1 = ⌈Σ s_i / B⌉ hacim alt sınırı. */
  lowerBoundL1: number;
  /**
   * L2 = büyük öge sayısı (s_i > B/2). Bunlar hiçbir başka büyük ögeyle
   * eşleşemez, dolayısıyla en az bu kadar kutu gerekir. Genelde L1 ≥ L2
   * ama tabana yakın instansta L2 devreye girer.
   */
  lowerBoundL2: number;
  /** max(L1, L2). */
  lowerBound: number;
  /** binCount / lowerBound ≥ 1. Küçüldükçe daha iyi. */
  ratio: number;
  /** Ortalama doluluk (Σ used / (binCount · B)). */
  averageFill: number;
}

export class BinPackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinPackingError';
  }
}

function validate(input: BinPackingInput): void {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new BinPackingError('En az bir öge girilmelidir.');
  }
  if (input.items.length > MAX_ITEMS) {
    throw new BinPackingError(
      `Öge sayısı ${MAX_ITEMS} ile sınırlıdır (${input.items.length} verildi).`,
    );
  }
  if (!Number.isFinite(input.capacity) || input.capacity <= 0) {
    throw new BinPackingError('Kutu kapasitesi pozitif bir sayı olmalıdır.');
  }
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    if (typeof it.name !== 'string' || it.name.trim() === '') {
      throw new BinPackingError(`Öge ${i + 1} için ad boş olamaz.`);
    }
    if (!Number.isFinite(it.size) || it.size <= 0) {
      throw new BinPackingError(
        `"${it.name}" boyutu pozitif bir sayı olmalıdır (${it.size} verildi).`,
      );
    }
    if (it.size > input.capacity + 1e-9) {
      throw new BinPackingError(
        `"${it.name}" (boyut ${it.size}) kutu kapasitesinden (${input.capacity}) büyük — tek bir kutuya sığmaz.`,
      );
    }
  }
}

/** Bir kutunun kalanına ögenin sığıp sığmadığı (floating-point toleranslı). */
function fits(bin: Bin, size: number): boolean {
  return bin.remaining + 1e-9 >= size;
}

function newBin(index: number, capacity: number): Bin {
  return { index, items: [], used: 0, remaining: capacity };
}

function place(bin: Bin, item: PackedItem, capacity: number): void {
  bin.items.push(item);
  bin.used += item.size;
  bin.remaining = capacity - bin.used;
  // Snap tiny negative epsilons to zero.
  if (Math.abs(bin.remaining) < 1e-9) bin.remaining = 0;
}

function packedItems(items: ReadonlyArray<BinPackingItem>): PackedItem[] {
  return items.map((it, i) => ({ originalIndex: i, name: it.name, size: it.size }));
}

function nextFit(items: PackedItem[], capacity: number): Bin[] {
  const bins: Bin[] = [];
  let current: Bin | null = null;
  for (const it of items) {
    if (current === null || !fits(current, it.size)) {
      current = newBin(bins.length + 1, capacity);
      bins.push(current);
    }
    place(current, it, capacity);
  }
  return bins;
}

function firstFit(items: PackedItem[], capacity: number): Bin[] {
  const bins: Bin[] = [];
  for (const it of items) {
    let placed = false;
    for (const b of bins) {
      if (fits(b, it.size)) {
        place(b, it, capacity);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const b = newBin(bins.length + 1, capacity);
      place(b, it, capacity);
      bins.push(b);
    }
  }
  return bins;
}

function bestFit(items: PackedItem[], capacity: number): Bin[] {
  const bins: Bin[] = [];
  for (const it of items) {
    let bestIdx = -1;
    let bestRemaining = Number.POSITIVE_INFINITY;
    for (let i = 0; i < bins.length; i++) {
      const r = bins[i].remaining;
      if (r + 1e-9 >= it.size && r < bestRemaining) {
        bestRemaining = r;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      place(bins[bestIdx], it, capacity);
    } else {
      const b = newBin(bins.length + 1, capacity);
      place(b, it, capacity);
      bins.push(b);
    }
  }
  return bins;
}

/**
 * Sort items by size descending; stable ties broken by original index.
 * Returns a NEW array — does not mutate.
 */
function sortDecreasing(items: PackedItem[]): PackedItem[] {
  return [...items].sort((a, b) => b.size - a.size || a.originalIndex - b.originalIndex);
}

export function solveBinPacking(input: BinPackingInput): BinPackingResult {
  validate(input);

  const capacity = input.capacity;
  const raw = packedItems(input.items);
  const totalSize = raw.reduce((s, it) => s + it.size, 0);

  const source =
    input.algorithm === 'first-fit-decreasing' || input.algorithm === 'best-fit-decreasing'
      ? sortDecreasing(raw)
      : raw;

  let bins: Bin[];
  switch (input.algorithm) {
    case 'next-fit':
      bins = nextFit(source, capacity);
      break;
    case 'first-fit':
    case 'first-fit-decreasing':
      bins = firstFit(source, capacity);
      break;
    case 'best-fit':
    case 'best-fit-decreasing':
      bins = bestFit(source, capacity);
      break;
    default: {
      const _exhaustive: never = input.algorithm;
      throw new BinPackingError(`Bilinmeyen algoritma: ${_exhaustive}`);
    }
  }

  const lowerBoundL1 = Math.ceil((totalSize - 1e-9) / capacity);
  const lowerBoundL2 = raw.filter((it) => it.size > capacity / 2 + 1e-9).length;
  const lowerBound = Math.max(lowerBoundL1, lowerBoundL2, 1);
  const binCount = bins.length;
  const ratio = binCount / lowerBound;
  const averageFill = binCount > 0 ? totalSize / (binCount * capacity) : 0;

  return {
    algorithm: input.algorithm,
    capacity,
    totalSize,
    bins,
    binCount,
    lowerBoundL1,
    lowerBoundL2,
    lowerBound,
    ratio,
    averageFill,
  };
}

/**
 * "ad<TAB>boyut" ya da tek sayı (otomatik "Öge k" adı) satırlarını
 * BinPackingItem'a çevir. Türkçe ondalık ("1,5") desteklenir.
 */
export function parseItems(input: string): BinPackingItem[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line, idx) => {
    const cells = line.split(/[\t;,]+(?=[^0-9])|\t+/).map((c) => c.trim()).filter(Boolean);
    let cellsFinal = cells;
    if (cells.length === 1) {
      cellsFinal = line.split(/\s+/).filter(Boolean);
    }
    if (cellsFinal.length === 1) {
      const size = Number(cellsFinal[0].replace(',', '.'));
      if (!Number.isFinite(size)) {
        throw new BinPackingError(`Satır ${idx + 1}: sayı çözümlenemedi (${cellsFinal[0]}).`);
      }
      return { name: `Öge ${idx + 1}`, size };
    }
    const name = cellsFinal.slice(0, -1).join(' ').trim();
    const sizeStr = cellsFinal[cellsFinal.length - 1];
    const size = Number(sizeStr.replace(',', '.'));
    if (!Number.isFinite(size)) {
      throw new BinPackingError(
        `Satır ${idx + 1}: son alan sayısal olmalı ("${sizeStr}" alındı).`,
      );
    }
    return { name: name || `Öge ${idx + 1}`, size };
  });
}
