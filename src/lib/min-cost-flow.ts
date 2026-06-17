/**
 * Min-Cost Flow (Min Maliyet Akış) — Successive Shortest Path (SSP) algoritması.
 *
 * Klasik problem: yönlü kapasiteli ve birim maliyetli bir ağda (V düğüm,
 * E kenar, kaynak s, hedef t), s'den t'ye d birim akıt; toplam maliyet
 * Σ w(u,v) · f(u,v) minimum olsun. Akış kısıtları kapasite (f ≤ c) ve
 * korunumudur (her ara düğümde Σ giren = Σ çıkan).
 *
 * SSP iskeleti:
 *   1. Başlangıç akışı 0; toplam maliyet 0.
 *   2. Residüel grafikte s'den t'ye EN UCUZ (cost'a göre en kısa) yolu
 *      Bellman-Ford / SPFA ile bul. Negatif maliyetli ters kenarlar
 *      (residüel akışın geri çağrılması) Dijkstra'yı potansiyellesiz
 *      yasaklar — bu yüzden SPFA kullanıyoruz.
 *   3. Yol üzerindeki minimum residüel kapasite δ kadar akıt; toplam
 *      akışa δ, toplam maliyete δ · pathCost ekle.
 *   4. Hedef akışa ulaşana veya artıran yol kalmayana kadar tekrarla.
 *
 * Hedef akış belirtilmezse maks akış kadarı (ulaşılabilen en yüksek)
 * minimum maliyetle akıtılır. Hedef akış ulaşılamazsa infeasible işareti
 * dönülür ve o ana kadar akıtılan kısım raporlanır.
 *
 * Karmaşıklık: SPFA başına O(V · E) ortalama, en kötü O(V · E²) toplam
 * iterasyon ile pratikte O(V² · E²) seviyesi. Küçük/orta ağlar (V ≤ 200,
 * E ≤ 1000) tarayıcıda anlık.
 *
 * Pure: no DOM, no I/O.
 */

export interface MinCostFlowEdge {
  /** Kaynak düğüm adı. */
  from: string;
  /** Hedef düğüm adı. */
  to: string;
  /** Kapasite c(u,v) ≥ 0. */
  capacity: number;
  /** Birim maliyet w(u,v); negatif olmamalı (klasik SSP varsayımı). */
  cost: number;
}

export interface MinCostFlowInput {
  edges: MinCostFlowEdge[];
  source: string;
  sink: string;
  /** Hedef akış miktarı d. Belirtilmezse maks akış kadar (Infinity). */
  requiredFlow?: number;
}

export interface MinCostFlowEdgeResult {
  from: string;
  to: string;
  capacity: number;
  cost: number;
  /** Atanan akış 0 ≤ f ≤ capacity. */
  flow: number;
  /** Bu kenarın toplam maliyet katkısı: flow · cost. */
  totalCost: number;
  saturated: boolean;
}

export interface MinCostFlowResult {
  /** Akıtılan toplam birim (hedef akışa eşit ya da daha az olabilir). */
  totalFlow: number;
  /** Toplam maliyet Σ flow · cost. */
  totalCost: number;
  /** Hedef akışa ulaşılamadıysa true. */
  infeasible: boolean;
  /** Orijinal kenarların akış raporu. */
  edges: MinCostFlowEdgeResult[];
  /** SSP iterasyon sayısı (artıran yol sayısı). */
  iterations: number;
  /** Otomatik keşfedilen düğümler (ekleme sırası). */
  nodes: string[];
}

export class MinCostFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MinCostFlowError';
  }
}

const EPS = 1e-9;
const MAX_NODES = 200;
const MAX_EDGES = 1000;
const MAX_ITERATIONS = 50000;
const INF = Number.POSITIVE_INFINITY;

