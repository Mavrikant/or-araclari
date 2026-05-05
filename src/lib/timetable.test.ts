import { describe, it, expect } from 'vitest';
import { solveTimetable, parseLessons, TimetableError, type Lesson } from './timetable';

const lessons = (defs: Array<[string, string, string]>): Lesson[] =>
  defs.map(([label, teacher, group]) => ({ label, teacher, group }));

describe('parseLessons', () => {
  it('parses tab-separated lessons', () => {
    expect(parseLessons('Mat 9A\tAhmet\t9A\nFizik 9A\tBurak\t9A')).toEqual([
      { label: 'Mat 9A', teacher: 'Ahmet', group: '9A' },
      { label: 'Fizik 9A', teacher: 'Burak', group: '9A' },
    ]);
  });

  it('rejects rows with fewer than 3 fields', () => {
    expect(() => parseLessons('Mat\tAhmet')).toThrow(/biçimi/i);
  });
});

describe('solveTimetable — basic feasibility', () => {
  it('single lesson always assignable', () => {
    const r = solveTimetable({
      lessons: lessons([['Mat', 'Ahmet', '9A']]),
      slots: 5,
    });
    expect(r.assignments).toHaveLength(1);
    expect(r.feasible).toBe(true);
  });

  it('two lessons with same teacher get different slots', () => {
    const r = solveTimetable({
      lessons: lessons([
        ['Mat 9A', 'Ahmet', '9A'],
        ['Mat 9B', 'Ahmet', '9B'],
      ]),
      slots: 5,
    });
    const slots = r.assignments.map((a) => a.slot);
    expect(slots[0]).not.toBe(slots[1]);
  });

  it('two lessons with same group get different slots', () => {
    const r = solveTimetable({
      lessons: lessons([
        ['Mat 9A', 'Ahmet', '9A'],
        ['Fizik 9A', 'Burak', '9A'],
      ]),
      slots: 5,
    });
    const slots = r.assignments.map((a) => a.slot);
    expect(slots[0]).not.toBe(slots[1]);
  });

  it('two independent lessons can share a slot', () => {
    const r = solveTimetable({
      lessons: lessons([
        ['Mat 9A', 'Ahmet', '9A'],
        ['Fizik 9B', 'Burak', '9B'],
      ]),
      slots: 1,
    });
    expect(r.assignments[0].slot).toBe(0);
    expect(r.assignments[1].slot).toBe(0);
  });
});

describe('solveTimetable — infeasibility', () => {
  it('throws when teacher has more lessons than slots', () => {
    expect(() =>
      solveTimetable({
        lessons: lessons([
          ['L1', 'A', 'g1'],
          ['L2', 'A', 'g2'],
          ['L3', 'A', 'g3'],
        ]),
        slots: 2,
      }),
    ).toThrow(/Çakışmasız/);
  });

  it('throws when group has more lessons than slots', () => {
    expect(() =>
      solveTimetable({
        lessons: lessons([
          ['L1', 'A', 'g1'],
          ['L2', 'B', 'g1'],
          ['L3', 'C', 'g1'],
        ]),
        slots: 2,
      }),
    ).toThrow(/Çakışmasız/);
  });
});

describe('solveTimetable — realistic small case', () => {
  it('solves a 4-lesson, 3-slot mini schedule', () => {
    const r = solveTimetable({
      lessons: lessons([
        ['Mat 9A', 'Ahmet', '9A'],
        ['Mat 9B', 'Ahmet', '9B'],
        ['Fizik 9A', 'Burak', '9A'],
        ['Fizik 9B', 'Burak', '9B'],
      ]),
      slots: 2,
    });
    expect(r.assignments).toHaveLength(4);
    // Verify no conflicts
    const byTeacher = new Map<string, Set<number>>();
    const byGroup = new Map<string, Set<number>>();
    for (const a of r.assignments) {
      const t = byTeacher.get(a.lesson.teacher) ?? new Set();
      const g = byGroup.get(a.lesson.group) ?? new Set();
      expect(t.has(a.slot)).toBe(false);
      expect(g.has(a.slot)).toBe(false);
      t.add(a.slot);
      g.add(a.slot);
      byTeacher.set(a.lesson.teacher, t);
      byGroup.set(a.lesson.group, g);
    }
  });

  it('attaches slot labels when provided', () => {
    const r = solveTimetable({
      lessons: lessons([['Mat', 'A', 'g']]),
      slots: 3,
      slotLabels: ['Pzt 1', 'Pzt 2', 'Pzt 3'],
    });
    expect(r.assignments[0].slotLabel).toMatch(/Pzt/);
  });
});

