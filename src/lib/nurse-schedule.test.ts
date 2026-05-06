import { describe, it, expect } from 'vitest';
import {
  ALL_SHIFT_CODES,
  DEFAULT_CONSTRAINTS,
  buildSampleSchedule,
  cellKey,
  cloneSchedule,
  computeStats,
  computeWeekendDays,
  createEmptySchedule,
  createMonthMeta,
  daysInMonth,
  getCell,
  isDayCovering,
  isLeaveShift,
  isNightCovering,
  isWorkingShift,
  shiftHoursOf,
  solveScheduleGreedy,
  validate,
  type Nurse,
  type Schedule,
  type ScheduleConstraints,
} from './nurse-schedule';

const sixNurses = (): Nurse[] =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `n${i + 1}`,
    name: `Hemşire ${i + 1}`,
    unavailable: [],
  }));

describe('shift code helpers', () => {
  it('shift hours map correctly (Gündüz 8 / Gece 16 / Nöbet 24)', () => {
    expect(shiftHoursOf('G8')).toBe(8);
    expect(shiftHoursOf('GC16')).toBe(16);
    expect(shiftHoursOf('N24')).toBe(24);
    expect(shiftHoursOf('DN')).toBe(0);
    expect(shiftHoursOf('YI')).toBe(0);
    expect(shiftHoursOf('RP')).toBe(0);
  });

  it('classification helpers', () => {
    expect(isWorkingShift('G8')).toBe(true);
    expect(isWorkingShift('GC16')).toBe(true);
    expect(isWorkingShift('N24')).toBe(true);
    expect(isWorkingShift('DN')).toBe(false);

    expect(isDayCovering('G8')).toBe(true);
    expect(isDayCovering('N24')).toBe(true);
    expect(isDayCovering('GC16')).toBe(false);

    expect(isNightCovering('GC16')).toBe(true);
    expect(isNightCovering('N24')).toBe(true);
    expect(isNightCovering('G8')).toBe(false);

    expect(isLeaveShift('DN')).toBe(true);
    expect(isLeaveShift('YI')).toBe(true);
    expect(isLeaveShift('RP')).toBe(true);
    expect(isLeaveShift('G8')).toBe(false);
  });

  it('all shift codes are 6 (no OFF)', () => {
    expect(ALL_SHIFT_CODES.length).toBe(6);
    expect(ALL_SHIFT_CODES).not.toContain('OFF');
  });
});

describe('calendar helpers', () => {
  it('daysInMonth correct for known months', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 5)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('rejects invalid month', () => {
    expect(() => daysInMonth(2026, 0)).toThrow();
    expect(() => daysInMonth(2026, 13)).toThrow();
  });

  it('computeWeekendDays returns Sat+Sun day numbers', () => {
    const we = computeWeekendDays(2026, 5);
    expect(we).toEqual([2, 3, 9, 10, 16, 17, 23, 24, 30, 31]);
  });
});