function validate(input: MinCostFlowInput): void {
  if (!Array.isArray(input.edges) || input.edges.length === 0) {
    throw new MinCostFlowError('En az bir kenar gerekli.');
  }
  if (input.edges.length > MAX_EDGES) {
    throw new MinCostFlowError(`Kenar sayısı en fazla ${MAX_EDGES} olabilir (${input.edges.length} verildi).`);
  }
  if (typeof input.source !== 'string' || input.source.length === 0) {
    throw new MinCostFlowError('Kaynak (source) düğüm adı gerekli.');
  }
  if (typeof input.sink !== 'string' || input.sink.length === 0) {
    throw new MinCostFlowError('Hedef (sink) düğüm adı gerekli.');
  }
  if (input.source === input.sink) {
    throw new MinCostFlowError('Kaynak ve hedef aynı düğüm olamaz.');
  }
  if (input.requiredFlow !== undefined) {
    if (!Number.isFinite(input.requiredFlow) || input.requiredFlow < 0) {
      throw new MinCostFlowError(`Hedef akış negatif olmayan bir sayı olmalı (${input.requiredFlow} verildi).`);
    }
  }
  for (let i = 0; i < input.edges.length; i++) {
    const e = input.edges[i];
    if (!e.from || !e.to) {
      throw new MinCostFlowError(`Kenar ${i + 1}: from ve to dolu olmalı.`);
    }
    if (e.from === e.to) {
      throw new MinCostFlowError(`Kenar ${i + 1}: self-loop (${e.from} → ${e.to}) desteklenmiyor.`);
    }
    if (typeof e.capacity !== 'number' || !Number.isFinite(e.capacity) || e.capacity < 0) {
      throw new MinCostFlowError(
        `Kenar ${i + 1} (${e.from} → ${e.to}): kapasite negatif olmayan bir sayı olmalı (${e.capacity} verildi).`,
      );
    }
    if (typeof e.cost !== 'number' || !Number.isFinite(e.cost) || e.cost < 0) {
      throw new MinCostFlowError(
        `Kenar ${i + 1} (${e.from} → ${e.to}): birim maliyet negatif olmayan bir sayı olmalı (${e.cost} verildi).`,
      );
    }
  }
}

/**
 * Successive Shortest Path ile min-cost flow.
 *
 * Residüel grafikte her orijinal (u→v) kenarı için:
 *   - İleri kenar: residüel kapasite c−f, maliyet +w
 *   - Ters kenar: residüel kapasite f, maliyet −w (akışı geri çağırma)
 *
 * Negatif ters maliyetler nedeniyle SPFA (Bellman-Ford queue-based)
 * kullanıyoruz. Potansiyel + Dijkstra alternatifi daha hızlı ama bu
 * problem boyutu için SPFA okunabilirliği seçtirir.
 */
