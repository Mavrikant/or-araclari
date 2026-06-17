/**
 * En kısa yol (shortest path) çözümü — Dijkstra ve Bellman-Ford algoritmaları.
 *
 * Klasik problem: yönlü ağırlıklı bir ağda (V düğüm, E kenar, kaynak s)
 * s'den her düğüme ulaşan minimum toplam ağırlıklı yolu bul. Ağırlıklar
 * w(u, v) maliyet/uzaklık/süre olabilir.
 *
 * İki algoritma:
 *   - **Dijkstra** — tüm ağırlıklar ≥ 0 olduğunda doğrudur; binary heap
 *     ile O((V + E) · log V). Negatif ağırlık varsa SONUÇ YANLIŞ
 *     olabilir, bu yüzden algoritma seçimi otomatiktir: negatif ağırlık
 *     görülürse Bellman-Ford'a düşülür (algorithm = "auto" modu).
 *   - **Bellman-Ford** — negatif ağırlığa izin verir, O(V · E). V − 1
 *     iterasyon ile tüm en kısa yolları bulur; V'inci iterasyonda hâlâ
 *     gevşetme olursa erişilebilir bir **negatif çevrim** vardır
 *     (shortest path tanımsız → kullanıcıya rapor edilir).
 *
 * Çıktı: her düğüm için (1) kaynaktan uzaklık, (2) önceki düğüm
 * (predecessor) pointer'ı ile yol rekonstrüksiyonu, (3) ulaşılabilir
 * mi flag'i. Hedef düğüm verildiyse o düğüme giden tam yol da döner.
 *
 * Pure: no DOM, no I/O.
 */

export interface ShortestPathEdge {
  /** Kaynak düğüm adı. */
  from: string;
  /** Hedef düğüm adı. */
  to: string;
  /** Ağırlık w(u, v) — Dijkstra için ≥ 0 olmalı, Bellman-Ford keyfi. */
  weight: number;
}

export type ShortestPathAlgorithm = 'dijkstra' | 'bellman-ford' | 'auto';

export interface ShortestPathInput {
  edges: ShortestPathEdge[];
  source: string;
  /** Opsiyonel hedef düğüm — verilirse o düğüme giden tam yol döner. */
  target?: string;
  /**
   * "auto" (varsayılan): negatif ağırlık varsa Bellman-Ford, yoksa
   * Dijkstra. "dijkstra" / "bellman-ford" ile zorla seçim yapılabilir;
   * Dijkstra negatif ağırlıkla çağrılırsa hata döndürür.
   */
  algorithm?: ShortestPathAlgorithm;
}

export interface NodeResult {
  /** Düğüm adı. */
  node: string;
  /** Kaynaktan uzaklık. Erişilemezse Infinity. */
  distance: number;
  /** Önceki düğüm adı (yol rekonstrüksiyonu için). Kaynak için null. */
  predecessor: string | null;
  /** Bu düğüm kaynaktan erişilebilir mi? */
  reachable: boolean;
}

export interface PathStep {
  /** Yol adımının başlangıç düğümü. */
  from: string;
  /** Yol adımının bitiş düğümü. */
  to: string;
  /** Bu kenardaki ağırlık. */
  weight: number;
  /** Yol başından bu kenarın bitişine kadar birikmiş toplam uzaklık. */
  cumulative: number;
}

export interface ShortestPathResult {
  /** Hangi algoritma çalıştı (auto modunda otomatik seçildi). */
  algorithm: 'dijkstra' | 'bellman-ford';
  /** Her düğüm için (uzaklık, predecessor, erişilebilirlik). */
  nodes: NodeResult[];
  /** Hedef verilmişse o düğüme giden yol — adım adım kenarlar. */
  targetPath: PathStep[] | null;
  /** Hedef verilmişse uzaklığı. Erişilemezse Infinity. null = hedef verilmedi. */
  targetDistance: number | null;
  /**
   * Bellman-Ford negatif çevrim tespit ederse true. true olursa nodes
   * dizisindeki uzaklıklar güvenilir değildir — kullanıcıya raporla.
   */
  hasNegativeCycle: boolean;
  /**
   * Negatif çevrim varsa, çevrimde yer alan düğümlerin bir örneği.
   * Boş dizi: çevrim yok.
   */
  negativeCycleNodes: string[];
  /** Algoritma toplam iterasyon/relaxation sayısı (debug/eğitim için). */
  iterations: number;
}