describe('solveTimetable — weeklyHours expansion', () => {
  it('default (no weeklyHours) yields one occurrence per lesson', () => {
    const r = solveTimetable({
      lessons: lessons([['Mat', 'Ahmet', '9A']]),
      slots: 5,
    });
    expect(r.assignments).toHaveLength(1);
    expect(r.assignments[0].occurrence).toEqual({ index: 1, total: 1 });
  });

  it('weeklyHours: 4 produces four assignments referencing the same source', () => {
    const r = solveTimetable({
      lessons: [{ label: 'Mat', teacher: 'Ahmet', group: '9A', weeklyHours: 4 }],
      slots: 6,
    });
    expect(r.assignments).toHaveLength(4);
    // Same source lesson reference for every occurrence
    expect(r.assignments.every((a) => a.lesson.label === 'Mat')).toBe(true);
    expect(r.assignments.every((a) => a.occurrence.total === 4)).toBe(true);
    // Each occurrence index appears exactly once
    expect(new Set(r.assignments.map((a) => a.occurrence.index))).toEqual(
      new Set([1, 2, 3, 4]),
    );
    // No two occurrences share a slot (single teacher → can't double-book)
    const slots = r.assignments.map((a) => a.slot);
    expect(new Set(slots).size).toBe(4);
  });

  it('mixed: some lessons multi-hour, others default', () => {
    const r = solveTimetable({
      lessons: [
        { label: 'Mat 9A', teacher: 'Ahmet', group: '9A', weeklyHours: 3 },
        { label: 'Fizik 9A', teacher: 'Burak', group: '9A', weeklyHours: 2 },
        { label: 'İng 9A', teacher: 'Ceyda', group: '9A' }, // default 1
      ],
      slots: 6,
    });
    expect(r.assignments).toHaveLength(6); // 3+2+1
    // Group 9A appears in every assignment, no slot collision
    const slots = r.assignments.map((a) => a.slot);
    expect(new Set(slots).size).toBe(6);
  });

  it('rejects when weeklyHours exceeds available slots', () => {
    expect(() =>
      solveTimetable({
        lessons: [{ label: 'Mat', teacher: 'Ahmet', group: '9A', weeklyHours: 6 }],
        slots: 5,
      }),
    ).toThrow(/saat istiyor/i);
  });

  it('rejects non-integer or zero weeklyHours', () => {
    expect(() =>
      solveTimetable({
        lessons: [{ label: 'Mat', teacher: 'Ahmet', group: '9A', weeklyHours: 0 }],
        slots: 5,
      }),
    ).toThrow(/en az 1/i);
    expect(() =>
      solveTimetable({
        lessons: [{ label: 'Mat', teacher: 'Ahmet', group: '9A', weeklyHours: 2.5 }],
        slots: 5,
      }),
    ).toThrow(/en az 1/i);
  });

  it('catches teacher capacity violation across expanded instances', () => {
    // Ahmet has 3 lessons of 2 hours each = 6 instances, only 5 slots
    expect(() =>
      solveTimetable({
        lessons: [
          { label: 'Mat 9A', teacher: 'Ahmet', group: '9A', weeklyHours: 2 },
          { label: 'Mat 9B', teacher: 'Ahmet', group: '9B', weeklyHours: 2 },
          { label: 'Mat 9C', teacher: 'Ahmet', group: '9C', weeklyHours: 2 },
        ],
        slots: 5,
      }),
    ).toThrow(/Çakışmasız/);
  });
});

describe('solveTimetable — validation', () => {
  it('rejects empty lesson list', () => {
    expect(() => solveTimetable({ lessons: [], slots: 5 })).toThrow(TimetableError);
  });

  it('rejects invalid slot count', () => {
    expect(() =>
      solveTimetable({ lessons: lessons([['L', 'A', 'g']]), slots: 0 }),
    ).toThrow(/slot/i);
  });

  it('rejects mismatched slot label count', () => {
    expect(() =>
      solveTimetable({
        lessons: lessons([['L', 'A', 'g']]),
        slots: 3,
        slotLabels: ['only', 'two'],
      }),
    ).toThrow(/slot/i);
  });
});
