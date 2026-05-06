/**
 * Hemşire vardiya planlama: tipler, doğrulama, sezgisel + ILP çözücü.
 *
 * Vardiya modeli:
 * - G8  Gündüz   08-16 (8 saat)
 * - GC16 Gece    16-08 (16 saat) — başlangıç günü için sayılır
 * - N24 Nöbet    00-24 (24 saat)
 * - DN  Dinlenme        (0 saat) — N24 sonrası zorunlu, ayrıca boş günleri doldurur
 * - YI  Yıllık izin    (0 saat)
 * - RP  Rapor          (0 saat)
 *
 * Boş hücre yoktur: solver her hemşirenin her gününü bu altı koddan biriyle
 * doldurur. Adil dağılım hem saat hem gün eşitliği üzerinden sağlanır.
 *
 * Pure: DOM yok, IO yok.
 */

export type ShiftCode = 'G8' | 'GC16' | 'N24' | 'DN' | 'YI' | 'RP';

export const ALL_SHIFT_CODES: readonly ShiftCode[] = [
  'G8',
  'GC16',
  'N24',
  'DN',
  'YI',
  'RP',
] as const;

/** Kullanıcının başlık olarak gördüğü kısaltma. */
export const SHIFT_LABEL: Record<ShiftCode, string> = {
  G8: '8',
  GC16: '16',
  N24: '24',
  DN: 'DN',
  YI: 'Yİ',
  RP: 'RP',
};

/** Her vardiya kodunun saat değeri (toplama dahil). */
export function shiftHoursOf(code: ShiftCode): number {
  switch (code) {
    case 'G8':
      return 8;
    case 'GC16':
      return 16;
    case 'N24':
      return 24;
    default:
      return 0;
  }
}

/** Aktif (çalışılan) vardiya: G8 / GC16 / N24. */
export function isWorkingShift(code: ShiftCode): boolean {
  return code === 'G8' || code === 'GC16' || code === 'N24';
}

/** Gündüz (08-16) saatlerinde sahada olunan vardiya: G8, N24. */
export function isDayCovering(code: ShiftCode): boolean {
  return code === 'G8' || code === 'N24';
}

/** Gece (16-08, ertesi sabaha kadar) saatlerinde sahada olunan vardiya: GC16, N24. */
export function isNightCovering(code: ShiftCode): boolean {
  return code === 'GC16' || code === 'N24';
}

/** İzin/dinlenme türü vardiyalar: DN, YI, RP. */
export function isLeaveShift(code: ShiftCode): boolean {
  return code === 'DN' || code === 'YI' || code === 'RP';
}

export interface Nurse {
  id: string;
  name: string;
  /** Çalışılamaz gün numaraları (1..31). YI olarak işaretlenir, kilitlenir. */
  unavailable: number[];
  notes?: string;
}

export interface ScheduleConstraints {
  /** Hafta içi gündüz (08-16) sahada gerekli minimum hemşire. */
  minDayWeekday: number;
  /** Hafta sonu gündüz (08-16) sahada gerekli minimum hemşire. */
  minDayWeekend: number;
  /** Hafta içi gece (16-08) sahada gerekli minimum hemşire. */
  minNightWeekday: number;
  /** Hafta sonu gece (16-08) sahada gerekli minimum hemşire. */
  minNightWeekend: number;
  /** Nöbet sonrası asgari boş gün (DN olarak işaretlenir). */
  restAfterNight: number;
  /** "Liste dönmüyor" modu — gece 1 hemşireye izin verilir, ihlal olarak raporlanır. */
  allowSingleNight: boolean;
}

export const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  minDayWeekday: 3,
  minDayWeekend: 2,
  minNightWeekday: 2,
  minNightWeekend: 2,
  restAfterNight: 2,
  allowSingleNight: false,
};

export interface MonthMeta {
  year: number;
  month: number; // 1..12
  daysInMonth: number;
  /** Hafta sonu gün numaraları (1..31). Cumartesi + Pazar. */
  weekendDays: number[];
}

