/**
 * Türkiye'nin nüfus olarak büyük 30 ilinin yaklaşık merkez koordinatları
 * (boylam, enlem). TSP aracında "Şehir ekle" datalist'i besler.
 *
 * Koordinatlar il merkezi yaklaşımıdır; uzun-mesafe tur metodolojisi için
 * yeterli kesinlikte (km cinsinden hata <5). Kaynak: kamuya açık ortalama
 * koordinatlar.
 */

export interface TurkishCity {
  /** Şehir adı (Türkçe karakterli). */
  label: string;
  /** Boylam (longitude, doğu pozitif). */
  x: number;
  /** Enlem (latitude, kuzey pozitif). */
  y: number;
}

export const TURKISH_CITIES: ReadonlyArray<TurkishCity> = [
  { label: 'İstanbul', x: 28.98, y: 41.01 },
  { label: 'Ankara', x: 32.85, y: 39.93 },
  { label: 'İzmir', x: 27.14, y: 38.42 },
  { label: 'Bursa', x: 29.06, y: 40.18 },
  { label: 'Antalya', x: 30.71, y: 36.90 },
  { label: 'Adana', x: 35.32, y: 37.00 },
  { label: 'Konya', x: 32.49, y: 37.87 },
  { label: 'Gaziantep', x: 37.38, y: 37.07 },
  { label: 'Şanlıurfa', x: 38.79, y: 37.16 },
  { label: 'Kayseri', x: 35.49, y: 38.73 },
  { label: 'Mersin', x: 34.62, y: 36.81 },
  { label: 'Diyarbakır', x: 40.21, y: 37.91 },
  { label: 'Hatay', x: 36.20, y: 36.20 },
  { label: 'Manisa', x: 27.43, y: 38.61 },
  { label: 'Kahramanmaraş', x: 36.94, y: 37.58 },
  { label: 'Samsun', x: 36.34, y: 41.29 },
  { label: 'Balıkesir', x: 27.89, y: 39.65 },
  { label: 'Van', x: 43.41, y: 38.50 },
  { label: 'Aydın', x: 27.85, y: 37.85 },
  { label: 'Denizli', x: 29.09, y: 37.78 },
  { label: 'Sakarya', x: 30.40, y: 40.79 },
  { label: 'Tekirdağ', x: 27.51, y: 40.98 },
  { label: 'Muğla', x: 28.36, y: 37.21 },
  { label: 'Eskişehir', x: 30.52, y: 39.78 },
  { label: 'Mardin', x: 40.74, y: 37.31 },
  { label: 'Malatya', x: 38.31, y: 38.36 },
  { label: 'Trabzon', x: 39.72, y: 41.00 },
  { label: 'Erzurum', x: 41.27, y: 39.91 },
  { label: 'Ordu', x: 37.88, y: 40.99 },
  { label: 'Sivas', x: 37.02, y: 39.74 },
];

/** Etiketten şehir nesnesine arama (case-insensitive Türkçe). */
export function findCity(label: string): TurkishCity | undefined {
  const target = label.trim().toLocaleLowerCase('tr');
  return TURKISH_CITIES.find((c) => c.label.toLocaleLowerCase('tr') === target);
}
