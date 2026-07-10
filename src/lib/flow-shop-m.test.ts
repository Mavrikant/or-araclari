import { describe, expect, it } from 'vitest';

import {
  bruteForceOptimumM,
  FlowShopMError,
  simulateFlowShopM,
  solveCDS,
  solveNEH,
  type FlowShopMJob,
} from './flow-shop-m';

const HAND: FlowShopMJob[] = [
  { label: 'J1', times: [5, 4, 3] },
  { label: 'J2', times: [2, 8, 4] },
  { label: 'J3', times: [3, 5, 6] },
  { label: 'J4', times: [7, 3, 2] },
];

function makespanOf(jobs: FlowShopMJob[], seq: number[]): number {
  return simulateFlowShopM(jobs, seq).makespan;
}

describe('simulateFlowShopM', () => {
  it('m=3 hand-verified schedule: sequence [J2, J3, J1, J4] → Cmax 26', () => {
    const r = simulateFlowShopM(HAND, [1, 2, 0, 3]);
    expect(r.machines).toBe(3);
    expect(r.makespan).toBe(26);
    expect(r.schedule.map((e) => e.label)).toEqual(['J2', 'J3', 'J1', 'J4']);
    expect(r.schedule[0].starts).toEqual([0, 2, 10]);
    expect(r.schedule[0].ends).toEqual([2, 10, 14]);
    expect(r.schedule[3].ends).toEqual([17, 22, 26]);
  });

  it('m=3 hand-verified schedule: sequence [J3, J2, J1, J4] → Cmax 25', () => {
    expect(makespanOf(HAND, [2, 1, 0, 3])).toBe(25);
  });

  it('machine idle sums are per-machine totals', () => {
    const r = simulateFlowShopM(HAND, [1, 2, 0, 3]);
    let m1IdleSum = 0;
    let m2IdleSum = 0;
    let m3IdleSum = 0;
    for (const e of r.schedule) {
      m1IdleSum += e.idleBefore[0];
      m2IdleSum += e.idleBefore[1];
      m3IdleSum += e.idleBefore[2];
    }
    expect(r.machineIdle).toEqual([m1IdleSum, m2IdleSum, m3IdleSum]);
    expect(r.machineIdle[0]).toBe(0);
  });

  it('respects job precedence (starts[r] ≥ ends[r-1] within a job)', () => {
    const r = simulateFlowShopM(HAND, [0, 1, 2, 3]);
    for (const e of r.schedule) {
      for (let r2 = 1; r2 < 3; r2++) {
        expect(e.starts[r2]).toBeGreaterThanOrEqual(e.ends[r2 - 1]);
      }
    }
  });

  it('respects machine precedence (schedule[k].starts[r] ≥ schedule[k-1].ends[r])', () => {
    const r = simulateFlowShopM(HAND, [0, 1, 2, 3]);
    for (let k = 1; k < r.schedule.length; k++) {
      for (let r2 = 0; r2 < 3; r2++) {
        expect(r.schedule[k].starts[r2]).toBeGreaterThanOrEqual(r.schedule[k - 1].ends[r2]);
      }
    }
  });

  it('makespan equals last machine, last job end', () => {
    const r = simulateFlowShopM(HAND, [3, 2, 1, 0]);
    expect(r.makespan).toBe(r.schedule[r.schedule.length - 1].ends[2]);
  });

  it('rejects sequence with duplicate index', () => {
    expect(() => simulateFlowShopM(HAND, [0, 0, 1, 2])).toThrow(FlowShopMError);
  });

  it('rejects sequence with out-of-range index', () => {
    expect(() => simulateFlowShopM(HAND, [0, 1, 2, 4])).toThrow(FlowShopMError);
  });

  it('accepts partial sequence (partial schedule, no length check)', () => {
    const r = simulateFlowShopM(HAND, [0, 1, 2]);
    expect(r.schedule).toHaveLength(3);
  });

  it('rejects negative processing time', () => {
    expect(() => simulateFlowShopM([{ label: 'X', times: [1, -1, 2] }], [0])).toThrow(FlowShopMError);
  });

  it('rejects empty job list', () => {
    expect(() => simulateFlowShopM([], [])).toThrow(FlowShopMError);
  });

  it('rejects m < 2', () => {
    expect(() => simulateFlowShopM([{ label: 'X', times: [1] }], [0])).toThrow(FlowShopMError);
  });

  it('rejects mismatched times length', () => {
    const bad = [
      { label: 'A', times: [1, 2, 3] },
      { label: 'B', times: [1, 2] },
    ];
    expect(() => simulateFlowShopM(bad, [0, 1])).toThrow(FlowShopMError);
  });
});

