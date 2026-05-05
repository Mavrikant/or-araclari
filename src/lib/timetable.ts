/**
 * Simple timetabling solver using backtracking with forward checking.
 *
 * Input: a list of lessons (each requiring a teacher and assigned to a
 * student group) and a number of time slots per week. The solver assigns
 * each lesson to a time slot such that no teacher and no student group has
 * two simultaneous lessons.
 *
 * This is a deliberately simple constraint satisfaction problem; it
 * supports basic cases well but does not handle room capacities or
 * preferred slots. For richer requirements see Google OR-Tools CP-SAT.
 *
 * Pure: no DOM, no I/O.
 */

export const MIN_LESSONS = 1;
export const MAX_LESSONS = 60;
export const MAX_SLOTS = 60;

export interface Lesson {
  /** Display label (e.g. "Matematik 9-A"). */
  label: string;
  /** Single string identifying the teacher (group key). */
  teacher: string;
  /** Single string identifying the student group (e.g. class section). */
  group: string;
}

export interface TimetableInput {
  lessons: ReadonlyArray<Lesson>;
  /** Total number of time slots per week (e.g. 5 days × 6 = 30). */
  slots: number;
  /** Optional human label for each slot (e.g. "Pzt 1", "Pzt 2", ...). */
  slotLabels?: ReadonlyArray<string>;
}

export interface TimetableAssignment {
  lesson: Lesson;
  slot: number;
  slotLabel?: string;
}

export interface TimetableResult {
  assignments: TimetableAssignment[];
  slots: number;
  feasible: true;
}

export class TimetableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimetableError';
  }
}

function validate(input: TimetableInput): void {
  if (input.lessons.length < MIN_LESSONS) {
    throw new TimetableError('En az bir ders gereklidir.');
  }
  if (input.lessons.length > MAX_LESSONS) {
    throw new TimetableError(
      `Bu sürümde en fazla ${MAX_LESSONS} ders desteklenir (${input.lessons.length} verildi).`,
    );
  }
  if (!Number.isInteger(input.slots) || input.slots < 1 || input.slots > MAX_SLOTS) {
    throw new TimetableError(
      `Slot sayısı 1 ile ${MAX_SLOTS} arasında bir tamsayı olmalı.`,
    );
  }
  for (const l of input.lessons) {
    if (!l.label || !l.teacher || !l.group) {
      throw new TimetableError('Her ders bir etiket, öğretmen ve grup içermelidir.');
    }
  }
  if (input.slotLabels && input.slotLabels.length !== input.slots) {
    throw new TimetableError(
      `Slot etiketi sayısı (${input.slotLabels.length}) slot sayısına (${input.slots}) eşit olmalı.`,
    );
  }
}

/**
 * Backtracking with the **most-constrained-variable** heuristic: at each
 * step, pick the lesson with the fewest remaining valid slots. This keeps
 * the search tree narrow and dramatically speeds up most realistic inputs.
 */
export function solveTimetable(input: TimetableInput): TimetableResult {
  validate(input);

  const lessons = input.lessons;
  const slots = input.slots;
  const n = lessons.length;

  // For each lesson, compute initial domain (valid slots — initially all).
  const domains: Set<number>[] = lessons.map(() => {
    const d = new Set<number>();
    for (let s = 0; s < slots; s++) d.add(s);
    return d;
  });

  const assignment = new Array<number>(n).fill(-1);

  // Group lessons by teacher and by student group for fast conflict checks.
  const byTeacher = new Map<string, number[]>();
  const byGroup = new Map<string, number[]>();
  lessons.forEach((l, i) => {
    if (!byTeacher.has(l.teacher)) byTeacher.set(l.teacher, []);
    byTeacher.get(l.teacher)!.push(i);
    if (!byGroup.has(l.group)) byGroup.set(l.group, []);
    byGroup.get(l.group)!.push(i);
  });

  // Quick infeasibility check: if any teacher has more lessons than slots,
  // or any group does, no schedule exists.
  for (const [teacher, idxs] of byTeacher) {
    if (idxs.length > slots) {
      throw new TimetableError(
        `Öğretmen "${teacher}" ${idxs.length} derse sahip ama yalnızca ${slots} slot var. Çakışmasız atama imkansız.`,
      );
    }
  }
  for (const [group, idxs] of byGroup) {
    if (idxs.length > slots) {
      throw new TimetableError(
        `Grup "${group}" ${idxs.length} derse sahip ama yalnızca ${slots} slot var. Çakışmasız atama imkansız.`,
      );
    }
  }

  let safety = 0;
  const maxSafety = 1_000_000;

  function backtrack(): boolean {
    if (safety++ > maxSafety) {
      throw new TimetableError(
        'Geri-izleme aşırı uzadı. Problemin çakışma olmadan çözülebilir olduğundan emin ol.',
      );
    }

    // Pick the unassigned lesson with the smallest remaining domain.
    let pickIdx = -1;
    let minDomain = Infinity;
    for (let i = 0; i < n; i++) {
      if (assignment[i] !== -1) continue;
      const dSize = domains[i].size;
      if (dSize === 0) return false; // dead end
      if (dSize < minDomain) {
        minDomain = dSize;
        pickIdx = i;
      }
    }
    if (pickIdx === -1) return true; // all assigned

    // Try each value in the domain.
    const valuesToTry = [...domains[pickIdx]];
    for (const slot of valuesToTry) {
      // Check teacher and group conflicts.
      const teacherConflict = byTeacher.get(lessons[pickIdx].teacher)!.some(
        (i) => i !== pickIdx && assignment[i] === slot,
      );
      if (teacherConflict) continue;
      const groupConflict = byGroup.get(lessons[pickIdx].group)!.some(
        (i) => i !== pickIdx && assignment[i] === slot,
      );
      if (groupConflict) continue;

      assignment[pickIdx] = slot;

      // Forward-check: temporarily remove this slot from any conflicting peer.
      const removed: Array<{ peer: number; slot: number }> = [];
      const teacherPeers = byTeacher.get(lessons[pickIdx].teacher)!;
      const groupPeers = byGroup.get(lessons[pickIdx].group)!;
      const peers = new Set([...teacherPeers, ...groupPeers]);
      peers.delete(pickIdx);
      for (const p of peers) {
        if (assignment[p] === -1 && domains[p].has(slot)) {
          domains[p].delete(slot);
          removed.push({ peer: p, slot });
        }
      }

      if (backtrack()) return true;

      // Undo.
      for (const { peer, slot: s } of removed) domains[peer].add(s);
      assignment[pickIdx] = -1;
    }

    return false;
  }

  const ok = backtrack();
  if (!ok) {
    throw new TimetableError(
      'Bu kısıtlarla çakışmasız bir program bulunamadı. Slot sayısını artırmayı veya çakışan öğretmen/grup atamalarını gözden geçirmeyi dene.',
    );
  }

  const assignments: TimetableAssignment[] = lessons.map((lesson, i) => ({
    lesson,
    slot: assignment[i],
    ...(input.slotLabels ? { slotLabel: input.slotLabels[assignment[i]] } : {}),
  }));

  return { assignments, slots, feasible: true };
}

/**
 * Parse "label<TAB>teacher<TAB>group" lines into Lesson objects.
 */
export function parseLessons(input: string): Lesson[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line, idx) => {
    const cells = line.split(/[\t;]+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3) {
      throw new TimetableError(
        `Satır ${idx + 1}: "ders<TAB>öğretmen<TAB>grup" biçimi gerekli (${cells.length} alan).`,
      );
    }
    return { label: cells[0], teacher: cells[1], group: cells[2] };
  });
}
