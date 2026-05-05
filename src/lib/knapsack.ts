/**
 * Knapsack problem solvers.
 *
 * Supports two classic variants:
 * - 0/1 (binary): each item can be taken at most once. Solved with the
 *   standard O(n × W) dynamic programming table; W is the capacity.
 * - Fractional: items can be split. Solved with the greedy algorithm by
 *   value/weight ratio in O(n log n).
 *
 * Both variants are pure functions; no DOM, no I/O.
 */

export const MAX_ITEMS = 100;
export const MAX_CAPACITY_FOR_BINARY = 100_000;

export type KnapsackVariant = 'binary' | 'fractional';

export interface KnapsackItem {
  /** Optional stable identifier (e.g. row index from input parsing). */
  id?: string;
  name: string;
  value: number;
  weight: number;
}

export interface KnapsackInput {
  items: ReadonlyArray<KnapsackItem>;
  capacity: number;
  variant: KnapsackVariant;
}

export interface KnapsackSelection {
  item: KnapsackItem;
  /** 1 for binary; 0..1 for fractional. */
  fraction: number;
  takenWeight: number;
  takenValue: number;
}

export interface KnapsackResult {
  variant: KnapsackVariant;
  selected: KnapsackSelection[];
  totalValue: number;
  totalWeight: number;
  capacity: number;
  /** True if all items required scaling to fit the binary DP table. */
  scaled: boolean;
}

export class KnapsackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnapsackError';
  }
}

function validate(input: KnapsackInput): void {
  if (!input.items.length) {
    throw new KnapsackError('En az bir öge gereklidir.');
  }
  if (input.items.length > MAX_ITEMS) {
    throw new KnapsackError(
      `Bu sürümde en fazla ${MAX_ITEMS} öge desteklenir (${input.items.length} verildi).`,
    );
  }
  if (!Number.isFinite(input.capacity) || input.capacity <= 0) {
    throw new KnapsackError('Kapasite pozitif bir sayı olmalıdır.');
  }
  for (const it of input.items) {
    if (!Number.isFinite(it.value) || it.value < 0) {
      throw new KnapsackError(
        `"${it.name}" değeri pozitif veya sıfır olmalıdır.`,
      );
    }
    if (!Number.isFinite(it.weight) || it.weight <= 0) {
      throw new KnapsackError(
        `"${it.name}" ağırlığı pozitif olmalıdır.`,
      );
    }
  }
}

function solveFractional(input: KnapsackInput): KnapsackResult {
  const sorted = [...input.items]
    .map((it, idx) => ({ ...it, _idx: idx, ratio: it.value / it.weight }))
    .sort((a, b) => b.ratio - a.ratio);

  const selected: KnapsackSelection[] = [];
  let remaining = input.capacity;
  let totalValue = 0;
  let totalWeight = 0;

  for (const it of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(it.weight, remaining);
    const fraction = take / it.weight;
    if (fraction <= 0) continue;
    const value = fraction * it.value;
    selected.push({
      item: { id: it.id, name: it.name, value: it.value, weight: it.weight },
      fraction,
      takenWeight: take,
      takenValue: value,
    });
    remaining -= take;
    totalWeight += take;
    totalValue += value;
  }

  return {
    variant: 'fractional',
    selected,
    totalValue,
    totalWeight,
    capacity: input.capacity,
    scaled: false,
  };
}

/**
 * Scales weights and capacity to integers so the DP table has a finite,
 * reasonable size. We pick the smallest power-of-ten factor that yields
 * integer weights (or accept rounding past a maximum precision threshold).
 */
