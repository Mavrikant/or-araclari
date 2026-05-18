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
