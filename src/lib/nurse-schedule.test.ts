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
  isEveningCovering,
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
  it('shift hours map correctly', () => {
    expect(shiftHoursOf('OFF')).toBe(0);
    expect(shiftHoursOf('D8')).toBe(8);
    expect(shiftHoursOf('E16')).toBe(8);
    expect(shiftHoursOf('N24')).toBe(24);
    expect(shiftHoursOf('YI')).toBe(0);
    expect(shiftHoursOf('RT')).toBe(0);
    expect(shiftHoursOf('NI')).toBe(0);
  });

  it('classification helpers', () => {
    expect(isWorkingShift('D8')).toBe(true);
    expect(isWorkingShift('N24')).toBe(true);
    expect(isWorkingShift('E16')).toBe(true);
    expect(isWorkingShift('YI')).toBe(false);
    expect(isWorkingShift('NI')).toBe(false);

    expect(isDayCovering('D8')).toBe(true);
    expect(isDayCovering('N24')).toBe(true);
    expect(isDayCovering('E16')).toBe(false);

    expect(isEveningCovering('E16')).toBe(true);
    expect(isEveningCovering('N24')).toBe(true);
    expect(isEveningCovering('D8')).toBe(false);

    expect(isNightCovering('N24')).toBe(true);
    expect(isNightCovering('D8')).toBe(false);

    expect(isLeaveShift('YI')).toBe(true);
    expect(isLeaveShift('RT')).toBe(true);
    expect(isLeaveShift('NI')).toBe(true);
    expect(isLeaveShift('D8')).toBe(false);
  });

  it('all shift codes covered', () => {
    expect(ALL_SHIFT_CODES.length).toBe(7);
  });
});

describe('calendar helpers', () => {
  it('daysInMonth correct for known months', () => {
    expect(daysInMonth(2026, 2)).toBe(28); // 2026 leap değil
    expect(daysInMonth(2024, 2)).toBe(29); // 2024 leap
    expect(daysInMonth(2026, 5)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('rejects invalid month', () => {
    expect(() => daysInMonth(2026, 0)).toThrow();
    expect(() => daysInMonth(2026, 13)).toThrow();
  });

  it('computeWeekendDays returns Sat+Sun day numbers', () => {
    // Mayıs 2026: 1 Cuma, 2 Cmt, 3 Pzr, 9-10, 16-17, 23-24, 30-31
    const we = computeWeekendDays(2026, 5);
    expect(we).toEqual([2, 3, 9, 10, 16, 17, 23, 24, 30, 31]);
  });

  it('createMonthMeta combines fields', () => {
    const m = createMonthMeta(2026, 5);
    expect(m.year).toBe(2026);
    expect(m.month).toBe(5);
    expect(m.daysInMonth).toBe(31);
    expect(m.weekendDays).toContain(3);
  });
});

describe('validate', () => {
  it('empty schedule reports night coverage missing for every day', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    const issues = validate(s);
    const nightIssues = issues.filter((i) => i.kind === 'COVERAGE_NIGHT');
    expect(nightIssues.length).toBe(31);
    expect(nightIssues[0].severity).toBe('error');
  });

  it('weekday day coverage required when 3 nurses missing', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    const issues = validate(s);
    // Hafta içi günler için COVERAGE_DAY olmalı
    const dayIssues = issues.filter((i) => i.kind === 'COVERAGE_DAY');
    expect(dayIssues.length).toBeGreaterThan(0);
  });

  it('weekend day coverage skipped when weekendReduced=true', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    const issues = validate(s);
    const weekendDayIssues = issues.filter(
      (i) => i.kind === 'COVERAGE_DAY' && s.meta.weekendDays.includes(i.day),
    );
    expect(weekendDayIssues.length).toBe(0);
  });

  it('rest violation when N24 followed by D8 next day', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 5)] = 'N24';
    s.cells[cellKey('n1', 6)] = 'D8';
    const issues = validate(s);
    const rest = issues.filter((i) => i.kind === 'REST_VIOLATION' && i.nurseId === 'n1');
    expect(rest.length).toBeGreaterThan(0);
  });

  it('rest violation when N24 followed by N24 next day', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 5)] = 'N24';
    s.cells[cellKey('n1', 6)] = 'N24';
    const issues = validate(s);
    expect(issues.some((i) => i.kind === 'REST_VIOLATION')).toBe(true);
  });

  it('NI shift after N24 satisfies rest rule', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 5)] = 'N24';
    s.cells[cellKey('n1', 6)] = 'NI';
    s.cells[cellKey('n1', 7)] = 'NI';
    const issues = validate(s).filter(
      (i) => i.kind === 'REST_VIOLATION' && i.nurseId === 'n1',
    );
    expect(issues.length).toBe(0);
  });

  it('unavailable override flagged when nurse is assigned a working shift', () => {
    const nurses = sixNurses();
    nurses[0].unavailable = [10];
    const s = createEmptySchedule(2026, 5, nurses);
    s.cells[cellKey('n1', 10)] = 'D8';
    const issues = validate(s);
    expect(issues.some((i) => i.kind === 'UNAVAILABLE_OVERRIDE')).toBe(true);
  });

  it('allowSingleNight downgrades hard to soft warning', () => {
    const s = createEmptySchedule(2026, 5, sixNurses(), {
      ...DEFAULT_CONSTRAINTS,
      allowSingleNight: true,
    });
    // Sadece 1 gece atayalım
    s.cells[cellKey('n1', 5)] = 'N24';
    s.cells[cellKey('n2', 5)] = 'D8';
    s.cells[cellKey('n3', 5)] = 'D8';
    s.cells[cellKey('n4', 5)] = 'D8';
    const dayFiveIssues = validate(s).filter((i) => i.day === 5);
    const nightIssue = dayFiveIssues.find((i) => i.kind === 'COVERAGE_NIGHT');
    expect(nightIssue?.severity).toBe('warning');
  });
});

