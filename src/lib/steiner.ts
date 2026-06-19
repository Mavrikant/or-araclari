/**
 * Steiner ağacı (Steiner Tree) — MST tabanlı 2-yaklaşım algoritması
 * (Kou, Markowsky, Berman, 1981).
 *
 * Klasik problem: yönsüz ağırlıklı bir ağda (V düğüm, E kenar) bir
 * **terminal** alt kümesi R ⊆ V verilir. Amaç, R'deki tüm düğümleri
 * birbirine bağlayan, toplam ağırlığı en küçük ağacı bulmak. Ağaç
 * isteğe bağlı olarak R dışı ara düğümler ("Steiner noktaları")
 * içerebilir; bu yüzden çözüm MST'den daha ucuz olabilir.
 *
 * Steiner ağacı problemi NP-zor; ama 2-yaklaşımı (bulunan toplam
 * ≤ 2 · optimum) polinom zamanda kolaydır. KMB algoritması:
 *
 *   1. Her terminal r ∈ R'den Dijkstra ile diğer tüm terminallere en
 *      kısa yolu hesapla.
 *   2. Terminaller üzerinde **metrik kapanış** (metric closure) tam
 *      grafını K kur: her (r_i, r_j) çiftinin ağırlığı orijinal
 *      grafdaki en kısa yol uzunluğu.
 *   3. K üzerinde Kruskal ile MST T1 bul.
 *   4. T1'in her kenarını orijinal grafdaki gerçek en kısa yola
 *      genişlet → orijinal düğümlerden oluşan alt graf S.
 *   5. S üzerinde tekrar MST T2 — çakışan yollardan doğan çevrimler
 *      kırpılır.
 *   6. T2'den, terminal olmayan **yaprak** düğümleri ardışık olarak
 *      kaldır — bunlar ağacın derinine inip geri dönmüyor, sadece
 *      bedel ekliyor.
 *
 * Yaklaşım garantisi: T_KMB ≤ 2 · (1 − 1/ℓ) · T_OPT, ℓ = optimum
 * Steiner ağacındaki yaprak sayısı (Takahashi & Matsuyama 1980 türevi).
 *
 * Karmaşıklık: O(|R| · (E + V log V)) — terminal başına bir Dijkstra.
 *
 * Pure: no DOM, no I/O.
 */

export interface SteinerEdge {
  from: string;
  to: string;
  weight: number;
}

export interface SteinerInput {
  edges: SteinerEdge[];
  /** Bağlanması zorunlu terminal düğümler. En az 1, tipik olarak ≥ 2. */
  terminals: string[];
}

export interface SteinerTreeEdge {
  from: string;
  to: string;
  weight: number;
  /** Orijinal kenar listesindeki indeks (1'den). */
  order: number;
}

export interface SteinerPathRow {
  /** Hangi terminal çiftine ait. */
  terminalA: string;
  terminalB: string;
  /** En kısa yol uzunluğu. */
  distance: number;
  /** Yol üzerindeki düğüm dizisi. */
  path: string[];
}

export interface SteinerResult {
  /** Steiner ağacının kenarları (orijinal graf üzerinde). */
  treeEdges: SteinerTreeEdge[];
  /** treeEdges ağırlıklarının toplamı. */
  totalWeight: number;
  /** Çözümdeki düğümler — terminaller + Steiner noktaları. */
  treeNodes: string[];
  /** Çözüme ara düğüm olarak giren (terminal olmayan) düğümler. */
  steinerNodes: string[];
  /** Tüm terminaller tek bileşene bağlandı mı? */
  reachable: boolean;
  /** Metrik kapanışta kullanılan terminal çiftleri arası en kısa yollar. */
  terminalPaths: SteinerPathRow[];
  /** Saf MST karşılaştırması: tüm grafın MST toplam ağırlığı. */
  mstTotalWeight: number;
}

export class SteinerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SteinerError';
  }
}

const MAX_NODES = 200;
const MAX_EDGES = 1000;
const MAX_TERMINALS = 30;

