import { describe, it, expect } from 'vitest';
import { solveSteiner, SteinerError, type SteinerEdge } from './steiner';

describe('solveSteiner — KMB 2-yaklaşım temel', () => {
  it('üçgen, 3 terminal — tüm graf zaten ağaç', () => {
    /* A-B-C üçgeni en pahalı kenarı atar; 3 terminal ise sonuç MST'ye eşit. */
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'B', to: 'C', weight: 2 },
      { from: 'A', to: 'C', weight: 10 },
    ];
    const r = solveSteiner({ edges, terminals: ['A', 'B', 'C'] });
    expect(r.reachable).toBe(true);
    expect(r.totalWeight).toBe(3);
    expect(r.treeEdges.length).toBe(2);
    expect(r.steinerNodes).toEqual([]);
  });

  it('iki terminal — sadece en kısa yol', () => {
    /* s → a → t (1+1=2) ve s → t (5); en kısa yol 2. */
    const edges: SteinerEdge[] = [
      { from: 's', to: 'a', weight: 1 },
      { from: 'a', to: 't', weight: 1 },
      { from: 's', to: 't', weight: 5 },
    ];
    const r = solveSteiner({ edges, terminals: ['s', 't'] });
    expect(r.totalWeight).toBe(2);
    /* Ara düğüm a, Steiner noktası olarak girdi. */
    expect(r.steinerNodes).toEqual(['a']);
    expect(r.treeNodes.sort()).toEqual(['a', 's', 't']);
  });

  it('Y şekli — orta Steiner noktası 3 terminale daha ucuz', () => {
    /* Klasik Steiner örneği: 3 terminal (T1, T2, T3) hub C üzerinden
     * bağlanırsa toplam 3·1=3; doğrudan bağlanırsa 3·5=15 olur (üçgen
     * eşitsizliği yerine 1+1=2 yerine 5). */
    const edges: SteinerEdge[] = [
      { from: 'T1', to: 'C', weight: 1 },
      { from: 'T2', to: 'C', weight: 1 },
      { from: 'T3', to: 'C', weight: 1 },
      { from: 'T1', to: 'T2', weight: 5 },
      { from: 'T2', to: 'T3', weight: 5 },
      { from: 'T1', to: 'T3', weight: 5 },
    ];
    const r = solveSteiner({ edges, terminals: ['T1', 'T2', 'T3'] });
    expect(r.totalWeight).toBe(3);
    expect(r.steinerNodes).toEqual(['C']);
  });

  it('tek terminal — boş ağaç, sadece terminal düğüm', () => {
    const r = solveSteiner({
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 1 },
      ],
      terminals: ['B'],
    });
    expect(r.totalWeight).toBe(0);
    expect(r.treeEdges).toEqual([]);
    expect(r.treeNodes).toEqual(['B']);
  });
});

describe('solveSteiner — Steiner noktası seçimi', () => {
  it('terminaller köşelerde, ara düğümler yol üzerinde', () => {
    /* Izgara benzeri ufak örnek:
     *
     *      A───1───B
     *      │       │
     *      1       1
     *      │       │
     *      C───1───D
     *
     * Terminaller A ve D. En kısa yol uzunluğu 2; AKB veya ACD ile.
     * Steiner noktası ya B ya da C (deterministic sıralamaya göre). */
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'A', to: 'C', weight: 1 },
      { from: 'B', to: 'D', weight: 1 },
      { from: 'C', to: 'D', weight: 1 },
    ];
    const r = solveSteiner({ edges, terminals: ['A', 'D'] });
    expect(r.totalWeight).toBe(2);
    expect(r.steinerNodes.length).toBe(1);
  });

  it('uzaktan dolaşmak pahalıyken kısa yol seçilir', () => {
    /* s ile t arasında iki yol: s-a-b-t (toplam 3) ve s-t (5).
     * KMB ucuz yolu seçer. */
    const edges: SteinerEdge[] = [
      { from: 's', to: 'a', weight: 1 },
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 't', weight: 1 },
      { from: 's', to: 't', weight: 5 },
    ];
    const r = solveSteiner({ edges, terminals: ['s', 't'] });
    expect(r.totalWeight).toBe(3);
    expect(r.steinerNodes.sort()).toEqual(['a', 'b']);
  });

  it('terminal olmayan yapraklar kırpılır', () => {
    /* T1 ─ C ─ T2 ve C'den ucuz bir saplama: C ─ X (ağırlık 1).
     * X terminal değil; kırpılmalı. */
    const edges: SteinerEdge[] = [
      { from: 'T1', to: 'C', weight: 2 },
      { from: 'C', to: 'T2', weight: 2 },
      { from: 'C', to: 'X', weight: 1 },
    ];
    const r = solveSteiner({ edges, terminals: ['T1', 'T2'] });
    expect(r.totalWeight).toBe(4);
    expect(r.treeNodes.sort()).toEqual(['C', 'T1', 'T2']);
    expect(r.steinerNodes).toEqual(['C']);
  });
});

