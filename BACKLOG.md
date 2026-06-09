# Backlog

Tek doğru kaynak. Öncelik sırası: kırık → yol haritası eksiği → kullanıcı talebi → yeni araç → cila.

Sütunlar: id · başlık · tür · değer · efor · durum

Tür: bug · chore · content · feature · refactor · infra
Değer: H (yüksek) · M (orta) · L (düşük)
Efor: XS · S · M · L
Durum: open · in-progress · blocked · done

---

## Şimdiki Sıra

| id | başlık | tür | değer | efor | durum |
|---|---|---|---|---|---|
| Q-CI-CHECK | CI workflow'una `npm run check` + `npm run test` adımları ekle (şu an sadece `astro build` çalışıyor) — 🔴 KIRMIZI: workflow değişikliği insan onayı ister | infra | H | S | blocked |
| Q-AUDIT-YAML | `npm audit` kalan 5 moderate zafiyet `yaml-language-server → volar-service-yaml → @astrojs/language-server → @astrojs/check` zincirinde; fix `--force` (breaking) ister — Astro/check uyumluluğunu doğrulayarak yükselt | chore | M | M | open |
| Q-OG-PERTOOL | Her araç sayfası için kendi başlığını taşıyan OG kartı üret (site-default kartın üzerine) — `image` prop'u BaseLayout'a #9'da eklendi; şimdi script'i `tools.ts`'den iterate ederek per-tool PNG'lere genişlet | content | M | M | open |

## Yeni Araç Fikirleri (sıra dışı, fırsat olursa)

| id | başlık | tür | değer | efor | durum |
|---|---|---|---|---|---|
| F-TRANSPORT | Ulaştırma Problemi Çözücü (North-West Corner + MODI) | feature | H | L | open |
| F-MINCOST | Min-Cost Flow / Maks-Akış Çözücü (Ford-Fulkerson, Edmonds-Karp) | feature | M | L | open |
| F-MARKOV | Markov Zinciri Sabit Dağılım Hesaplayıcı | feature | M | M | open |
| F-DECISION | Karar Ağacı / Beklenen Değer Çözücü (EMV, EVPI) | feature | M | M | open |
| F-GAME | İki Kişilik Sıfır Toplamlı Oyun (saddle point + karışık strateji LP) | feature | M | M | open |
| F-MM_C | M/M/c, M/M/1/K, M/M/c/K kuyrukları | feature | M | M | open |

---

## Tamamlananlar

| id | başlık | döngü |
|---|---|---|
| Q-TYPECHECK | `npm run check` 4 TypeScript hatasını gider | #1 |
| Q-README-LP | README "Faz 5" LP notu güncellendi, Faz 6 satırı eklendi | #2 |
| Q-UNUSED | 3 kullanılmayan değişken/tip (`Schedule`, `ys`, `slackPanel`) temizlendi | #3 |
| Q-DEPENDABOT-14 | `devalue` 5.8.0 → 5.8.1 (Dependabot #14 superseded by PR #18) — high alert kapatıldı | #4 |
| Q-CONTENT-CONFIG | `astro:schema` → `astro/zod` (deprecate uyarısı düzeltildi, 14 hint → 0) | #5 |
| Q-PLAUSIBLE | Plausible Analytics desteği (çerezsiz, onaysız eager); ADR-0003. #7'de secret kaldırıldı, prod'da koda gömülü `karaman.dev` ile her zaman açık | #6, #7 |
| F-EBQ | Üretim Lot Boyu (EPQ/EBQ) hesaplayıcısı + uzun-form Türkçe rehber (PR #20, +14 vitest) | #8 |
| Q-OG-IMAGE | Site-default OG/Twitter görseli (1200×630 PNG) + BaseLayout'ta `image` prop'u; her sayfa `og:image`, `twitter:image` ve `summary_large_image` ile share preview alıyor | #9 |
