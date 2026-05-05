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
