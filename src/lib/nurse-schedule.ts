/**
 * Hemşire vardiya planlama: tipler, doğrulama, sezgisel + ILP çözücü.
 *
 * Bir aylık çizelge için kullanıcı hemşireleri ve kısıtlarını tanımlar.
 * Sezgisel (greedy + forward-checking + repair) hızlı bir başlangıç çözümü
 * üretir; isteğe bağlı ILP (glpk.js) sonradan çağrılarak adillik için
 * rafine edilebilir.
 *
 * Pure: DOM yok, IO yok. Tüm fonksiyonlar saf.
 */

export type ShiftCode = 'OFF' | 'D8' | 'E16' | 'N24' | 'YI' | 'RT' | 'NI';

export const ALL_SHIFT_CODES: readonly ShiftCode[] = [
  'OFF',
  'D8',
  'E16',
  'N24',
  'YI',
  'RT',
  'NI',
] as const;

/** Her vardiya kodunun saat değeri (toplama dahil). */
export function shiftHoursOf(code: ShiftCode): number {
  switch (code) {
    case 'D8':
      return 8;
    case 'E16':
      return 8;
    case 'N24':
      return 24;
    default:
      return 0;
  }
}

/** Aktif (çalışılan) vardiya: D8 / E16 / N24. */
export function isWorkingShift(code: ShiftCode): boolean {
  return code === 'D8' || code === 'E16' || code === 'N24';
}

/** Gündüz (08-16) saatlerinde sahada olunan vardiya: D8, N24. */
export function isDayCovering(code: ShiftCode): boolean {
  return code === 'D8' || code === 'N24';
}

/** Akşam (16-24) saatlerinde sahada olunan vardiya: E16, N24. */
export function isEveningCovering(code: ShiftCode): boolean {
  return code === 'E16' || code === 'N24';
}

/** Gece (00-08) saatlerinde sahada olunan vardiya: yalnız N24. */
export function isNightCovering(code: ShiftCode): boolean {
  return code === 'N24';
}

/** İzin/dinlenme türü vardiyalar: YI, RT, NI. */
export function isLeaveShift(code: ShiftCode): boolean {
  return code === 'YI' || code === 'RT' || code === 'NI';
}

export interface Nurse {
  id: string;
  name: string;
  /** Çalışılamaz gün numaraları (1..31). YI olarak işaretlenir, kilitlenir. */
  unavailable: number[];
  notes?: string;
}

export interface ScheduleConstraints {
  /** Hafta içi gündüz (08-16) sahada olması gereken minimum hemşire. */
  minDayPresent: number;
  /** Akşam (16-24) sahada olması gereken minimum hemşire. 0 = serbest. */
  minEveningPresent: number;
  /** Gece (00-08) nöbette olması gereken minimum hemşire. */
  minNightPresent: number;
  /** Nöbet sonrası asgari boş gün (NI olarak işaretlenir). */
  restAfterNight: number;
  /** Hafta sonu gündüz minimumunu gece minimumuna düşür. */
  weekendReduced: boolean;
  /** "Liste dönmüyor" modu — gece 1 hemşireye izin verilir, ihlal olarak raporlanır. */
  allowSingleNight: boolean;
}

export const DEFAULT_CONSTRAINTS: ScheduleConstraints = {
  minDayPresent: 3,
  minEveningPresent: 0,
  minNightPresent: 2,
  restAfterNight: 2,
  weekendReduced: true,
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
  /** Sparse map. Eksik hücre = OFF. */
  cells: Record<string, ShiftCode>;
  /** Kullanıcının kilitlediği hücreler. */
  pinned: Record<string, true>;
  constraints: ScheduleConstraints;
}

export type ValidationKind =
  | 'COVERAGE_DAY'
  | 'COVERAGE_EVENING'
  | 'COVERAGE_NIGHT'
  | 'REST_VIOLATION'
  | 'UNAVAILABLE_OVERRIDE';

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
  // JavaScript Date: gün=0 bir önceki ayın son gününü verir
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

