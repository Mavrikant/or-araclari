/**
 * Linear programming model parsing and solving via glpk.js (WASM).
 *
 * The parser accepts a textbook-style LP format in Turkish or English:
 *
 *     max 3x + 4y
 *     x + 2y <= 14
 *     3x - y >= 0
 *     x - y <= 2
 *
 * Lines starting with `#` or `//` are comments. The first non-empty,
 * non-comment line must declare the optimisation direction (max/min/maks/min)
 * followed by the objective expression. Subsequent lines are constraints
 * with a relation (<=, >=, =, ≤, ≥) and a numeric right-hand side.
 *
 * Variables that appear in any line are auto-discovered. By default every
 * variable is constrained to be >= 0 (the standard LP assumption); explicit
 * bounds in the form `x <= 5` or `x >= -3` override the default lower bound.
 *
 * The solver wrapper dynamically imports glpk.js so the ~600 KB WASM bundle
 * is only fetched the first time someone actually solves a problem.
 */

export const MAX_VARIABLES = 64;
export const MAX_CONSTRAINTS = 128;

export type LpDirection = 'max' | 'min';

export interface LpTerm {
  coef: number;
  variable: string;
}

export interface LpConstraint {
  /** Index in the original input (1-based, for diagnostics). */
  index: number;
  terms: LpTerm[];
  /** '<=' | '>=' | '=' */
  relation: '<=' | '>=' | '=';
  rhs: number;
  /** Original source line for error messages. */
  source: string;
}

export interface ParsedLp {
  direction: LpDirection;
  objective: LpTerm[];
  constraints: LpConstraint[];
  variables: string[];
}

export interface LpVariableValue {
  variable: string;
  value: number;
}

export type LpStatus =
  | 'optimal'
  | 'feasible'
  | 'infeasible'
  | 'no_feasible'
  | 'unbounded'
  | 'undefined';

export interface LpSolveResult {
  status: LpStatus;
  /** Optimal objective value (only meaningful when status is 'optimal'). */
  objectiveValue: number;
  variables: LpVariableValue[];
  /** Total wall time the solver took, in milliseconds. */
  solveTimeMs: number;
}

export class LpParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LpParseError';
  }
}

export class LpSolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LpSolveError';
  }
}

const VAR_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RELATION_RE = /(<=|>=|=|≤|≥)/;

function normaliseRelation(rel: string): '<=' | '>=' | '=' {
  if (rel === '≤') return '<=';
  if (rel === '≥') return '>=';
  if (rel === '<=' || rel === '>=' || rel === '=') return rel;
  throw new LpParseError(`Bilinmeyen ilişki operatörü: "${rel}".`);
}

function parseNumber(s: string, context: string): number {
  const cleaned = s.replace(/\s+/g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new LpParseError(`Geçersiz sayı (${context}): "${s.trim()}".`);
  }
  return n;
}

/**
 * Parse one side of an equation/inequality into [term, term, ...].
 * Each chunk is "<sign?><coef?><var>" — coefficient defaults to 1, sign
 * defaults to +. Multiplication operator `*` between coef and var is
 * tolerated but not required.
 */
function parseExpression(expr: string, context: string): LpTerm[] {
  let cleaned = expr.replace(/\s+/g, '');
  /* Normalise Turkish decimal commas inside numbers (1,5 → 1.5).
     Only inside numeric runs, not as a list separator. */
  cleaned = cleaned.replace(/(\d),(?=\d)/g, '$1.');
  if (cleaned.length === 0) {
    throw new LpParseError(`Boş ifade (${context}).`);
  }
  if (cleaned[0] !== '+' && cleaned[0] !== '-') cleaned = '+' + cleaned;

  /* Split on +/- while keeping the sign as part of each chunk. */
  const tokens: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let j = i + 1;
    while (j < cleaned.length && cleaned[j] !== '+' && cleaned[j] !== '-') j++;
    tokens.push(cleaned.slice(i, j));
    i = j;
  }

  const terms: LpTerm[] = [];
  for (const token of tokens) {
    const m = token.match(/^([+-])((?:\d+(?:\.\d*)?|\.\d+)?)\*?([A-Za-z_][A-Za-z0-9_]*)$/);
    if (!m) {
      throw new LpParseError(
        `Anlaşılmayan terim (${context}): "${token}". Beklenen biçim: "3x", "-2.5y", "+z".`,
      );
    }
    const [, sign, numStr, varName] = m;
    const magnitude = numStr === '' ? 1 : parseNumber(numStr, context);
    const coef = sign === '-' ? -magnitude : magnitude;
    terms.push({ coef, variable: varName });
  }
  return terms;
}