export interface Schedule {
  meta: MonthMeta;
  nurses: Nurse[];
  /** Sparse map. Eksik hücre = OFF (henüz dolmamış); solver çıktısında DN olur. */
  cells: Record<string, ShiftCode>;
  /** Kullanıcının kilitlediği hücreler. */
  pinned: Record<string, true>;
  constraints: ScheduleConstraints;
}

export type ValidationKind =
  | 'COVERAGE_DAY'
  | 'COVERAGE_NIGHT'
  | 'REST_VIOLATION'
  | 'UNAVAILABLE_OVERRIDE'
  | 'EMPTY_CELL';

export interface ValidationIssue {
  kind: ValidationKind;
  day: number;
  nurseId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ScheduleStats {
  hoursByNurse: Record<string, number>;
  countsByNurse: Record<string, Record<ShiftCode, number>>;
  /** Hemşire başına toplam saatin standart sapması (adillik göstergesi). */
  hoursStdDev: number;
  /** En yüklü ve en az yüklü hemşirenin saat farkı (spread). */
  hoursSpread: number;
}

export interface SolveResult {
  schedule: Schedule;
  issues: ValidationIssue[];
  stats: ScheduleStats;
  /** Algoritma kaç repair adımı kullandı. */
  repairSteps: number;
  /** Hangi solver çalıştı. */
  solver: 'greedy' | 'ilp';
}

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleError';
  }
}

/* ----------------------------------------------------------- Yardımcılar */

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new ScheduleError(`Geçersiz ay: ${month}`);
  }
  return new Date(year, month, 0).getDate();
}

export function computeWeekendDays(year: number, month: number): number[] {
  const total = daysInMonth(year, month);
  const out: number[] = [];
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) out.push(d);
  }
  return out;
}

export function createMonthMeta(year: number, month: number): MonthMeta {
  return {
    year,
    month,
    daysInMonth: daysInMonth(year, month),
    weekendDays: computeWeekendDays(year, month),
  };
}

export function cellKey(nurseId: string, day: number): string {
  return `${nurseId}:${day}`;
}

/** Hücre kodu — eksikse 'DN' (boş gün otomatik dinlenmedir). */
export function getCell(schedule: Schedule, nurseId: string, day: number): ShiftCode {
  return schedule.cells[cellKey(nurseId, day)] ?? 'DN';
}

/** Schedule'i derin kopyalar. Saf operasyon sırasında mutasyon güvenliği. */
export function cloneSchedule(s: Schedule): Schedule {
  return {
    meta: { ...s.meta, weekendDays: [...s.meta.weekendDays] },
    nurses: s.nurses.map((n) => ({ ...n, unavailable: [...n.unavailable] })),
    cells: { ...s.cells },
    pinned: { ...s.pinned },
    constraints: { ...s.constraints },
  };
}

export function createEmptySchedule(
  year: number,
  month: number,
  nurses: Nurse[] = [],
  constraints: ScheduleConstraints = DEFAULT_CONSTRAINTS,
): Schedule {
  return {
    meta: createMonthMeta(year, month),
    nurses: nurses.map((n) => ({ ...n, unavailable: [...n.unavailable] })),
    cells: {},
    pinned: {},
    constraints: { ...constraints },
  };
}

/* ------------------------------------------------------------ Doğrulama */

function dayMin(constraints: ScheduleConstraints, isWeekend: boolean): number {
  return isWeekend ? constraints.minDayWeekend : constraints.minDayWeekday;
}

function nightMin(constraints: ScheduleConstraints, isWeekend: boolean): number {
  return isWeekend ? constraints.minNightWeekend : constraints.minNightWeekday;
}

