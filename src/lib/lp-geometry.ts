/**
 * Geometric primitives for visualising 2-variable linear programs.
 *
 * The LP graphical method works in (x, y) space: each constraint
 * `a*x + b*y {<=,>=,=} c` becomes a half-plane (or line for `=`),
 * the feasible region is the intersection of all half-planes, and the
 * optimum sits at one of the polygon's vertices.
 *
 * This module is UI-free: it only computes points and feasibility.
 * The .astro renderer translates the resulting polygon into SVG.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface LineEquation {
  /** Coefficient of x. */
  a: number;
  /** Coefficient of y. */
  b: number;
  /** Right-hand side: a*x + b*y {relation} c. */
  c: number;
  relation: '<=' | '>=' | '=';
}

const DEFAULT_EPS = 1e-7;

/** Collapse -0 / tiny float noise to a positive zero so equality and
 *  formatting downstream behave predictably. */
function snapZero(n: number, eps: number = 1e-10): number {
  return Math.abs(n) < eps ? 0 : n;
}

/**
 * Solve a 2x2 linear system using Cramer's rule:
 *   a1*x + b1*y = c1
 *   a2*x + b2*y = c2
 * Returns null if the lines are parallel (determinant ≈ 0), including
 * the degenerate case of identical lines (no unique intersection).
 */
export function intersect(
  l1: LineEquation,
  l2: LineEquation,
  eps: number = DEFAULT_EPS,
): Point2D | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < eps) return null;
  const x = (l1.c * l2.b - l2.c * l1.b) / det;
  const y = (l1.a * l2.c - l2.a * l1.c) / det;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: snapZero(x), y: snapZero(y) };
}

/** Returns true when the point satisfies a single constraint within tolerance. */
export function satisfies(
  p: Point2D,
  line: LineEquation,
  eps: number = DEFAULT_EPS,
): boolean {
  const lhs = line.a * p.x + line.b * p.y;
  if (line.relation === '<=') return lhs <= line.c + eps;
  if (line.relation === '>=') return lhs >= line.c - eps;
  return Math.abs(lhs - line.c) <= eps;
}

/** Returns true when the point satisfies every constraint within tolerance. */
export function isFeasible(
  p: Point2D,
  constraints: LineEquation[],
  eps: number = DEFAULT_EPS,
): boolean {
  for (const c of constraints) {
    if (!satisfies(p, c, eps)) return false;
  }
  return true;
}

/**
 * Enumerate every candidate vertex: pairwise intersections of the supplied
 * lines (treating each constraint as an equality regardless of relation).
 *
 * Note: the caller is expected to include axis lines (x=0, y=0) in the
 * constraint list when default non-negativity bounds apply, so this
 * function does not implicitly add them.
 */
export function candidateVertices(
  constraints: LineEquation[],
  eps: number = DEFAULT_EPS,
): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const p = intersect(constraints[i], constraints[j], eps);
      if (p) points.push(p);
    }
  }
  return points;
}

/** Centroid of a non-empty point set; used as the polygon's anchor. */
function centroid(points: Point2D[]): Point2D {
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/** Deduplicate points within the given tolerance. */
function dedupe(points: Point2D[], eps: number): Point2D[] {
  const out: Point2D[] = [];
  for (const p of points) {
    let dup = false;
    for (const q of out) {
      if (Math.abs(p.x - q.x) <= eps && Math.abs(p.y - q.y) <= eps) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(p);
  }
  return out;
}

/**
 * Compute the feasible-region polygon for a 2-variable LP.
 * - Generates candidate vertices from every pair of constraint lines.
 * - Filters down to vertices that satisfy every constraint.
 * - Sorts the survivors counter-clockwise around their centroid so they
 *   form a valid closed polygon for `<polygon>` rendering.
 *
 * Returns an empty array when the feasible region is empty or degenerate.
 */
export function feasibleRegion(
  constraints: LineEquation[],
  eps: number = DEFAULT_EPS,
): Point2D[] {
  if (constraints.length < 2) return [];
  const candidates = candidateVertices(constraints, eps);
  const feasible = candidates.filter((p) => isFeasible(p, constraints, eps));
  const unique = dedupe(feasible, eps * 100);
  if (unique.length < 3) return unique;
  const c = centroid(unique);
  return [...unique].sort(
    (p, q) => Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(q.y - c.y, q.x - c.x),
  );
}

/** Evaluate the linear objective ax + by at a point. */
export function objectiveAt(
  p: Point2D,
  obj: { x: number; y: number },
): number {
  return obj.x * p.x + obj.y * p.y;
}

/**
 * For a `<= / >= / =` constraint, return a point clearly on the *inside*
 * of the half-plane. Used by the renderer to decide which side of a
 * constraint line to shade.
 */
export function interiorTestPoint(line: LineEquation, distance: number): Point2D {
  /* Pick a point at the given distance from the line, on the satisfying side.
     Equality constraints have no interior — returning the line foot is fine. */
  const norm = Math.hypot(line.a, line.b) || 1;
  const nx = line.a / norm;
  const ny = line.b / norm;
  const sign = line.relation === '>=' ? 1 : line.relation === '<=' ? -1 : 0;
  /* A point on the line: project origin. */
  const t = line.c / (line.a * line.a + line.b * line.b || 1);
  const foot = { x: line.a * t, y: line.b * t };
  return {
    x: foot.x + sign * nx * distance,
    y: foot.y + sign * ny * distance,
  };
}
