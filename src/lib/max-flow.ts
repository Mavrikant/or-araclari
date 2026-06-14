/**
 * Maks-Akış (max-flow) çözümü — Edmonds-Karp algoritması ve min-cut çıkarımı.
 *
 * Klasik problem: yönlü kapasiteli bir ağda (V düğüm, E kenar, kaynak s,
 * hedef t) s'den t'ye ulaşan toplam akışın maksimumunu bul. Her kenarın
 * kapasitesi c(u,v) ≥ 0; akış f(u,v) ≤ c(u,v) ve her ara düğümde Σ giren
 * = Σ çıkan (akış korunumu).
 *
 * Ford-Fulkerson genel iskeletinde augmenting-path arıyoruz; Edmonds-Karp
 * artığa BFS uygulayarak EN KISA (kenar sayısına göre) artıran yolu seçer.
 * Sonuç: karmaşıklık O(V · E²) — pratikte küçük/orta ağlarda anlık.
 *
 * Min-cut max-flow teoremi (Ford-Fulkerson 1956): maksimum akış değeri,
 * kaynak ve hedefi ayıran herhangi bir kesimin minimum kapasitesine
 * eşittir. Algoritma bittiğinde s'den BFS ile erişilebilen düğüm kümesi
 * S, kalanı T'dir; S→T yönündeki orijinal kenarlar minimum kesimi
 * oluşturur.
 *
 * Pure: no DOM, no I/O.
 */

export interface MaxFlowEdge {
  /** Kaynak düğüm adı. */
  from: string;
  /** Hedef düğüm adı. */
  to: string;
  /** Kapasite c(u,v) ≥ 0. */
  capacity: number;
}

export interface MaxFlowInput {
  edges: MaxFlowEdge[];
  source: string;
  sink: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  capacity: number;
  /** Atanan akış 0 ≤ f ≤ capacity. */
  flow: number;
  /** Saturated mı (flow == capacity, ε hassasiyetinde)? */
  saturated: boolean;
}

export interface MaxFlowResult {
  maxFlow: number;
  /** Her orijinal kenar için son akış değerleri. */
  edges: FlowEdge[];
  /** Min-cut'ın kaynak tarafındaki düğümler (s dahil). */
  cutSourceSide: string[];
  /** Min-cut'ın hedef tarafındaki düğümler (t dahil). */
  cutSinkSide: string[];
  /** Min-cut kenarları: source-side → sink-side yönünde orijinal kenarlar. */
  cutEdges: Array<{ from: string; to: string; capacity: number }>;
  /** Edmonds-Karp augmenting-path iterasyon sayısı. */
  iterations: number;
  /** Otomatik keşfedilen tüm düğümler (ekleme sırası). */
  nodes: string[];
}

export class MaxFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaxFlowError';
  }
}

const EPS = 1e-9;
const MAX_NODES = 200;
const MAX_EDGES = 1000;
const MAX_ITERATIONS = 50000;

function validate(input: MaxFlowInput): void {
  if (!Array.isArray(input.edges) || input.edges.length === 0) {
    throw new MaxFlowError('En az bir kenar gerekli.');
  }
  if (input.edges.length > MAX_EDGES) {
    throw new MaxFlowError(`Kenar sayısı en fazla ${MAX_EDGES} olabilir (${input.edges.length} verildi).`);
  }
  if (typeof input.source !== 'string' || input.source.length === 0) {
    throw new MaxFlowError('Kaynak (source) düğüm adı gerekli.');
  }
  if (typeof input.sink !== 'string' || input.sink.length === 0) {
    throw new MaxFlowError('Hedef (sink) düğüm adı gerekli.');
  }
  if (input.source === input.sink) {
    throw new MaxFlowError('Kaynak ve hedef aynı düğüm olamaz.');
  }
  for (let i = 0; i < input.edges.length; i++) {
    const e = input.edges[i];
    if (!e.from || !e.to) {
      throw new MaxFlowError(`Kenar ${i + 1}: from ve to dolu olmalı.`);
    }
    if (e.from === e.to) {
      throw new MaxFlowError(`Kenar ${i + 1}: self-loop (${e.from} → ${e.to}) desteklenmiyor.`);
    }
    if (typeof e.capacity !== 'number' || !Number.isFinite(e.capacity) || e.capacity < 0) {
      throw new MaxFlowError(
        `Kenar ${i + 1} (${e.from} → ${e.to}): kapasite negatif olmayan bir sayı olmalı (${e.capacity} verildi).`,
      );
    }
  }
}

/**
 * Edmonds-Karp ile s → t maks akış. Algoritma:
 *   1. Residüel kapasite matrisini kur (orijinal kenarlar + ters kenar 0 başlar).
 *   2. BFS ile s'den t'ye en kısa artıran yol bul.
 *   3. Yolda min kapasite kadar akıt; ileri kenarlardan çıkar, geri kenarlara
 *      ekle. cumulative max-flow'a ekle.
 *   4. BFS yol bulamayana kadar tekrarla.
 *   5. Son residüel grafiğin s'den erişilebilir kümesi S; cut = S→T orijinal
 *      kenarları.
 *
 * Kenar kümesi paralel kenar içerebilir (aynı u→v birden fazla); bu hâl
 * tek bir matris hücresine toplanır — flow geri çözümünde orantı kuralı
 * gerekmez çünkü doygunluk testi kapasite-bazlıdır.
 */