function validate(input: SteinerInput): void {
  if (!Array.isArray(input.edges) || input.edges.length === 0) {
    throw new SteinerError('En az bir kenar gerekli.');
  }
  if (input.edges.length > MAX_EDGES) {
    throw new SteinerError(
      `Kenar sayısı en fazla ${MAX_EDGES} olabilir (${input.edges.length} verildi).`,
    );
  }
  if (!Array.isArray(input.terminals) || input.terminals.length === 0) {
    throw new SteinerError('En az bir terminal gerekli.');
  }
  if (input.terminals.length > MAX_TERMINALS) {
    throw new SteinerError(
      `Terminal sayısı en fazla ${MAX_TERMINALS} olabilir (${input.terminals.length} verildi).`,
    );
  }
  for (let i = 0; i < input.edges.length; i++) {
    const e = input.edges[i];
    if (!e.from || !e.to) {
      throw new SteinerError(`Kenar ${i + 1}: from ve to dolu olmalı.`);
    }
    if (e.from === e.to) {
      throw new SteinerError(
        `Kenar ${i + 1}: self-loop (${e.from} — ${e.to}) Steiner ağacına katkı sağlamaz.`,
      );
    }
    if (typeof e.weight !== 'number' || !Number.isFinite(e.weight)) {
      throw new SteinerError(
        `Kenar ${i + 1} (${e.from} — ${e.to}): ağırlık sonlu sayı olmalı.`,
      );
    }
    if (e.weight < 0) {
      throw new SteinerError(
        `Kenar ${i + 1} (${e.from} — ${e.to}): ağırlık ≥ 0 olmalı (Dijkstra varsayımı).`,
      );
    }
  }
  const seen = new Set<string>();
  for (const t of input.terminals) {
    if (!t) throw new SteinerError('Terminal adı boş olamaz.');
    if (seen.has(t)) {
      throw new SteinerError(`Terminal '${t}' tekrar etmiş.`);
    }
    seen.add(t);
  }
}

interface AdjEdge {
  to: number;
  weight: number;
}

interface PreparedGraph {
  n: number;
  nodes: string[];
  indexOf: Map<string, number>;
  adj: AdjEdge[][];
  terminalIdx: number[];
  /** Düz kenar listesi — paralel kenarlardan en küçüğü. */
  edgeList: Array<{ u: number; v: number; w: number }>;
}

function prepareGraph(input: SteinerInput): PreparedGraph {
  const indexOf = new Map<string, number>();
  const nodes: string[] = [];
  const intern = (name: string): number => {
    let id = indexOf.get(name);
    if (id !== undefined) return id;
    if (nodes.length >= MAX_NODES) {
      throw new SteinerError(`Düğüm sayısı en fazla ${MAX_NODES} olabilir.`);
    }
    id = nodes.length;
    nodes.push(name);
    indexOf.set(name, id);
    return id;
  };

  for (const e of input.edges) {
    intern(e.from);
    intern(e.to);
  }

  /* Paralel yönsüz kenarlardan en küçüğünü tut. */
  const undirectedMin = new Map<string, number>();
  for (const e of input.edges) {
    const u = indexOf.get(e.from)!;
    const v = indexOf.get(e.to)!;
    const a = Math.min(u, v);
    const b = Math.max(u, v);
    const key = `${a}|${b}`;
    const prev = undirectedMin.get(key);
    if (prev === undefined || e.weight < prev) {
      undirectedMin.set(key, e.weight);
    }
  }

  const n = nodes.length;
  const adj: AdjEdge[][] = Array.from({ length: n }, () => []);
  const edgeList: Array<{ u: number; v: number; w: number }> = [];
  for (const [key, w] of undirectedMin) {
    const [a, b] = key.split('|').map(Number);
    adj[a].push({ to: b, weight: w });
    adj[b].push({ to: a, weight: w });
    edgeList.push({ u: a, v: b, w });
  }

  const terminalIdx: number[] = [];
  for (const t of input.terminals) {
    const id = indexOf.get(t);
    if (id === undefined) {
      throw new SteinerError(`Terminal '${t}' kenarlarda yer almıyor.`);
    }
    terminalIdx.push(id);
  }

  return { n, nodes, indexOf, adj, terminalIdx, edgeList };
}

/* ─── Dijkstra (≥ 0 ağırlık) ──────────────────────────────── */

class MinHeap {
  private heap: Array<{ w: number; node: number }> = [];

  size(): number {
    return this.heap.length;
  }

  push(w: number, node: number): void {
    this.heap.push({ w, node });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { w: number; node: number } | undefined {
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
      if (h[parent].w <= h[i].w) break;
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
      if (l < n && h[l].w < h[smallest].w) smallest = l;
      if (r < n && h[r].w < h[smallest].w) smallest = r;
      if (smallest === i) break;
      [h[smallest], h[i]] = [h[i], h[smallest]];
      i = smallest;
    }
  }
}

