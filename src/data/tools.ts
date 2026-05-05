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
      'Harita üzerinde nokta seç, en kısa turu nearest-neighbor + 2-opt sezgiseliyle hesapla.',
    category: 'graf',
    status: 'soon',
  },
  {
    slug: 'atama-problemi-cozucu',
    title: 'Atama Problemi Çözücü',
    shortTitle: 'Atama (Hungarian)',
    description:
      'Maliyet matrisini gir, Macar algoritmasıyla optimum atamayı bul. İş–makine, görev–çalışan eşlemeleri için.',
    category: 'optimizasyon',
    status: 'soon',
  },
  {
    slug: 'knapsack-cozucu',
    title: 'Sırt Çantası (Knapsack) Çözücü',
    shortTitle: 'Knapsack',
    description:
      '0/1 ve fractional varyantları ile sırt çantası problemini çöz. Dinamik programlama tablolarını adım adım gör.',
    category: 'kombinatoryel',
    status: 'soon',
  },
  {
    slug: 'ders-programi-uretici',
    title: 'Sınav / Ders Programı Üretici',
    shortTitle: 'Ders Programı',
    description:
      'Öğretmen, sınıf ve zaman kısıtlarına göre çakışmasız haftalık program üret.',
    category: 'cizelgeleme',
    status: 'soon',
  },
] as const;

export function getReadyTools(): readonly Tool[] {
  return TOOLS.filter((tool) => tool.status === 'ready');
}