export class ShortestPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShortestPathError';
  }
}

const MAX_NODES = 500;
const MAX_EDGES = 2000;

function validate(input: ShortestPathInput): void {
  if (!Array.isArray(input.edges) || input.edges.length === 0) {
    throw new ShortestPathError('En az bir kenar gerekli.');
  }
  if (input.edges.length > MAX_EDGES) {
    throw new ShortestPathError(
      `Kenar sayısı en fazla ${MAX_EDGES} olabilir (${input.edges.length} verildi).`,
    );
  }
  if (typeof input.source !== 'string' || input.source.length === 0) {
    throw new ShortestPathError('Kaynak (source) düğüm adı gerekli.');
  }
  if (input.target !== undefined && input.target !== '' && input.source === input.target) {
    throw new ShortestPathError('Kaynak ve hedef aynı düğüm olamaz.');
  }
  for (let i = 0; i < input.edges.length; i++) {
    const e = input.edges[i];
    if (!e.from || !e.to) {
      throw new ShortestPathError(`Kenar ${i + 1}: from ve to dolu olmalı.`);
    }
    if (e.from === e.to) {
      throw new ShortestPathError(
        `Kenar ${i + 1}: self-loop (${e.from} → ${e.to}) desteklenmiyor.`,
      );
    }
    if (typeof e.weight !== 'number' || !Number.isFinite(e.weight)) {
      throw new ShortestPathError(
        `Kenar ${i + 1} (${e.from} → ${e.to}): ağırlık sonlu bir sayı olmalı (${e.weight} verildi).`,
      );
    }
  }
}

interface InternState {
  indexOf: Map<string, number>;
  nodes: string[];
  intern: (name: string) => number;
}

function makeIntern(): InternState {
  const indexOf = new Map<string, number>();
  const nodes: string[] = [];
  const intern = (name: string): number => {
    let id = indexOf.get(name);
    if (id !== undefined) return id;
    if (nodes.length >= MAX_NODES) {
      throw new ShortestPathError(`Düğüm sayısı en fazla ${MAX_NODES} olabilir.`);
    }
    id = nodes.length;
    nodes.push(name);
    indexOf.set(name, id);
    return id;
  };
  return { indexOf, nodes, intern };
}

interface AdjEdge {
  to: number;
  weight: number;
}

/**
 * İkili (binary) min-heap — anahtar: (distance, nodeId). Dijkstra'nın
 * frontier'ı; klasik decrease-key yerine "lazy deletion" stratejisi:
 * aynı düğüm için daha eski (büyük) bir mesafe heap'te kalabilir, pop
 * edildiğinde dist[u] ile karşılaştırıp atlanır.
 */
class MinHeap {
  private heap: Array<{ dist: number; node: number }> = [];

  size(): number {
    return this.heap.length;
  }

