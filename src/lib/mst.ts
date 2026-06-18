/**
 * Minimum yayılan ağaç (Minimum Spanning Tree, MST) — Prim ve Kruskal
 * algoritmaları.
 *
 * Klasik problem: yönsüz ağırlıklı bir ağda (V düğüm, E kenar) tüm
 * düğümleri birbirine bağlayan, kenar ağırlıklarının toplamı en küçük
 * olan ağaçtır. Ağacın V − 1 kenarı vardır ve hiçbir çevrim içermez.
 * Graf bağlı değilse her bağlı bileşen için ayrı bir ağaç bulunur:
 * minimum yayılan orman (spanning forest).
 *
 * İki algoritma:
 *   - **Prim** — bir düğümden başlayıp her adımda mevcut ağaca en
 *     ucuz şekilde komşu yeni bir düğüm ekler. Binary heap ile
 *     O((V + E) · log V).
 *   - **Kruskal** — tüm kenarları ağırlığa göre sıralar; ayrık küme
 *     (union-find) yapısıyla çevrim oluşturmayanları teker teker MST'ye
 *     katar. O(E · log E).
 *
 * Yönsüz graf varsayımı: kullanıcının her (u, v, w) kenarı için ters
 * yönlü (v, u, w) bir kayıt eklemesi gerekmez; bu motor kenarları
 * yönsüz olarak modeller. Paralel kenarlar arasında en küçük ağırlık
 * korunur (büyük olanlar zaten MST'ye alınmaz).
 *
 * Çıktı: MST kenarları, toplam ağırlık, bağlı bileşen sayısı (≥ 2 ise
 * graf bağlı değildir — orman) ve düğüm başına bileşen etiketi.
 *
 * Pure: no DOM, no I/O.
 */

export interface MstEdge {
  /** Bir uç düğümü. */
  from: string;
  /** Diğer uç düğümü. */
  to: string;
  /** Kenar ağırlığı — negatif olabilir, MST tanımı bunu kabul eder. */
  weight: number;
}

export type MstAlgorithm = 'prim' | 'kruskal';

export interface MstInput {
  edges: MstEdge[];
  /**
   * Prim için başlangıç düğümü; verilmezse ilk keşfedilen düğüm
   * seçilir. Kruskal için göz ardı edilir (algoritma global sıralama
   * kullanır).
   */
  startNode?: string;
  /** Varsayılan: 'prim'. */
  algorithm?: MstAlgorithm;
}

export interface MstTreeEdge {
  from: string;
  to: string;
  weight: number;
  /** Bu kenarın MST'ye katıldığı sıra (1'den başlar). */
  order: number;
}

export interface NodeComponent {
  node: string;
  /** Bileşen kimliği — aynı sayı = aynı ağaç. 0'dan başlar. */
  component: number;
}

export interface MstResult {
  algorithm: MstAlgorithm;
  /** MST (ya da MST ormanı) kenarları, eklenme sırasına göre. */
  treeEdges: MstTreeEdge[];
  /** treeEdges ağırlıklarının toplamı. */
  totalWeight: number;
  /** Bağlı bileşen sayısı. 1 = tek MST; ≥ 2 = MST ormanı. */
  components: number;
  /** Düğüm başına bileşen etiketi. */
  nodeComponents: NodeComponent[];
  /** Algoritma toplam iterasyon sayısı (debug/eğitim için). */
  iterations: number;
}

export class MstError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MstError';
  }
}

const MAX_NODES = 500;
const MAX_EDGES = 2000;