function scaleToIntegers(
  weights: number[],
  capacity: number,
): { intWeights: number[]; intCapacity: number; scaled: boolean } {
  const allInteger =
    weights.every((w) => Number.isInteger(w)) && Number.isInteger(capacity);
  if (allInteger) {
    return { intWeights: weights, intCapacity: capacity, scaled: false };
  }
  for (const factor of [10, 100, 1000]) {
    const scaledW = weights.map((w) => Math.round(w * factor));
    const scaledC = Math.round(capacity * factor);
    const lossless = weights.every(
      (w, i) => Math.abs(w * factor - scaledW[i]) < 1e-9,
    );
    if (lossless) {
      return { intWeights: scaledW, intCapacity: scaledC, scaled: true };
    }
  }
  // Fallback: round at 1000× and accept tiny error.
  const factor = 1000;
  return {
    intWeights: weights.map((w) => Math.round(w * factor)),
    intCapacity: Math.round(capacity * factor),
    scaled: true,
  };
}

function solveBinary(input: KnapsackInput): KnapsackResult {
  const items = input.items;
  const n = items.length;
  const weights = items.map((it) => it.weight);
  const values = items.map((it) => it.value);

  const { intWeights, intCapacity, scaled } = scaleToIntegers(
    weights,
    input.capacity,
  );

  if (intCapacity > MAX_CAPACITY_FOR_BINARY) {
    throw new KnapsackError(
      `0/1 knapsack için kapasite çok büyük (DP tablosu ${intCapacity}+ hücre olur). Kesirli (fractional) varyantı tercih et veya daha az hassas birimle çalış.`,
    );
  }

  // dp[i][w] = max value using first i items with capacity w.
  // Use a 1D rolling array for memory efficiency.
  const dp = new Array<number>(intCapacity + 1).fill(0);
  // Track "taken" decisions for backtracking.
  const taken: boolean[][] = Array.from({ length: n }, () =>
    new Array<boolean>(intCapacity + 1).fill(false),
  );

  for (let i = 0; i < n; i++) {
    const wi = intWeights[i];
    const vi = values[i];
    if (wi <= 0) continue;
    for (let w = intCapacity; w >= wi; w--) {
      const candidate = dp[w - wi] + vi;
      if (candidate > dp[w]) {
        dp[w] = candidate;
        taken[i][w] = true;
      }
    }
  }

  // Backtrack to find which items were taken.
  const selected: KnapsackSelection[] = [];
  let totalValue = 0;
  let totalWeight = 0;
  let w = intCapacity;
  for (let i = n - 1; i >= 0; i--) {
    if (taken[i][w]) {
      selected.push({
        item: items[i],
        fraction: 1,
        takenWeight: items[i].weight,
        takenValue: items[i].value,
      });
      totalValue += items[i].value;
      totalWeight += items[i].weight;
      w -= intWeights[i];
    }
  }

  selected.reverse();

  return {
    variant: 'binary',
    selected,
    totalValue,
    totalWeight,
    capacity: input.capacity,
    scaled,
  };
}

export function solveKnapsack(input: KnapsackInput): KnapsackResult {
  validate(input);
  return input.variant === 'fractional'
    ? solveFractional(input)
    : solveBinary(input);
}

/**
 * Parse a "name<TAB>value<TAB>weight" textarea into KnapsackItems.
 * Cells separated by tab/semicolon/whitespace. Comma is reserved as
 * Turkish decimal separator (e.g. "1,5" → 1.5).
 */
export function parseItems(input: string): KnapsackItem[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line, idx) => {
    const cells = line.split(/[\t;]+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3) {
      throw new KnapsackError(
        `Satır ${idx + 1}: "ad<TAB>değer<TAB>ağırlık" biçimi gerekli (${cells.length} alan bulundu).`,
      );
    }
    const [name, valueStr, weightStr] = cells;
    const value = Number(valueStr.replace(',', '.'));
    const weight = Number(weightStr.replace(',', '.'));
    if (Number.isNaN(value)) {
      throw new KnapsackError(`Satır ${idx + 1}: değer geçerli değil ("${valueStr}").`);
    }
    if (Number.isNaN(weight)) {
      throw new KnapsackError(`Satır ${idx + 1}: ağırlık geçerli değil ("${weightStr}").`);
    }
    return { id: String(idx), name, value, weight };
  });
}