export function validate(schedule: Schedule): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { meta, constraints, nurses } = schedule;
  const D = meta.daysInMonth;
  const weekendSet = new Set(meta.weekendDays);

  for (let d = 1; d <= D; d++) {
    const isWeekend = weekendSet.has(d);

    let dayCount = 0;
    let nightCount = 0;
    for (const nurse of nurses) {
      const c = getCell(schedule, nurse.id, d);
      if (isDayCovering(c)) dayCount++;
      if (isNightCovering(c)) nightCount++;
    }

    const minDay = dayMin(constraints, isWeekend);
    const minNight = nightMin(constraints, isWeekend);
    const effectiveMinNight = constraints.allowSingleNight ? Math.min(1, minNight) : minNight;

    if (dayCount < minDay) {
      issues.push({
        kind: 'COVERAGE_DAY',
        day: d,
        message: `Gün ${d}${isWeekend ? ' (hafta sonu)' : ''}: gündüz ${dayCount} hemşire (≥ ${minDay} olmalı).`,
        severity: 'error',
      });
    }

    if (nightCount < effectiveMinNight) {
      issues.push({
        kind: 'COVERAGE_NIGHT',
        day: d,
        message: `Gün ${d}${isWeekend ? ' (hafta sonu)' : ''}: gece ${nightCount} hemşire (≥ ${effectiveMinNight} olmalı).`,
        severity: 'error',
      });
    } else if (constraints.allowSingleNight && nightCount < minNight) {
      issues.push({
        kind: 'COVERAGE_NIGHT',
        day: d,
        message: `Gün ${d}${isWeekend ? ' (hafta sonu)' : ''}: gece ${nightCount} hemşire (yumuşak hedef ${minNight}).`,
        severity: 'warning',
      });
    }
  }

  // Nöbet sonrası dinlenme kuralı
  for (const nurse of nurses) {
    for (let d = 1; d <= D; d++) {
      if (getCell(schedule, nurse.id, d) !== 'N24') continue;
      for (let r = 1; r <= constraints.restAfterNight; r++) {
        if (d + r > D) break;
        const c = getCell(schedule, nurse.id, d + r);
        if (isWorkingShift(c)) {
          issues.push({
            kind: 'REST_VIOLATION',
            day: d + r,
            nurseId: nurse.id,
            message: `${nurse.name}: gün ${d}→${d + r} arasında nöbet sonrası dinlenme yetersiz (${constraints.restAfterNight} gün gerek).`,
            severity: 'error',
          });
        }
      }
    }
  }

  // İzin günü ihlali
  for (const nurse of nurses) {
    for (const d of nurse.unavailable) {
      if (d < 1 || d > D) continue;
      const c = getCell(schedule, nurse.id, d);
      if (isWorkingShift(c)) {
        issues.push({
          kind: 'UNAVAILABLE_OVERRIDE',
          day: d,
          nurseId: nurse.id,
          message: `${nurse.name}: gün ${d} izin gününde aktif vardiya (${SHIFT_LABEL[c]}).`,
          severity: 'error',
        });
      }
    }
  }

  return issues;
}

/* ------------------------------------------------------------- İstatistik */

export function computeStats(schedule: Schedule): ScheduleStats {
  const hoursByNurse: Record<string, number> = {};
  const countsByNurse: Record<string, Record<ShiftCode, number>> = {};

  for (const nurse of schedule.nurses) {
    hoursByNurse[nurse.id] = 0;
    countsByNurse[nurse.id] = {
      G8: 0,
      GC16: 0,
      N24: 0,
      DN: 0,
      YI: 0,
      RP: 0,
    };
    for (let d = 1; d <= schedule.meta.daysInMonth; d++) {
      const c = getCell(schedule, nurse.id, d);
      countsByNurse[nurse.id][c]++;
      hoursByNurse[nurse.id] += shiftHoursOf(c);
    }
  }

  const hoursValues = Object.values(hoursByNurse);
  const n = hoursValues.length;
  let stdDev = 0;
  let spread = 0;
  if (n > 0) {
    const mean = hoursValues.reduce((a, b) => a + b, 0) / n;
    const variance = hoursValues.reduce((a, h) => a + (h - mean) ** 2, 0) / n;
    stdDev = Math.sqrt(variance);
    spread = Math.max(...hoursValues) - Math.min(...hoursValues);
  }

  return { hoursByNurse, countsByNurse, hoursStdDev: stdDev, hoursSpread: spread };
}

/* ----------------------------------------------------------- Greedy çözücü */

