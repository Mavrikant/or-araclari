import { describe, it, expect } from 'vitest';
import {
  parseLp,
  LpParseError,
  MAX_VARIABLES,
  structuredToText,
  parsedToStructured,
  emptyStructured,
  type StructuredLp,
} from './lp';

describe('parseLp — basics', () => {
  it('parses a canonical 2-variable maximisation problem', () => {
    const r = parseLp(`
      max 3x + 4y
      x + 2y <= 14
      3x - y >= 0
      x - y <= 2
    `);
    expect(r.direction).toBe('max');
    expect(r.variables).toEqual(['x', 'y']);
    expect(r.objective).toEqual([
      { coef: 3, variable: 'x' },
      { coef: 4, variable: 'y' },
    ]);
    expect(r.constraints).toHaveLength(3);
    expect(r.constraints[0]).toMatchObject({
      relation: '<=',
      rhs: 14,
      terms: [
        { coef: 1, variable: 'x' },
        { coef: 2, variable: 'y' },
      ],
    });
  });

  it('parses minimisation with subject-to marker', () => {
    const r = parseLp(`
      min x + 2y
      s.t.
      x + y >= 5
      x >= 0
    `);
    expect(r.direction).toBe('min');
    expect(r.constraints).toHaveLength(2);
  });

  it('accepts Turkish keywords (maks, en küçük)', () => {
    const r1 = parseLp(`maks 5x\nx <= 10`);
    expect(r1.direction).toBe('max');
    const r2 = parseLp(`en küçük x + y\nx + y >= 1`);
    expect(r2.direction).toBe('min');
  });

  it('skips comment lines', () => {
    const r = parseLp(`
      # a comment
      max x
      // another comment
      x <= 5
    `);
    expect(r.constraints).toHaveLength(1);
  });
});

describe('parseLp — coefficient handling', () => {
  it('treats absent coefficient as 1', () => {
    const r = parseLp(`max x + y\nx + y <= 10`);
    expect(r.objective[0].coef).toBe(1);
    expect(r.objective[1].coef).toBe(1);
  });

  it('treats lone minus as -1', () => {
    const r = parseLp(`max x - y\nx <= 5`);
    expect(r.objective[1]).toEqual({ coef: -1, variable: 'y' });
  });

  it('parses fractional coefficients', () => {
    const r = parseLp(`max 2.5x + 0.75y\nx + y <= 10`);
    expect(r.objective[0].coef).toBe(2.5);
    expect(r.objective[1].coef).toBe(0.75);
  });

  it('accepts Turkish decimal comma', () => {
    const r = parseLp(`max 2,5x + 0,75y\nx + y <= 10`);
    expect(r.objective[0].coef).toBe(2.5);
    expect(r.objective[1].coef).toBe(0.75);
  });

  it('tolerates explicit multiplication operator', () => {
    const r = parseLp(`max 3*x + 4*y\nx <= 5`);
    expect(r.objective).toEqual([
      { coef: 3, variable: 'x' },
      { coef: 4, variable: 'y' },
    ]);
  });

  it('handles ≤ and ≥ unicode operators', () => {
    const r = parseLp(`max x\nx ≤ 5\nx ≥ 0`);
    expect(r.constraints[0].relation).toBe('<=');
    expect(r.constraints[1].relation).toBe('>=');
  });
});

describe('parseLp — variables', () => {
  it('discovers variables in first-appearance order', () => {
    const r = parseLp(`
      max z + x
      y + z <= 10
    `);
    expect(r.variables).toEqual(['z', 'x', 'y']);
  });

  it('rejects too many variables', () => {
    let lp = 'max ';
    for (let i = 0; i < MAX_VARIABLES + 1; i++) {
      lp += `${i > 0 ? '+ ' : ''}x${i} `;
    }
    lp += '\n';
    for (let i = 0; i < MAX_VARIABLES + 1; i++) {
      lp += `x${i} <= 1\n`;
    }
    expect(() => parseLp(lp)).toThrow(/en fazla/);
  });
});

describe('parseLp — error cases', () => {
  it('rejects empty input', () => {
    expect(() => parseLp('')).toThrow(LpParseError);
    expect(() => parseLp('   \n  \n')).toThrow(LpParseError);
  });

  it('rejects missing direction keyword', () => {
    expect(() => parseLp(`x + y <= 5`)).toThrow(/max.*min/);
  });

  it('rejects constraint without relation', () => {
    expect(() => parseLp(`max x\nx + y 5`)).toThrow(/operatörü/);
  });

  it('rejects constraint with empty rhs', () => {
    expect(() => parseLp(`max x\nx + y <=`)).toThrow(/sağ taraf boş/);
  });

  it('rejects malformed term', () => {
    expect(() => parseLp(`max x@y\nx <= 5`)).toThrow(LpParseError);
  });
});

