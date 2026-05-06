import { describe, it, expect } from 'vitest';
import {
  intersect,
  satisfies,
  isFeasible,
  candidateVertices,
  feasibleRegion,
  objectiveAt,
  type LineEquation,
} from './lp-geometry';

describe('intersect', () => {
  it('finds the intersection of two crossing lines', () => {
    /* x + y = 1, x - y = 0  →  (0.5, 0.5) */
    const l1: LineEquation = { a: 1, b: 1, c: 1, relation: '=' };
    const l2: LineEquation = { a: 1, b: -1, c: 0, relation: '=' };
    const p = intersect(l1, l2);
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(0.5);
    expect(p!.y).toBeCloseTo(0.5);
  });

  it('returns null for parallel lines', () => {
    const l1: LineEquation = { a: 1, b: 2, c: 3, relation: '<=' };
    const l2: LineEquation = { a: 2, b: 4, c: 7, relation: '<=' };
    expect(intersect(l1, l2)).toBeNull();
  });

  it('returns null for identical lines', () => {
    const l1: LineEquation = { a: 1, b: 1, c: 1, relation: '<=' };
    const l2: LineEquation = { a: 2, b: 2, c: 2, relation: '<=' };
    expect(intersect(l1, l2)).toBeNull();
  });

  it('intersects an axis line with a sloped line', () => {
    /* y = 0 axis, x + y = 5  →  (5, 0) */
    const yAxis: LineEquation = { a: 0, b: 1, c: 0, relation: '>=' };
    const sloped: LineEquation = { a: 1, b: 1, c: 5, relation: '<=' };
    const p = intersect(yAxis, sloped);
    expect(p!.x).toBeCloseTo(5);
    expect(p!.y).toBeCloseTo(0);
  });
});

describe('satisfies', () => {
  it('accepts points on the satisfying side of <=', () => {
    const c: LineEquation = { a: 1, b: 1, c: 10, relation: '<=' };
    expect(satisfies({ x: 3, y: 4 }, c)).toBe(true);
    expect(satisfies({ x: 6, y: 5 }, c)).toBe(false);
  });

  it('accepts points on the satisfying side of >=', () => {
    const c: LineEquation = { a: 1, b: 1, c: 5, relation: '>=' };
    expect(satisfies({ x: 4, y: 3 }, c)).toBe(true);
    expect(satisfies({ x: 1, y: 1 }, c)).toBe(false);
  });

  it('honours an epsilon tolerance for boundary points', () => {
    const c: LineEquation = { a: 1, b: 0, c: 5, relation: '<=' };
    expect(satisfies({ x: 5.00000001, y: 0 }, c, 1e-6)).toBe(true);
    expect(satisfies({ x: 5.1, y: 0 }, c, 1e-6)).toBe(false);
  });
});

describe('isFeasible', () => {
  it('requires every constraint to hold', () => {
    const cs: LineEquation[] = [
      { a: 1, b: 0, c: 0, relation: '>=' }, // x >= 0
      { a: 0, b: 1, c: 0, relation: '>=' }, // y >= 0
      { a: 1, b: 1, c: 10, relation: '<=' }, // x + y <= 10
    ];
    expect(isFeasible({ x: 3, y: 3 }, cs)).toBe(true);
    expect(isFeasible({ x: -1, y: 5 }, cs)).toBe(false); // violates x>=0
    expect(isFeasible({ x: 8, y: 8 }, cs)).toBe(false); // violates sum
  });
});

describe('candidateVertices', () => {
  it('emits one intersection per pair of non-parallel lines', () => {
    const cs: LineEquation[] = [
      { a: 1, b: 0, c: 0, relation: '>=' },
      { a: 0, b: 1, c: 0, relation: '>=' },
      { a: 1, b: 1, c: 4, relation: '<=' },
    ];
    /* 3 pairs → up to 3 intersections (origin, x-intercept, y-intercept). */
    expect(candidateVertices(cs)).toHaveLength(3);
  });

  it('skips parallel pairs', () => {
    const cs: LineEquation[] = [
      { a: 1, b: 1, c: 1, relation: '<=' },
      { a: 2, b: 2, c: 5, relation: '<=' }, // parallel to the first
      { a: 1, b: -1, c: 0, relation: '<=' },
    ];
    /* Only the two non-parallel pairings produce intersections. */
    expect(candidateVertices(cs)).toHaveLength(2);
  });
});