interface ScoringState {
  nCount: Record<string, number>;
  hours: Record<string, number>;
}

function initScoringState(schedule: Schedule): ScoringState {
  const nCount: Record<string, number> = {};
  const hours: Record<string, number> = {};
  for (const nurse of schedule.nurses) {
    nCount[nurse.id] = 0;
    hours[nurse.id] = 0;
    for (let d = 1; d <= schedule.meta.daysInMonth; d++) {
      const k = cellKey(nurse.id, d);
      const c = schedule.cells[k];
      if (!c) continue;
      if (c === 'N24') nCount[nurse.id]++;
      hours[nurse.id] += shiftHoursOf(c);
    }
  }
  return { nCount, hours };
}

function nurseRecentlyOnNight(
  schedule: Schedule,
  nurseId: string,
  day: number,
  rest: number,
): boolean {
  for (let r = 1; r <= rest; r++) {
    if (day - r < 1) break;
    if (schedule.cells[cellKey(nurseId, day - r)] === 'N24') return true;
  }
  return false;
}

/**
 * Pinned olmayan hücreleri sıfırlar (yeniden çözüm öncesi). YI/RP olanlar
 * kullanıcının elle koyduğu izinler olabilir; pinli değilse de korunur
 * çünkü hemşirenin unavailable listesinden geliyor olabilir — ama her
 * durumda unavailable günler aşağıda yeniden YI olarak işaretlenecek.
 */
function resetForSolve(schedule: Schedule): void {
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= schedule.meta.daysInMonth; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) continue;
      const cur = schedule.cells[k];
      // RP (rapor) kullanıcı tarafından konabilir; pin değilse de bilgi olarak korunur
      if (cur === 'RP') continue;
      delete schedule.cells[k];
    }
    for (const d of nurse.unavailable) {
      if (d < 1 || d > schedule.meta.daysInMonth) continue;
      const k = cellKey(nurse.id, d);
      if (!schedule.pinned[k]) {
        schedule.cells[k] = 'YI';
      }
    }
  }
}

function assignShift(
  schedule: Schedule,
  state: ScoringState,
  nurseId: string,
  day: number,
  code: ShiftCode,
): void {
  const k = cellKey(nurseId, day);
  const prev = schedule.cells[k];
  if (prev) {
    state.hours[nurseId] -= shiftHoursOf(prev);
    if (prev === 'N24') state.nCount[nurseId]--;
  }
  schedule.cells[k] = code;
  state.hours[nurseId] += shiftHoursOf(code);
  if (code === 'N24') state.nCount[nurseId]++;
}

interface DayCounts {
  day: number;
  night: number;
}

function countOnDay(schedule: Schedule, day: number): DayCounts {
  let dc = 0,
    nc = 0;
  for (const nurse of schedule.nurses) {
    const k = cellKey(nurse.id, day);
    const c = schedule.cells[k];
    if (!c) continue;
    if (isDayCovering(c)) dc++;
    if (isNightCovering(c)) nc++;
  }
  return { day: dc, night: nc };
}

/** O gün için boş (atanmamış) ve dinlenme zorunluluğu olmayan hemşireler. */
function candidatesForDay(
  schedule: Schedule,
  day: number,
  rest: number,
): Nurse[] {
  const out: Nurse[] = [];
  for (const nurse of schedule.nurses) {
    const k = cellKey(nurse.id, day);
    if (schedule.pinned[k]) continue;
    if (schedule.cells[k]) continue; // already assigned
    if (nurseRecentlyOnNight(schedule, nurse.id, day, rest)) continue;
    out.push(nurse);
  }
  return out;
}

function rankCandidates(candidates: Nurse[], state: ScoringState): Nurse[] {
  return [...candidates].sort((a, b) => {
    const dn = state.nCount[a.id] - state.nCount[b.id];
    if (dn !== 0) return dn;
    return state.hours[a.id] - state.hours[b.id];
  });
}

/** Geriye kalan tüm boş hücreleri DN ile doldur. */
function fillEmptyWithRest(schedule: Schedule): void {
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= schedule.meta.daysInMonth; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) continue;
      if (!schedule.cells[k]) {
        schedule.cells[k] = 'DN';
      }
    }
  }
}

