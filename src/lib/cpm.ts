/**
 * Critical Path Method (CPM) — forward/backward pass on an activity DAG.
 *
 * Activities have a duration and a list of predecessor IDs. The solver
 * topologically sorts the DAG, runs the forward pass to compute earliest
 * start/finish times, then the backward pass to compute latest start/finish
 * times, then the per-activity slack. Activities with zero slack form
 * the critical path; project duration is the maximum EF.
 *
 * Pure: no DOM, no I/O.
 */

export const MAX_ACTIVITIES = 100;

export interface Activity {
  /** Unique identifier (e.g. "A", "1", "DESIGN"). Case-sensitive. */
  id: string;
  /** Display label; defaults to id if not provided. */
  label?: string;
  /** Duration in arbitrary time units (days, weeks, hours). */
  duration: number;
  /** IDs of activities that must finish before this one can start. */
  predecessors: string[];
}

export interface CpmActivity {
  id: string;
  label: string;
  duration: number;
  predecessors: string[];
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  critical: boolean;
}

export interface CpmResult {
  activities: CpmActivity[];
  /** Project duration (max EF across all activities). */
  projectDuration: number;
  /** Sequence of activity IDs forming one critical path (multiple paths may exist; one is returned). */
  criticalPath: string[];
}

export class CpmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CpmError';
  }
}

function validate(activities: ReadonlyArray<Activity>): void {
  if (activities.length === 0) {
    throw new CpmError('En az bir aktivite gereklidir.');
  }
  if (activities.length > MAX_ACTIVITIES) {
    throw new CpmError(
      `Bu sürümde en fazla ${MAX_ACTIVITIES} aktivite desteklenir (${activities.length} verildi).`,
    );
  }
  const ids = new Set<string>();
  for (const a of activities) {
    if (!a.id || typeof a.id !== 'string') {
      throw new CpmError('Her aktivitenin geçerli bir id\'si olmalıdır.');
    }
    if (ids.has(a.id)) {
      throw new CpmError(`Tekrar eden aktivite id'si: "${a.id}".`);
    }
    ids.add(a.id);
    if (typeof a.duration !== 'number' || !Number.isFinite(a.duration) || a.duration < 0) {
      throw new CpmError(`"${a.id}" süresi 0 veya pozitif bir sayı olmalı (${a.duration} verildi).`);
    }
  }
  for (const a of activities) {
    for (const p of a.predecessors) {
      if (!ids.has(p)) {
        throw new CpmError(
          `"${a.id}" aktivitesinin önceli "${p}" listede bulunamadı.`,
        );
      }
      if (p === a.id) {
        throw new CpmError(`"${a.id}" kendisini öncel olarak gösteremez.`);
      }
    }
  }
}

/**
 * Standard Kahn's algorithm topological sort. Throws if a cycle exists.
 */
function topoSort(activities: ReadonlyArray<Activity>): string[] {
  const inDegree = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const a of activities) {
    inDegree.set(a.id, (inDegree.get(a.id) ?? 0) + a.predecessors.length);
    if (!successors.has(a.id)) successors.set(a.id, []);
    for (const p of a.predecessors) {
      if (!successors.has(p)) successors.set(p, []);
      successors.get(p)!.push(a.id);
    }
  }
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      const newDeg = (inDegree.get(s) ?? 0) - 1;
      inDegree.set(s, newDeg);
      if (newDeg === 0) queue.push(s);
    }
  }
  if (order.length !== activities.length) {
    throw new CpmError(
      'Aktivite ağında döngü tespit edildi. Önceller bir DAG (yönlü çevrimsiz graf) oluşturmalıdır.',
    );
  }
  return order;
}

export function solveCpm(activities: ReadonlyArray<Activity>): CpmResult {
  validate(activities);

  const order = topoSort(activities);
  const byId = new Map(activities.map((a) => [a.id, a]));
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();
  const LS = new Map<string, number>();
  const LF = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const a of activities) {
    successors.set(a.id, []);
  }
  for (const a of activities) {
    for (const p of a.predecessors) {
      successors.get(p)!.push(a.id);
    }
  }

  /* Forward pass */
  for (const id of order) {
    const a = byId.get(id)!;
    const es = a.predecessors.length === 0
      ? 0
      : Math.max(...a.predecessors.map((p) => EF.get(p)!));
    ES.set(id, es);
    EF.set(id, es + a.duration);
  }

  const projectDuration = Math.max(...EF.values());

  /* Backward pass */
  for (const id of [...order].reverse()) {
    const a = byId.get(id)!;
    const succ = successors.get(id)!;
    const lf = succ.length === 0
      ? projectDuration
      : Math.min(...succ.map((s) => LS.get(s)!));
    LF.set(id, lf);
    LS.set(id, lf - a.duration);
  }

  /* Build result list in topological order */
  const result: CpmActivity[] = order.map((id) => {
    const a = byId.get(id)!;
    const slack = LS.get(id)! - ES.get(id)!;
    return {
      id,
      label: a.label ?? id,
      duration: a.duration,
      predecessors: a.predecessors.slice(),
      earlyStart: ES.get(id)!,
      earlyFinish: EF.get(id)!,
      lateStart: LS.get(id)!,
      lateFinish: LF.get(id)!,
      slack,
      critical: Math.abs(slack) < 1e-9,
    };
  });

  /* Walk one critical path: start with the earliest critical activity that
     has no critical predecessor; follow critical successors. */
  const criticalIds = new Set(result.filter((a) => a.critical).map((a) => a.id));
  const criticalPath: string[] = [];
  let current = result.find(
    (a) => a.critical && !a.predecessors.some((p) => criticalIds.has(p)),
  );
  while (current) {
    criticalPath.push(current.id);
    const next = (successors.get(current.id) ?? []).find((s) =>
      criticalIds.has(s),
    );
    current = next ? result.find((a) => a.id === next) : undefined;
  }

  return { activities: result, projectDuration, criticalPath };
}