/**
 * Detect direction keyword at the start of a line. Accepts max/min in
 * Turkish (maks, maksimize, minimize, en büyük) and English forms.
 */
function parseDirectionLine(line: string): { direction: LpDirection; rest: string } | null {
  const m = line.match(/^(maks(?:imize)?|max(?:imize)?|min(?:imize)?|en\s+b[üu]y[üu]k|en\s+k[üu][cç][üu]k)\s*[:]?\s*(.+)$/i);
  if (!m) return null;
  const word = m[1].toLowerCase();
  const direction: LpDirection = /^(maks|max|en\s+b[üu]y[üu]k)/i.test(word) ? 'max' : 'min';
  return { direction, rest: m[2] };
}

export function parseLp(input: string): ParsedLp {
  const lines = input
    .split(/\r?\n/)
    .map((l, i) => ({ raw: l.trim(), index: i + 1 }))
    .filter((l) => l.raw.length > 0 && !l.raw.startsWith('#') && !l.raw.startsWith('//'));

  if (lines.length === 0) {
    throw new LpParseError('LP boş — en az bir hedef satırı gereklidir.');
  }

  const dirParse = parseDirectionLine(lines[0].raw);
  if (!dirParse) {
    throw new LpParseError(
      'İlk anlamlı satır "max" veya "min" ile başlamalıdır. Örn: "max 3x + 4y".',
    );
  }
  const { direction, rest } = dirParse;
  const objective = parseExpression(rest, `hedef satırı ${lines[0].index}`);

  const constraints: LpConstraint[] = [];
  for (let li = 1; li < lines.length; li++) {
    const { raw, index } = lines[li];
    /* Skip "subject to" / "s.t." / "öyle ki" markers. */
    if (/^(subject\s+to|s\.?\s*t\.?|kısıt|öyle\s+ki|where)\s*[:]?\s*$/i.test(raw)) continue;

    const relMatch = raw.match(RELATION_RE);
    if (!relMatch) {
      throw new LpParseError(
        `Satır ${index}: kısıt operatörü (<=, >=, =) bulunamadı. "${raw}".`,
      );
    }
    const relIdx = relMatch.index!;
    const lhs = raw.slice(0, relIdx);
    const relation = normaliseRelation(relMatch[0]);
    const rhsRaw = raw.slice(relIdx + relMatch[0].length);
    if (rhsRaw.trim().length === 0) {
      throw new LpParseError(`Satır ${index}: sağ taraf boş.`);
    }
    const terms = parseExpression(lhs, `satır ${index}`);
    const rhs = parseNumber(rhsRaw, `satır ${index} sağ taraf`);

    constraints.push({ index, terms, relation, rhs, source: raw });
  }

  /* Collect unique variables in their first-appearance order. */
  const seen = new Set<string>();
  const variables: string[] = [];
  for (const term of objective) {
    if (!VAR_RE.test(term.variable)) {
      throw new LpParseError(`Geçersiz değişken adı: "${term.variable}".`);
    }
    if (!seen.has(term.variable)) {
      seen.add(term.variable);
      variables.push(term.variable);
    }
  }
  for (const c of constraints) {
    for (const term of c.terms) {
      if (!VAR_RE.test(term.variable)) {
        throw new LpParseError(`Geçersiz değişken adı: "${term.variable}".`);
      }
      if (!seen.has(term.variable)) {
        seen.add(term.variable);
        variables.push(term.variable);
      }
    }
  }

  if (variables.length === 0) {
    throw new LpParseError('Hiçbir karar değişkeni bulunamadı.');
  }
  if (variables.length > MAX_VARIABLES) {
    throw new LpParseError(
      `Bu sürümde en fazla ${MAX_VARIABLES} değişken desteklenir (${variables.length} bulundu).`,
    );
  }
  if (constraints.length > MAX_CONSTRAINTS) {
    throw new LpParseError(
      `Bu sürümde en fazla ${MAX_CONSTRAINTS} kısıt desteklenir (${constraints.length} bulundu).`,
    );
  }

  return { direction, objective, constraints, variables };
}