function validate(input: MstInput): void {
  if (!Array.isArray(input.edges) || input.edges.length === 0) {
    throw new MstError('En az bir kenar gerekli.');
  }
  if (input.edges.length > MAX_EDGES) {
    throw new MstError(
      `Kenar sayısı en fazla ${MAX_EDGES} olabilir (${input.edges.length} verildi).`,
    );
  }
  for (let i = 0; i < input.edges.length; i++) {
    const e = input.edges[i];
    if (!e.from || !e.to) {
      throw new MstError(`Kenar ${i + 1}: from ve to dolu olmalı.`);
    }
    if (e.from === e.to) {
      throw new MstError(
        `Kenar ${i + 1}: self-loop (${e.from} — ${e.to}) MST'ye katkı sağlamaz.`,
      );
    }
    if (typeof e.weight !== 'number' || !Number.isFinite(e.weight)) {
      throw new MstError(
        `Kenar ${i + 1} (${e.from} — ${e.to}): ağırlık sonlu bir sayı olmalı (${e.weight} verildi).`,
      );
    }
  }
}

interface AdjEdge {
  to: number;
  weight: number;
  /** Orijinal edges[] dizisindeki indeks — paralel kenarlardan minimum seçimi için. */
  edgeIdx: number;
}

interface PreparedGraph {
  n: number;
  nodes: string[];
  startIdx: number;
  /** Yönsüz komşuluk listesi (Prim için). */
  adj: AdjEdge[][];
  /** Düz kenar listesi (Kruskal için) — paralel kenarlardan en küçük tutulur. */
  edgeList: Array<{ u: number; v: number; w: number }>;
}