export function getCell(schedule: Schedule, nurseId: string, day: number): ShiftCode {
  return schedule.cells[cellKey(nurseId, day)] ?? 'OFF';
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

export function validate(schedule: Schedule): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { meta, constraints, nurses } = schedule;
  const D = meta.daysInMonth;
  const weekendSet = new Set(meta.weekendDays);

  for (let d = 1; d <= D; d++) {
    const isWeekend = weekendSet.has(d);
    const reduceDay = isWeekend && constraints.weekendReduced;

    let dayCount = 0;
    let eveningCount = 0;
    let nightCount = 0;
    for (const nurse of nurses) {
      const c = getCell(schedule, nurse.id, d);
      if (isDayCovering(c)) dayCount++;
      if (isEveningCovering(c)) eveningCount++;
      if (isNightCovering(c)) nightCount++;
    }

    const needNight = constraints.allowSingleNight ? 1 : constraints.minNightPresent;
    if (nightCount < needNight) {
      issues.push({
        kind: 'COVERAGE_NIGHT',
        day: d,
        message: `Gün ${d}: gece ${nightCount} hemşire (≥ ${needNight} olmalı).`,
        severity: 'error',
      });
    } else if (
      constraints.allowSingleNight &&
      nightCount < constraints.minNightPresent
    ) {
      issues.push({
        kind: 'COVERAGE_NIGHT',
        day: d,
        message: `Gün ${d}: gece ${nightCount} hemşire (yumuşak hedef ${constraints.minNightPresent}).`,
        severity: 'warning',
      });
    }

    if (!reduceDay && dayCount < constraints.minDayPresent) {
      issues.push({
        kind: 'COVERAGE_DAY',
        day: d,
        message: `Gün ${d}: gündüz ${dayCount} hemşire (≥ ${constraints.minDayPresent} olmalı).`,
        severity: 'error',
      });
    }

    if (constraints.minEveningPresent > 0 && eveningCount < constraints.minEveningPresent) {
      issues.push({
        kind: 'COVERAGE_EVENING',
        day: d,
        message: `Gün ${d}: akşam ${eveningCount} hemşire (≥ ${constraints.minEveningPresent} olmalı).`,
        severity: 'error',
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
          message: `${nurse.name}: gün ${d} izin gününde aktif vardiya (${c}).`,
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
      OFF: 0,
      D8: 0,
      E16: 0,
      N24: 0,
      YI: 0,
      RT: 0,
      NI: 0,
    };
    for (let d = 1; d <= schedule.meta.daysInMonth; d++) {
      const c = getCell(schedule, nurse.id, d);
      countsByNurse[nurse.id][c]++;
      hoursByNurse[nurse.id] += shiftHoursOf(c);
    }
  }

  // Standart sapma (adillik göstergesi)
  const hoursValues = Object.values(hoursByNurse);
  const n = hoursValues.length;
  let stdDev = 0;
  if (n > 0) {
    const mean = hoursValues.reduce((a, b) => a + b, 0) / n;
    const variance = hoursValues.reduce((a, h) => a + (h - mean) ** 2, 0) / n;
    stdDev = Math.sqrt(variance);
  }

  return { hoursByNurse, countsByNurse, hoursStdDev: stdDev };
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
      const c = getCell(schedule, nurse.id, d);
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
    if (getCell(schedule, nurseId, day - r) === 'N24') return true;
  }
  return false;
}

/**
 * Pinned olmayan ve YI/RT olmayan hücreleri sıfırlar (yeniden çözüm öncesi).
 * unavailable günleri YI olarak yeniden işaretler.
 */
function resetForSolve(schedule: Schedule): void {
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= schedule.meta.daysInMonth; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) continue;
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
  const prev = schedule.cells[k] ?? 'OFF';
  state.hours[nurseId] -= shiftHoursOf(prev);
  if (prev === 'N24') state.nCount[nurseId]--;
  schedule.cells[k] = code;
  state.hours[nurseId] += shiftHoursOf(code);
  if (code === 'N24') state.nCount[nurseId]++;
}

function markPostNightRest(
  schedule: Schedule,
  nurseId: string,
  fromDay: number,
  rest: number,
): void {
  for (let r = 1; r <= rest; r++) {
    const d = fromDay + r;
    if (d > schedule.meta.daysInMonth) break;
    const k = cellKey(nurseId, d);
    if (schedule.pinned[k]) continue;
    const cur = schedule.cells[k];
    if (!cur || cur === 'OFF') schedule.cells[k] = 'NI';
  }
}

interface DayCounts {
  day: number;
  evening: number;
  night: number;
}

