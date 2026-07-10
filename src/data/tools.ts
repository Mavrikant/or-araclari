export type ToolStatus = 'ready' | 'soon';

export type ToolCategory =
  | 'cizelgeleme'
  | 'optimizasyon'
  | 'kombinatoryel'
  | 'graf'
  | 'envanter'
  | 'olasilik';

export interface Tool {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  guideSlug?: string;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  cizelgeleme: 'Çizelgeleme',
  optimizasyon: 'Optimizasyon',
  kombinatoryel: 'Kombinatoryel',
  graf: 'Graf & Rota',
  envanter: 'Envanter & Tedarik',
  olasilik: 'Olasılık & Kuyruk',
};

export const TOOLS: readonly Tool[] = [
  {
    slug: 'lig-fiksturu-olusturucu',
    title: 'Lig Fikstürü Oluşturucu',
    shortTitle: 'Lig Fikstürü',
    description:
      'Tek veya çift devreli lig fikstürünü round-robin algoritmasıyla saniyeler içinde üret. CSV indirme, yazdırma ve paylaşılabilir bağlantı.',
    category: 'cizelgeleme',
    status: 'ready',
    guideSlug: 'fikstur-nasil-olusturulur',
  },
  {
    slug: 'lineer-programlama-cozucu',
    title: 'Lineer Programlama Çözücü',
    shortTitle: 'LP Çözücü',
    description:
      'Değişkenleri ve kısıtları görsel formla gir; GLPK\'nın WASM motoru tarayıcıda çözsün. İki değişkenli problemde uygun bölge ve optimum vertex anlık olarak çizilir.',
    category: 'optimizasyon',
    status: 'ready',
    guideSlug: 'dogrusal-programlama-nedir',
  },
  {
    slug: 'tsp-cozucu',
    title: 'Gezgin Satıcı (TSP) Çözücü',
    shortTitle: 'TSP Çözücü',
    description:
      'Noktaları satır satır gir veya Türkiye şehirlerinden seç; nearest-neighbor + 2-opt en kısa turu bulsun, sonuç interaktif Plotly haritasında çizilsin.',
    category: 'graf',
    status: 'ready',
    guideSlug: 'tsp-rota-optimizasyonu',
  },
  {
    slug: 'atama-problemi-cozucu',
    title: 'Atama Problemi Çözücü',
    shortTitle: 'Atama (Hungarian)',
    description:
      'Düzenlenebilir matris ızgarasında satır/sütun etiketlerini ve maliyetleri gir; Macar (Hungarian) algoritması optimum atamayı bulup hücreleri vurgular.',
    category: 'optimizasyon',
    status: 'ready',
    guideSlug: 'macar-algoritmasi',
  },
  {
    slug: 'knapsack-cozucu',
    title: 'Sırt Çantası (Knapsack) Çözücü',
    shortTitle: 'Knapsack',
    description:
      '0/1 ve fractional varyantlarıyla sırt çantası problemini çöz. Dinamik programlama ve açgözlü algoritma.',
    category: 'kombinatoryel',
    status: 'ready',
    guideSlug: 'knapsack-cesitleri',
  },
  {
    slug: 'ders-programi-uretici',
    title: 'Sınav / Ders Programı Üretici',
    shortTitle: 'Ders Programı',
    description:
      'Öğretmen, sınıf ve haftalık saat kısıtlarına göre çakışmasız haftalık takvim üret. Görsel hafta ızgarası, öğretmenler renk kodlu.',
    category: 'cizelgeleme',
    status: 'ready',
    guideSlug: 'ders-programi-olusturma',
  },
  {
    slug: 'eoq-hesaplayici',
    title: 'Ekonomik Sipariş Miktarı (EOQ)',
    shortTitle: 'EOQ',
    description:
      'Yıllık talep, sipariş maliyeti ve taşıma maliyetinden Wilson formülüyle optimum sipariş miktarını hesapla. Toplam maliyet eğrisi grafik olarak gösterilir.',
    category: 'envanter',
    status: 'ready',
    guideSlug: 'eoq-stok-yonetimi',
  },
  {
    slug: 'epq-uretim-lot-boyu',
    title: 'Üretim Lot Boyu (EPQ) Hesaplayıcı',
    shortTitle: 'EPQ / Üretim Lot Boyu',
    description:
      'Yıllık talep, kurulum maliyeti, taşıma maliyeti ve üretim hızını gir; tedarik anlık değil de sonlu hızla geldiğinde optimum üretim parti büyüklüğünü hesapla. Toplam maliyet eğrisi anlık çizilir.',
    category: 'envanter',
    status: 'ready',
    guideSlug: 'epq-uretim-lot-boyu',
  },
  {
    slug: 'mm1-kuyruk-analizci',
    title: 'M/M/1 Kuyruk Analizci',
    shortTitle: 'M/M/1 Kuyruk',
    description:
      'Geliş ve hizmet hızlarından kararlı durumda ortalama bekleyiş, sistemde olma süresi ve durum olasılıklarını hesapla. Kuyruk teorisi temelinin görsel keşfi.',
    category: 'olasilik',
    status: 'ready',
    guideSlug: 'mm1-kuyruk-teorisi',
  },
  {
    slug: 'mmc-kuyruk-analizci',
    title: 'M/M/c Çoklu Sunucu Kuyruk Analizci',
    shortTitle: 'M/M/c Kuyruk',
    description:
      'Geliş hızı (λ), sunucu başına hizmet hızı (μ) ve sunucu sayısı (c) ver; Erlang-C formülüyle bekleme olasılığı, ortalama kuyruk uzunluğu ve durum dağılımı anlık olarak hesaplansın. Sunucu sayısı duyarlılık tablosuyla "bir sunucu daha eklesem ne olur?" sorusu görsel.',
    category: 'olasilik',
    status: 'ready',
    guideSlug: 'mmc-kuyruk-erlang-c',
  },
  {
    slug: 'hemsire-vardiya-planlayici',
    title: 'Hemşire Vardiya Planlayıcı',
    shortTitle: 'Vardiya Planlayıcı',
    description:
      'Hastane servisi için 1 aylık nöbet listesini renkli ızgarada planla. Otomatik doldur, klavyeden hızlı düzenle, kapsama ve dinlenme ihlallerini canlı gör.',
    category: 'cizelgeleme',
    status: 'ready',
    guideSlug: 'hemsire-vardiya-planlama',
  },
  {
    slug: 'pert-cpm-kritik-yol',
    title: 'PERT / CPM Kritik Yol Analizci',
    shortTitle: 'PERT / CPM',
    description:
      'Aktivite, süre ve öncelleri gir; ileri/geri pas ile ES, EF, LS, LF ve slack hesaplansın. Kritik yol vurgulu Gantt çizelgesi otomatik üretilir.',
    category: 'cizelgeleme',
    status: 'ready',
    guideSlug: 'pert-cpm-kritik-yol',
  },
  {
    slug: 'markov-zinciri',
    title: 'Markov Zinciri Sabit Dağılım',
    shortTitle: 'Markov Zinciri',
    description:
      'n×n geçiş matrisini gir; sabit dağılımı (π), ortalama dönüş sürelerini ve başlangıç dağılımının zaman içinde nasıl değiştiğini anlık olarak hesapla. Tarayıcıda lineer sistem çözümü.',
    category: 'olasilik',
    status: 'ready',
    guideSlug: 'markov-zinciri',
  },
  {
    slug: 'ulastirma-problemi-cozucu',
    title: 'Ulaştırma Problemi Çözücü',
    shortTitle: 'Ulaştırma Problemi',
    description:
      'Kaynak kapasitelerini, hedef taleplerini ve birim taşıma maliyetlerini gir; Kuzeybatı Köşesi başlangıcı + MODI iterasyonları ile en az (veya en çok) maliyetli sevkiyat planını anlık olarak bul. Dengesiz problemler otomatik dengelenir.',
    category: 'optimizasyon',
    status: 'ready',
    guideSlug: 'ulastirma-problemi',
  },
  {
    slug: 'karar-analizi',
    title: 'Karar Analizi (EMV / EVPI)',
    shortTitle: 'Karar Analizi',
    description:
      'Alternatif × doğa durumu getiri matrisini gir; belirsizlik altında Maximax, Maximin, Laplace, Hurwicz ve Savage Regret kriterleri ile olasılıklar varsa EMV, EOL ve EVPI tek geçişte hesaplansın. Hurwicz iyimserlik katsayısı kaydırma çubuğuyla canlı ayarlanır.',
    category: 'olasilik',
    status: 'ready',
    guideSlug: 'karar-analizi-emv',
  },
  {
    slug: 'sonlu-kapasite-kuyruk',
    title: 'Sonlu Kapasiteli Kuyruk Analizci (M/M/1/K, M/M/c/K)',
    shortTitle: 'M/M/1/K · M/M/c/K',
    description:
      'M/M/1/K ve M/M/c/K sonlu kapasiteli kuyruk modellerinde bloklama olasılığı P_K, efektif geliş hızı, durum olasılıkları ve kararlı durum ortalamaları (L, Lq, W, Wq) tarayıcıda anında hesaplansın. Erlang-B kayıp sistemi (M/M/c/c) özel hâliyle birlikte. λ > μ olsa da sistem kararlı kalır.',
    category: 'olasilik',
    status: 'ready',
    guideSlug: 'sonlu-kapasite-kuyruk',
  },
  {
    slug: 'oyun-teorisi-cozucu',
    title: 'İki Kişilik Sıfır Toplamlı Oyun Çözücü',
    shortTitle: 'Oyun Teorisi',
    description:
      'Satır oyuncusunun getiri matrisini gir; saddle point varsa saf strateji denge noktasını, yoksa karışık stratejiyi LP üzerinden (glpk.js WASM) tarayıcıda anlık çöz. Maximin / minimax sınırları, dominant strateji elemesi ve oyunun değeri v* tek geçişte.',
    category: 'optimizasyon',
    status: 'ready',
    guideSlug: 'sifir-toplamli-oyun',
  },
  {
    slug: 'erlang-a-bekleme-birakma',
    title: 'Erlang-A Bekleme & Bırakma Analizci (M/M/c + abandonment)',
    shortTitle: 'Erlang-A (M/M/c+M)',
    description:
      'Bekleyen müşterinin sabırsızlandığı modern çağrı merkezi modeli — λ, μ, sunucu sayısı c ve bireysel bırakma hızı θ ver; bırakma olasılığı P(abandon), efektif servis hızı, ortalama bekleme süresi ve durum dağılımı tarayıcıda anlık hesaplansın. θ > 0 olduğunda λ ≥ c·μ olsa bile sistem kararlıdır.',
    category: 'olasilik',
    status: 'ready',
    guideSlug: 'erlang-a-sabirsiz-musteri',
  },
  {
    slug: 'maks-akis-cozucu',
    title: 'Maksimum Akış (Max-Flow) Çözücü',
    shortTitle: 'Maks-Akış',
    description:
      'Yönlü kapasiteli ağda kaynak (s) ile hedef (t) arasındaki maksimum akışı Edmonds-Karp algoritmasıyla (BFS ile en kısa artıran yol) tarayıcıda anlık çöz. Her kenardaki akış, doygun kenarlar ve min-cut (Ford-Fulkerson teoremi: max-flow = min-cut) görselleştirilir.',
    category: 'graf',
    status: 'ready',
    guideSlug: 'maks-akis-min-cut',
  },
  {
    slug: 'min-maliyet-akis-cozucu',
    title: 'Min Maliyetli Akış (Min-Cost Flow) Çözücü',
    shortTitle: 'Min-Maliyetli Akış',
    description:
      'Yönlü ağda her kenarın kapasitesi ve birim maliyeti olsun; kaynak (s) ile hedef (t) arasında d birim akıtmanın en ucuz yolunu Successive Shortest Path algoritmasıyla (residüel grafta SPFA / Bellman-Ford) tarayıcıda anlık bul. Hedef akış boş bırakılırsa maks akış kadarı minimum maliyetle akıtılır; her kenarda akış, doygunluk ve maliyet katkısı raporlanır. Ulaştırma ve atama problemlerinin ağ-üstüne genellemesi.',
    category: 'graf',
    status: 'ready',
    guideSlug: 'min-maliyet-akis',
  },
  {
    slug: 'bimatris-nash-cozucu',
    title: 'Bimatris (Genel Toplam) Nash Dengesi Çözücü',
    shortTitle: 'Bimatris Nash',
    description:
      'İki oyuncunun ayrı payoff matrislerini (A: satır, B: sütun) gir; tüm Nash dengelerini — saf ve karışık — support enumeration algoritmasıyla tarayıcıda anlık bul. Tutuklu Açmazı, Cinsiyet Savaşı, Stag Hunt gibi klasik koordinasyon ve çatışma oyunlarının tam çözümü; sıfır toplamlı oyun çözücünün genel toplama uzantısı.',
    category: 'optimizasyon',
    status: 'ready',
    guideSlug: 'nash-dengesi-bimatris',
  },
  {
    slug: 'en-kisa-yol-cozucu',
    title: 'En Kısa Yol Çözücü (Dijkstra · Bellman-Ford)',
    shortTitle: 'En Kısa Yol',
    description:
      'Yönlü ağırlıklı ağda kaynaktan (s) tüm düğümlere ya da seçilen hedefe (t) minimum toplam ağırlıklı yolu Dijkstra (binary heap, ≥ 0 ağırlık) ya da Bellman-Ford (negatif ağırlık + negatif çevrim tespiti) ile tarayıcıda anlık bul. Algoritma seçimi otomatik: negatif kenar varsa Bellman-Ford. Her düğüm için uzaklık + predecessor; hedef verilirse adım adım yol rekonstrüksiyonu.',
    category: 'graf',
    status: 'ready',
    guideSlug: 'en-kisa-yol-dijkstra-bellman-ford',
  },
  {
    slug: 'a-star-grid-cozucu',
    title: 'A* (A-yıldız) & JPS Izgara Yol Bulucu',
    shortTitle: 'A* / JPS Yol Bulucu',
    description:
      '2D ızgara üzerinde bir başlangıç hücresinden hedefe en kısa yolu A* (A-yıldız) sezgisel arama ya da JPS (Jump Point Search) ile tarayıcıda anlık bul. Manhattan, Octile, Euclidean, Chebyshev veya sıfır heuristic; 4 ya da 8 bağlantı (kardinal 1, çapraz √2); köşe kesme yasak/serbest seçeneği. JPS 8-bağlantı eş-maliyetli ızgaralarda A*\'ın simetrisini kırıp jump point\'lere odaklanarak dramatik biçimde daha az heap-pop yapar. Görsel ızgarada tıklayarak engelleri çiz; yolun her hücresi, açılan kapalı küme ve sezginin iyiliği aynı anda görselleştirilir.',
    category: 'graf',
    status: 'ready',
    guideSlug: 'a-star-grid-heuristik',
  },
  {
    slug: 'minimum-yayilan-agac-cozucu',
    title: 'Minimum Yayılan Ağaç (MST) Çözücü',
    shortTitle: 'MST (Prim · Kruskal)',
    description:
      'Yönsüz ağırlıklı bir ağdaki tüm düğümleri birbirine bağlayan en az toplam ağırlıklı ağacı Prim (binary heap) ya da Kruskal (union-find) algoritmasıyla tarayıcıda anlık bul. Graf bağlı değilse minimum yayılan orman; paralel kenarlardan en küçük olanı seçilir; negatif ağırlık desteklenir. Ağ tasarımı, kümeleme ve yaklaşım algoritmalarının temel taşı.',
    category: 'graf',
    status: 'ready',
    guideSlug: 'minimum-yayilan-agac-prim-kruskal',
  },
  {
    slug: 'steiner-agaci-cozucu',
    title: 'Steiner Ağacı Çözücü (KMB 2-Yaklaşımı)',
    shortTitle: 'Steiner Ağacı',
    description:
      'Yönsüz ağırlıklı bir ağda bir terminal alt kümesini birbirine bağlayan en az toplam ağırlıklı ağacı Kou-Markowsky-Berman 1981 algoritmasıyla tarayıcıda anlık bul. Steiner noktaları (terminal olmayan ara düğümler) toplam ağırlığı düşürmek için seçilebilir. Problem NP-zor; KMB 2-yaklaşım garantisi sağlar. Tüm grafın MST karşılaştırması ve terminaller arası en kısa yollar (metrik kapanış) raporlanır. VLSI, multicast ve telekomünikasyon backbone tasarımının temeli.',
    category: 'graf',
    status: 'ready',
    guideSlug: 'steiner-agaci-2-yaklasim',
  },
  {
    slug: 'newsvendor-cozucu',
    title: 'Newsvendor (Tek-Dönem Envanter) Çözücü',
    shortTitle: 'Newsvendor',
    description:
      'Gazete, taze meyve, sezonluk giyim, konser bileti gibi tek dönemlik ürünler için belirsiz talep altında optimum sipariş miktarını critical fractile (F(Q*) = Cu/(Cu+Co)) yöntemiyle tarayıcıda anlık hesapla. Normal ya da üniform talep, Cu/Co doğrudan girişi veya fiyat-maliyet-hurda-ceza modelinden türetme, beklenen kâr / eksik / fazla / fill rate ve Q duyarlılık eğrisi tek geçişte.',
    category: 'envanter',
    status: 'ready',
    guideSlug: 'newsvendor-tek-donem-envanter',
  },
  {
    slug: 'johnson-akis-tipi-cizelgeleme',
    title: 'Johnson Kuralı — 2/3 Makina Akış-Tipi Çizelgeleme',
    shortTitle: 'Johnson (Flow-Shop)',
    description:
      'Her iş önce M1 sonra M2 (isteğe bağlı M3) makinesinden geçen akış-tipi atölyede toplam süreyi (Cmax) minimize eden iş sırasını Johnson 1954 kuralı ile tarayıcıda anlık bul. İki makinada optimum garantili; üç makinada min(p₁) ≥ max(p₂) ya da min(p₃) ≥ max(p₂) sağlanırsa optimum, sağlanmazsa Johnson-Bellman sezgiseli. Gantt çizelgesi, U/V grup analizi ve makine boş süreleri tek geçişte.',
    category: 'cizelgeleme',
    status: 'ready',
    guideSlug: 'johnson-akis-tipi-cizelgeleme',
  },
  {
    slug: 'wagner-whitin-cozucu',
    title: 'Wagner-Whitin Dinamik Lot Boyutlandırma',
    shortTitle: 'Wagner-Whitin',
    description:
      'Zamana bağlı değişken talep, kurulum ve taşıma maliyetleri altında çok-dönemli üretim/sipariş çizelgesini Wagner-Whitin (1958) ileri dinamik programlaması ile tarayıcıda anlık optimize et. Zero Inventory Ordering ilkesi, lot yapısı, dönem defteri ve Silver-Meal sezgiseliyle otomatik karşılaştırma. Değişken talep altında EOQ / EPQ ailesinin doğal DP uzantısı, MRP ve APS motorlarının çekirdeğinde bulunan klasik.',
    category: 'envanter',
    status: 'ready',
    guideSlug: 'wagner-whitin-dinamik-lot',
  },
  {
    slug: 'rop-emniyet-stogu',
    title: 'Yeniden Sipariş Noktası & Emniyet Stoğu (ROP · SS)',
    shortTitle: 'ROP / Emniyet Stoğu',
    description:
      'Sürekli-izleme (Q, R) modelinde ortalama günlük talep, talep standart sapması, ortalama ve isteğe bağlı tedarik süresi belirsizliği ile hedef servis seviyesinden yeniden sipariş noktası R = μL + z·σ_DL ve emniyet stoğu SS = z·σ_DL tarayıcıda anlık hesaplansın. Type-I (cycle service) veya Type-II (fill rate) hedef; EOQ türetimi ve toplam yıllık maliyet, testere dişi stok grafiği ve α duyarlılık tablosuyla EOQ + Newsvendor + Wagner-Whitin envanter serisini tamamlayan sürekli stokastik model.',
    category: 'envanter',
    status: 'ready',
    guideSlug: 'yeniden-siparis-noktasi-emniyet-stogu',
  },
] as const;

export function getReadyTools(): readonly Tool[] {
  return TOOLS.filter((tool) => tool.status === 'ready');
}