describe('solveCDS', () => {
  it('m=3 HAND: bestK=2, sequence [J3, J2, J1, J4], Cmax 25', () => {
    const r = solveCDS(HAND);
    expect(r.algorithm).toBe('cds');
    expect(r.machines).toBe(3);
    expect(r.subproblems).toHaveLength(2);
    expect(r.bestK).toBe(2);
    expect(r.sequence).toEqual([2, 1, 0, 3]);
    expect(r.makespan).toBe(25);
  });

  it('m=3 HAND k=1 subproblem: alpha=p1, beta=p3, Johnson sequence [J2, J3, J1, J4], Cmax 26', () => {
    const r = solveCDS(HAND);
    const sub = r.subproblems.find((s) => s.k === 1)!;
    expect(sub.virtualTimes[0]).toEqual({ label: 'J1', alpha: 5, beta: 3, group: 'V' });
    expect(sub.virtualTimes[1]).toEqual({ label: 'J2', alpha: 2, beta: 4, group: 'U' });
    expect(sub.sequence).toEqual([1, 2, 0, 3]);
    expect(sub.makespan).toBe(26);
  });

  it('m=3 HAND k=2 subproblem: alpha=p1+p2, beta=p2+p3', () => {
    const r = solveCDS(HAND);
    const sub = r.subproblems.find((s) => s.k === 2)!;
    expect(sub.virtualTimes[0]).toEqual({ label: 'J1', alpha: 9, beta: 7, group: 'V' });
    expect(sub.virtualTimes[1]).toEqual({ label: 'J2', alpha: 10, beta: 12, group: 'U' });
    expect(sub.virtualTimes[2]).toEqual({ label: 'J3', alpha: 8, beta: 11, group: 'U' });
    expect(sub.virtualTimes[3]).toEqual({ label: 'J4', alpha: 10, beta: 5, group: 'V' });
    expect(sub.sequence).toEqual([2, 1, 0, 3]);
    expect(sub.makespan).toBe(25);
  });

  it('m=2 case: CDS produces a single subproblem equivalent to Johnson', () => {
    const jobs: FlowShopMJob[] = [
      { label: 'J1', times: [6, 3] },
      { label: 'J2', times: [2, 8] },
      { label: 'J3', times: [4, 7] },
      { label: 'J4', times: [1, 4] },
      { label: 'J5', times: [3, 5] },
    ];
    const r = solveCDS(jobs);
    expect(r.subproblems).toHaveLength(1);
    // Taha textbook two-machine Johnson optimum:
    // U (alpha ≤ beta): J2(2,8), J3(4,7), J4(1,4), J5(3,5) → sort by alpha:
    //   J4(1), J2(2), J5(3), J3(4)
    // V: J1(6,3) → alone; sort by beta desc → [J1]
    // Optimum: J4, J2, J5, J3, J1
    expect(r.sequence).toEqual([3, 1, 4, 2, 0]);
    // Verified against Johnson-rule textbook example (Taha 5-job F2).
    expect(r.makespan).toBe(28);
  });

  it('CDS on 4 machines: sequence is valid, makespan ≥ brute-force optimum', () => {
    const jobs: FlowShopMJob[] = [
      { label: 'A', times: [3, 4, 6, 2] },
      { label: 'B', times: [1, 8, 3, 5] },
      { label: 'C', times: [7, 2, 5, 4] },
      { label: 'D', times: [4, 5, 2, 6] },
      { label: 'E', times: [2, 3, 8, 3] },
    ];
    const cds = solveCDS(jobs);
    const bf = bruteForceOptimumM(jobs);
    expect(new Set(cds.sequence)).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(cds.subproblems).toHaveLength(3);
    expect(cds.makespan).toBeGreaterThanOrEqual(bf.makespan);
    expect(cds.makespan / bf.makespan).toBeLessThanOrEqual(1.5);
  });
});