/**
 * Sezgisel çözüm: greedy forward + repair. Kullanıcının önceden kilitlediği
 * hücreleri ve izin günlerini korur. Tüm boş hücreler en sonda DN ile
 * doldurulur — sonuçta her hücre bir kod alır.
 */
export function solveScheduleGreedy(input: Schedule): SolveResult {
  const schedule = cloneSchedule(input);
  resetForSolve(schedule);
  const state = initScoringState(schedule);
  const D = schedule.meta.daysInMonth;
  const { constraints } = schedule;
  const weekendSet = new Set(schedule.meta.weekendDays);

  for (let d = 1; d <= D; d++) {
    const isWeekend = weekendSet.has(d);
    const minDay = dayMin(constraints, isWeekend);
    const minNight = nightMin(constraints, isWeekend);

    // 1) Gece kapsamasını N24 ile tamamla (gündüze de sayılır)
    let counts = countOnDay(schedule, d);
    let needNight = Math.max(0, minNight - counts.night);
    // Önce N24 atayarak hem gündüz hem gece bir miktar kapsama ekleyelim
    const nightCands = rankCandidates(candidatesForDay(schedule, d, constraints.restAfterNight), state);
    let i = 0;
    while (needNight > 0 && i < nightCands.length) {
      const nurse = nightCands[i++];
      assignShift(schedule, state, nurse.id, d, 'N24');
      needNight--;
    }

    // 2) Gece eksik kaldıysa GC16 ile tamamla
    counts = countOnDay(schedule, d);
    let needNightExtra = Math.max(0, minNight - counts.night);
    if (needNightExtra > 0) {
      const eveCands = rankCandidates(candidatesForDay(schedule, d, constraints.restAfterNight), state);
      i = 0;
      while (needNightExtra > 0 && i < eveCands.length) {
        const nurse = eveCands[i++];
        assignShift(schedule, state, nurse.id, d, 'GC16');
        needNightExtra--;
      }
    }

    // 3) Gündüz kapsamasını G8 ile tamamla (N24'lar zaten gündüze de sayılır)
    counts = countOnDay(schedule, d);
    let needDay = Math.max(0, minDay - counts.day);
    if (needDay > 0) {
      const dayCands = rankCandidates(candidatesForDay(schedule, d, constraints.restAfterNight), state);
      i = 0;
      while (needDay > 0 && i < dayCands.length) {
        const nurse = dayCands[i++];
        assignShift(schedule, state, nurse.id, d, 'G8');
        needDay--;
      }
    }
  }

  // Repair
  const repairSteps = repairPass(schedule, state, 100);

  // Boş kalanları DN ile doldur
  fillEmptyWithRest(schedule);

  const issues = validate(schedule);
  const stats = computeStats(schedule);

  return { schedule, issues, stats, repairSteps, solver: 'greedy' };
}

function repairPass(schedule: Schedule, state: ScoringState, maxIter: number): number {
  let iter = 0;
  while (iter < maxIter) {
    const issues = validate(schedule);
    if (issues.length === 0) break;

    const nightIssue = issues.find(
      (i) => i.kind === 'COVERAGE_NIGHT' && i.severity === 'error',
    );
    if (nightIssue) {
      const cands = rankCandidates(
        candidatesForDay(schedule, nightIssue.day, schedule.constraints.restAfterNight),
        state,
      );
      if (cands.length > 0) {
        // Önce N24 dener, gerekirse GC16
        const targetCode: ShiftCode = state.nCount[cands[0].id] < 6 ? 'N24' : 'GC16';
        assignShift(schedule, state, cands[0].id, nightIssue.day, targetCode);
        iter++;
        continue;
      }
    }

    const dayIssue = issues.find(
      (i) => i.kind === 'COVERAGE_DAY' && i.severity === 'error',
    );
    if (dayIssue) {
      const cands = rankCandidates(
        candidatesForDay(schedule, dayIssue.day, schedule.constraints.restAfterNight),
        state,
      );
      if (cands.length > 0) {
        assignShift(schedule, state, cands[0].id, dayIssue.day, 'G8');
        iter++;
        continue;
      }
    }

    break;
  }
  return iter;
}