describe('computeStats', () => {
  it('sums hours and counts shifts per nurse', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    s.cells[cellKey('n1', 1)] = 'D8';
    s.cells[cellKey('n1', 2)] = 'N24';
    s.cells[cellKey('n1', 5)] = 'E16';
    s.cells[cellKey('n2', 1)] = 'YI';
    const stats = computeStats(s);
    expect(stats.hoursByNurse['n1']).toBe(8 + 24 + 8);
    expect(stats.countsByNurse['n1'].D8).toBe(1);
    expect(stats.countsByNurse['n1'].N24).toBe(1);
    expect(stats.countsByNurse['n1'].E16).toBe(1);
    expect(stats.countsByNurse['n2'].YI).toBe(1);
    expect(stats.countsByNurse['n2'].OFF).toBe(s.meta.daysInMonth - 1);
  });

  it('hoursStdDev is 0 when all nurses have same hours', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    for (const nurse of s.nurses) {
      s.cells[cellKey(nurse.id, 1)] = 'D8';
    }
    const stats = computeStats(s);
    expect(stats.hoursStdDev).toBe(0);
  });
});

describe('cloneSchedule', () => {
  it('produces independent copy', () => {
    const s = buildSampleSchedule(2026, 5);
    s.cells[cellKey('n1', 1)] = 'D8';
    const c = cloneSchedule(s);
    c.cells[cellKey('n1', 1)] = 'N24';
    c.nurses[0].name = 'X';
    c.constraints.minDayPresent = 99;
    c.meta.weekendDays.push(99);
    expect(s.cells[cellKey('n1', 1)]).toBe('D8');
    expect(s.nurses[0].name).toBe('Ayşe');
    expect(s.constraints.minDayPresent).toBe(3);
    expect(s.meta.weekendDays).not.toContain(99);
  });
});

