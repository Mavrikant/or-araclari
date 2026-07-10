import { describe, it, expect } from 'vitest';
import { solveJohnson, bruteForceOptimum, JohnsonError, type JohnsonJob } from './johnson';

describe('solveJohnson — two-machine flow shop, textbook cases', () => {
  it('classic 5-job Taha F2 example: sequence J4-J2-J5-J3-J1, makespan 28', () => {
    // J1=(6,3), J2=(2,8), J3=(4,7), J4=(1,4), J5=(3,5)
    // U (a ≤ b) = {J2, J3, J4, J5} sorted by a asc → J4(1), J2(2), J5(3), J3(4)
    // V (a > b) = {J1} sorted by b desc → J1(3)
    // Optimum sequence: J4, J2, J5, J3, J1. Hand-traced makespan = 28.
    const jobs: JohnsonJob[] = [
      { label: 'J1', p1: 6, p2: 3 },
      { label: 'J2', p1: 2, p2: 8 },
      { label: 'J3', p1: 4, p2: 7 },
      { label: 'J4', p1: 1, p2: 4 },
      { label: 'J5', p1: 3, p2: 5 },
    ];
    const r = solveJohnson(jobs);
    expect(r.sequence).toEqual([3, 1, 4, 2, 0]);
    expect(r.makespan).toBe(28);
    const bf = bruteForceOptimum(jobs);
    expect(r.makespan).toBe(bf.makespan);
  });

  it('single job: makespan = p1 + p2', () => {
    const r = solveJohnson([{ label: 'A', p1: 4, p2: 7 }]);
    expect(r.makespan).toBe(11);
    expect(r.sequence).toEqual([0]);
    expect(r.schedule[0]).toMatchObject({ m1Start: 0, m1End: 4, m2Start: 4, m2End: 11 });
  });

  it('all-equal times: any permutation same makespan, algorithm returns stable order', () => {
    const jobs: JohnsonJob[] = Array.from({ length: 4 }, (_, i) => ({ label: `J${i + 1}`, p1: 5, p2: 5 }));
    const r = solveJohnson(jobs);
    expect(r.makespan).toBe(5 * 4 + 5); // M2 never idle after first job.
    expect(r.sequence).toEqual([0, 1, 2, 3]);
  });

  it('trivial case where M2 dominates: makespan = p1 of first job + Σ p2', () => {
    // All jobs have p2 > p1, so U contains everyone, sorted by p1 ascending.
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 1, p2: 10 },
      { label: 'B', p1: 2, p2: 10 },
      { label: 'C', p1: 3, p2: 10 },
    ];
    const r = solveJohnson(jobs);
    expect(r.sequence).toEqual([0, 1, 2]);
    // M1 finishes A at t=1, M2 starts A at t=1, then M2 never idles.
    expect(r.makespan).toBe(1 + 30);
  });

  it('trivial case where M1 dominates: last job to finish is the last in the sequence', () => {
    // All p1 > p2, so V contains everyone, sorted by p2 descending.
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 10, p2: 1 },
      { label: 'B', p1: 10, p2: 2 },
      { label: 'C', p1: 10, p2: 3 },
    ];
    const r = solveJohnson(jobs);
    expect(r.sequence).toEqual([2, 1, 0]); // p2 desc: C (3), B (2), A (1)
    // M1 finishes all at t=30, then M2 processes A last (p2=1) → t=31.
    expect(r.makespan).toBe(30 + 1);
  });

  it('zero p1 job goes first (as if pre-processed)', () => {
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 5, p2: 3 },
      { label: 'Z', p1: 0, p2: 4 },
      { label: 'B', p1: 3, p2: 5 },
    ];
    const r = solveJohnson(jobs);
    // Z has α=0 (smallest, goes first in U). B has (3,5)→U. A has (5,3)→V.
    expect(r.sequence).toEqual([1, 2, 0]);
  });

  it('rejects empty input', () => {
    expect(() => solveJohnson([])).toThrow(JohnsonError);
  });

  it('rejects negative processing times', () => {
    expect(() => solveJohnson([{ label: 'A', p1: -1, p2: 3 }])).toThrow(JohnsonError);
  });

  it('rejects mixed 2/3-machine input', () => {
    expect(() =>
      solveJohnson([
        { label: 'A', p1: 1, p2: 2, p3: 3 },
        { label: 'B', p1: 1, p2: 2 },
      ]),
    ).toThrow(JohnsonError);
  });
});

describe('solveJohnson — optimality vs brute force', () => {
  const randInts = (seed: number, n: number, max: number): number[] => {
    const out: number[] = [];
    let s = seed >>> 0;
    for (let i = 0; i < n; i++) {
      // xorshift32
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      out.push(1 + (s % max));
    }
    return out;
  };

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'random 6-job instance (seed=%i) matches brute-force optimum on F2',
    (seed) => {
      const p1 = randInts(seed * 7 + 1, 6, 12);
      const p2 = randInts(seed * 11 + 3, 6, 12);
      const jobs: JohnsonJob[] = p1.map((v, i) => ({ label: `J${i + 1}`, p1: v, p2: p2[i] }));
      const r = solveJohnson(jobs);
      const bf = bruteForceOptimum(jobs);
      expect(r.makespan).toBe(bf.makespan);
    },
  );

  it.each([1, 2, 3, 4])(
    'random 5-job three-machine instance (seed=%i) — when Johnson condition holds, matches brute force',
    (seed) => {
      // Build a satisfying case: p2 small, p1 and p3 comfortably larger.
      const p2 = randInts(seed * 5, 5, 3); // small: 1..3
      const p1 = randInts(seed * 7 + 1, 5, 5).map((v) => v + 10); // 11..15 all ≥ max p2
      const p3 = randInts(seed * 11 + 3, 5, 5).map((v) => v + 10);
      const jobs: JohnsonJob[] = p1.map((v, i) => ({ label: `J${i + 1}`, p1: v, p2: p2[i], p3: p3[i] }));
      const r = solveJohnson(jobs);
      expect(r.optimality).toBe('exact');
      const bf = bruteForceOptimum(jobs);
      expect(r.makespan).toBe(bf.makespan);
    },
  );
});