export function solveMaxFlow(input: MaxFlowInput): MaxFlowResult {
  validate(input);

  /* Düğüm indeksleme — ekleme sırası korunur (deterministik raporlama). */
  const indexOf = new Map<string, number>();
  const nodes: string[] = [];
  const intern = (name: string): number => {
    let id = indexOf.get(name);
    if (id !== undefined) return id;
    if (nodes.length >= MAX_NODES) {
      throw new MaxFlowError(`Düğüm sayısı en fazla ${MAX_NODES} olabilir.`);
    }
    id = nodes.length;
    nodes.push(name);
    indexOf.set(name, id);
    return id;
  };

  /* Önce kaynak ve hedef eklenir (raporlama düzeni için). */
  const s = intern(input.source);
  const t = intern(input.sink);
  for (const e of input.edges) {
    intern(e.from);
    intern(e.to);
  }

  /* Kapasite matrisini ve orijinal kenar toplamlarını ayır — paralel
   * kenarlar aynı (u,v) hücresine toplanır. */
  const n = nodes.length;
  const cap: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  /* Orijinal toplam kapasite (paralel kenarlar dahil) — flow geri haritalama. */
  const origCap: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const e of input.edges) {
    const u = indexOf.get(e.from)!;
    const v = indexOf.get(e.to)!;
    cap[u][v] += e.capacity;
    origCap[u][v] += e.capacity;
  }

  /* Komşuluk listesi — BFS hızlandırması; her (u,v) için ters (v,u) da
   * gezilebilmeli (residüel grafiği için). */
  const neighbors: number[][] = Array.from({ length: n }, () => []);
  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      if (origCap[u][v] > 0 || origCap[v][u] > 0) {
        if (!neighbors[u].includes(v)) neighbors[u].push(v);
      }
    }
  }

  let maxFlow = 0;
  let iterations = 0;
  /* Augmenting-path döngüsü — BFS bulamayana kadar. */
  while (iterations < MAX_ITERATIONS) {
    const parent = new Int32Array(n).fill(-1);
    parent[s] = s; /* sentinel: s'in ebeveyni kendisi */
    const queue: number[] = [s];
    let qHead = 0;
    while (qHead < queue.length) {
      const u = queue[qHead++];
      if (u === t) break;
      for (const v of neighbors[u]) {
        if (parent[v] === -1 && cap[u][v] > EPS) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    if (parent[t] === -1) break; /* artıran yol kalmadı */

    /* Yol üzerindeki min kapasiteyi bul. */
    let bottleneck = Infinity;
    for (let v = t; v !== s; v = parent[v]) {
      const u = parent[v];
      if (cap[u][v] < bottleneck) bottleneck = cap[u][v];
    }
    if (bottleneck <= EPS) break; /* sayısal güvenlik */

    /* Akışı uygula: ileri −, geri +. */
    for (let v = t; v !== s; v = parent[v]) {
      const u = parent[v];
      cap[u][v] -= bottleneck;
      cap[v][u] += bottleneck;
    }
    maxFlow += bottleneck;
    iterations++;
  }
  if (iterations >= MAX_ITERATIONS) {
    throw new MaxFlowError(`Edmonds-Karp ${MAX_ITERATIONS} iterasyonda yakınsamadı — kapasiteler veya ağ yapısını gözden geçirin.`);
  }

  /* Orijinal kenarlar üzerinde akış geri çıkarımı: f(u,v) = orig(u,v) − cap(u,v).
   * Negatif sonuçlar (akış geri kenardan geldi) net olarak değerlendirilir;
   * f(u,v) ≥ 0 olarak raporlanır, ters yön ayrıca varsa onun da net flow'u alınır. */
  const edges: FlowEdge[] = input.edges.map((e) => {
    const u = indexOf.get(e.from)!;
    const v = indexOf.get(e.to)!;
    /* Paralel kenarlar arasında akış dağıtımı belirsizdir; toplam (u,v) akışını
     * paralel kenarlara kapasiteyle orantılı paylaştır. */
    const totalNetFlow = Math.max(0, origCap[u][v] - cap[u][v]);
    const share = origCap[u][v] > 0 ? e.capacity / origCap[u][v] : 0;
    const flow = totalNetFlow * share;
    return {
      from: e.from,
      to: e.to,
      capacity: e.capacity,
      flow,
      saturated: e.capacity > EPS && Math.abs(e.capacity - flow) < EPS * Math.max(1, e.capacity),
    };
  });

  /* Min-cut: son residüel grafikte s'den erişilebilenler S kümesi. */
  const reachable = new Uint8Array(n);
  reachable[s] = 1;
  const q: number[] = [s];
  let h = 0;
  while (h < q.length) {
    const u = q[h++];
    for (const v of neighbors[u]) {
      if (!reachable[v] && cap[u][v] > EPS) {
        reachable[v] = 1;
        q.push(v);
      }
    }
  }
  const cutSourceSide: string[] = [];
  const cutSinkSide: string[] = [];
  for (let i = 0; i < n; i++) (reachable[i] ? cutSourceSide : cutSinkSide).push(nodes[i]);

  /* Cut kenarları: S → T yönünde orijinal kenarlar (residüelde değil,
   * orijinal grafikte). */
  const cutEdges: Array<{ from: string; to: string; capacity: number }> = [];
  for (let u = 0; u < n; u++) {
    if (!reachable[u]) continue;
    for (let v = 0; v < n; v++) {
      if (reachable[v]) continue;
      if (origCap[u][v] > 0) {
        cutEdges.push({ from: nodes[u], to: nodes[v], capacity: origCap[u][v] });
      }
    }
  }

  return {
    maxFlow,
    edges,
    cutSourceSide,
    cutSinkSide,
    cutEdges,
    iterations,
    nodes,
  };
}