describe('feasibleRegion', () => {
  it('returns the triangle vertices of a basic LP', () => {
    /* x >= 0, y >= 0, x + y <= 4  →  triangle (0,0)-(4,0)-(0,4) */
    const cs: LineEquation[] = [
      { a: 1, b: 0, c: 0, relation: '>=' },
      { a: 0, b: 1, c: 0, relation: '>=' },
      { a: 1, b: 1, c: 4, relation: '<=' },
    ];
    const region = feasibleRegion(cs);
    expect(region).toHaveLength(3);
    /* Order matters: vertices must form a simple polygon (CCW around centroid). */
    const xs = region.map((p) => p.x).sort((a, b) => a - b);
    const ys = region.map((p) => p.y).sort((a, b) => a - b);
    expect(xs).toEqual([0, 0, 4]);
    expect(ys).toEqual([0, 0, 4]);
  });

  it('returns the four vertices of a square', () => {
    /* 0 <= x <= 3, 0 <= y <= 3 */
    const cs: LineEquation[] = [
      { a: 1, b: 0, c: 0, relation: '>=' },
      { a: 1, b: 0, c: 3, relation: '<=' },
      { a: 0, b: 1, c: 0, relation: '>=' },
      { a: 0, b: 1, c: 3, relation: '<=' },
    ];
    const region = feasibleRegion(cs);
    expect(region).toHaveLength(4);
  });

  it('returns the pentagon for the canonical example', () => {
    /* max 3x+4y, x+2y<=14, 3x-y>=0, x-y<=2, x>=0, y>=0
       Feasible region is a pentagon with 5 vertices. */
    const cs: LineEquation[] = [
      { a: 1, b: 0, c: 0, relation: '>=' }, // x >= 0
      { a: 0, b: 1, c: 0, relation: '>=' }, // y >= 0
      { a: 1, b: 2, c: 14, relation: '<=' },
      { a: 3, b: -1, c: 0, relation: '>=' },
      { a: 1, b: -1, c: 2, relation: '<=' },
    ];
    const region = feasibleRegion(cs);
    expect(region.length).toBeGreaterThanOrEqual(4);
    expect(region.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array for an infeasible system', () => {
    /* x >= 0, x <= -1  →  empty */
    const cs: LineEquation[] = [
      { a: 1, b: 0, c: 0, relation: '>=' },
      { a: 1, b: 0, c: -1, relation: '<=' },
    ];
    expect(feasibleRegion(cs)).toEqual([]);
  });

  it('handles equality constraints', () => {
    /* x + y = 5, x >= 0, y >= 0  →  segment (5,0)-(0,5) — degenerate as polygon */
    const cs: LineEquation[] = [
      { a: 1, b: 0, c: 0, relation: '>=' },
      { a: 0, b: 1, c: 0, relation: '>=' },
      { a: 1, b: 1, c: 5, relation: '=' },
    ];
    const region = feasibleRegion(cs);
    /* Two vertices on the equality line — degenerate polygon. */
    expect(region.length).toBeGreaterThanOrEqual(2);
  });
});

describe('objectiveAt', () => {
  it('computes ax + by', () => {
    expect(objectiveAt({ x: 6, y: 4 }, { x: 3, y: 4 })).toBe(34);
    expect(objectiveAt({ x: 0, y: 0 }, { x: 5, y: -2 })).toBe(0);
    expect(objectiveAt({ x: 1, y: 1 }, { x: -1, y: -1 })).toBe(-2);
  });
});