describe('solveJohnson — three-machine variant', () => {
  it('flags exact when min(p1) ≥ max(p2)', () => {
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 10, p2: 3, p3: 5 },
      { label: 'B', p1: 12, p2: 2, p3: 4 },
      { label: 'C', p1: 15, p2: 1, p3: 6 },
    ];
    const r = solveJohnson(jobs);
    expect(r.machines).toBe(3);
    expect(r.optimality).toBe('exact');
    const bf = bruteForceOptimum(jobs);
    expect(r.makespan).toBe(bf.makespan);
  });

  it('flags exact when min(p3) ≥ max(p2)', () => {
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 3, p2: 4, p3: 10 },
      { label: 'B', p1: 2, p2: 3, p3: 15 },
      { label: 'C', p1: 5, p2: 2, p3: 12 },
    ];
    const r = solveJohnson(jobs);
    expect(r.optimality).toBe('exact');
    const bf = bruteForceOptimum(jobs);
    expect(r.makespan).toBe(bf.makespan);
  });

  it('flags heuristic when neither condition holds', () => {
    // p2 has max 9 which exceeds min(p1)=3 and min(p3)=2.
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 3, p2: 9, p3: 4 },
      { label: 'B', p1: 5, p2: 6, p3: 2 },
      { label: 'C', p1: 4, p2: 7, p3: 6 },
    ];
    const r = solveJohnson(jobs);
    expect(r.optimality).toBe('heuristic');
    expect(r.reductionNote).toContain('İndirgeme koşulu sağlanmıyor');
  });

  it('produces a consistent 3-machine schedule with M3 respecting M2 completion', () => {
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 10, p2: 2, p3: 5 },
      { label: 'B', p1: 12, p2: 3, p3: 4 },
    ];
    const r = solveJohnson(jobs);
    for (const e of r.schedule) {
      expect(e.m2Start).toBeGreaterThanOrEqual(e.m1End);
      expect(e.m3Start!).toBeGreaterThanOrEqual(e.m2End);
    }
    for (let k = 1; k < r.schedule.length; k++) {
      expect(r.schedule[k].m1Start).toBeGreaterThanOrEqual(r.schedule[k - 1].m1End);
      expect(r.schedule[k].m2Start).toBeGreaterThanOrEqual(r.schedule[k - 1].m2End);
      expect(r.schedule[k].m3Start!).toBeGreaterThanOrEqual(r.schedule[k - 1].m3End!);
    }
  });
});

describe('solveJohnson — schedule consistency invariants', () => {
  it('m2Start = max(m1End, previous m2End) for every job', () => {
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 4, p2: 2 },
      { label: 'B', p1: 3, p2: 6 },
      { label: 'C', p1: 5, p2: 1 },
      { label: 'D', p1: 2, p2: 8 },
    ];
    const r = solveJohnson(jobs);
    let prevM2End = 0;
    for (const e of r.schedule) {
      expect(e.m2Start).toBe(Math.max(e.m1End, prevM2End));
      prevM2End = e.m2End;
    }
    expect(r.makespan).toBe(prevM2End);
  });

  it('sum of processing times bounds makespan from below', () => {
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 4, p2: 2 },
      { label: 'B', p1: 3, p2: 6 },
      { label: 'C', p1: 5, p2: 1 },
      { label: 'D', p1: 2, p2: 8 },
    ];
    const r = solveJohnson(jobs);
    const sumP1 = 4 + 3 + 5 + 2;
    // Cmax ≥ Σp1 + min p2: the last job on M2 still needs at least min p2 time.
    expect(r.makespan).toBeGreaterThanOrEqual(sumP1 + Math.min(2, 6, 1, 8));
    // Cmax ≥ max_i (p1_i + p2_i): any job's own single-job trace is a lower bound.
    expect(r.makespan).toBeGreaterThanOrEqual(Math.max(4 + 2, 3 + 6, 5 + 1, 2 + 8));
  });

  it('virtualTimes exposes U / V grouping consistent with alpha ≤ beta split', () => {
    const jobs: JohnsonJob[] = [
      { label: 'A', p1: 1, p2: 5 },
      { label: 'B', p1: 6, p2: 2 },
      { label: 'C', p1: 3, p2: 3 },
    ];
    const r = solveJohnson(jobs);
    const vt = Object.fromEntries(r.virtualTimes.map((v) => [v.label, v]));
    expect(vt.A.group).toBe('U');
    expect(vt.B.group).toBe('V');
    expect(vt.C.group).toBe('U');
  });
});
