export type ToolStatus = 'ready' | 'soon';

export type ToolCategory =
  | 'cizelgeleme'
  | 'optimizasyon'
  | 'kombinatoryel'
  | 'graf';

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
      'Doğrusal amaç ve kısıtlarla tanımlı problemleri tarayıcıda çöz. glpk.js destekli, simpleks adımlarını görsel olarak izle.',
    category: 'optimizasyon',
    status: 'soon',
    guideSlug: 'dogrusal-programlama-nedir',
  },
  {
    slug: 'tsp-cozucu',
    title: 'Gezgin Satıcı (TSP) Çözücü',
    shortTitle: 'TSP Çözücü',
    description:
      'Noktaların koordinatlarını gir, en kısa turu nearest-neighbor + 2-opt sezgiseliyle bul. Görsel önizleme dahil.',
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
] as const;

export function getReadyTools(): readonly Tool[] {
  return TOOLS.filter((tool) => tool.status === 'ready');
}