/**
 * Cached glpk.js instance — created lazily on the first solve, reused for
 * subsequent solves so the WASM doesn't re-initialise every time.
 */
let glpkPromise: Promise<unknown> | null = null;

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
  solve(lp: unknown, options?: number | unknown): Promise<{
    result: { status: number; z: number; vars: Record<string, number> };
  }>;
}

async function getGlpk(): Promise<GlpkLike> {
  if (!glpkPromise) {
    glpkPromise = import('glpk.js').then((mod) =>
      (mod.default as () => Promise<GlpkLike>)(),
    );
  }
  return (await glpkPromise) as GlpkLike;
}

function relationToBnd(
  glpk: GlpkLike,
  relation: '<=' | '>=' | '=',
  rhs: number,
): { type: number; ub: number; lb: number } {
  if (relation === '<=') return { type: glpk.GLP_UP, ub: rhs, lb: 0 };
  if (relation === '>=') return { type: glpk.GLP_LO, ub: 0, lb: rhs };
  return { type: glpk.GLP_FX, ub: rhs, lb: rhs };
}

function statusToString(glpk: GlpkLike, status: number): LpStatus {
  if (status === glpk.GLP_OPT) return 'optimal';
  if (status === glpk.GLP_FEAS) return 'feasible';
  if (status === glpk.GLP_INFEAS) return 'infeasible';
  if (status === glpk.GLP_NOFEAS) return 'no_feasible';
  if (status === glpk.GLP_UNBND) return 'unbounded';
  return 'undefined';
}

export async function solveLp(parsed: ParsedLp): Promise<LpSolveResult> {
  const glpk = await getGlpk();
  const t0 = performance.now();

  const lp = {
    name: 'lp',
    objective: {
      direction: parsed.direction === 'max' ? glpk.GLP_MAX : glpk.GLP_MIN,
      name: 'obj',
      vars: parsed.objective.map((t) => ({ name: t.variable, coef: t.coef })),
    },
    subjectTo: parsed.constraints.map((c) => ({
      name: `c${c.index}`,
      vars: c.terms.map((t) => ({ name: t.variable, coef: t.coef })),
      bnds: relationToBnd(glpk, c.relation, c.rhs),
    })),
    bounds: parsed.variables.map((v) => ({
      name: v,
      type: glpk.GLP_LO,
      lb: 0,
      ub: 0,
    })),
  };

  let result;
  try {
    result = await glpk.solve(lp, glpk.GLP_MSG_OFF);
  } catch (err) {
    throw new LpSolveError(
      `Çözücü hata verdi: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const elapsed = performance.now() - t0;

  const status = statusToString(glpk, result.result.status);
  const variables: LpVariableValue[] = parsed.variables.map((v) => ({
    variable: v,
    value: result.result.vars[v] ?? 0,
  }));

  return {
    status,
    objectiveValue: result.result.z,
    variables,
    solveTimeMs: Math.round(elapsed),
  };
}