export function solveMinCostFlow(input: MinCostFlowInput): MinCostFlowResult {
  validate(input);

  const required = input.requiredFlow ?? INF;

  /* Düğüm indeksleme — ekleme sırası korunur (deterministik raporlama). */
  const indexOf = new Map<string, number>();
  const nodes: string[] = [];
  const intern = (name: string): number => {
    let id = indexOf.get(name);
    if (id !== undefined) return id;
    if (nodes.length >= MAX_NODES) {
      throw new MinCostFlowError(`Düğüm sayısı en fazla ${MAX_NODES} olabilir.`);
    }
    id = nodes.length;
    nodes.push(name);
    indexOf.set(name, id);
    return id;
  };
  const s = intern(input.source);
  const t = intern(input.sink);
  for (const e of input.edges) {
    intern(e.from);
    intern(e.to);
  }
  const n = nodes.length;

  /* Residüel grafiği yön bilinçli depolayalım: paralel kenarlar ayrı
   * tutulur (her birinin maliyeti farklı olabilir), her kenar bir
   * "head" indeksine ve onun ters çiftine sahiptir. */
  interface RNode {
    to: number;
    cap: number;
    cost: number;
    /** Ters kenarın `adj[to]` içindeki indeksi. */
    revIdx: number;
    /** Orijinal kenar indeksi (input.edges içinde); ters kenarda -1. */
    origIdx: number;
  }
  const adj: RNode[][] = Array.from({ length: n }, () => []);

  const addArc = (u: number, v: number, cap: number, cost: number, origIdx: number): void => {
    adj[u].push({ to: v, cap, cost, revIdx: adj[v].length, origIdx });
    adj[v].push({ to: u, cap: 0, cost: -cost, revIdx: adj[u].length - 1, origIdx: -1 });
  };

  for (let i = 0; i < input.edges.length; i++) {
    const e = input.edges[i];
    addArc(indexOf.get(e.from)!, indexOf.get(e.to)!, e.capacity, e.cost, i);
  }

  /* Her orijinal kenar için atanan toplam akış (geri çağırma sonrası
   * net). Direkt orijinal arc'ın "cap'i eksildikçe" akış bilinir. */
  const origFlow = new Float64Array(input.edges.length);

  let totalFlow = 0;
  let totalCost = 0;
  let iterations = 0;
  let infeasible = false;

  /* SPFA — queue-based Bellman-Ford; tüm düğümlerin s'den uzaklığını
   * (cost'a göre) bulur. Negatif ağırlıklı kenarlar (ters residüel) için
   * gerekli. Negatif döngü olmaz (orijinal maliyetler ≥ 0 ve residüel
   * azalmaz). */
  const dist = new Float64Array(n);
  const inQueue = new Uint8Array(n);
  /* parent: kullanılan kenarın (node, arcIndex) çifti. */
  const parentNode = new Int32Array(n);
  const parentArc = new Int32Array(n);

  while (iterations < MAX_ITERATIONS) {
    if (totalFlow + EPS >= required) break;

    dist.fill(INF);
    inQueue.fill(0);
    parentNode.fill(-1);
    parentArc.fill(-1);
    dist[s] = 0;
    const queue: number[] = [s];
    inQueue[s] = 1;
    while (queue.length > 0) {
      const u = queue.shift()!;
      inQueue[u] = 0;
      const adjU = adj[u];
      for (let k = 0; k < adjU.length; k++) {
        const arc = adjU[k];
        if (arc.cap <= EPS) continue;
        const nd = dist[u] + arc.cost;
        if (nd + EPS < dist[arc.to]) {
          dist[arc.to] = nd;
          parentNode[arc.to] = u;
          parentArc[arc.to] = k;
          if (!inQueue[arc.to]) {
            queue.push(arc.to);
            inQueue[arc.to] = 1;
          }
        }
      }
    }

    if (!Number.isFinite(dist[t])) {
      /* Artıran yol kalmadı. */
      if (required !== INF && totalFlow + EPS < required) infeasible = true;
      break;
    }

    /* Yol üzerindeki minimum residüel kapasite. */
    let bottleneck = required - totalFlow;
    for (let v = t; v !== s; v = parentNode[v]) {
      const arc = adj[parentNode[v]][parentArc[v]];
      if (arc.cap < bottleneck) bottleneck = arc.cap;
    }
    if (bottleneck <= EPS) break;

    /* Akışı uygula: ileri kapasiteyi azalt, ters kapasiteyi artır. */
    for (let v = t; v !== s; v = parentNode[v]) {
      const arc = adj[parentNode[v]][parentArc[v]];
      arc.cap -= bottleneck;
      adj[arc.to][arc.revIdx].cap += bottleneck;
      if (arc.origIdx >= 0) {
        origFlow[arc.origIdx] += bottleneck;
      } else {
        /* Ters kenara akış: orijinal akışı azaltır. revIdx üzerinden
         * orijinal kenarı bul. */
        const orig = adj[arc.to][arc.revIdx];
        if (orig.origIdx >= 0) origFlow[orig.origIdx] -= bottleneck;
      }
    }
    totalFlow += bottleneck;
    totalCost += bottleneck * dist[t];
    iterations++;
  }
  if (iterations >= MAX_ITERATIONS) {
    throw new MinCostFlowError(`SSP ${MAX_ITERATIONS} iterasyonda yakınsamadı — ağ yapısını gözden geçirin.`);
  }

  /* Paralel kenarlarda akışın orantı kuralı yerine "her arc kendi
   * akışını taşır" doğal sonucu kullanılır — algoritmamız her input
   * kenarı için ayrı bir residüel arc tuttuğundan origFlow[i] gerçekten
   * o kenardaki net akıştır. */
  const edges: MinCostFlowEdgeResult[] = input.edges.map((e, i) => {
    const flow = Math.max(0, origFlow[i]);
    return {
      from: e.from,
      to: e.to,
      capacity: e.capacity,
      cost: e.cost,
      flow,
      totalCost: flow * e.cost,
      saturated: e.capacity > EPS && Math.abs(e.capacity - flow) < EPS * Math.max(1, e.capacity),
    };
  });

  return {
    totalFlow,
    totalCost,
    infeasible,
    edges,
    iterations,
    nodes,
  };
}