  push(dist: number, node: number): void {
    this.heap.push({ dist, node });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { dist: number; node: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    const h = this.heap;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (h[parent].dist <= h[i].dist) break;
      [h[parent], h[i]] = [h[i], h[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const h = this.heap;
    const n = h.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && h[l].dist < h[smallest].dist) smallest = l;
      if (r < n && h[r].dist < h[smallest].dist) smallest = r;
      if (smallest === i) break;
      [h[smallest], h[i]] = [h[i], h[smallest]];
      i = smallest;
    }
  }
}

interface PreparedGraph {
  n: number;
  nodes: string[];
  sourceIdx: number;
  targetIdx: number;
  /** Komşuluk listesi (Dijkstra için). */
  adj: AdjEdge[][];
  /** Düz kenar listesi indeksli (Bellman-Ford için). */
  edgeList: Array<{ u: number; v: number; w: number }>;
  hasNegativeEdge: boolean;
}

function prepareGraph(input: ShortestPathInput): PreparedGraph {
  const state = makeIntern();
  const sourceIdx = state.intern(input.source);
  let targetIdx = -1;
  if (input.target !== undefined && input.target !== '') {
    targetIdx = state.intern(input.target);
  }
  for (const e of input.edges) {
    state.intern(e.from);
    state.intern(e.to);
  }

  const n = state.nodes.length;
  const adj: AdjEdge[][] = Array.from({ length: n }, () => []);
  const edgeList: Array<{ u: number; v: number; w: number }> = [];
  let hasNegativeEdge = false;
  for (const e of input.edges) {
    const u = state.indexOf.get(e.from)!;
    const v = state.indexOf.get(e.to)!;
    adj[u].push({ to: v, weight: e.weight });
    edgeList.push({ u, v, w: e.weight });
    if (e.weight < 0) hasNegativeEdge = true;
  }
  return {
    n,
    nodes: state.nodes,
    sourceIdx,
    targetIdx,
    adj,
    edgeList,
    hasNegativeEdge,
  };
}

function reconstructPath(
  graph: PreparedGraph,
  pred: Int32Array,
  dist: Float64Array,
  targetIdx: number,
): PathStep[] | null {
  if (targetIdx < 0 || dist[targetIdx] === Infinity) return null;
  /* Source = target durumu validation'da yakalanır; burada geliriz garanti. */
  const path: number[] = [];
  let cur = targetIdx;
  let safety = graph.n + 1;
  while (cur !== graph.sourceIdx) {
    if (safety-- <= 0) return null; /* Korumalı — predecessor zinciri kopuk. */
    path.push(cur);
    const p = pred[cur];
    if (p === -1) return null;
    cur = p;
  }
  path.push(graph.sourceIdx);
  path.reverse();
  /* Yolu PathStep[] olarak inşa et — her adım = (path[i], path[i+1]). */
  const steps: PathStep[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const u = path[i];
    const v = path[i + 1];
    /* (u, v) kenarının ağırlığını bul — paralel kenarlardan en küçüğü kullanıldı. */
    let w = Infinity;
    for (const e of graph.adj[u]) {
      if (e.to === v && e.weight < w) w = e.weight;
    }
    steps.push({
      from: graph.nodes[u],
      to: graph.nodes[v],
      weight: w,
      cumulative: dist[v],
    });
  }
  return steps;
}

function buildNodeResults(graph: PreparedGraph, dist: Float64Array, pred: Int32Array): NodeResult[] {
  const out: NodeResult[] = [];
  for (let i = 0; i < graph.n; i++) {
    const reachable = dist[i] !== Infinity;
    out.push({
      node: graph.nodes[i],
      distance: dist[i],
      predecessor: pred[i] === -1 ? null : graph.nodes[pred[i]],
      reachable,
    });
  }
  return out;
}

/**
 * Dijkstra — tüm ağırlıklar ≥ 0 varsayar. Binary heap + lazy delete.
 *
 * Adım: kaynak dist = 0; heap'ten (en küçük dist, u) çek; relax(u → v)
 * her komşu için. Settled küme tutmak yerine "pop edildiğinde stale
 * mı?" kontrolü ile aynı node için heap'te kalmış eski kayıtları atla.
 */
function dijkstra(graph: PreparedGraph): {
  dist: Float64Array;
  pred: Int32Array;
  iterations: number;
} {
  if (graph.hasNegativeEdge) {
    throw new ShortestPathError(
      "Dijkstra negatif ağırlık kabul etmez — 'bellman-ford' ya da 'auto' seçeneğini kullanın.",
    );
  }
  const n = graph.n;
  const dist = new Float64Array(n).fill(Infinity);
  const pred = new Int32Array(n).fill(-1);
  dist[graph.sourceIdx] = 0;
  const heap = new MinHeap();
  heap.push(0, graph.sourceIdx);
  let iterations = 0;
  while (heap.size() > 0) {
    const top = heap.pop()!;
    const u = top.node;
    /* Lazy delete — heap'teki eski kayıt. */
    if (top.dist > dist[u]) continue;
    iterations++;
    for (const e of graph.adj[u]) {
      const nd = dist[u] + e.weight;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        pred[e.to] = u;
        heap.push(nd, e.to);
      }
    }
  }
  return { dist, pred, iterations };
}