function countOnDay(schedule: Schedule, day: number): DayCounts {
  let dc = 0,
    ec = 0,
    nc = 0;
  for (const nurse of schedule.nurses) {
    const c = getCell(schedule, nurse.id, day);
    if (isDayCovering(c)) dc++;
    if (isEveningCovering(c)) ec++;
    if (isNightCovering(c)) nc++;
  }
  return { day: dc, evening: ec, night: nc };
}

/**
 * Günün adayları: pinned olmayan, çalışmaz vardiya (YI/RT/NI) atanmamış,
 * ve son `restAfterNight` günde N24 yapmamış hemşireler.
 */
function candidatesForDay(
  schedule: Schedule,
  day: number,
  rest: number,
  acceptOver: ReadonlySet<ShiftCode> = new Set(['OFF']),
): Nurse[] {
  const out: Nurse[] = [];
  for (const nurse of schedule.nurses) {
    const k = cellKey(nurse.id, day);
    if (schedule.pinned[k]) continue;
    const cur = schedule.cells[k];
    if (cur && !acceptOver.has(cur)) continue;
    if (nurseRecentlyOnNight(schedule, nurse.id, day, rest)) continue;
    out.push(nurse);
  }
  return out;
}

/** Düşük N sayısı + düşük saat skoruyla sıralar. */
function rankCandidates(candidates: Nurse[], state: ScoringState): Nurse[] {
  return [...candidates].sort((a, b) => {
    const dn = state.nCount[a.id] - state.nCount[b.id];
    if (dn !== 0) return dn;
    return state.hours[a.id] - state.hours[b.id];
  });
}

