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
