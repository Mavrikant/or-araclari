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

---

## ADR-0003 — Plausible Analytics: domain-tabanlı yapılandırma + onaysız (çerezsiz) eager yükleme

**Tarih:** 2026-06-02 · **Döngü:** #6 · **Durum:** kabul

### Bağlam
Kullanıcı talebi: "add plausible support". İki tasarım sorusu vardı: (1) Plausible
sitesi nasıl tanımlanır — GA4 (`G-…`) veya Clarity (10 haneli) gibi ayrı bir
"ID" mi gerekir? (2) Plausible, GA4/Clarity gibi çerez tercih bandının arkasına
mı alınmalı yoksa eager mı yüklenmeli? (Talepte verilen `BMAxUwrIK8Icg2HpLysj2`
21 karakterlik bir nanoid — görev/istek izleme kimliği; Plausible bir
yapılandırma değeri değil, bu yüzden koda gömülmedi.)

### Seçenekler
1. Plausible'ı bir "ID" env değişkeniyle yapılandır, GA/Clarity gibi banda al.
2. Domain ile yapılandır (`PUBLIC_PLAUSIBLE_DOMAIN`), banda al (consent-gated).
3. Domain ile yapılandır, çerezsiz olduğu için onaysız eager yükle, bandı
   tetikleme. Script kaynağı (`PUBLIC_PLAUSIBLE_SRC`) override edilebilir
   (self-host + script uzantıları).

### Karar
Seçenek 3.

### Gerekçe
- Plausible siteleri **`data-domain`** ile tanımlanır; ayrı bir sayısal/dizgi
  site ID kavramı yoktur (hem Cloud hem self-host). "ID" alanı yanıltıcı olurdu.
- Plausible **çerezsizdir**, kalıcı tanımlayıcı/parmak izi tutmaz, kişisel veri
  toplamaz → KVKK/GDPR uyumlu **onaysız** ölçüm (Plausible'ın resmi tavsiyesi:
  "cookie banner gerekmez"). Banda almak gereksiz friction ve projenin
  gizlilik-öncelikli felsefesiyle tutarsız olurdu.
- `PUBLIC_PLAUSIBLE_SRC` opsiyonu, varsayılanı (`plausible.io/js/script.js`)
  bozmadan self-hosting ve script uzantılarını (örn. `outbound-links`) açar —
  Plausible kullanımının yaygın iki ihtiyacı.

### Sonuç
Çerez bandı yalnızca çerez yazan üçlü (`GA_ID`/`CLARITY_ID`/`ADSENSE_CLIENT_ID`)
için görünür; Plausible bandı tetiklemez. `gizlilik.astro` ve `cerezler.astro`
artık "consent-gated" ile "çerezsiz" hizmetleri ayırır (`consentGated` vs
`plausibleActive`).

### Güncelleme — 2026-06-02 (Döngü #7): secret yerine koda gömülü domain
Kullanıcı geri bildirimi: "Plausible için secret kullanma." Gerekçe doğru —
`data-domain` değeri herkese açık (sayfa kaynağında görünür) bir domaindir,
gizli bir bilgi değildir; secret'la korunması yanlış bir güvenlik modeli ve
gereksiz deploy friction'ı yaratıyordu (secret set edilmeden feature prod'da
ölü kaldı). Karar revize edildi:
- `PLAUSIBLE_DOMAIN` artık üretim build'inde `karaman.dev`'e **default**'lar
  (`import.meta.env.PROD ? 'karaman.dev' : ''`) — secret gerekmez, prod'da her
  zaman açık. `astro dev`'de kapalı (yerel trafik sayılmaz). `PUBLIC_*` env hâlâ
  override olarak okunur (fork/disable için), ama artık zorunlu değil.
- `deploy.yml`'daki iki secret passthrough **geri alındı** → workflow dosyası
  Plausible için hiç değişmiyor, dolayısıyla Q-CI-CHECK governance işareti de
  bu iş için geçersiz (🟡 → yok).
Çekirdek karar (çerezsiz, onaysız eager yükleme) değişmedi.