describe('structuredToText', () => {
  it('renders a simple max problem with two variables', () => {
    const s: StructuredLp = {
      direction: 'max',
      variables: ['x', 'y'],
      objective: { x: 3, y: 4 },
      constraints: [
        { id: '1', coefficients: { x: 1, y: 2 }, relation: '<=', rhs: 14 },
        { id: '2', coefficients: { x: 3, y: -1 }, relation: '>=', rhs: 0 },
      ],
    };
    const text = structuredToText(s);
    expect(text).toBe('max 3x + 4y\nx + 2y <= 14\n3x - y >= 0');
  });

  it('omits sparse (missing/zero) coefficients', () => {
    const s: StructuredLp = {
      direction: 'max',
      variables: ['x', 'y', 'z'],
      objective: { x: 5, z: 2 },
      constraints: [{ id: '1', coefficients: { y: 1 }, relation: '=', rhs: 7 }],
    };
    const text = structuredToText(s);
    expect(text).toBe('max 5x + 2z\ny = 7');
  });

  it('handles negative leading coefficients', () => {
    const s: StructuredLp = {
      direction: 'min',
      variables: ['x', 'y'],
      objective: { x: -1, y: 2 },
      constraints: [
        { id: '1', coefficients: { x: -3, y: -2 }, relation: '<=', rhs: -6 },
      ],
    };
    const text = structuredToText(s);
    expect(text).toBe('min -x + 2y\n-3x - 2y <= -6');
  });

  it('hides coefficient when |coef| is 1', () => {
    const s: StructuredLp = {
      direction: 'max',
      variables: ['x', 'y'],
      objective: { x: 1, y: -1 },
      constraints: [{ id: '1', coefficients: { x: 1, y: 1 }, relation: '<=', rhs: 10 }],
    };
    expect(structuredToText(s)).toBe('max x - y\nx + y <= 10');
  });

  it('renders fractional coefficients without trailing zeros', () => {
    const s: StructuredLp = {
      direction: 'max',
      variables: ['x', 'y'],
      objective: { x: 2.5, y: 0.75 },
      constraints: [{ id: '1', coefficients: { x: 1, y: 1 }, relation: '<=', rhs: 10 }],
    };
    expect(structuredToText(s)).toBe('max 2.5x + 0.75y\nx + y <= 10');
  });

  it('renders empty objective as "0"', () => {
    const s: StructuredLp = {
      direction: 'max',
      variables: ['x'],
      objective: {},
      constraints: [{ id: '1', coefficients: { x: 1 }, relation: '<=', rhs: 5 }],
    };
    expect(structuredToText(s)).toBe('max 0\nx <= 5');
  });
});

describe('structured ↔ parsed round-trip', () => {
  it('parses what structuredToText produces (canonical example)', () => {
    const s: StructuredLp = {
      direction: 'max',
      variables: ['x', 'y'],
      objective: { x: 3, y: 4 },
      constraints: [
        { id: '1', coefficients: { x: 1, y: 2 }, relation: '<=', rhs: 14 },
        { id: '2', coefficients: { x: 3, y: -1 }, relation: '>=', rhs: 0 },
        { id: '3', coefficients: { x: 1, y: -1 }, relation: '<=', rhs: 2 },
      ],
    };
    const parsed = parseLp(structuredToText(s));
    expect(parsed.direction).toBe('max');
    expect(parsed.variables).toEqual(['x', 'y']);
    expect(parsed.constraints).toHaveLength(3);
    expect(parsed.constraints[0].rhs).toBe(14);
    expect(parsed.constraints[1].rhs).toBe(0);
  });

  it('preserves float coefficients within tolerance', () => {
    const s: StructuredLp = {
      direction: 'min',
      variables: ['x', 'y'],
      objective: { x: 1 / 3, y: 2 / 7 },
      constraints: [
        { id: '1', coefficients: { x: 0.123456, y: 1 }, relation: '<=', rhs: 9.999 },
      ],
    };
    const parsed = parseLp(structuredToText(s));
    expect(Math.abs(parsed.objective[0].coef - 1 / 3)).toBeLessThan(1e-5);
    expect(Math.abs(parsed.objective[1].coef - 2 / 7)).toBeLessThan(1e-5);
    expect(parsed.constraints[0].rhs).toBeCloseTo(9.999, 5);
  });
});

describe('parsedToStructured', () => {
  it('converts a parsed LP back into structured form', () => {
    const parsed = parseLp(`max 3x + 4y\nx + 2y <= 14\n3x - y >= 0`);
    const s = parsedToStructured(parsed);
    expect(s.direction).toBe('max');
    expect(s.variables).toEqual(['x', 'y']);
    expect(s.objective).toEqual({ x: 3, y: 4 });
    expect(s.constraints).toHaveLength(2);
    expect(s.constraints[0].coefficients).toEqual({ x: 1, y: 2 });
    expect(s.constraints[0].relation).toBe('<=');
    expect(s.constraints[0].rhs).toBe(14);
    expect(s.constraints[1].coefficients).toEqual({ x: 3, y: -1 });
    expect(s.constraints[1].relation).toBe('>=');
    /* Each constraint should get a stable id. */
    expect(s.constraints[0].id).toBeTruthy();
    expect(s.constraints[1].id).toBeTruthy();
    expect(s.constraints[0].id).not.toBe(s.constraints[1].id);
  });
});

describe('emptyStructured', () => {
  it('returns a sane default with two variables and one empty constraint', () => {
    const s = emptyStructured();
    expect(s.direction).toBe('max');
    expect(s.variables).toEqual(['x', 'y']);
    expect(s.objective).toEqual({});
    expect(s.constraints).toHaveLength(1);
    expect(s.constraints[0].relation).toBe('<=');
    expect(s.constraints[0].coefficients).toEqual({});
    expect(s.constraints[0].id).toBeTruthy();
  });

  it('produces fresh ids on each call', () => {
    const a = emptyStructured();
    const b = emptyStructured();
    expect(a.constraints[0].id).not.toBe(b.constraints[0].id);
  });
});