describe('solveSteiner — terminal yollar ve metrik kapanış', () => {
  it('terminal çiftlerini ve en kısa yol uzunluklarını raporlar', () => {
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 3 },
      { from: 'B', to: 'C', weight: 4 },
      { from: 'A', to: 'C', weight: 10 },
    ];
    const r = solveSteiner({ edges, terminals: ['A', 'B', 'C'] });
    /* 3 terminal → C(3,2) = 3 çift. */
    expect(r.terminalPaths.length).toBe(3);
    const ab = r.terminalPaths.find(
      (p) => (p.terminalA === 'A' && p.terminalB === 'B') ||
             (p.terminalA === 'B' && p.terminalB === 'A'),
    );
    expect(ab?.distance).toBe(3);
    const ac = r.terminalPaths.find(
      (p) => (p.terminalA === 'A' && p.terminalB === 'C') ||
             (p.terminalA === 'C' && p.terminalB === 'A'),
    );
    /* A-B-C üzerinden 7, A-C doğrudan 10 — Dijkstra 7'yi seçer. */
    expect(ac?.distance).toBe(7);
    expect(ac?.path).toEqual(['A', 'B', 'C']);
  });

  it('MST karşılaştırması — Steiner < MST ise saplama atılmış demektir', () => {
    /* 4 düğüm: T1-T2 (5), T1-X (1), X-T2 (1), X-Y (1), Y-Z (1).
     * Terminaller {T1, T2}. MST tüm graf üzerinden çok daha pahalı
     * olur (Y, Z dahil), ama Steiner çözümü saplamayı atar. */
    const edges: SteinerEdge[] = [
      { from: 'T1', to: 'T2', weight: 5 },
      { from: 'T1', to: 'X', weight: 1 },
      { from: 'X', to: 'T2', weight: 1 },
      { from: 'X', to: 'Y', weight: 1 },
      { from: 'Y', to: 'Z', weight: 1 },
    ];
    const r = solveSteiner({ edges, terminals: ['T1', 'T2'] });
    expect(r.totalWeight).toBe(2);
    expect(r.mstTotalWeight).toBe(4); /* T1-X, X-T2, X-Y, Y-Z → 4 */
    expect(r.steinerNodes).toEqual(['X']);
  });
});

describe('solveSteiner — sınır ve hata durumları', () => {
  it('erişilemez terminal — reachable=false', () => {
    /* Graf iki bileşene ayrılmış. */
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'X', to: 'Y', weight: 1 },
    ];
    const r = solveSteiner({ edges, terminals: ['A', 'X'] });
    expect(r.reachable).toBe(false);
    expect(r.treeEdges).toEqual([]);
  });

  it('boş kenar listesi hatası', () => {
    expect(() => solveSteiner({ edges: [], terminals: ['A'] })).toThrow(
      SteinerError,
    );
  });

  it('boş terminal listesi hatası', () => {
    expect(() =>
      solveSteiner({
        edges: [{ from: 'A', to: 'B', weight: 1 }],
        terminals: [],
      }),
    ).toThrow(SteinerError);
  });

  it('self-loop hatası', () => {
    expect(() =>
      solveSteiner({
        edges: [{ from: 'A', to: 'A', weight: 1 }],
        terminals: ['A'],
      }),
    ).toThrow(SteinerError);
  });

  it('negatif ağırlık hatası', () => {
    expect(() =>
      solveSteiner({
        edges: [{ from: 'A', to: 'B', weight: -1 }],
        terminals: ['A', 'B'],
      }),
    ).toThrow(SteinerError);
  });

  it('grafa ait olmayan terminal hatası', () => {
    expect(() =>
      solveSteiner({
        edges: [{ from: 'A', to: 'B', weight: 1 }],
        terminals: ['A', 'Z'],
      }),
    ).toThrow(SteinerError);
  });

  it('tekrar eden terminal hatası', () => {
    expect(() =>
      solveSteiner({
        edges: [{ from: 'A', to: 'B', weight: 1 }],
        terminals: ['A', 'A'],
      }),
    ).toThrow(SteinerError);
  });

  it('NaN ağırlık hatası', () => {
    expect(() =>
      solveSteiner({
        edges: [{ from: 'A', to: 'B', weight: NaN }],
        terminals: ['A', 'B'],
      }),
    ).toThrow(SteinerError);
  });
});