describe('solveScheduleGreedy — temel akış', () => {
  it('returns a SolveResult with greedy solver tag', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    expect(r.solver).toBe('greedy');
    expect(r.schedule.meta.daysInMonth).toBe(31);
    expect(r.stats.hoursByNurse['n1']).toBeGreaterThan(0);
  });

  it('weekday days have ≥ 2 nurses on N24 by default', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    for (let d = 1; d <= r.schedule.meta.daysInMonth; d++) {
      const nightCount = r.schedule.nurses.filter(
        (n) => getCell(r.schedule, n.id, d) === 'N24',
      ).length;
      // Yeterli hemşire varken her gün gece kapsanmalı
      expect(nightCount).toBeGreaterThanOrEqual(2);
    }
  });

  it('weekday days satisfy minDayPresent', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    const weekendSet = new Set(r.schedule.meta.weekendDays);
    for (let d = 1; d <= r.schedule.meta.daysInMonth; d++) {
      if (weekendSet.has(d)) continue;
      const dayCount = r.schedule.nurses.filter((n) => {
        const c = getCell(r.schedule, n.id, d);
        return c === 'D8' || c === 'N24';
      }).length;
      expect(dayCount).toBeGreaterThanOrEqual(3);
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

  it('post-N rest: nurse on N24 day d has NI or non-working on d+1, d+2', () => {
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

  it('weekendReduced=true: weekend day has just N24 coverage (no D8 forced)', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    // Hafta sonu günlerinde gündüz toplamı 2 (sadece 2 N24) olabilir
    // ama bu geçerli — D8 zorunlu değil
    const issues = r.issues.filter(
      (i) => i.kind === 'COVERAGE_DAY' && r.schedule.meta.weekendDays.includes(i.day),
    );
    expect(issues.length).toBe(0);
  });

  it('with too few nurses, reports COVERAGE_NIGHT issues', () => {
    const nurses: Nurse[] = [
      { id: 'n1', name: 'A', unavailable: [] },
      { id: 'n2', name: 'B', unavailable: [] },
    ];
    const s = createEmptySchedule(2026, 5, nurses);
    const r = solveScheduleGreedy(s);
    // 2 hemşire ile 31 gün boyunca her gün 2 N tutmak imkansız (rest ihlali olur)
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('no rest violations in produced schedule with sufficient staff', () => {
    const s = buildSampleSchedule(2026, 5);
    const r = solveScheduleGreedy(s);
    const restIssues = r.issues.filter((i) => i.kind === 'REST_VIOLATION');
    expect(restIssues.length).toBe(0);
  });

  it('rerun clears prior NI/D8/N24 (idempotent over re-solve)', () => {
    const s = buildSampleSchedule(2026, 5);
    const first = solveScheduleGreedy(s);
    const second = solveScheduleGreedy(first.schedule);
    // Tekrar çözümde aynı kullanıcı pinned hücreler olmadığı için
    // sonuç deterministik (önceki çözümün artıkları temizlenir).
    expect(second.issues.length).toBeLessThanOrEqual(first.issues.length);
  });
});

describe('constraints variations', () => {
  it('minEveningPresent=1 enforces evening coverage', () => {
    const cons: ScheduleConstraints = {
      ...DEFAULT_CONSTRAINTS,
      minEveningPresent: 1,
    };
    const s = createEmptySchedule(2026, 5, sixNurses(), cons);
    const r = solveScheduleGreedy(s);
    const weekendSet = new Set(r.schedule.meta.weekendDays);
    for (let d = 1; d <= r.schedule.meta.daysInMonth; d++) {
      if (weekendSet.has(d)) continue;
      const eveCount = r.schedule.nurses.filter((n) => {
        const c = getCell(r.schedule, n.id, d);
        return c === 'E16' || c === 'N24';
      }).length;
      expect(eveCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('weekendReduced=false makes validate flag understaffed weekend days', () => {
    const cons: ScheduleConstraints = {
      ...DEFAULT_CONSTRAINTS,
      weekendReduced: false,
    };
    const s = createEmptySchedule(2026, 5, sixNurses(), cons);
    // Sadece 2 N24 ata, gündüz toplamı 2 → eksik
    s.cells[cellKey('n1', 2)] = 'N24';
    s.cells[cellKey('n2', 2)] = 'N24';
    const issues = validate(s);
    const dayIssue = issues.find((i) => i.kind === 'COVERAGE_DAY' && i.day === 2);
    expect(dayIssue).toBeDefined();
    expect(dayIssue?.severity).toBe('error');
  });

  it('weekendReduced=true (default) skips COVERAGE_DAY check on weekends', () => {
    const s = createEmptySchedule(2026, 5, sixNurses());
    // 2 Mayıs hafta sonu, 0 hemşire atanmış — ama gece eksik raporlanır, gündüz raporlanmaz
    const issues = validate(s);
    const weekendDayCoverage = issues.find(
      (i) => i.kind === 'COVERAGE_DAY' && i.day === 2,
    );
    expect(weekendDayCoverage).toBeUndefined();
  });
});

describe('buildSampleSchedule', () => {
  it('produces 8 nurses with realistic seed leaves', () => {
    const s = buildSampleSchedule(2026, 5);
    expect(s.nurses.length).toBe(8);
    expect(s.nurses[0].unavailable.length).toBeGreaterThan(0);
  });
});
