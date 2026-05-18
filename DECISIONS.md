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

---

## ADR-0002 — Geride kalmış Dependabot PR'ı kapatıp manuel `npm update` ile değiştir

**Tarih:** 2026-05-18 · **Döngü:** #4 · **Durum:** kabul

### Bağlam
Dependabot PR #14 (`devalue` 5.8.0 → 5.8.1) Astro 6 yükseltmesi, tip düzeltmeleri ve denetim dosyalarından önce açıldı. `mergeStateStatus: UNKNOWN`; lokal olarak çekildiğinde main'e karşı 11 dosyada eski hâli geri taşıyacak şekilde divergent. Bu arada Dependabot Alert #2 ("Svelte devalue: DoS via sparse array deserialization", high) aynı patch ile kapatılıyor.

### Seçenekler
1. PR'a `@dependabot rebase` yorumu yaz, beklet
2. PR'ı lokal olarak rebase et, force-push (Dependabot dalına)
3. PR'ı kapat, `npm update devalue` ile temiz patch'i yeni PR'da uygula

### Karar
Seçenek 3: PR #14 kapatıldı, PR #18 açıldı.

### Gerekçe
- (1) zaman bilinmez ve aradaki Astro yükseltmesi yüzünden Dependabot rebase'i çakışma üretebilirdi.
- (2) Dependabot dalına force-push ajan etiketini bozar; manuel müdahale beklenmedik.
- (3) `npm update devalue` `package.json`'daki `^` aralığı koruyarak yalnızca lock dosyasını günceller — patch sürüm bu. Audit yüzeyi (6 → 5 zafiyet), 1 high gitti.

### Sonuç
PR #14 superseded olarak kapatıldı. PR #18 1 dosya / 4 satır değişiklikle merge edildi. Yeni Dependabot PR'ları için kural: ajan, main'in çok ileride olduğu Dependabot PR'larını otomatik olarak yerine "manuel `npm update <pkg>`" patch'iyle değiştirebilir; orijinal PR'ı kapatırken "superseded by #<n>" yorumu bırakır.