describe('validate', () => {
  it('default empty schedule (cells unset) treats them as DN, so coverage missing every day', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    const issues = validate(s);
    const nightIssues = issues.filter((i) => i.kind === 'COVERAGE_NIGHT');
    const dayIssues = issues.filter((i) => i.kind === 'COVERAGE_DAY');
    expect(nightIssues.length).toBe(31);
    expect(dayIssues.length).toBe(31);
  });

  it('weekend uses minDayWeekend / minNightWeekend', () => {
    const cons: ScheduleConstraints = {
      ...DEFAULT_CONSTRAINTS,
      minDayWeekday: 3,
      minDayWeekend: 1, // Hafta sonu çok düşük
      minNightWeekday: 2,
      minNightWeekend: 1,
    };
    const s = createEmptySchedule(2026, 5, sixNurses(), cons);
    // Cumartesi 2 Mayıs: 1 G8 + 1 GC16 ata
    s.cells[cellKey('n1', 2)] = 'G8';
    s.cells[cellKey('n2', 2)] = 'GC16';
    const issues = validate(s).filter((i) => i.day === 2);
    // Hafta sonu min 1/1 → ihlal yok
    expect(issues.filter((i) => i.kind === 'COVERAGE_DAY').length).toBe(0);
    expect(issues.filter((i) => i.kind === 'COVERAGE_NIGHT').length).toBe(0);
  });

  it('weekday COVERAGE_DAY issue when understaffed', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    // Cuma 1 Mayıs hafta içi: 2 N24 ata, gündüz=2, ihtiyaç=3
    s.cells[cellKey('n1', 1)] = 'N24';
    s.cells[cellKey('n2', 1)] = 'N24';
    const dayIssue = validate(s).find((i) => i.kind === 'COVERAGE_DAY' && i.day === 1);
    expect(dayIssue).toBeDefined();
  });

  it('rest violation when N24 followed by G8 next day', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 5)] = 'N24';
    s.cells[cellKey('n1', 6)] = 'G8';
    const issues = validate(s);
    const rest = issues.filter((i) => i.kind === 'REST_VIOLATION' && i.nurseId === 'n1');
    expect(rest.length).toBeGreaterThan(0);
  });

  it('rest violation when N24 followed by GC16 next day (gece de aktif)', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 5)] = 'N24';
    s.cells[cellKey('n1', 6)] = 'GC16';
    const issues = validate(s);
    expect(issues.some((i) => i.kind === 'REST_VIOLATION')).toBe(true);
  });

  it('DN after N24 satisfies rest rule', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 5)] = 'N24';
    s.cells[cellKey('n1', 6)] = 'DN';
    s.cells[cellKey('n1', 7)] = 'DN';
    const issues = validate(s).filter(
      (i) => i.kind === 'REST_VIOLATION' && i.nurseId === 'n1',
    );
    expect(issues.length).toBe(0);
  });

  it('unavailable override flagged when nurse is assigned a working shift', () => {
    const nurses = sixNurses();
    nurses[0].unavailable = [10];
    const s = createEmptySchedule(2026, 5, nurses);
    s.cells[cellKey('n1', 10)] = 'G8';
    const issues = validate(s);
    expect(issues.some((i) => i.kind === 'UNAVAILABLE_OVERRIDE')).toBe(true);
  });

  it('allowSingleNight downgrades hard error to soft warning', () => {
    const s = createEmptySchedule(2026, 5, sixNurses(), {
      ...DEFAULT_CONSTRAINTS,
      allowSingleNight: true,
    });
    // Cuma 1 Mayıs: gündüz dolu (3 G8), gece sadece 1 N24
    s.cells[cellKey('n1', 1)] = 'N24';
    s.cells[cellKey('n2', 1)] = 'G8';
    s.cells[cellKey('n3', 1)] = 'G8';
    s.cells[cellKey('n4', 1)] = 'G8';
    const dayOneIssues = validate(s).filter((i) => i.day === 1);
    const nightIssue = dayOneIssues.find((i) => i.kind === 'COVERAGE_NIGHT');
    expect(nightIssue?.severity).toBe('warning');
  });
});

describe('computeStats', () => {
  it('sums hours and counts shifts per nurse with new shift hours', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 1)] = 'G8';
    s.cells[cellKey('n1', 2)] = 'N24';
    s.cells[cellKey('n1', 5)] = 'GC16';
    s.cells[cellKey('n2', 1)] = 'YI';
    const stats = computeStats(s);
    expect(stats.hoursByNurse['n1']).toBe(8 + 24 + 16);
    expect(stats.countsByNurse['n1'].G8).toBe(1);
    expect(stats.countsByNurse['n1'].N24).toBe(1);
    expect(stats.countsByNurse['n1'].GC16).toBe(1);
    expect(stats.countsByNurse['n2'].YI).toBe(1);
  });

  it('hoursStdDev and hoursSpread are 0 when all nurses have same hours', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    for (const nurse of s.nurses) {
      s.cells[cellKey(nurse.id, 1)] = 'G8';
    }
    const stats = computeStats(s);
    expect(stats.hoursStdDev).toBe(0);
    expect(stats.hoursSpread).toBe(0);
  });

  it('hoursSpread reflects max - min difference', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 1)] = 'N24'; // 24 hours
    // Diğerleri 0 → spread = 24
    const stats = computeStats(s);
    expect(stats.hoursSpread).toBe(24);
  });
});

describe('cloneSchedule', () => {
  it('produces independent copy', () => {
    const s = buildSampleSchedule(2026, 5);
    s.cells[cellKey('n1', 1)] = 'G8';
    const c = cloneSchedule(s);
    c.cells[cellKey('n1', 1)] = 'N24';
    c.nurses[0].name = 'X';
    c.constraints.minDayWeekday = 99;
    c.meta.weekendDays.push(99);
    expect(s.cells[cellKey('n1', 1)]).toBe('G8');
    expect(s.nurses[0].name).toBe('Ayşe');
    expect(s.constraints.minDayWeekday).toBe(3);
    expect(s.meta.weekendDays).not.toContain(99);
  });
});