describe('solveSteiner — yaklaşım garantisi pratikte', () => {
  it('KMB ≤ 2 · OPT (basit kontrol — Y şeklinde)', () => {
    /* Optimum 3 olan örnekte (hub C ile 3 terminal): metrik kapanışta
     * tüm çiftlerin uzaklığı 2 (hub C üzerinden) ile direkt kenar
     * (ağırlık 2) eşit. Beraberlik bozumuna göre KMB ya hub-yolunu ya
     * direkt kenarları seçer; her iki durumda da yaklaşım sınırı sağlanır. */
    const edges: SteinerEdge[] = [
      { from: 'T1', to: 'C', weight: 1 },
      { from: 'T2', to: 'C', weight: 1 },
      { from: 'T3', to: 'C', weight: 1 },
      { from: 'T1', to: 'T2', weight: 2 },
      { from: 'T2', to: 'T3', weight: 2 },
      { from: 'T1', to: 'T3', weight: 2 },
    ];
    const r = solveSteiner({ edges, terminals: ['T1', 'T2', 'T3'] });
    const opt = 3;
    expect(r.totalWeight).toBeLessThanOrEqual(2 * opt);
  });

  it('5 terminalli çubuk graf — terminaller bir yol üzerinde', () => {
    /* A-B-C-D-E zinciri (her kenar 1). 5 terminalin hepsi alınırsa
     * tüm zincir gerekir → toplam 4. */
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'B', to: 'C', weight: 1 },
      { from: 'C', to: 'D', weight: 1 },
      { from: 'D', to: 'E', weight: 1 },
    ];
    const r = solveSteiner({
      edges,
      terminals: ['A', 'B', 'C', 'D', 'E'],
    });
    expect(r.totalWeight).toBe(4);
    expect(r.steinerNodes).toEqual([]);
  });

  it('zincir + sadece uçlar terminal — ara düğümler Steiner noktası', () => {
    /* A-B-C-D-E, terminaller {A, E}. Yol 4. B, C, D Steiner noktası. */
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'B', to: 'C', weight: 1 },
      { from: 'C', to: 'D', weight: 1 },
      { from: 'D', to: 'E', weight: 1 },
    ];
    const r = solveSteiner({ edges, terminals: ['A', 'E'] });
    expect(r.totalWeight).toBe(4);
    expect(r.steinerNodes.sort()).toEqual(['B', 'C', 'D']);
  });

  it('paralel kenarlar — en küçüğü seçilir', () => {
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 10 },
      { from: 'A', to: 'B', weight: 3 },
      { from: 'A', to: 'B', weight: 7 },
    ];
    const r = solveSteiner({ edges, terminals: ['A', 'B'] });
    expect(r.totalWeight).toBe(3);
  });

  it('Steiner ağacında çevrim yok — kenar sayısı düğüm − 1', () => {
    /* 4-düğümlü tam graf K4'te 4 terminal. MST = 3 kenar, çevrim yok. */
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'A', to: 'C', weight: 2 },
      { from: 'A', to: 'D', weight: 3 },
      { from: 'B', to: 'C', weight: 4 },
      { from: 'B', to: 'D', weight: 5 },
      { from: 'C', to: 'D', weight: 6 },
    ];
    const r = solveSteiner({
      edges,
      terminals: ['A', 'B', 'C', 'D'],
    });
    expect(r.treeEdges.length).toBe(r.treeNodes.length - 1);
  });

  it('sonuç deterministiktir — aynı giriş aynı çıktı', () => {
    const edges: SteinerEdge[] = [
      { from: 'A', to: 'B', weight: 2 },
      { from: 'B', to: 'C', weight: 3 },
      { from: 'A', to: 'C', weight: 4 },
      { from: 'C', to: 'D', weight: 1 },
    ];
    const r1 = solveSteiner({ edges, terminals: ['A', 'D'] });
    const r2 = solveSteiner({ edges, terminals: ['A', 'D'] });
    expect(r1.totalWeight).toBe(r2.totalWeight);
    expect(r1.treeEdges).toEqual(r2.treeEdges);
    expect(r1.steinerNodes).toEqual(r2.steinerNodes);
  });
});
