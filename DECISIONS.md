# Mimari & Ürün Kararları (ADR)

Önemli her karar için: bağlam, seçenekler, karar, gerekçe, sonuç.

---

## ADR-0001 — `plotly.js-basic-dist-min` için modül beyanı

**Tarih:** 2026-05-18 · **Döngü:** #1 · **Durum:** kabul

### Bağlam
`plotly.js-basic-dist-min` paketi tip beyanı içermiyor. TypeScript `strict`
modu altında `astro check` `ts7016` hatası veriyor; LP ve TSP araçları
bundan etkileniyor.

### Seçenekler
1. `@types/plotly.js-basic-dist-min` (paket mevcut değil)
2. Tam `@types/plotly.js` paketini ekle (~MB)
3. Yerel olarak `declare module` ile minimal beyan
4. `// @ts-ignore` ile baskıla

### Karar
Seçenek 3: `src/types/plotly.d.ts` içinde `declare module 'plotly.js-basic-dist-min';`

### Gerekçe
- Çağrı yerlerinde zaten yerel `PlotlyApi` tipi tanımlı (sadece kullanılan
  yüzeyler — `newPlot`, `react`, `purge`, `Plots.resize`). Tam tipler gereksiz.
- Bağımlılık eklenmediği için bundle ve denetim yüzeyi büyümez.
- `// @ts-ignore` davranışı saklar; modül beyanı niyeti açıkça belgeler.

### Sonuç
İki çağrı yerinde `ts7016` çözüldü. Build/test davranışı değişmedi.