/**
 * Sezgisel çözüm: greedy forward + repair. Kullanıcının önceden kilitlediği
 * hücreleri ve izin günlerini korur.
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
    const reduceDay = isWeekend && constraints.weekendReduced;

    // 1) Gece kapsamasını tamamla (N24)
    let counts = countOnDay(schedule, d);
    let needNight = Math.max(0, constraints.minNightPresent - counts.night);
    if (needNight > 0) {
      const nightCands = rankCandidates(
        candidatesForDay(schedule, d, constraints.restAfterNight),
        state,
      );
      for (const nurse of nightCands) {
        if (needNight === 0) break;
        assignShift(schedule, state, nurse.id, d, 'N24');
        markPostNightRest(schedule, nurse.id, d, constraints.restAfterNight);
        needNight--;
      }
    }

    // 2) Gündüz kapsamasını tamamla (D8)
    if (!reduceDay) {
      counts = countOnDay(schedule, d);
      let needDay = Math.max(0, constraints.minDayPresent - counts.day);
      if (needDay > 0) {
        const dayCands = rankCandidates(
          candidatesForDay(schedule, d, constraints.restAfterNight),
          state,
        );
        for (const nurse of dayCands) {
          if (needDay === 0) break;
          assignShift(schedule, state, nurse.id, d, 'D8');
          needDay--;
        }
      }
    }

    // 3) Akşam kapsaması (E16) — opsiyonel, sadece minEveningPresent > 0 ise
    if (constraints.minEveningPresent > 0) {
      counts = countOnDay(schedule, d);
      let needEve = Math.max(0, constraints.minEveningPresent - counts.evening);
      if (needEve > 0) {
        const eveCands = rankCandidates(
          candidatesForDay(schedule, d, constraints.restAfterNight),
          state,
        );
        for (const nurse of eveCands) {
          if (needEve === 0) break;
          assignShift(schedule, state, nurse.id, d, 'E16');
          needEve--;
        }
      }
    }
  }

  // Repair pass — küçük bir düzeltme döngüsü
  const repairSteps = repairPass(schedule, state, 100);

  const issues = validate(schedule);
  const stats = computeStats(schedule);

  return { schedule, issues, stats, repairSteps, solver: 'greedy' };
}

function repairPass(schedule: Schedule, state: ScoringState, maxIter: number): number {
  let iter = 0;
  while (iter < maxIter) {
    const issues = validate(schedule);
    if (issues.length === 0) break;

    // Önce gece kapsama eksikliklerini gidermeye çalış
    const nightIssue = issues.find(
      (i) => i.kind === 'COVERAGE_NIGHT' && i.severity === 'error',
    );
    if (nightIssue) {
      const cands = rankCandidates(
        candidatesForDay(schedule, nightIssue.day, schedule.constraints.restAfterNight),
        state,
      );
      if (cands.length > 0) {
        assignShift(schedule, state, cands[0].id, nightIssue.day, 'N24');
        markPostNightRest(
          schedule,
          cands[0].id,
          nightIssue.day,
          schedule.constraints.restAfterNight,
        );
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
        assignShift(schedule, state, cands[0].id, dayIssue.day, 'D8');
        iter++;
        continue;
      }
    }

    // Çözülemeyen ihlal — döngüden çık
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

const ACTIVE_SHIFTS: readonly ShiftCode[] = ['D8', 'E16', 'N24'] as const;

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
 * ILP çözücü: glpk.js'in MILP motoruyla optimal (veya en azından
 * feasible) bir çizelge bulur. Amaç: en yüklü hemşirenin saat
 * sayısını minimize ederek adilliği sağlamak.
 *
 * @param input — başlangıç çizelgesi (pinned hücreler ve izinler korunur)
 * @param options — `tmlim` saniyesi varsayılan 30
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

  // 2. Aktif vardiya değişkenleri (binary)
  const binaries: string[] = [];
  const isAvailable = (nurseId: string, day: number): boolean => {
    const k = cellKey(nurseId, day);
    const cur = schedule.cells[k];
    if (schedule.pinned[k]) return false; // pinned hücre tamamen sabit
    if (cur === 'YI' || cur === 'RT') return false; // izin günü
    return true;
  };

  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      if (!isAvailable(nurse.id, d)) continue;
      for (const s of ACTIVE_SHIFTS) {
        binaries.push(varNameOf(nurse.id, d, s));
      }
    }
  }

  const glpk = await getGlpk();
  const subjectTo: LpRow[] = [];

  // 3. Tek aktif vardiya: x_D8 + x_E16 + x_N24 ≤ 1
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      if (!isAvailable(nurse.id, d)) continue;
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

  // 4. Pinned aktif hücreler — fixed = 1
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (!schedule.pinned[k]) continue;
      const c = schedule.cells[k];
      if (!isWorkingShift(c)) continue;
      const v = varNameOf(nurse.id, d, c);
      // Pinned hücreler binaries listesinde yok; ek değişken olarak ekleyelim
      if (!binaries.includes(v)) binaries.push(v);
      subjectTo.push({
        name: `pin_${nurse.id}_${d}`,
        vars: [{ name: v, coef: 1 }],
        bnds: { type: glpk.GLP_FX, ub: 1, lb: 1 },
      });
    }
  }

  // 5. Gündüz kapsama (hafta içi, weekendReduced=false ise hafta sonu da)
  for (let d = 1; d <= D; d++) {
    const reduceDay = weekendSet.has(d) && cons.weekendReduced;
    if (reduceDay) continue;
    const vars: LpVar[] = [];
    for (const nurse of schedule.nurses) {
      for (const s of ['D8', 'N24'] as ShiftCode[]) {
        const v = varNameOf(nurse.id, d, s);
        if (binaries.includes(v)) vars.push({ name: v, coef: 1 });
        // Pinned hücreler için sabit katkı
        const k = cellKey(nurse.id, d);
        if (schedule.pinned[k] && schedule.cells[k] === s && !vars.find((x) => x.name === v)) {
          vars.push({ name: v, coef: 1 });
        }
      }
    }
    if (vars.length === 0) continue;
    subjectTo.push({
      name: `day_${d}`,
      vars,
      bnds: { type: glpk.GLP_LO, ub: 0, lb: cons.minDayPresent },
    });
  }

  // 6. Akşam kapsama (opsiyonel)
  if (cons.minEveningPresent > 0) {
    for (let d = 1; d <= D; d++) {
      const vars: LpVar[] = [];
      for (const nurse of schedule.nurses) {
        for (const s of ['E16', 'N24'] as ShiftCode[]) {
          const v = varNameOf(nurse.id, d, s);
          if (binaries.includes(v)) vars.push({ name: v, coef: 1 });
        }
      }
      if (vars.length === 0) continue;
      subjectTo.push({
        name: `eve_${d}`,
        vars,
        bnds: { type: glpk.GLP_LO, ub: 0, lb: cons.minEveningPresent },
      });
    }
  }

  // 7. Gece kapsama
  const minNight = cons.allowSingleNight ? 1 : cons.minNightPresent;
  for (let d = 1; d <= D; d++) {
    const vars: LpVar[] = [];
    for (const nurse of schedule.nurses) {
      const v = varNameOf(nurse.id, d, 'N24');
      if (binaries.includes(v)) vars.push({ name: v, coef: 1 });
    }
    if (vars.length === 0) continue;
    subjectTo.push({
      name: `night_${d}`,
      vars,
      bnds: { type: glpk.GLP_LO, ub: 0, lb: minNight },
    });
  }

  // 8. Nöbet sonrası dinlenme: x[n,d,N24] + x[n,d',aktif] ≤ 1
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

  // 9. Adillik objektifi: Z ≥ saat_n her hemşire için
  // Z - 8*x_D8 - 8*x_E16 - 24*x_N24 ≥ 0  ⇔  -Z + 8*... ≤ 0
  // Pinned aktif vardiyaların saatleri sabit; sadece binary değişkenlere baktığımızdan
  // pinned hours değerini de pinned bir saatten çıkarıyoruz: maxhours kısıtının LB sabit kısmı.
  for (const nurse of schedule.nurses) {
    let pinnedHours = 0;
    const vars: LpVar[] = [{ name: 'Z', coef: -1 }];
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) {
        pinnedHours += shiftHoursOf(schedule.cells[k] ?? 'OFF');
        continue;
      }
      const v1 = varNameOf(nurse.id, d, 'D8');
      const v2 = varNameOf(nurse.id, d, 'E16');
      const v3 = varNameOf(nurse.id, d, 'N24');
      if (binaries.includes(v1)) vars.push({ name: v1, coef: 8 });
      if (binaries.includes(v2)) vars.push({ name: v2, coef: 8 });
      if (binaries.includes(v3)) vars.push({ name: v3, coef: 24 });
    }
    // Pinned saatleri sağ tarafa al: -Z + sum(coefs * x) ≤ -pinnedHours
    subjectTo.push({
      name: `maxhours_${nurse.id}`,
      vars,
      bnds: { type: glpk.GLP_UP, ub: -pinnedHours, lb: 0 },
    });
  }

  // 10. LP nesnesini kur ve çöz
  const lp = {
    name: 'nurse_schedule',
    objective: {
      direction: glpk.GLP_MIN,
      name: 'maxhours',
      vars: [{ name: 'Z', coef: 1 }],
    },
    subjectTo,
    bounds: [{ name: 'Z', type: glpk.GLP_LO, lb: 0, ub: 0 }],
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

  // 11. Sonucu schedule'a yaz
  // Önce non-pinned aktif hücreleri temizle (YI/RT korunur)
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) continue;
      const c = schedule.cells[k];
      if (c === 'YI' || c === 'RT') continue;
      delete schedule.cells[k];
    }
  }

  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      const k = cellKey(nurse.id, d);
      if (schedule.pinned[k]) continue;
      const c = schedule.cells[k];
      if (c === 'YI' || c === 'RT') continue;
      for (const s of ACTIVE_SHIFTS) {
        const v = varNameOf(nurse.id, d, s);
        if ((result.result.vars[v] ?? 0) > 0.5) {
          schedule.cells[k] = s;
          break;
        }
      }
    }
  }

  // 12. Post-N rest günleri NI işaretle
  for (const nurse of schedule.nurses) {
    for (let d = 1; d <= D; d++) {
      if (getCell(schedule, nurse.id, d) !== 'N24') continue;
      for (let r = 1; r <= cons.restAfterNight; r++) {
        if (d + r > D) break;
        const k = cellKey(nurse.id, d + r);
        if (schedule.pinned[k]) continue;
        const cur = schedule.cells[k];
        if (!cur || cur === 'OFF') schedule.cells[k] = 'NI';
      }
    }
  }

  const issues = validate(schedule);
  const stats = computeStats(schedule);

  return { schedule, issues, stats, repairSteps: 0, solver: 'ilp' };
}

/* ----------------------------------------------------------- Örnek üretici */

/** Bir araya getirilmiş örnek bir veri seti — UI'da "Örnek doldur" için. */
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
  // Birkaç örnek izin
  const meta = createMonthMeta(year, month);
  if (meta.daysInMonth >= 5) {
    nurses[0].unavailable = [5, 6];
    if (meta.daysInMonth >= 18) nurses[2].unavailable = [12, 13, 14];
    if (meta.daysInMonth >= 22) nurses[4].unavailable = [22];
  }
  return createEmptySchedule(year, month, nurses, DEFAULT_CONSTRAINTS);
}
