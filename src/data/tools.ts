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
] as const;

export function getReadyTools(): readonly Tool[] {
  return TOOLS.filter((tool) => tool.status === 'ready');
}