function dijkstra(
  graph: PreparedGraph,
  source: number,
): { dist: Float64Array; pred: Int32Array } {
  const n = graph.n;
  const dist = new Float64Array(n);
  const pred = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    dist[i] = Infinity;
    pred[i] = -1;
  }
  dist[source] = 0;
  const heap = new MinHeap();
  heap.push(0, source);
  while (heap.size() > 0) {
    const top = heap.pop()!;
    const u = top.node;
    if (top.w > dist[u]) continue;
    for (const e of graph.adj[u]) {
      const nd = dist[u] + e.weight;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        pred[e.to] = u;
        heap.push(nd, e.to);
      }
    }
  }
  return { dist, pred };
}

function reconstructPath(pred: Int32Array, target: number): number[] {
  const path: number[] = [];
  let cur = target;
  while (cur !== -1) {
    path.push(cur);
    cur = pred[cur];
  }
  return path.reverse();
}

/* ─── Union-Find ──────────────────────────────────────────── */

class DSU {
  private parent: Int32Array;
  private rank: Int32Array;

  constructor(n: number) {
    this.parent = new Int32Array(n);
    this.rank = new Int32Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }

  find(x: number): number {
    let r = x;
    while (this.parent[r] !== r) r = this.parent[r];
    let cur = x;
    while (this.parent[cur] !== r) {
      const next = this.parent[cur];
      this.parent[cur] = r;
      cur = next;
    }
    return r;
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
    return true;
  }
}

interface PlainEdge {
  u: number;
  v: number;
  w: number;
  /** Stabil sıra için. */
  i: number;
}

function kruskalMst(
  n: number,
  edges: PlainEdge[],
): { tree: PlainEdge[]; totalWeight: number } {
  const sorted = edges.slice().sort((a, b) => a.w - b.w || a.i - b.i);
  const dsu = new DSU(n);
  const tree: PlainEdge[] = [];
  let totalWeight = 0;
  for (const e of sorted) {
    if (dsu.union(e.u, e.v)) {
      tree.push(e);
      totalWeight += e.w;
      if (tree.length === n - 1) break;
    }
  }
  return { tree, totalWeight };
}

/* ─── KMB ana algoritma ────────────────────────────────────── */

