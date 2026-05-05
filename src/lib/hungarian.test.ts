import { describe, it, expect } from 'vitest';
import {
  solveAssignment,
  parseCostMatrix,
  AssignmentError,
} from './hungarian';

describe('parseCostMatrix', () => {
  it('parses tab-separated values', () => {
    expect(parseCostMatrix('1\t2\t3\n4\t5\t6')).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('parses semicolon-separated values', () => {
    expect(parseCostMatrix('1;2;3\n4;5;6')).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('parses space-separated values', () => {
    expect(parseCostMatrix('1 2 3\n4 5 6')).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('handles Turkish decimal comma', () => {
    expect(parseCostMatrix('1,5\t2,5\n3,5\t4,5')).toEqual([
      [1.5, 2.5],
      [3.5, 4.5],
    ]);
  });

  it('rejects non-numeric cells', () => {
    expect(() => parseCostMatrix('1 abc 3')).toThrow(AssignmentError);
  });
});

describe('solveAssignment — basic correctness', () => {
  it('1×1: single agent, single task', () => {
    const r = solveAssignment({ costs: [[5]] });
    expect(r.assignments).toEqual([{ row: 0, col: 0, cost: 5 }]);
    expect(r.totalCost).toBe(5);
  });

  it('2×2: trivial known optimum', () => {
    // Min cost: assign 0→1 (1), 1→0 (2) = 3
    const r = solveAssignment({
      costs: [
        [4, 1],
        [2, 3],
      ],
    });
    expect(r.totalCost).toBe(3);
  });

  it('3×3: classic textbook example', () => {
    // Munkres canonical example from Wikipedia / Munkres' paper
    const r = solveAssignment({
      costs: [
        [4, 1, 3],
        [2, 0, 5],
        [3, 2, 2],
      ],
    });
    // Optimum: 0→1 (1) + 1→0 (2) + 2→2 (2) = 5
    expect(r.totalCost).toBe(5);
  });

  it('4×4: another known case', () => {
    const r = solveAssignment({
      costs: [
        [82, 83, 69, 92],
        [77, 37, 49, 92],
        [11, 69, 5, 86],
        [8, 9, 98, 23],
      ],
    });
    // Optimum sum = 140 (0→2, 1→1, 2→0, 3→3 → 69+37+11+23 = 140)
    expect(r.totalCost).toBe(140);
  });

  it('every row gets exactly one column assignment in square cases', () => {
    const r = solveAssignment({
      costs: [
        [4, 1, 3],
        [2, 0, 5],
        [3, 2, 2],
      ],
    });
    expect(r.assignments).toHaveLength(3);
    const rows = new Set(r.assignments.map((a) => a.row));
    const cols = new Set(r.assignments.map((a) => a.col));
    expect(rows.size).toBe(3);
    expect(cols.size).toBe(3);
  });
});

describe('solveAssignment — maximize mode', () => {
  it('finds max instead of min', () => {
    // Same matrix as the 2x2 above; max = 4 + 3 = 7 (0→0, 1→1)
    const r = solveAssignment({
      costs: [
        [4, 1],
        [2, 3],
      ],
      maximize: true,
    });
    expect(r.totalCost).toBe(7);
  });

  it('handles 3x3 maximisation', () => {
    const r = solveAssignment({
      costs: [
        [4, 1, 3],
        [2, 0, 5],
        [3, 2, 2],
      ],
      maximize: true,
    });
    // Max possible sum = 4 + 5 + 2 = 11 (0→0, 1→2, 2→1)
    expect(r.totalCost).toBe(11);
  });
});

describe('solveAssignment — rectangular matrices', () => {
  it('3 rows × 5 cols: 3 assignments only, 2 columns unused', () => {
    const r = solveAssignment({
      costs: [
        [10, 9, 8, 7, 6],
        [10, 9, 8, 7, 6],
        [10, 9, 8, 7, 6],
      ],
    });
    expect(r.assignments).toHaveLength(3);
    expect(r.square).toBe(false);
    // Optimum is to take the 3 cheapest distinct columns: 6 + 7 + 8 = 21
    expect(r.totalCost).toBe(21);
  });

  it('5 rows × 3 cols: only 3 rows assigned', () => {
    const r = solveAssignment({
      costs: [
        [10, 10, 10],
        [9, 9, 9],
        [8, 8, 8],
        [7, 7, 7],
        [6, 6, 6],
      ],
    });
    expect(r.assignments).toHaveLength(3);
    // Best: rows 4,3,2 (cheapest) → 6 + 7 + 8 = 21
    expect(r.totalCost).toBe(21);
  });
});

describe('solveAssignment — labels in result', () => {
  it('attaches row and column labels when provided', () => {
    const r = solveAssignment({
      costs: [
        [3, 1],
        [2, 4],
      ],
      rowLabels: ['Ali', 'Veli'],
      colLabels: ['Görev A', 'Görev B'],
    });
    expect(r.assignments[0].rowLabel).toMatch(/Ali|Veli/);
    expect(r.assignments[0].colLabel).toMatch(/Görev/);
  });
});

describe('solveAssignment — negative and mixed values', () => {
  it('handles negative costs', () => {
    const r = solveAssignment({
      costs: [
        [-5, -2],
        [-3, -4],
      ],
    });
    // min sum: -5 + -4 = -9 (0→0, 1→1)
    expect(r.totalCost).toBe(-9);
  });

  it('handles zero costs', () => {
    const r = solveAssignment({
      costs: [
        [0, 1, 2],
        [1, 0, 1],
        [2, 1, 0],
      ],
    });
    expect(r.totalCost).toBe(0);
  });
});

describe('solveAssignment — validation', () => {
  it('rejects empty matrix', () => {
    expect(() => solveAssignment({ costs: [] })).toThrow(AssignmentError);
  });

  it('rejects non-uniform row widths', () => {
    expect(() =>
      solveAssignment({
        costs: [
          [1, 2, 3],
          [4, 5],
        ],
      }),
    ).toThrow(/sütun/i);
  });

  it('rejects matrices larger than the configured maximum', () => {
    const huge = Array.from({ length: 33 }, () =>
      Array.from({ length: 33 }, () => 1),
    );
    expect(() => solveAssignment({ costs: huge })).toThrow(/en fazla/i);
  });

  it('rejects non-finite values', () => {
    expect(() =>
      solveAssignment({ costs: [[1, Number.NaN]] }),
    ).toThrow(AssignmentError);
  });

  it('rejects mismatched label counts', () => {
    expect(() =>
      solveAssignment({
        costs: [[1, 2]],
        rowLabels: ['A', 'B'],
      }),
    ).toThrow(/satır etiketi/i);
  });
});