describe('solveNEH', () => {
  it('m=3 HAND: orders by total Σp desc, ties by original index', () => {
    const r = solveNEH(HAND);
    expect(r.algorithm).toBe('neh');
    // totals: J1=12, J2=14, J3=14, J4=12
    expect(r.orderByTotal.map((o) => o.label)).toEqual(['J2', 'J3', 'J1', 'J4']);
    expect(r.orderByTotal.map((o) => o.total)).toEqual([14, 14, 12, 12]);
  });

  it('m=3 HAND: NEH insertion trace matches hand simulation, Cmax 25', () => {
    const r = solveNEH(HAND);
    expect(r.steps).toHaveLength(4);
    // Step 1: insert J2 (only 1 position)
    expect(r.steps[0].insertedLabel).toBe('J2');
    expect(r.steps[0].sequenceAfter).toEqual([1]);
    // Step 2: insert J3, candidates [pos0=20, pos1=21] → pos0
    expect(r.steps[1].candidateMakespans).toEqual([20, 21]);
    expect(r.steps[1].insertedPos).toBe(0);
    expect(r.steps[1].sequenceAfter).toEqual([2, 1]);
    // Step 3: insert J1, candidates [pos0=26, pos1=24, pos2=23] → pos2
    expect(r.steps[2].candidateMakespans).toEqual([26, 24, 23]);
    expect(r.steps[2].insertedPos).toBe(2);
    expect(r.steps[2].sequenceAfter).toEqual([2, 1, 0]);
    // Step 4: insert J4, candidates [pos0=30, pos1=28, pos2=26, pos3=25] → pos3
    expect(r.steps[3].candidateMakespans).toEqual([30, 28, 26, 25]);
    expect(r.steps[3].insertedPos).toBe(3);
    expect(r.steps[3].sequenceAfter).toEqual([2, 1, 0, 3]);
    expect(r.sequence).toEqual([2, 1, 0, 3]);
    expect(r.makespan).toBe(25);
  });

  it('m=2 case: NEH produces a valid permutation with Cmax ≥ Johnson optimum', () => {
    const jobs: FlowShopMJob[] = [
      { label: 'J1', times: [6, 3] },
      { label: 'J2', times: [2, 8] },
      { label: 'J3', times: [4, 7] },
      { label: 'J4', times: [1, 4] },
      { label: 'J5', times: [3, 5] },
    ];
    const r = solveNEH(jobs);
    expect(new Set(r.sequence)).toEqual(new Set([0, 1, 2, 3, 4]));
    // Johnson optimum for this instance is 28 (from CDS m=2 test above)
    expect(r.makespan).toBeGreaterThanOrEqual(28);
  });

  it('tie-break: equal candidate Cmax → chooses earliest position', () => {
    // Symmetric 3-job instance where inserting last job in pos 0 vs 1 gives same Cmax.
    const jobs: FlowShopMJob[] = [
      { label: 'A', times: [2, 2] },
      { label: 'B', times: [2, 2] },
      { label: 'C', times: [2, 2] },
    ];
    const r = solveNEH(jobs);
    // All permutations yield same Cmax=8; NEH picks earliest each time.
    expect(r.makespan).toBe(8);
    expect(r.steps[1].insertedPos).toBe(0);
    expect(r.steps[2].insertedPos).toBe(0);
  });

  it('single-job trivial: sequence [0], Cmax = Σp', () => {
    const r = solveNEH([{ label: 'X', times: [3, 4, 5, 2] }]);
    expect(r.sequence).toEqual([0]);
    expect(r.makespan).toBe(14);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].candidateMakespans).toEqual([14]);
  });

  it('NEH ≥ brute-force optimum on 4-machine random instance (heuristic bound)', () => {
    const jobs: FlowShopMJob[] = [
      { label: 'A', times: [3, 4, 6, 2] },
      { label: 'B', times: [1, 8, 3, 5] },
      { label: 'C', times: [7, 2, 5, 4] },
      { label: 'D', times: [4, 5, 2, 6] },
      { label: 'E', times: [2, 3, 8, 3] },
    ];
    const neh = solveNEH(jobs);
    const bf = bruteForceOptimumM(jobs);
    expect(neh.makespan).toBeGreaterThanOrEqual(bf.makespan);
    expect(neh.makespan / bf.makespan).toBeLessThanOrEqual(1.2);
  });
});

describe('CDS vs NEH vs brute-force cross-check', () => {
  const instances: { name: string; jobs: FlowShopMJob[] }[] = [
    {
      name: '4×3 HAND',
      jobs: HAND,
    },
    {
      name: '5×4 mixed',
      jobs: [
        { label: 'A', times: [3, 4, 6, 2] },
        { label: 'B', times: [1, 8, 3, 5] },
        { label: 'C', times: [7, 2, 5, 4] },
        { label: 'D', times: [4, 5, 2, 6] },
        { label: 'E', times: [2, 3, 8, 3] },
      ],
    },
    {
      name: '4×5 near-uniform',
      jobs: [
        { label: 'A', times: [2, 3, 2, 4, 3] },
        { label: 'B', times: [3, 2, 4, 2, 3] },
        { label: 'C', times: [4, 3, 3, 2, 2] },
        { label: 'D', times: [2, 4, 3, 3, 2] },
      ],
    },
  ];

  it.each(instances)('$name: heuristic ≥ optimum, both within 30% of optimum', ({ jobs }) => {
    const bf = bruteForceOptimumM(jobs);
    const cds = solveCDS(jobs);
    const neh = solveNEH(jobs);
    expect(cds.makespan).toBeGreaterThanOrEqual(bf.makespan);
    expect(neh.makespan).toBeGreaterThanOrEqual(bf.makespan);
    expect(cds.makespan / bf.makespan).toBeLessThanOrEqual(1.3);
    expect(neh.makespan / bf.makespan).toBeLessThanOrEqual(1.3);
  });
});

describe('bruteForceOptimumM', () => {
  it('m=3 HAND optimum matches known value', () => {
    const bf = bruteForceOptimumM(HAND);
    expect(bf.makespan).toBeLessThanOrEqual(25);
  });

  it('rejects n > 8', () => {
    const jobs = Array.from({ length: 9 }, (_, i) => ({ label: `J${i}`, times: [1, 1] }));
    expect(() => bruteForceOptimumM(jobs)).toThrow(FlowShopMError);
  });
});