export function solveSteiner(input: SteinerInput): SteinerResult {
  validate(input);
  const graph = prepareGraph(input);
  const { n, nodes, terminalIdx, edgeList } = graph;
  const k = terminalIdx.length;

  /* Tüm grafın MST toplamını karşılaştırma için hesapla. */
  const mstPlain: PlainEdge[] = edgeList.map((e, i) => ({ ...e, i }));
  const fullMst = kruskalMst(n, mstPlain);
  /* Tüm graf bağlı değilse fullMst düğümleri kapsamayabilir; bu sadece
   * karşılaştırma için. */

  /* Tek terminal: tek düğüm, boş ağaç. */
  if (k === 1) {
    const t = nodes[terminalIdx[0]];
    return {
      treeEdges: [],
      totalWeight: 0,
      treeNodes: [t],
      steinerNodes: [],
      reachable: true,
      terminalPaths: [],
      mstTotalWeight: fullMst.totalWeight,
    };
  }

  /* 1. Adım: her terminalden Dijkstra. */
  const dijkstraResults: Array<{ dist: Float64Array; pred: Int32Array }> = [];
  for (const t of terminalIdx) {
    dijkstraResults.push(dijkstra(graph, t));
  }

  /* Erişilebilirlik kontrolü. */
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      if (!Number.isFinite(dijkstraResults[i].dist[terminalIdx[j]])) {
        return {
          treeEdges: [],
          totalWeight: 0,
          treeNodes: [],
          steinerNodes: [],
          reachable: false,
          terminalPaths: [],
          mstTotalWeight: fullMst.totalWeight,
        };
      }
    }
  }

  /* 2. Adım: metrik kapanış grafı G1 — terminaller arası tam graf. */
  const metricEdges: PlainEdge[] = [];
  const terminalPaths: SteinerPathRow[] = [];
  let metricIdx = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const d = dijkstraResults[i].dist[terminalIdx[j]];
      metricEdges.push({ u: i, v: j, w: d, i: metricIdx++ });
      const path = reconstructPath(dijkstraResults[i].pred, terminalIdx[j]);
      terminalPaths.push({
        terminalA: nodes[terminalIdx[i]],
        terminalB: nodes[terminalIdx[j]],
        distance: d,
        path: path.map((idx) => nodes[idx]),
      });
    }
  }

  /* 3. Adım: G1 üzerinde MST T1. */
  const t1 = kruskalMst(k, metricEdges);

  /* 4. Adım: T1'in her kenarını orijinal yola genişlet → alt graf S. */
  const subgraphEdgeSet = new Map<string, PlainEdge>();
  let subIdx = 0;
  const usedNodes = new Set<number>();
  for (const e of t1.tree) {
    const srcTerm = terminalIdx[e.u];
    const dstTerm = terminalIdx[e.v];
    const path = reconstructPath(dijkstraResults[e.u].pred, dstTerm);
    /* terminalIdx[e.u] başlangıç; path zaten kaynaktan hedefe. */
    /* Kontrol: path[0] === srcTerm (Dijkstra sonucu garanti). */
    if (path[0] !== srcTerm) {
      /* Sağlamlık — beklenmeyen durum. */
      continue;
    }
    for (let p = 0; p < path.length - 1; p++) {
      const a = path[p];
      const b = path[p + 1];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}|${hi}`;
      if (!subgraphEdgeSet.has(key)) {
        /* Ağırlığı orijinal graftan al. */
        let w = Infinity;
        for (const ae of graph.adj[a]) {
          if (ae.to === b && ae.weight < w) w = ae.weight;
        }
        subgraphEdgeSet.set(key, { u: lo, v: hi, w, i: subIdx++ });
      }
      usedNodes.add(a);
      usedNodes.add(b);
    }
  }

  /* Alt graftaki düğümleri 0..m−1 yeniden indeksle. */
  const subNodes = Array.from(usedNodes).sort((a, b) => a - b);
  const subIndexOf = new Map<number, number>();
  subNodes.forEach((orig, i) => subIndexOf.set(orig, i));
  const subEdges: PlainEdge[] = [];
  let sIdx = 0;
  for (const e of subgraphEdgeSet.values()) {
    subEdges.push({
      u: subIndexOf.get(e.u)!,
      v: subIndexOf.get(e.v)!,
      w: e.w,
      i: sIdx++,
    });
  }

  /* 5. Adım: alt graf üzerinde MST T2. */
  const t2 = kruskalMst(subNodes.length, subEdges);

  /* 6. Adım: terminal olmayan yaprakları ardışık olarak kaldır. */
  const terminalSet = new Set<number>(terminalIdx);
  /* T2 kenarlarını orijinal düğüm indekslerine geri çevir. */
  let curEdges = t2.tree.map((e) => ({
    u: subNodes[e.u],
    v: subNodes[e.v],
    w: e.w,
    i: e.i,
  }));

  while (true) {
    const degree = new Map<number, number>();
    for (const e of curEdges) {
      degree.set(e.u, (degree.get(e.u) ?? 0) + 1);
      degree.set(e.v, (degree.get(e.v) ?? 0) + 1);
    }
    /* Kaldırılacak: derecesi 1 ve terminal olmayanlar. */
    const toRemove = new Set<number>();
    for (const [node, deg] of degree) {
      if (deg === 1 && !terminalSet.has(node)) {
        toRemove.add(node);
      }
    }
    if (toRemove.size === 0) break;
    curEdges = curEdges.filter((e) => !toRemove.has(e.u) && !toRemove.has(e.v));
  }

  /* Sonuç dizilerini topla. */
  const finalNodes = new Set<number>();
  for (const e of curEdges) {
    finalNodes.add(e.u);
    finalNodes.add(e.v);
  }
  /* Tek terminal hâli yukarıda ele alındı; ama kenarsız edge durumu olabilir. */
  if (finalNodes.size === 0) {
    for (const t of terminalIdx) finalNodes.add(t);
  }

  const treeEdges: SteinerTreeEdge[] = curEdges.map((e, i) => ({
    from: nodes[e.u],
    to: nodes[e.v],
    weight: e.w,
    order: i + 1,
  }));
  const totalWeight = treeEdges.reduce((s, e) => s + e.weight, 0);

  const sortedFinalNodes = Array.from(finalNodes).sort((a, b) => a - b);
  const treeNodes = sortedFinalNodes.map((idx) => nodes[idx]);
  const steinerNodes = sortedFinalNodes
    .filter((idx) => !terminalSet.has(idx))
    .map((idx) => nodes[idx]);

  return {
    treeEdges,
    totalWeight,
    treeNodes,
    steinerNodes,
    reachable: true,
    terminalPaths,
    mstTotalWeight: fullMst.totalWeight,
  };
}
