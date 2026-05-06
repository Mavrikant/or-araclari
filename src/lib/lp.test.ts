import { describe, it, expect } from 'vitest';
import { parseLp, LpParseError, MAX_VARIABLES } from './lp';

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
