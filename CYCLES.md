# Döngü Günlüğü

Otonom ajanın çalışma günlüğü. Append-only. Her döngü için: tarih, seçilen iş,
kalite kapısı sonuçları, deploy durumu, sıradaki adım.

---

## DÖNGÜ #1 — 2026-05-18

**Yapılan:** `npm run check` üzerinde 4 TypeScript hatası giderildi; otonom ajan denetim dosyaları (CYCLES.md, BACKLOG.md, DECISIONS.md, INCIDENTS.md) oluşturuldu.

**Detay:**
- `src/types/plotly.d.ts` eklendi — `plotly.js-basic-dist-min` için modül beyanı (ts7016 × 2)
- `lineer-programlama-cozucu.astro:368` — ternary literal genişlemesi `as` ile daraltıldı (ts2322)
- `tsp-cozucu.astro:344` — type predicate `Partial<PointEntry>` yerine `PointEntry` yapıldı (ts2677)

**Kalite kapıları:** check ✓ (0 hata) · test ✓ (234/234) · build ✓ (30 sayfa) · Lighthouse — yalnızca kod tipi değişikliği, davranış değişikliği yok, ek ölçüm gerekmedi

**Yayın:** PR açılacak ve CI yeşilse merge.

**İşaret:** yok (sırf 🟢 yeşil eylemler)

**Sıradaki:** CI workflow `npm run check` ve `npm run test` adımları içermiyor — bunu eklemek DoD'u sürekli korur. Backlog'a alındı (Q-CI-CHECK).

---

## DÖNGÜ #2 — 2026-05-18