/* --------------------------------------------------------- ILP çözücü */

interface GlpkLike {
  GLP_MIN: number;
  GLP_MAX: number;
  GLP_LO: number;
  GLP_UP: number;
  GLP_FX: number;
  GLP_FR: number;
  GLP_DB: number;
  GLP_MSG_OFF: number;
  GLP_OPT: number;
  GLP_FEAS: number;
  GLP_INFEAS: number;
  GLP_NOFEAS: number;
  GLP_UNBND: number;
  solve(
    lp: unknown,
    options?: number | { msglev?: number; tmlim?: number; mipgap?: number },
  ): Promise<{
    result: { status: number; z: number; vars: Record<string, number> };
  }>;
}

let glpkPromise: Promise<unknown> | null = null;

async function getGlpk(): Promise<GlpkLike> {
  if (!glpkPromise) {
    glpkPromise = import('glpk.js').then((mod) =>
      (mod.default as () => Promise<GlpkLike>)(),
    );
  }
  return (await glpkPromise) as GlpkLike;
}

const ACTIVE_SHIFTS: readonly ShiftCode[] = ['G8', 'GC16', 'N24'] as const;

function varNameOf(nurseId: string, day: number, shift: ShiftCode): string {
  return `x_${nurseId}_${day}_${shift}`;
}

interface LpVar {
  name: string;
  coef: number;
}

interface LpRow {
  name: string;
  vars: LpVar[];
  bnds: { type: number; ub: number; lb: number };
}

/**
 * ILP çözücü. Karar değişkenleri: her (n, d) için x_G8, x_GC16, x_N24 (ikili).
 * DN/YI/RP karar değişkeni değil — DN dolaylı (toplam ≤ 1, eksik yere DN
 * yazılır), YI/RP ise pinli olarak gelir. Amaç: max_hours - min_hours
 * (spread) minimize ederek hem en yüklü hemşireyi rahatlat, hem en az
 * çalışanı yeterli gün çalıştır.
 */