function prepareGraph(input: MstInput): PreparedGraph {
  const indexOf = new Map<string, number>();
  const nodes: string[] = [];
  const intern = (name: string): number => {
    let id = indexOf.get(name);
    if (id !== undefined) return id;
    if (nodes.length >= MAX_NODES) {
      throw new MstError(`Düğüm sayısı en fazla ${MAX_NODES} olabilir.`);
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

  const n = nodes.length;
  let startIdx = 0;
  if (input.startNode !== undefined && input.startNode !== '') {
    const idx = indexOf.get(input.startNode);
    if (idx === undefined) {
      throw new MstError(`Başlangıç düğümü '${input.startNode}' kenarlarda yer almıyor.`);
    }
    startIdx = idx;
  }

  /* Paralel kenarlardan en küçüğünü tut: (min(u,v), max(u,v)) → en küçük w. */
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

  const adj: AdjEdge[][] = Array.from({ length: n }, () => []);
  const edgeList: Array<{ u: number; v: number; w: number }> = [];
  let edgeIdx = 0;
  for (const [key, w] of undirectedMin) {
    const [a, b] = key.split('|').map(Number);
    adj[a].push({ to: b, weight: w, edgeIdx });
    adj[b].push({ to: a, weight: w, edgeIdx });
    edgeList.push({ u: a, v: b, w });
    edgeIdx++;
  }

  return { n, nodes, startIdx, adj, edgeList };
}

/**
 * Binary min-heap — anahtar: (weight, nodeId, fromNodeId). Prim'in
 * frontier'ı. Lazy delete stratejisi: bir düğüm için heap'te eski
 * kayıt kalabilir; pop edildiğinde in-tree mi diye kontrol edilir.
 */
class MinHeap {
  private heap: Array<{ w: number; node: number; from: number }> = [];

  size(): number {
    return this.heap.length;
  }

  push(w: number, node: number, from: number): void {
    this.heap.push({ w, node, from });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { w: number; node: number; from: number } | undefined {
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

/**
 * Prim — başlangıç düğümünden başlayıp her adımda mevcut ağaca en
 * ucuz şekilde komşu olan kenarı seçer. Binary heap + lazy delete.
 *
 * Graf bağlı değilse algoritma ulaşabildiği bileşeni bitirir; geri
 * kalan bileşenler için keşfedilmemiş düğümlerden başlayarak ek
 * Prim çalışmaları yapılır (MST ormanı).
 */
function prim(graph: PreparedGraph): {
  treeEdges: MstTreeEdge[];
  iterations: number;
} {
  const n = graph.n;
  const inTree = new Uint8Array(n);
  const treeEdges: MstTreeEdge[] = [];
  let iterations = 0;
  let order = 1;

  const runFrom = (start: number): void => {
    const heap = new MinHeap();
    heap.push(0, start, -1);
    while (heap.size() > 0) {
      const top = heap.pop()!;
      const u = top.node;
      if (inTree[u]) continue;
      iterations++;
      inTree[u] = 1;
      if (top.from !== -1) {
        treeEdges.push({
          from: graph.nodes[top.from],
          to: graph.nodes[u],
          weight: top.w,
          order: order++,
        });
      }
      for (const e of graph.adj[u]) {
        if (!inTree[e.to]) {
          heap.push(e.weight, e.to, u);
        }
      }
    }
  };

  runFrom(graph.startIdx);
  for (let i = 0; i < n; i++) {
    if (!inTree[i]) runFrom(i);
  }
  return { treeEdges, iterations };
}

/**
 * Union-find (ayrık küme) — küçük ağaç birleşimi + path compression.
 * O(α(n)) amortize maliyet — pratikte sabit.
 */
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
    /* Path compression. */
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
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
    return true;
  }
}

/**
 * Kruskal — tüm kenarları ağırlığa göre sıralar; union-find ile
 * çevrim oluşturmayanları teker teker MST'ye katar.
 *
 * Beraberlik kuralı: aynı ağırlıklı kenarlar arasında stabil sıra
 * korunur — kullanıcının verdiği sırayla. MST tek değil ise bu
 * deterministiklik için yeterlidir.
 */
function kruskal(graph: PreparedGraph): {
  treeEdges: MstTreeEdge[];
  iterations: number;
} {
  const n = graph.n;
  const indexed = graph.edgeList.map((e, i) => ({ ...e, i }));
  indexed.sort((a, b) => a.w - b.w || a.i - b.i);
  const dsu = new DSU(n);
  const treeEdges: MstTreeEdge[] = [];
  let iterations = 0;
  let order = 1;
  for (const e of indexed) {
    iterations++;
    if (dsu.union(e.u, e.v)) {
      treeEdges.push({
        from: graph.nodes[e.u],
        to: graph.nodes[e.v],
        weight: e.w,
        order: order++,
      });
      if (treeEdges.length === n - 1) break;
    }
  }
  return { treeEdges, iterations };
}

/**
 * Düğüm bileşenlerini hesapla — MST kenarlarından union-find.
 */
function buildComponents(
  graph: PreparedGraph,
  treeEdges: MstTreeEdge[],
): { components: number; nodeComponents: NodeComponent[] } {
  const n = graph.n;
  const dsu = new DSU(n);
  for (const e of treeEdges) {
    /* MST kenarlarındaki düğüm adları zaten internlendi. */
    const u = graph.nodes.indexOf(e.from);
    const v = graph.nodes.indexOf(e.to);
    dsu.union(u, v);
  }
  /* Bileşen kimliklerini 0..k−1 olarak yeniden numaralandır. */
  const rootToId = new Map<number, number>();
  const nodeComponents: NodeComponent[] = [];
  for (let i = 0; i < n; i++) {
    const r = dsu.find(i);
    let id = rootToId.get(r);
    if (id === undefined) {
      id = rootToId.size;
      rootToId.set(r, id);
    }
    nodeComponents.push({ node: graph.nodes[i], component: id });
  }
  return { components: rootToId.size, nodeComponents };
}

/**
 * MST çözücü — Prim ya da Kruskal. Bağlı olmayan graf için
 * minimum yayılan orman döner.
 */
export function solveMst(input: MstInput): MstResult {
  validate(input);
  const graph = prepareGraph(input);
  const algorithm: MstAlgorithm = input.algorithm ?? 'prim';

  let treeEdges: MstTreeEdge[];
  let iterations: number;
  if (algorithm === 'kruskal') {
    const res = kruskal(graph);
    treeEdges = res.treeEdges;
    iterations = res.iterations;
  } else {
    const res = prim(graph);
    treeEdges = res.treeEdges;
    iterations = res.iterations;
  }

  const totalWeight = treeEdges.reduce((s, e) => s + e.weight, 0);
  const { components, nodeComponents } = buildComponents(graph, treeEdges);

  return {
    algorithm,
    treeEdges,
    totalWeight,
    components,
    nodeComponents,
    iterations,
  };
}