**Yapılan:** README yol haritası gerçekle hizalandı — Faz 5 satırındaki yanıltıcı "LP solver hâlâ yapım aşamasında" notu kaldırıldı (LP `tools.ts`'de `ready`) ve son dönemde yayınlanan dört araç (EOQ, M/M/1, Hemşire Vardiya, PERT/CPM) için Faz 6 eklendi.

**Detay:**
- `README.md` "Yol Haritası" tablosu: Faz 5 başlığı `LP Çözücü, TSP, Atama, Knapsack, Ders Programı` oldu
- `README.md` Faz 6 satırı eklendi: `EOQ, M/M/1 Kuyruk, Hemşire Vardiya Planlayıcı, PERT/CPM`

**Kalite kapıları:** check ✓ (0 hata, 17 hint) · test ✓ (234/234, 12 dosya) · build ✓ (30 sayfa) · Lighthouse — yalnızca README değişti, üretilen `dist/` etkilenmedi; ölçüm gerekmedi

**Yayın:** PR açılacak ve CI yeşilse merge.

**İşaret:** yok (sırf 🟢 yeşil eylem — içerik düzeltmesi)

**Sıradaki:** Q-AUDIT (npm audit 6 zafiyet incelemesi) ya da Q-UNUSED (3 kullanılmayan değişken temizliği — XS). Sıradaki döngüde Q-UNUSED tercih edilecek (XS efor, %100 yeşil, denetim warning sayısını düşürür).

---

## DÖNGÜ #3 — 2026-05-18

**Yapılan:** 3 kullanılmayan değişken/tip temizliği (Q-UNUSED) — `nurse-schedule.test.ts` `Schedule` importu, `eoq-hesaplayici.astro` `ys` değişkeni, `lineer-programlama-cozucu.astro` `slackPanel` referansı kaldırıldı.

**Detay:**
- `src/lib/nurse-schedule.test.ts`: import bloğunda kullanılmayan `type Schedule` kaldırıldı
- `src/pages/araclar/eoq-hesaplayici.astro:241`: hiç tüketilmeyen `ys = points.map(p => p.total)` ölü değişkeni kaldırıldı (chart için ayrıca `yMax` farklı bir map ile hesaplanıyor)
- `src/pages/araclar/lineer-programlama-cozucu.astro:456`: referanslanmayan `slackPanel` DOM çağrısı kaldırıldı (`slackTbody` tabloyu güncelliyor)

**Kalite kapıları:** check ✓ (0 hata, 14 hint — 17'den −3) · test ✓ (234/234, 12 dosya) · build ✓ (30 sayfa, 5.34s) · Lighthouse — yalnızca ölü kod silindi, davranış aynı, ek ölçüm gerekmedi

**Yayın:** PR #17 açıldı, CI yeşil (Code Review Doctor pass), merge edildi, `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 26043905670).

**İşaret:** yok (sırf 🟢 yeşil eylem — ölü kod temizliği)

**Sıradaki:** Q-DEPENDABOT-14 (devalue 5.8.0 → 5.8.1 patch — XS) ya da Q-AUDIT (6 zafiyet incelemesi — S). Sıradaki döngüde Q-DEPENDABOT-14 tercih edilebilir; patch sürüm yükseltmesi düşük riskli ve denetimi azaltır. Q-CONTENT-CONFIG (`astro:schema` `z` deprecate uyarısı) hâlâ 13 hint üretiyor — kalan büyük hint kaynağı bu.

---

## DÖNGÜ #4 — 2026-05-18

**Yapılan:** `devalue` 5.8.0 → 5.8.1 transitive patch yükseltmesi — Dependabot Alert #2 ("Svelte devalue: DoS via sparse array deserialization", high) kapatıldı. Q-DEPENDABOT-14 ve Q-AUDIT'in high kısmı tek hamlede çözüldü.

**Detay:**
- `devalue` Astro üzerinden transitive bağımlılık (`astro@6.2.2 → devalue`); `package.json` doğrudan referans tutmuyor.
- Dependabot PR #14 main'in çok gerisinde kaldığı için (`mergeStateStatus: UNKNOWN`, Astro 6 + tip düzeltmeleri + denetim dosyaları sonrası 10+ dosyada eski hâli geri taşıyacaktı) yerine `npm update devalue` ile temiz patch uygulandı.
- PR #14 "superseded by #18" yorumuyla kapatıldı.
- `npm audit`: 6 → 5 zafiyet (1 high gitti; kalan 5 moderate `yaml-language-server` → `volar-service-yaml` → `@astrojs/language-server` → `@astrojs/check` zincirinde, fix `--force` ile breaking-change istiyor — ayrı backlog).

**Kalite kapıları:** check ✓ (0 hata, 14 hint — değişmedi) · test ✓ (234/234, 12 dosya) · build ✓ (30 sayfa, 4.47s) · Lighthouse — yalnızca transitive lock dosyası değişti, üretilen `dist/` etkilenmedi

**Yayın:** PR #18 açıldı, CI yeşil (Code Review Doctor pass), merge edildi, `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 26044158252). Dependabot PR #14 superseded olarak kapatıldı.

**İşaret:** 🟡 SARI — Dependabot PR'ı yerine ajan elle `npm update devalue` ile transitive bağımlılık güncellemesi yaptı + Dependabot PR #14 ajan tarafından kapatıldı. Gerekçe DECISIONS.md'ye ADR-0002 olarak yazılacak.

**Sıradaki:** Q-CONTENT-CONFIG (`astro:schema` `z` deprecate uyarısı, 13 hint kaynağı — S, refactor). Astro 6 önerisine geçiş hem hint sayısını ciddi düşürür hem gelecek breaking-change riskini azaltır.

---

## DÖNGÜ #5 — 2026-05-18

**Yapılan:** `src/content.config.ts` içindeki `import { z } from 'astro:schema'` deprecate import'u `astro/zod`'a taşındı. `astro:schema` virtual module Astro 7'de kaldırılacak; resmi geçiş bu.

**Detay:**
- `src/content.config.ts:2` tek satır değişikliği — davranış değişmedi.
- `astro/client.d.ts` `astro:schema` modülünü `@deprecated` JSDoc ile işaretlemiş ve `astro/zod` yönlendirmesi belge halinde.
- İçerik koleksiyon şeması (`rehberler`) ve `getCollection`/`render` çağrıları etkilenmedi; 30 sayfanın hepsi build sırasında temiz derlendi.

**Kalite kapıları:** check ✓ (0 hata, **0 hint** — 14'ten −14) · test ✓ (234/234) · build ✓ (30 sayfa, 4.17s) · Lighthouse — yalnızca import yolu değişti, üretilen `dist/` davranışı aynı

**Yayın:** PR #19 açıldı, CI yeşil (Code Review Doctor pass), merge edildi, `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 26044398068).

**İşaret:** yok (sırf 🟢 yeşil eylem — resmi migration)

**Sıradaki:** Q-OG-IMAGE (her araç için statik OG kart, M efor — içerik/SEO). Alternatif: backlog'daki yeni araç fikirlerinden F-EBQ (Üretim Lot Boyu — S efor, mevcut EOQ deseninin uzantısı, hızlı kazanç). Q-AUDIT-YAML (M efor, breaking-change riski) ya da Q-CI-CHECK (🔴 kırmızı, insan onayı) ileride değerlendirilir.

---

## DÖNGÜ #6 — 2026-06-02

**Yapılan:** Kullanıcı talebi — Plausible Analytics desteği eklendi. Mevcut
env-gated analitik desenine paralel, ama Plausible çerezsiz olduğu için
**onaysız eager** yüklenir ve çerez tercih bandını tetiklemez.

**Detay:**
- `src/data/site.ts`: `PLAUSIBLE_DOMAIN` (`PUBLIC_PLAUSIBLE_DOMAIN`) ve opsiyonel
  `PLAUSIBLE_SRC` (`PUBLIC_PLAUSIBLE_SRC`, varsayılan `plausible.io/js/script.js`)
  export'ları. Plausible'da ayrı "ID" yok — site `data-domain` ile tanımlanır.
- `src/layouts/BaseLayout.astro`: `PLAUSIBLE_DOMAIN` set ise `<script defer
  data-domain src>` eager render edilir; çerez bandı koşulu (`GA_ID ||
  ADSENSE_CLIENT_ID || CLARITY_ID`) Plausible'ı **içermez** (bilinçli).
- `src/pages/gizlilik.astro` + `src/pages/cerezler.astro`: "consent-gated" ile
  "çerezsiz" hizmetler ayrıldı; Plausible üçüncü-taraf listesine ve çerez
  politikasına "hiçbir çerez yerleştirmez" notuyla eklendi. Yasal sayfa tarihi
  "2 Haziran 2026" oldu.
- `README.md`: env tablosuna iki satır + bandı tetiklemediğine dair açıklama.
- `.github/workflows/deploy.yml`: iki secret passthrough.
- `DECISIONS.md`: ADR-0003 (domain-as-ID + onaysız eager yükleme gerekçesi).

**Doğrulama:** `PUBLIC_PLAUSIBLE_DOMAIN=karaman.dev` ile build → script `<head>`'de
ve alt sayfalarda; band yok. Plausible + `PUBLIC_GA_ID` birlikte → her iki
script + band var. `PUBLIC_PLAUSIBLE_SRC` override → custom src render ediliyor.
Env yokken → script yok. Yasal sayfaların koşullu içeriği her iki durumda doğru.

**Kalite kapıları:** check ✓ (0 hata, 0 hint) · test ✓ (234/234) · build ✓ (30
sayfa) · Lighthouse — Plausible scripti `defer` + hafif (~1KB), tek dış istek;
ölçülebilir regresyon beklenmez.

**Yayın:** Branch `claude/dreamy-keller-lNCQV`'a push, draft PR açılacak.

**İşaret:** 🟡 SARI — `deploy.yml` workflow dosyası değişti (iki secret
passthrough). Backlog'daki Q-CI-CHECK notuna göre workflow değişiklikleri insan
onayı ister; bu yüzden PR draft açılıyor ve workflow değişikliği PR gövdesinde
açıkça işaretleniyor. Passthrough olmadan secret build'e ulaşmadığından feature
prod'da çalışmaz — bu yüzden kapsama dahil edildi.

**Sıradaki:** Q-OG-IMAGE (statik OG kart) ya da F-EBQ (EPQ/EBQ aracı).

---

## DÖNGÜ #7 — 2026-06-02

**Yapılan:** Kullanıcı geri bildirimi sonrası Plausible artık secret kullanmıyor.
Canlı testte (#6 merge sonrası) Plausible scripti çıkmadı: `PUBLIC_PLAUSIBLE_DOMAIN`
secret'ı set edilmemişti, dolayısıyla feature prod'da ölü kalmıştı. `data-domain`
herkese açık bir domain (gizli değil), bu yüzden secret yanlış modeldi.

**Detay:**
- `src/data/site.ts`: `PLAUSIBLE_DOMAIN` artık `import.meta.env.PROD ? 'karaman.dev'
  : ''`'e default'lar — secret gerekmez, üretimde her zaman açık; `astro dev`'de
  kapalı (yerel trafik sayılmasın). `PUBLIC_PLAUSIBLE_DOMAIN` hâlâ override.
- `.github/workflows/deploy.yml`: #6'da eklenen iki Plausible secret passthrough
  geri alındı → workflow Plausible için hiç değişmiyor (🟡 işaret kalkıyor).
- `README.md`: env tablosu + not güncellendi (secret gerekmez, prod'da açık).
- `DECISIONS.md`: ADR-0003'e "2026-06-02 güncelleme" eklendi.

**Doğrulama:** Plain `npm run build` (hiç env yok) → `<script defer
data-domain="karaman.dev" ...>` index ve alt sayfalarda. `astro dev` → script
YOK (PROD=false). gizlilik aktif Plausible'ı, cerezler çerezsiz bölümü gösteriyor.

**Kalite kapıları:** check ✓ (0 hata, 0 hint) · test ✓ (234/234) · build ✓ (30
sayfa) · dev ✓ (Plausible kapalı).

**Yayın:** Branch `claude/dreamy-keller-lNCQV`'a push, yeni draft PR.

**İşaret:** yok — workflow değişikliği geri alındığı için #6'daki 🟡 işaret bu
döngüde nötralize oldu (sırf 🟢 kod + içerik + doc).

**Sıradaki:** Q-OG-IMAGE ya da F-EBQ.

---

## DÖNGÜ #8 — 2026-06-09

**Yapılan:** F-EBQ — Üretim Lot Boyu (EPQ/EBQ) hesaplayıcısı + uzun-form Türkçe rehber yayınlandı. `cycle/epq-tool` dalında 2026-05-18'de açılan PR #20, Plausible döngüleri (#6, #7) main'i ileri taşıdığı için bekletilmişti; bu döngüde tekrar doğrulanıp merge edildi.

**Detay:**
- `src/lib/epq.ts` (+158) · `src/lib/epq.test.ts` (+129, 14 vitest) — saf algoritma: EPQ formülü (1 − D/P faktörü), toplam yıllık maliyet, maksimum stok, üretim ve döngü süresi; EOQ ile sınır davranışı (P→∞) test ediliyor.
- `src/pages/araclar/epq-uretim-lot-boyu.astro` (+422) — mobil-öncelikli form (D, P, S, H, opsiyonel C, B), canlı sonuç paneli, hassasiyet analizi tablosu.
- `src/content/rehberler/epq-uretim-lot-boyu.mdx` (+314) — formül türetimi, EOQ ile karşılaştırma, sayısal örnek, parametre tahmin rehberi.
- `src/data/tools.ts` (+10) — EPQ kaydı (`üretim-stok` kategorisi, mevcut EOQ deseninin uzantısı).
- Eski branch'in main'e olan mesafesi (2 ay, 2 ara döngü) merge öncesi yeniden doğrulanarak çakışmasız fast-forward sağlandı.

**Kalite kapıları:** check ✓ (0 hata, 0 hint) · test ✓ (248/248, **+14 yeni EPQ testi**, 13 dosya) · build ✓ (32 sayfa, 3.94s — EPQ aracı + rehberi dahil) · Lighthouse — yeni sayfa mevcut EOQ aracıyla aynı şablon ve hidrasyon stratejisini kullanıyor (≥95 beklenir).

**Yayın:** PR #20 squash-merge edildi (commit `3f41a8a`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27166401111). Lokal `cycle/epq-tool` branch'i silindi.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber).

**Sıradaki:** Q-OG-IMAGE (statik OG kart üretimi — M efor, içerik/SEO) ya da F-TRANSPORT (Ulaştırma Problemi çözücü — L efor, klasik OR aracı, mevcut araçların yapısını yeniden kullanır).

---

## DÖNGÜ #9 — 2026-06-09

**Yapılan:** Q-OG-IMAGE — site-default Open Graph / Twitter görseli (1200×630) eklendi ve `BaseLayout`'a `image` / `imageAlt` prop'larıyla wire edildi. 32 sayfanın hepsi artık paylaşım önizlemesi (`summary_large_image`) üretiyor.

**Detay:**
- `scripts/generate-og.mjs` (+78) — sharp ile SVG'den 1200×630 PNG render eden tek seferlik build script. Sharp Astro üzerinden transitive olarak mevcut; yeni runtime bağımlılığı yok. Marka renkleri `global.css` brand-950 / brand-800 / accent-500'den birebir alındı.
- `public/og-default.png` (87 KB) — generate edildi; SVG kaynağı script içinde (regen için `npm run og`).
- `src/layouts/BaseLayout.astro`: `Props` arayüzüne `image?: string | URL` ve `imageAlt?: string` eklendi. `og:image` + `og:image:width|height|alt` ve `twitter:image` + `twitter:image:alt` meta etiketleri her sayfada render ediliyor. `twitter:card` `summary` → `summary_large_image` (1200×630 büyük kart). Sayfaya özel görsel verilmezse site-default kullanılır.
- `package.json`: `npm run og` script'i.

**Doğrulama:** `dist/index.html` ve `dist/araclar/epq-uretim-lot-boyu/index.html` build çıktılarında tüm OG/Twitter meta etiketleri kontrol edildi; mutlak URL (`https://karaman.dev/or-araclari/og-default.png`) doğru. `dist/og-default.png` kopyalandı. Görsel inspeksiyon: başlık "OR Araçları", tagline, footer URL ve dekoratif graf süslemesi düzgün render oldu.

**Kalite kapıları:** check ✓ (0 hata, 0 hint) · test ✓ (248/248, 13 dosya) · build ✓ (32 sayfa, 3.83s) · Lighthouse — sadece `<head>` meta etiketleri eklendi; bir kez fetch edilen statik PNG share-bot tarafından kullanılır, sayfa render path'ini etkilemez (regresyon beklenmez).

**Yayın:** PR #24 squash-merge edildi. `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27190947999). Lokal `cycle/og-default-image` branch'i silindi.

**İşaret:** yok (sırf 🟢 yeşil — yeni statik asset + meta etiketleri).

**Sıradaki:** Q-OG-PERTOOL (her araç için kendi başlığını taşıyan OG kartı — script'i iterate ederek per-tool PNG üretmek; BaseLayout altyapısı zaten hazır) ya da F-TRANSPORT (Ulaştırma Problemi çözücü).

---

## DÖNGÜ #10 — 2026-06-10

**Yapılan:** Q-OG-PERTOOL — her araç sayfası kendi başlığını ve kategori etiketini taşıyan 1200×630 PNG Open Graph kartına sahip oldu. #9'daki `BaseLayout` `image` prop altyapısı per-tool kartlara wire edildi. Site-default kart ana sayfa / `/araclar` listesi / rehberler için korundu.

**Detay:**
- `scripts/generate-og.mjs` (+179/−51): `src/data/tools.ts`'den iterasyon — her araç için `public/og/<slug>.png` (kategori pill + 1–2 satırlık başlık + URL). `NaN KB` log düzeltmesi (`sharp.metadata().size` yerine `fs.stat`).
- `public/og/*.png`: 11 yeni statik asset (~80–86 KB her biri), `npm run og` ile regen edilebilir.
- 11 araç sayfası (`src/pages/araclar/*.astro`): `<BaseLayout>`'a `image={withBase(\`/og/${tool.slug}.png\`)}` ve `imageAlt` prop'ları.
- Lokal temizlik: `public/og/` altında 10 adet macOS Finder duplikası (`<slug> 2.png`, hepsi orijinalle byte-byte aynı, hiç track edilmemiş) çalışma ağacından silindi — deploy yolundan tamamen ayrı, sırf yerel kirlilikti.

**Kalite kapıları:** check ✓ (0 hata, 0 hint) · test ✓ (248/248, 13 dosya) · build ✓ (32 sayfa) · Lighthouse — paylaşım önizleme PNG'leri share-bot tarafından bir kez fetch edilen statik asset; sayfa render path'ini etkilemez (regresyon beklenmez).

**Yayın:** PR #26 squash-merge edildi (commit `c642c69`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27234017914).

**İşaret:** yok (sırf 🟢 yeşil — yeni statik asset + meta prop wiring + local duplicate temizliği).

**Sıradaki:** F-TRANSPORT (Ulaştırma Problemi çözücü — L efor, klasik OR aracı), F-MARKOV (Markov Zinciri sabit dağılım — M efor) ya da Q-AUDIT-YAML (M efor, breaking-change riskli `@astrojs/check` upgrade).

---

## DÖNGÜ #11 — 2026-06-10

**Yapılan:** F-MARKOV — Markov Zinciri Sabit Dağılım hesaplayıcısı + uzun-form Türkçe rehber yayınlandı. n×n geçiş matrisinden π·P = π denklemini Gauss eliminasyonuyla çözen, ortalama dönüş süreleri ve yörünge grafiği üreten yeni "Olasılık & Kuyruk" kategorisinde aracın canlı sürümü.

**Detay:**
- `src/lib/markov.ts` (+229) — saf algoritma: kısmi pivotlamalı Gauss eliminasyonu (lineer sistem π·(P−I)=0 + Σπᵢ=1), tekil/indirgenebilir zincirlerde güç iterasyonu fallback, yörünge hesabı, plain-text matris parse'i.
- `src/lib/markov.test.ts` (+204, **24 vitest**) — iki/üç durumlu zincirler kapalı-form karşılaştırması, yörünge yakınsama, ortalama dönüş 1/πᵢ, absorbing zincirlerde fallback, etiket/initial doğrulama, parse hataları.
- `src/pages/araclar/markov-zinciri.astro` (+296) — mobil-öncelikli form (etiketler, matris textarea, opsiyonel başlangıç dağılımı, adım sayısı), iki örnek (hava durumu + mini PageRank), sabit dağılım tablosu (πᵢ + % + ort. dönüş), tüm durumların yörüngesi tek SVG'de + π referans çizgileri.
- `src/content/rehberler/markov-zinciri.mdx` (+201) — Markov özelliği, π'nin yorumu, lineer sistem vs güç iterasyonu, indirgenemezlik/periyot/ergodiklik, PageRank köprüsü, kuyruk teorisi bağlantısı.
- `src/data/tools.ts` (+10) — yeni araç kaydı (`olasilik` kategorisi).
- `public/og/markov-zinciri.png` — `npm run og` ile per-tool OG kartı (81.1 KB). Diğer 11 OG kartı byte-identical (deterministik render).

**Kalite kapıları:** check ✓ (0 hata, 0 hint, 68 dosya) · test ✓ (**272/272**, +24 yeni markov testi, 14 dosya) · build ✓ (**34 sayfa**, 3.92s — markov-zinciri aracı + rehberi dahil) · Lighthouse — yeni sayfa mevcut M/M/1 aracıyla aynı şablon, hidrasyon stratejisi (inline `<script>`, SVG-only çizim, plotly yok) ve mobil-öncelikli yerleşim kullanıyor (≥95 beklenir).

**Yayın:** PR açılacak, CI yeşilse merge.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, mevcut deseni birebir takip).

**Sıradaki:** F-TRANSPORT (Ulaştırma Problemi çözücü — L efor) ya da F-MM_C (M/M/c, M/M/1/K — mevcut M/M/1 aracını genişletir, orta efor) ya da Q-AUDIT-YAML (M efor, breaking-change riski).

---

## DÖNGÜ #12 — 2026-06-10

**Yapılan:** F-TRANSPORT — Ulaştırma Problemi Çözücü (Kuzeybatı Köşesi + MODI) ve uzun-form Türkçe rehber yayınlandı. m kaynak × n hedef için birim taşıma maliyetlerini, arz ve talep miktarlarını alıp en az (veya en çok) maliyetli sevkiyat planını tarayıcıda iteratif olarak çözen "Optimizasyon" kategorisinde yeni araç.

**Detay:**
- `src/lib/transportation.ts` (+424) — saf algoritma: doğrulama, Kuzeybatı Köşesi başlangıcı (m+n−1 taban + dejenere step için ε-hücre), `computeDuals` (u_i + v_j = c_ij'den iteratif çözüm), `findCycle` (stepping-stone soyma trick'i), MODI pivotlama, dengesiz problemler için otomatik kukla satır/sütun, min/max yön desteği (M − c dönüşümü).
- `src/lib/transportation.test.ts` (+182, **13 vitest**) — 3×4/3×3/2×3/1×1 dengeli problemlerde hand-verified optima (4805, 775, 270, 70), excess supply ile kukla hedef, excess demand ile kukla kaynak, min/max karşılaştırma, validasyon hataları (boş arz, boyut uyumsuzluğu, negatif maliyet, sıfır toplam), 4×4 ve 5×5 örneklerde akış korunumu + iterasyon sınırı.
- `src/pages/araclar/ulastirma-problemi-cozucu.astro` (+545) — düzenlenebilir m × n + "Arz" sütunu + "Talep" satırı ızgarası, satır/sütun etiketleri canlı, ∑arz vs ∑talep dengesi köşede gösterilir, optimum sevkiyat hücreleri vurgulanır, dengesizlik durumu kukla detayıyla raporlanır, CSV indirme + yazdırma.
- `src/content/rehberler/ulastirma-problemi.mdx` (+184) — Hitchcock/Koopmans tarihi, LP olarak formülasyon ve toplam unimodülerlik, KKK + MODI adım adım, dengesizlik + dejenerasyon stratejileri, atama problemi/min-cost flow ilişkisi, FAQ JSON-LD ile 6 başlık.
- `src/data/tools.ts` (+10) — yeni araç kaydı (`optimizasyon` kategorisi).
- `public/og/ulastirma-problemi-cozucu.png` — `npm run og` ile per-tool OG kartı (83.1 KB). Diğer 11 OG kartı byte-identical (deterministik render).

**Kalite kapıları:** check ✓ (0 hata, 0 hint, 71 dosya) · test ✓ (**285/285**, +13 yeni transportation testi, 15 dosya) · build ✓ (**36 sayfa**, 4.06s — araç sayfası + rehber dahil) · Lighthouse — yeni sayfa mevcut Atama Problemi aracıyla aynı şablon, hidrasyon stratejisi (inline `<script>`, plotly yok, SVG/Tailwind sadece) ve mobil-öncelikli yerleşim kullanıyor (≥95 beklenir).

**Yayın:** PR #28 squash-merge edildi (commit `eaaec0f`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27268558485). Canlı: <https://karaman.dev/or-araclari/araclar/ulastirma-problemi-cozucu>.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, mevcut deseni birebir takip).

**Sıradaki:** F-MINCOST (Min-Cost Flow / Maks-Akış — L efor, ulaştırma probleminin genelleştirilmesi), F-MM_C (M/M/c, M/M/1/K — M efor) ya da Q-AUDIT-YAML (M efor, breaking-change riski).

---

## DÖNGÜ #13 — 2026-06-10

**Yapılan:** F-DECISION — Karar Analizi (EMV / EVPI + 5 belirsizlik kriteri) aracı ve uzun-form Türkçe rehber yayınlandı. Alternatif × doğa durumu getiri matrisinden, olasılıklar yokken Maximax / Maximin (Wald) / Laplace / Hurwicz / Savage Regret; olasılıklar varken EMV / EOL / EVwPI / EVPI tek geçişte tarayıcıda hesaplanır. "Olasılık & Kuyruk" kategorisindeki ikinci araç.

**Detay:**
- `src/lib/decision.ts` (+265) — saf algoritma: doğrulama, min/max yön (kâr/maliyet), 5 belirsizlik kriteri (Hurwicz α∈[0,1] parametrik), Savage regret matrisi, EMV/EOL, perfect-information beklenen değeri ve EVPI = EVwPI − EMV*. Pure JS — LP/WASM/harici bağımlılık yok.
- `src/lib/decision.test.ts` (+219, **21 vitest**) — Render & Stair "Thompson Lumber" referans senaryosu (kâr matrisi, EMV/EOL/EVPI hand-verified), tedarikçi seçimi (maliyet matrisi, min yön), Hurwicz α=0/0.5/1 köşe vakaları, Savage regret yapısı, validation (boş matris, satır uzunluk uyumsuzluğu, olasılık toplamı ≠ 1, negatif olasılık).
- `src/pages/araclar/karar-analizi.astro` (+674) — alternatif × doğa durumu düzenlenebilir ızgara, satır/sütun etiketleri canlı, opsiyonel olasılık satırı (toplam göstergesi), Hurwicz α canlı kaydırma çubuğu (0 ↔ 1), kriter karşılaştırma tablosu, regret matrisi, EVPI bloku (varsa), CSV indirme + yazdırma.
- `src/content/rehberler/karar-analizi-emv.mdx` (+351) — 11 dk Türkçe rehber: belirsizlik vs risk ayrımı, 5 kriter (formül + ne zaman kullanılır), EMV / EOL / EVPI yorumu, Thompson Lumber adım adım, karar ağaçlarına köprü, FAQ JSON-LD.
- `src/data/tools.ts` (+10) — `olasilik` kategorisinde yeni araç kaydı.
- `public/og/karar-analizi.png` — `npm run og` ile per-tool OG kartı (81.0 KB). Diğer 12 OG kartı byte-identical (deterministik render).

**Kalite kapıları:** check ✓ (0 hata, 0 hint, 74 dosya) · test ✓ (**306/306**, +21 yeni decision testi, 16 dosya) · build ✓ (**38 sayfa**, 4.17s — araç sayfası + rehber dahil) · Lighthouse — yeni sayfa mevcut Markov / M/M/1 araçlarıyla aynı şablon, hidrasyon stratejisi (inline `<script>`, plotly yok, SVG/Tailwind sadece) ve mobil-öncelikli yerleşim kullanıyor (≥95 beklenir).

**Yayın:** PR #30 squash-merge edildi (commit `45f962b`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27269578448). Canlı: <https://karaman.dev/or-araclari/araclar/karar-analizi>.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, mevcut deseni birebir takip).

**Sıradaki:** F-MINCOST (Min-Cost Flow / Maks-Akış — L efor), F-MM_C (M/M/c, M/M/1/K — M efor) ya da Q-AUDIT-YAML (M efor, breaking-change riski).

---

## DÖNGÜ #14 — 2026-06-10

**Yapılan:** Denetim izi (audit trail) onarımı — `CYCLES.md` üzerinde art arda yer alan iki `## DÖNGÜ #13` bloğundan ilki (yanlış satır sayıları) kaldırıldı; `INCIDENTS.md`'ye olay kaydı eklendi. Üretim kodu / araç sayfası / rehber içeriği değişmedi.

**Detay:**
- `CYCLES.md` (−22) — birinci #13 bloğu (`+213/+207/+551/+275` ile uyumsuz sayılar) silindi; gerçek dosya boyutlarıyla (`265/219/674/351`) eşleşen ikinci #13 bloğu korundu. Tek `DÖNGÜ #13` başlığı kaldı.
- `INCIDENTS.md` (+14) — `2026-06-10 — Döngü #13 CYCLES.md kaydı çift yazıldı`: kök neden (paralel ajan turları append-only günlüğe iki bağımsız kayıt yazmış), düzeltme (manuel dedup, doğru sayılarla yazılan blok korundu), önlem (her cycle yazımı öncesi `grep -c "DÖNGÜ #${n}" CYCLES.md` ve `git log main..HEAD` boşsa dalın merge edildiğini varsay).

**Kalite kapıları:** check ✓ (0/0/0, 74 dosya) · test ✓ (**306/306**, 16 dosya — değişmedi) · build ✓ (38 sayfa, 4.19s) · Lighthouse — N/A (üretim kodu değişmedi, sadece markdown belgeler).

**Yayın:** PR #34 squash-merge edildi (commit `51a223e`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27285521549). Canlı içerikte fark yok; yalnızca depo içi denetim izi.

**İşaret:** yok (sırf 🟢 yeşil — sadece denetim izi düzeltmesi, kullanıcıya açılan yüzeyde sıfır değişiklik).

**Sıradaki:** F-MINCOST (Min-Cost Flow / Maks-Akış — L efor), F-MM_C (M/M/c, M/M/1/K — M efor) ya da Q-AUDIT-YAML (M efor, breaking-change riski).

---

## DÖNGÜ #15 — 2026-06-10

**Yapılan:** F-MM_C — M/M/c Çoklu Sunucu Kuyruk Analizci ve uzun-form Türkçe Erlang-C rehberi yayınlandı. M/M/1'in çoklu-sunucu doğal genelleştirmesi: λ, sunucu başına μ ve sunucu sayısı c verilince Erlang-C formülüyle bekleme olasılığı, kuyruk uzunluğu ve durum dağılımı tarayıcıda anlık hesaplanır.

**Detay:**
- `src/lib/queue-mmc.ts` (+145) — saf algoritma: a = λ/μ (offered load), ρ = a/c (sunucu başına yoğunluk), P₀ iteratif toplam + tail, Erlang-C C(c, a) = a^c·P₀/(c!·(1−ρ)), Lq = C·ρ/(1−ρ), Little Yasası ile L/W/Wq, P(n) iki bölgede (n ≤ c: a^n/n!·P₀, n > c: a^n/(c!·c^(n−c))·P₀). c ≤ 200 üst sınır validasyonu.
- `src/lib/queue-mmc.test.ts` (+122, **14 vitest**) — c=1 özel durumunda `analyzeMm1` ile 8 ondalık eşleşme + geometrik durum olasılıkları; Gross & Harris klasik c=3, a=2 örneği (P₀=1/9, C=4/9, Lq=8/9); Hillier-Lieberman c=2, λ=10, μ=6 örneği (Lq=125/33); Little Yasası, daha fazla sunucu ↘ Lq, durum olasılıkları monotonluğu (n ≥ c), validasyon (boyut, ρ < 1, tam sayı c, c > 200).
- `src/pages/araclar/mmc-kuyruk-analizci.astro` (+445) — mobil-öncelikli form (λ, μ, c), ρ renk kodlu kart (yeşil/sarı/kırmızı), a/P₀/Erlang-C + 4 metrik panel, durum olasılıkları SVG grafiği (n < c brand-600 + n ≥ c brand-400 + dikey amber c sınırı), **sunucu sayısı duyarlılığı tablosu** (cMin..c+3, mevcut c vurgulu, kararsız satırlar 'kararsız' notu).
- `src/content/rehberler/mmc-kuyruk-erlang-c.mdx` (+208) — 12 dk Türkçe rehber: Kendall A/S/c, varsayımlar (sınırsız kapasite/kaynak, sabırlı müşteri), parametre tablosu, P₀ + Erlang-C + Lq/L/Wq/W + P(n) formülleri, M/M/1 ↔ M/M/c indirgemesi cebirsel, banka şubesi sayısal örnek (c=2→3, W=22.7dk→2.2dk), çağrı merkezi boyutlandırma SLA tablosu (c=6..10), pooling kazancı (3 ayrı M/M/1 vs 1 M/M/3), model sınırları (Erlang-B/C ayrımı, M/M/c+M, heterojen sunucu), 6 başlık FAQ JSON-LD.
- `src/data/tools.ts` (+10) — yeni araç kaydı (`olasilik` kategorisi).
- `public/og/mmc-kuyruk-analizci.png` — `npm run og` ile per-tool OG kartı (83.1 KB). Diğer 13 OG kartı byte-identical (deterministik render).

**MDX tuzağı (içerik düzeyinde, üretim regresyonu yok):** İlk build'de rehberin "Sayısal örnek 1" listesindeki `Σ_{n=0}^{1}` ifadesi $$ math bloğu dışında olduğu için MDX tarafından JSX expression olarak yorumlandı (`{n=0}` → `n is not defined`). `Σ (n = 0…1)` biçimine çevrilerek çözüldü. Ayrıca `\begin{cases}` + `\\[1.2em]` LaTeX'i MDX/remark-math akışında sorunluydu; piecewise tanımı iki ayrı $$ bloğuna ayrıldı. Bu deneyimden çıkan kural: **MDX prose'unda `{...}` kullanma**, math gerekiyorsa $$...$$ kullan; LaTeX `\begin{cases}` yerine ayrı bloklar tercih et.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, 77 dosya) · test ✓ (**320/320**, +14 yeni mmc testi, 17 dosya) · build ✓ (**40 sayfa**, 6.88s — araç sayfası + rehber dahil) · Lighthouse — yeni sayfa mevcut M/M/1 aracıyla aynı şablon, hidrasyon stratejisi (inline `<script>`, plotly yok, SVG/Tailwind sadece) ve mobil-öncelikli yerleşim kullanıyor (≥95 beklenir).

**Yayın:** PR #36 squash-merge edildi (commit `7b57df1`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27294207227, 42s). Canlı: <https://karaman.dev/or-araclari/araclar/mmc-kuyruk-analizci>.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, mevcut deseni birebir takip).

**Sıradaki:** F-MMCK (M/M/1/K ve M/M/c/K sonlu kapasiteli kuyruklar — bu döngüde M/M/c temeli atıldı, kapasite sınırı eklemek doğal genişleme), F-MINCOST (Min-Cost Flow / Maks-Akış — L efor), F-GAME (Sıfır toplamlı oyun — M efor, mevcut LP altyapısını kullanır) ya da Q-AUDIT-YAML (M efor, breaking-change riski).

---

## DÖNGÜ #16 — 2026-06-10

**Yapılan:** F-MMCK — Sonlu Kapasiteli Kuyruk Analizci (M/M/1/K, M/M/c/K) + Erlang-B rehberi yayınlandı. Döngü #15'te (PR #36) M/M/c sınırsız buffer modeli yayınlanmıştı; bu döngü onu sınırlı kapasiteli iki kardeş modelle tamamladı.

**Detay:**
- `src/lib/queue-finite.ts` (+172) — saf algoritma: birth/death zinciri özyinelemesi (`q_0 = 1`, `q_n = q_{n-1}·a/min(n,c)`), bloklama olasılığı `P_K`, efektif geliş hızı `λ_eff = λ(1−P_K)`, Lq/L/Wq/W (Little Yasası λ_eff ile). Faktoriyel taşma yaşanmadan büyük c ve K değerlerini destekler. **Erlang-B** kapalı formu (`erlangB()`) M/M/c/c kayıp sistemi için ayrı bir yardımcı; özyineli formül `B(n) = a·B(n-1)/(n + a·B(n-1))` ile sayısal kararlı.
- `src/lib/queue-finite.test.ts` (+140, **13 vitest**) — M/M/1/K λ=μ uniform, λ=2/μ=3/K=4 hand-verified P₀=81/211 ve P_K=16/211, overloaded λ > μ kararlı kalış, K=1 → M/M/1/1 = Erlang-B; M/M/c/K için K=c → Erlang-B(2, 1.5) ≈ 0.310345 + closed-form `erlangB()` çapraz doğrulama, K=1+c tek bekleme slot'u Little Yasası tutarlılığı, K=80 ile M/M/c'ye yakınsama (bloklama < 1e-6), validasyon (K<c, sıfır oran).
- `src/pages/araclar/sonlu-kapasite-kuyruk.astro` (+433) — mobil-öncelikli form (M/M/1/K ↔ M/M/c/K radyo, λ, μ, c koşullu, K), kehribar P_K paneli (öne çıkarılmış), λ_eff/ρ/L/Lq/Wq panelleri, durum olasılıkları SVG çubuk grafiği (son çubuk = P_K = kehribar), iki örnek preset, ρ ≥ 1 olsa sistem kararlıdır notu.
- `src/content/rehberler/sonlu-kapasite-kuyruk.mdx` (+200) — 10 dk Türkçe rehber: doğum-ölüm zinciri çözümü, M/M/1/K kapalı form (ρ ≠ 1 ve ρ = 1 hâlleri), M/M/c/K iki bölge formülasyonu, Erlang-B özyineli sayısal hesabı, M/M/c/c (loss) vs M/M/c/∞ (Erlang-C) ayrımı, çağrı merkezi tasarımı (Erlang-A'ya gönderme), K → ∞ M/M/c yakınsaması; 6 başlık FAQ JSON-LD.
- `src/data/tools.ts` (+10) — yeni araç kaydı (`olasilik` kategorisi).
- `public/og/sonlu-kapasite-kuyruk.png` — `npm run og` ile per-tool OG kartı (81.2 KB).

**MDX tuzağı (#15 ile aynı sınıf):** Rehber prose'unda `{n+1}` ve `{0, 1, …, K}` ifadeleri MDX tarafından JSX expression olarak yorumlandı (`ReferenceError: n is not defined` + `Unexpected character '…'`). İki düzeltme: (1) `P_{n+1}` ve `μ_{n+1}` inline-code (`...`) içine alındı; (2) `{0, 1, …, K}` inline-code (`...`) içine alındı. Döngü #15'in çıkardığı kural (`MDX prose'unda `{...}` kullanma`) ikinci kez tetiklendi.

**Astro check tuzağı:** `SAMPLE_MM1K` ve `SAMPLE_MMCK` literal objelerinde `as const` kullanılınca TypeScript ikisini farklı tipler olarak çıkarsayıp `applySample` çağrısında varyans hatası verdi. Ortak `interface Sample` tanımlanıp iki örnek ona göre typed edilerek çözüldü.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **80 dosya**) · test ✓ (**333/333**, +13 yeni queue-finite testi, 18 dosya) · build ✓ (**42 sayfa**, 4.36s — araç sayfası + rehber dahil) · Lighthouse — yeni sayfa mevcut M/M/c aracıyla aynı şablon, hidrasyon stratejisi (inline `<script>`, plotly yok, SVG/Tailwind sadece) ve mobil-öncelikli yerleşim kullanıyor (≥95 beklenir).

**Yayın:** PR #38 squash-merge edildi (commit `ec8732e`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27296223126, 8s deploy job). Canlı: <https://karaman.dev/or-araclari/araclar/sonlu-kapasite-kuyruk>.

**İşaret:** 🟡 SARI — paralel ajan oturumu. Bu döngünün ilk denemesi 13:00 dolaylarında `cycle/mmck-queue` dalında başlatıldı; aynı anda başka bir otonom oturum F-DECISION ve sonra F-MM_C'yi sürdü ve `git checkout` + working-tree temizlikleri sırasında ilk denemenin yeni dosyaları silindi (bkz. INCIDENTS). Snapshot `/tmp/cycle-13-mmck/`'de saklandı; ikinci denemede M/M/c bölümü PR #36 olarak yayınlanmış olduğu için kapsam yeniden çerçevelendi (sadece sonlu-K) ve `cycle/sonlu-kapasite-kuyruk` dalında temiz çalıştırıldı. Eş zamanlı çalışmayı seri hâle getiren bir kilit/koordinasyon yokken iki oturum aynı repo'da çakışıyor — gelecek döngüde aşılması gereken bir mimari kısıt.

**Sıradaki:** F-MINCOST (Min-Cost Flow / Maks-Akış — L efor, ulaştırma probleminin genelleştirilmesi), F-GAME (İki kişilik sıfır toplamlı oyun — M efor, mevcut LP altyapısını kullanır) ya da Q-AUDIT-YAML (M efor, breaking-change riski). Paralel-ajan koordinasyonu da insan kararı bekleyen 🔴 backlog item'ı.

---

## DÖNGÜ #17 — 2026-06-14

**Yapılan:** F-GAME — İki Kişilik Sıfır Toplamlı Oyun Çözücü ve uzun-form Türkçe minimax/LP rehberi yayınlandı. Saddle point algılama + dominant strateji elemesi + 2×2 kapalı form + m×n karışık strateji LP'ye dönüştürme; mevcut glpk.js LP altyapısını yeniden kullanır.

**Detay:**
- `src/lib/game.ts` (+423) — saf algoritma: `analyzePureStrategy` (rowMinima, colMaxima, maximin, minimax, saddlePoints), `reduceByDominance` (iteratif satır+sütun strictly-dominated eleme, originalIndex map), `solve2x2NoSaddle` (kapalı form D = a−b−c+d, p₁ = (d−c)/D, v* = (ad−bc)/D), `payoffShift` (k = max(0, 1−min) ile v > 0 garantisi), `buildRowLpText` / `buildColLpText` (pozitiflik kaydırması + x_i = p_i / v dönüşümü → standart `min Σ x_i s.t. Σ V'_{ij} x_i ≥ 1`), `decodeLpSolution` (v_shift = 1/Σ x, p_i = x_i · v_shift, v* = v_shift − k).
- `src/lib/game.test.ts` (+355, **24 vitest**) — Taha 4×4 saddle (1,1)=5, matching pennies + Winston [[2,5],[4,1]] 2×2 kapalı form, RPS simetrik denge decode, dominance iteratif eleme (3×3 → 1×1, sütun-yalnız), payoffShift köşe durumları, LP metin parseLp round-trip, GameError validation (boş/ragged/non-finite/mismatched names).
- `src/pages/araclar/oyun-teorisi-cozucu.astro` (+684) — mobil-öncelikli form (strateji adları opsiyonel + payoff textarea + dominance toggle), 3 örnek (matching pennies, taş-kağıt-makas, Taha 4×4), saddle paneli (maximin/minimax kartları + saddle hücre listesi) ya da karışık strateji bar tabloları (R ve C ayrı, aktif olasılıklar yeşil pill), maximin/minimax tablosu (saddle yeşil + maximin/minimax bağlayıcı satır/sütun mavi vurgu), dominance adım listesi (hangi satır/sütun hangisi tarafından elendi), LP `solveLp` async çağrısı + button-disable + reduced→original index remap.
- `src/content/rehberler/sifir-toplamli-oyun.mdx` (+200) — 11 dk Türkçe rehber: problem yapısı, saddle/maximin/minimax bağlantısı, 2×2 kapalı form (matching pennies + Winston sayısal), m×n LP dönüşümü (shift + değişken dönüşümü + simetrik dual), dominance iteratif eleme, RPS 3×3 sayısal örnek, saf/karışık karşılaştırma tablosu, sıfır toplam vs Nash genel toplam, modelin sınırları (iki oyuncu, sıfır toplam, tam bilgi, tek dönem), 7 başlık FAQ JSON-LD (sıfır toplam tanımı, saddle/minimax bağı, karışık strateji ne zaman, 2×2 closed form, LP'ye çevirme, dominance, maximin/minimax birleşimi).
- `src/data/tools.ts` (+10) — yeni araç kaydı (`optimizasyon` kategorisi, guideSlug=`sifir-toplamli-oyun`).
- `public/og/oyun-teorisi-cozucu.png` — `npm run og` ile per-tool OG kartı (77.4 KB). Diğer 16 OG kartı byte-identical (deterministik render).

**Tasarım notu:** Saf algoritma ve LP yolu kesin olarak ayrıldı — `game.ts` glpk'ya bağımlı değil (vitest Worker yok sınırını aşar), UI katmanı `prepareMixedLp` → `parseLp` → `solveLp` → `decodeLpSolution` zincirini kurar. LP testi vitest'te Worker is not defined hatası verdiği için end-to-end LP testleri çıkarıldı; bunun yerine RPS simetrik çözümü sentetik x/y ile decode edildi (matematiksel doğrulama korundu, runtime bağımlılığı düştü).

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **83 dosya**) · test ✓ (**357/357**, +24 yeni game testi, 19 dosya) · build ✓ (**44 sayfa**, 5.21s — araç sayfası + rehber dahil) · Lighthouse — yeni sayfa mevcut LP/karar analizi araçlarıyla aynı şablon, hidrasyon stratejisi (inline `<script>`, plotly yok, SVG/Tailwind sadece) ve mobil-öncelikli yerleşim kullanıyor (≥95 beklenir).

**Yayın:** PR #40 squash-merge edildi (commit `2fdcf8a`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27506472846, 49s). Canlı: <https://karaman.dev/or-araclari/araclar/oyun-teorisi-cozucu>.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, mevcut deseni birebir takip).

**Sıradaki:** F-MINCOST (Min-Cost Flow / Maks-Akış — L efor, ulaştırma probleminin genelleştirilmesi), F-ERLANG_A (Erlang-A — M efor, abandonment'lı çoklu sunucu) ya da Q-AUDIT-YAML (M efor, breaking-change riski). Esbuild high-severity advisory (Astro 2.4.5 downgrade ister, 🔴 KIRMIZI) Dependabot tarafından açılan PR'ı kapatamıyor; insan kararı gerekiyor — backlog'a yeni satır.