export async function solveScheduleILP(
  input: Schedule,
  options: { timeLimitSec?: number } = {},
): Promise<SolveResult> {
  const schedule = cloneSchedule(input);
  const D = schedule.meta.daysInMonth;
  const cons = schedule.constraints;
  const weekendSet = new Set(schedule.meta.weekendDays);

  // 1. Pre-fill: izin günlerini YI olarak işaretle
  for (const nurse of schedule.nurses) {
    for (const d of nurse.unavailable) {
      if (d < 1 || d > D) continue;
      const k = cellKey(nurse.id, d);
      if (!schedule.pinned[k]) schedule.cells[k] = 'YI';
    }
  }

  // 2. Aktif değişkenler: pin değilse + YI/RP olmayan hücreler için
  const binaries: string[] = [];
  const isFree = (nurseId: string, day: number): boolean => {
    const k = cellKey(nurseId, day);
    if (schedule.pinned[k]) return false;
    const cur = schedule.cells[k];
    if (cur === 'YI' || cur === 'RP') return false;
    return true;
  };

  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      if (!isFree(nurse.id, d)) continue;
      for (const s of ACTIVE_SHIFTS) {
        binaries.push(varNameOf(nurse.id, d, s));
      }
    }
  }

  const glpk = await getGlpk();
  const subjectTo: LpRow[] = [];

  // 3. En fazla bir aktif vardiya per (n,d): x_G8 + x_GC16 + x_N24 ≤ 1
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      if (!isFree(nurse.id, d)) continue;
      const vars: LpVar[] = ACTIVE_SHIFTS.map((s) => ({
        name: varNameOf(nurse.id, d, s),
        coef: 1,
      }));
      subjectTo.push({
        name: `one_${nurse.id}_${d}`,
        vars,
        bnds: { type: glpk.GLP_UP, ub: 1, lb: 0 },
      });
    }
  }

  // 4. Pinned aktif hücreler — sabit 1
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (!schedule.pinned[k]) continue;
      const c = schedule.cells[k];
      if (!isWorkingShift(c)) continue;
      const v = varNameOf(nurse.id, d, c);
      if (!binaries.includes(v)) binaries.push(v);
      subjectTo.push({
        name: `pin_${nurse.id}_${d}`,
        vars: [{ name: v, coef: 1 }],
        bnds: { type: glpk.GLP_FX, ub: 1, lb: 1 },
      });
    }
  }

  // 5. Gündüz kapsama (G8 + N24)
  for (let d = 1; d <= D; d++) {
    const isWeekend = weekendSet.has(d);
    const minDay = dayMin(cons, isWeekend);
    const vars: LpVar[] = [];
    for (const nurse of schedule.nurses) {
      for (const s of ['G8', 'N24'] as ShiftCode[]) {
        const v = varNameOf(nurse.id, d, s);
        if (binaries.includes(v) && !vars.find((x) => x.name === v)) {
          vars.push({ name: v, coef: 1 });
        }
      }
    }
    if (vars.length === 0) continue;
    subjectTo.push({
      name: `day_${d}`,
      vars,
      bnds: { type: glpk.GLP_LO, ub: 0, lb: minDay },
    });
  }

  // 6. Gece kapsama (GC16 + N24)
  for (let d = 1; d <= D; d++) {
    const isWeekend = weekendSet.has(d);
    const baseMin = nightMin(cons, isWeekend);
    const minNight = cons.allowSingleNight ? Math.min(1, baseMin) : baseMin;
    const vars: LpVar[] = [];
    for (const nurse of schedule.nurses) {
      for (const s of ['GC16', 'N24'] as ShiftCode[]) {
        const v = varNameOf(nurse.id, d, s);
        if (binaries.includes(v) && !vars.find((x) => x.name === v)) {
          vars.push({ name: v, coef: 1 });
        }
      }
    }
    if (vars.length === 0) continue;
    subjectTo.push({
      name: `night_${d}`,
      vars,
      bnds: { type: glpk.GLP_LO, ub: 0, lb: minNight },
    });
  }

  // 7. Nöbet sonrası dinlenme: x[n,d,N24] + x[n,d',aktif] ≤ 1
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      const vN = varNameOf(nurse.id, d, 'N24');
      if (!binaries.includes(vN)) continue;
      for (let r = 1; r <= cons.restAfterNight; r++) {
        if (d + r > D) break;
        const vars: LpVar[] = [{ name: vN, coef: 1 }];
        for (const s of ACTIVE_SHIFTS) {
          const v2 = varNameOf(nurse.id, d + r, s);
          if (binaries.includes(v2)) vars.push({ name: v2, coef: 1 });
        }
        if (vars.length < 2) continue;
        subjectTo.push({
          name: `rest_${nurse.id}_${d}_${r}`,
          vars,
          bnds: { type: glpk.GLP_UP, ub: 1, lb: 0 },
        });
      }
    }
  }

  // 8. Adillik objektifi: min(Z1 - Z2)
  // Z1 ≥ hours_n, Z2 ≤ hours_n her n için
  // Yardımcı: hours_n = pinnedHours + sum(8 x_G8 + 16 x_GC16 + 24 x_N24)
  for (const nurse of schedule.nurses) {
    let pinnedHours = 0;
    const z1Vars: LpVar[] = [{ name: 'Z1', coef: -1 }];
    const z2Vars: LpVar[] = [{ name: 'Z2', coef: -1 }];
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) {
        pinnedHours += shiftHoursOf(schedule.cells[k] ?? 'DN');
        continue;
      }
      const v1 = varNameOf(nurse.id, d, 'G8');
      const v2 = varNameOf(nurse.id, d, 'GC16');
      const v3 = varNameOf(nurse.id, d, 'N24');
      if (binaries.includes(v1)) {
        z1Vars.push({ name: v1, coef: 8 });
        z2Vars.push({ name: v1, coef: 8 });
      }
      if (binaries.includes(v2)) {
        z1Vars.push({ name: v2, coef: 16 });
        z2Vars.push({ name: v2, coef: 16 });
      }
      if (binaries.includes(v3)) {
        z1Vars.push({ name: v3, coef: 24 });
        z2Vars.push({ name: v3, coef: 24 });
      }
    }
    // -Z1 + sum(coef*x) ≤ -pinnedHours  (yani sum + pinned ≤ Z1)
    subjectTo.push({
      name: `maxhours_${nurse.id}`,
      vars: z1Vars,
      bnds: { type: glpk.GLP_UP, ub: -pinnedHours, lb: 0 },
    });
    // -Z2 + sum(coef*x) ≥ -pinnedHours  (yani sum + pinned ≥ Z2)
    subjectTo.push({
      name: `minhours_${nurse.id}`,
      vars: z2Vars,
      bnds: { type: glpk.GLP_LO, ub: 0, lb: -pinnedHours },
    });
  }

  const lp = {
    name: 'nurse_schedule',
    objective: {
      direction: glpk.GLP_MIN,
      name: 'spread',
      vars: [
        { name: 'Z1', coef: 1 },
        { name: 'Z2', coef: -1 },
      ],
    },
    subjectTo,
    bounds: [
      { name: 'Z1', type: glpk.GLP_LO, lb: 0, ub: 0 },
      { name: 'Z2', type: glpk.GLP_LO, lb: 0, ub: 0 },
    ],
    binaries,
  };

  const tmlim = options.timeLimitSec ?? 30;
  const result = await glpk.solve(lp, {
    msglev: glpk.GLP_MSG_OFF,
    tmlim,
    mipgap: 0.05,
  });

  const status = result.result.status;
  if (
    status === glpk.GLP_NOFEAS ||
    status === glpk.GLP_INFEAS ||
    status === glpk.GLP_UNBND
  ) {
    throw new ScheduleError(
      'Çözüm bulunamadı: kısıtlar mevcut hemşire/izin durumuyla tutarsız. Kısıtları gevşetmeyi deneyin.',
    );
  }

  // Aktif olmayan hücreleri temizle (YI/RP/pinned hariç)
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) continue;
      const c = schedule.cells[k];
      if (c === 'YI' || c === 'RP') continue;
      delete schedule.cells[k];
    }
  }

  // Çözüm değerlerinden aktif hücreleri yaz
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) continue;
      const c = schedule.cells[k];
      if (c === 'YI' || c === 'RP') continue;
      for (const s of ACTIVE_SHIFTS) {
        const v = varNameOf(nurse.id, d, s);
        if ((result.result.vars[v] ?? 0) > 0.5) {
          schedule.cells[k] = s;
          break;
        }
      }
    }
  }

  // Boş kalan tüm hücreleri DN ile doldur
  fillEmptyWithRest(schedule);

  const issues = validate(schedule);
  const stats = computeStats(schedule);

  return { schedule, issues, stats, repairSteps: 0, solver: 'ilp' };
}

/* ----------------------------------------------------------- Örnek üretici */

export function buildSampleSchedule(year: number, month: number): Schedule {
  const nurses: Nurse[] = [
    { id: 'n1', name: 'Ayşe', unavailable: [] },
    { id: 'n2', name: 'Fatma', unavailable: [] },
    { id: 'n3', name: 'Zeynep', unavailable: [] },
    { id: 'n4', name: 'Elif', unavailable: [] },
    { id: 'n5', name: 'Hanife', unavailable: [] },
    { id: 'n6', name: 'Sevgi', unavailable: [] },
    { id: 'n7', name: 'Merve', unavailable: [] },
    { id: 'n8', name: 'Selin', unavailable: [] },
  ];
  const meta = createMonthMeta(year, month);
  if (meta.daysInMonth >= 5) {
    nurses[0].unavailable = [5, 6];
    if (meta.daysInMonth >= 18) nurses[2].unavailable = [12, 13, 14];
    if (meta.daysInMonth >= 22) nurses[4].unavailable = [22];
  }
  return createEmptySchedule(year, month, nurses, DEFAULT_CONSTRAINTS);
}