describe('solveScheduleGreedy', () => {
  it('returns a SolveResult with greedy solver tag', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    expect(r.solver).toBe('greedy');
    expect(r.schedule.meta.daysInMonth).toBe(31);
  });

  it('every cell is filled (no empty / OFF)', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    for (const nurse of r.schedule.nurses) {
      for (let d = 1; d <= r.schedule.meta.daysInMonth; d++) {
        const c = getCell(r.schedule, nurse.id, d);
        expect(ALL_SHIFT_CODES).toContain(c);
      }
    }
  });

  it('weekday days satisfy minDayWeekday', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    const weekendSet = new Set(r.schedule.meta.weekendDays);
    for (let d = 1; d <= r.schedule.meta.daysInMonth; d++) {
      if (weekendSet.has(d)) continue;
      const dayCount = r.schedule.nurses.filter((n) => {
        const c = getCell(r.schedule, n.id, d);
        return isDayCovering(c);
      }).length;
      expect(dayCount).toBeGreaterThanOrEqual(r.schedule.constraints.minDayWeekday);
    }
  });

  it('weekend days satisfy minDayWeekend (default 2)', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    for (const d of r.schedule.meta.weekendDays) {
      const dayCount = r.schedule.nurses.filter((n) => isDayCovering(getCell(r.schedule, n.id, d))).length;
      expect(dayCount).toBeGreaterThanOrEqual(r.schedule.constraints.minDayWeekend);
    }
  });

  it('every day has minNight (weekday or weekend) coverage', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    const weekendSet = new Set(r.schedule.meta.weekendDays);
    for (let d = 1; d <= r.schedule.meta.daysInMonth; d++) {
      const isWeekend = weekendSet.has(d);
      const need = isWeekend ? r.schedule.constraints.minNightWeekend : r.schedule.constraints.minNightWeekday;
      const nightCount = r.schedule.nurses.filter((n) => isNightCovering(getCell(r.schedule, n.id, d))).length;
      expect(nightCount).toBeGreaterThanOrEqual(need);
    }
  });

  it('preserves user-pinned cells', () => {
    const s = buildSampleSchedule(2026, 5);
    s.cells[cellKey('n2', 10)] = 'YI';
    s.pinned[cellKey('n2', 10)] = true;
    const r = solveScheduleGreedy(s);
    expect(getCell(r.schedule, 'n2', 10)).toBe('YI');
  });

  it('honors unavailable days as YI', () => {
    const nurses: Nurse[] = sixNurses();
    nurses[0].unavailable = [5, 10, 15];
    const s = createEmptySchedule(2026, 5, nurses);
    const r = solveScheduleGreedy(s);
    expect(getCell(r.schedule, 'n1', 5)).toBe('YI');
    expect(getCell(r.schedule, 'n1', 10)).toBe('YI');
    expect(getCell(r.schedule, 'n1', 15)).toBe('YI');
  });

  it('post-N rest: N24 day has DN/non-working on next 2 days', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    for (const nurse of r.schedule.nurses) {
      for (let d = 1; d <= r.schedule.meta.daysInMonth - 2; d++) {
        if (getCell(r.schedule, nurse.id, d) !== 'N24') continue;
        const c1 = getCell(r.schedule, nurse.id, d + 1);
        const c2 = getCell(r.schedule, nurse.id, d + 2);
        expect(isWorkingShift(c1)).toBe(false);
        expect(isWorkingShift(c2)).toBe(false);
      }
    }
  });

  it('with too few nurses, reports COVERAGE_NIGHT issues', () => {
    const nurses: Nurse[] = [
      { id: 'n1', name: 'A', unavailable: [] },
      { id: 'n2', name: 'B', unavailable: [] },
    ];
    const s = createEmptySchedule(2026, 5, nurses);
    const r = solveScheduleGreedy(s);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('rerun on prior result is idempotent (no worse)', () => {
    const s = buildSampleSchedule(2026, 5);
    const first = solveScheduleGreedy(s);
    const second = solveScheduleGreedy(first.schedule);
    expect(second.issues.length).toBeLessThanOrEqual(first.issues.length);
  });
});

describe('constraints variations', () => {
  it('different weekday vs weekend mins are honored', () => {
    const cons: ScheduleConstraints = {
      ...DEFAULT_CONSTRAINTS,
      minDayWeekday: 4,
      minDayWeekend: 2,
      minNightWeekday: 3,
      minNightWeekend: 1,
    };
    const nurses = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i + 1}`,
      name: `H${i + 1}`,
      unavailable: [],
    }));
    const s = createEmptySchedule(2026, 5, nurses, cons);
    const r = solveScheduleGreedy(s);
    const weekendSet = new Set(r.schedule.meta.weekendDays);
    for (let d = 1; d <= r.schedule.meta.daysInMonth; d++) {
      const dayCount = r.schedule.nurses.filter((n) => isDayCovering(getCell(r.schedule, n.id, d))).length;
      const nightCount = r.schedule.nurses.filter((n) => isNightCovering(getCell(r.schedule, n.id, d))).length;
      const need = weekendSet.has(d) ? 2 : 4;
      const needNight = weekendSet.has(d) ? 1 : 3;
      expect(dayCount).toBeGreaterThanOrEqual(need);
      expect(nightCount).toBeGreaterThanOrEqual(needNight);
    }
  });
});

describe('buildSampleSchedule', () => {
  it('produces 9 nurses with realistic seed leaves', () => {
    const s = buildSampleSchedule(2026, 5);
    expect(s.nurses.length).toBe(9);
    expect(s.nurses[0].unavailable.length).toBeGreaterThan(0);
    // Gülnihal son sırada
    expect(s.nurses[8].name).toBe('Gülnihal');
  });
});