/**
 * Bellman-Ford — V − 1 tam relax pass; V'inci pass'te hâlâ değişim
 * olursa erişilebilir bir negatif çevrim vardır.
 *
 * Erken çıkış: bir pass'te hiçbir gevşetme olmazsa algoritma yakınsadı.
 * Negatif çevrim varsa V'inci pass'te değişen bir düğümden V kez
 * predecessor'ı takip ederek çevrimde olduğu garantili bir düğüm bulunur.
 */
function bellmanFord(graph: PreparedGraph): {
  dist: Float64Array;
  pred: Int32Array;
  iterations: number;
  negativeCycleNodes: string[];
} {
  const n = graph.n;
  const dist = new Float64Array(n).fill(Infinity);
  const pred = new Int32Array(n).fill(-1);
  dist[graph.sourceIdx] = 0;
  let iterations = 0;
  let changedThisPass = true;
  /* V − 1 pass — değişim durursa erken çık. */
  for (let pass = 0; pass < n - 1 && changedThisPass; pass++) {
    changedThisPass = false;
    iterations++;
    for (const { u, v, w } of graph.edgeList) {
      if (dist[u] === Infinity) continue;
      const nd = dist[u] + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        pred[v] = u;
        changedThisPass = true;
      }
    }
  }
  /* V'inci pass — değişim olursa negatif çevrim var. */
  const negativeCycleNodes: string[] = [];
  if (changedThisPass) {
    /* Bir kez daha gevşet ve hangi düğümlerin değiştiğini izle. */
    let cycleSeed = -1;
    for (const { u, v, w } of graph.edgeList) {
      if (dist[u] === Infinity) continue;
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        pred[v] = u;
        cycleSeed = v;
      }
    }
    iterations++;
    if (cycleSeed !== -1) {
      /* cycleSeed'in çevrim üzerinde olduğunu garantilemek için V kez geri git. */
      let cur = cycleSeed;
      for (let i = 0; i < n; i++) {
        const p = pred[cur];
        if (p === -1) break;
        cur = p;
      }
      /* Şimdi cur çevrim üzerinde — çevrimi izle. */
      const visited = new Set<number>();
      let head = cur;
      while (!visited.has(head)) {
        visited.add(head);
        const p = pred[head];
        if (p === -1) break;
        head = p;
      }
      /* head'den başlayıp predecessor zincirini head'e geri dönene kadar topla. */
      const cyc: number[] = [head];
      let walker = pred[head];
      while (walker !== -1 && walker !== head && cyc.length <= n) {
        cyc.push(walker);
        walker = pred[walker];
      }
      cyc.reverse();
      for (const idx of cyc) negativeCycleNodes.push(graph.nodes[idx]);
    }
  }
  return { dist, pred, iterations, negativeCycleNodes };
}

/**
 * En kısa yol çözücü — Dijkstra ya da Bellman-Ford. algoritm = "auto"
 * (varsayılan) ise negatif ağırlık varlığına göre otomatik seçer.
 */
export function solveShortestPath(input: ShortestPathInput): ShortestPathResult {
  validate(input);
  const graph = prepareGraph(input);
  const mode: ShortestPathAlgorithm = input.algorithm ?? 'auto';
  const useBellmanFord =
    mode === 'bellman-ford' || (mode === 'auto' && graph.hasNegativeEdge);

  let dist: Float64Array;
  let pred: Int32Array;
  let iterations: number;
  let negativeCycleNodes: string[] = [];
  let algorithm: 'dijkstra' | 'bellman-ford';
  if (useBellmanFord) {
    algorithm = 'bellman-ford';
    const res = bellmanFord(graph);
    dist = res.dist;
    pred = res.pred;
    iterations = res.iterations;
    negativeCycleNodes = res.negativeCycleNodes;
  } else {
    algorithm = 'dijkstra';
    const res = dijkstra(graph);
    dist = res.dist;
    pred = res.pred;
    iterations = res.iterations;
  }

  const nodes = buildNodeResults(graph, dist, pred);
  const targetPath =
    graph.targetIdx >= 0 ? reconstructPath(graph, pred, dist, graph.targetIdx) : null;
  const targetDistance = graph.targetIdx >= 0 ? dist[graph.targetIdx] : null;

  return {
    algorithm,
    nodes,
    targetPath,
    targetDistance,
    hasNegativeCycle: negativeCycleNodes.length > 0,
    negativeCycleNodes,
    iterations,
  };
}
