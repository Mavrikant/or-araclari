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
| Q-AUDIT-ESBUILD | `npm audit` 4 high `esbuild ≤ 0.28.0` zincirinde (esbuild → vite → astro → @astrojs/mdx); fix `--force` Astro 2.4.5'e downgrade ister, breaking-change. Astro 7.x'e yükselterek esbuild ≥ 0.28.1 ile uyumluluğu kontrol et — 🔴 KIRMIZI: major Astro upgrade insan onayı ister | chore | H | L | blocked |

## Yeni Araç Fikirleri (sıra dışı, fırsat olursa)

| id | başlık | tür | değer | efor | durum |
|---|---|---|---|---|---|
| F-GAME-NASH | Bimatris (genel toplam) Nash dengesi çözücü — Lemke-Howson algoritması, F-GAME'in non-zero-sum uzantısı | feature | M | L | open |

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
| Q-OG-PERTOOL | Araç başına özel 1200×630 OG kartı (kategori pill + başlık + URL); `scripts/generate-og.mjs` `tools.ts`'den iterate ediyor, 11 araç sayfası kendi `image`/`imageAlt` prop'unu wire ediyor (PR #26) | #10 |
| F-MARKOV | Markov Zinciri Sabit Dağılım hesaplayıcısı (n×n geçiş matrisinde Gauss eliminasyonu ile π·P = π çözümü, ortalama dönüş süreleri, yörünge grafiği) + 12 dakikalık Türkçe rehber + 24 yeni vitest | #11 |
| F-TRANSPORT | Ulaştırma Problemi Çözücü (m × n birim maliyet + arz/talep, Kuzeybatı Köşesi + MODI, min/max, otomatik dengeleme) + uzun-form Türkçe rehber + 13 yeni vitest | #12 |
| F-DECISION | Karar Analizi aracı — Maximax / Maximin (Wald) / Laplace / Hurwicz (α∈[0,1]) / Savage Regret + risk altında EMV / EOL / EVwPI / EVPI; min/max yön; pure JS; +21 vitest (PR #30) | #13 |
| F-MM_C (M/M/c kısmı) | M/M/c Çoklu Sunucu Kuyruk Analizci — Erlang-C C(c,a), P₀, L/Lq/W/Wq, durum olasılıkları (n ≤ c ve n > c bölgeleri ayrı renkte), sunucu sayısı duyarlılığı tablosu; c=1'de M/M/1'e indirgenir; +14 vitest (PR #36). Kalan M/M/1/K ve M/M/c/K satırı yukarıda open. | #15 |
| F-MM_C (M/M/1/K + M/M/c/K kısmı) | Sonlu Kapasiteli Kuyruk Analizci — birth/death zinciri özyinelemesi (faktoriyel taşması yok), bloklama P_K + λ_eff, Erlang-B kapalı formu (`erlangB()` özyineli); +13 vitest (PR #38) | #16 |
| F-GAME | İki Kişilik Sıfır Toplamlı Oyun Çözücü — saddle/maximin/minimax analizi + dominant strateji elemesi + 2×2 kapalı form + m×n karışık strateji için LP dönüşümü (pozitiflik shift + x_i = p_i / v); +24 vitest (PR #40) | #17 |
| F-ERLANG_A | Erlang-A Bekleme & Bırakma Analizci (M/M/c + abandonment) — doğum-ölüm zinciri özyinelemesi + tail truncation, λ > c·μ kararlılığı (θ > 0), P(abandon), λ_aban = θ·Lq, λ_served, QED rejimi rehberi; +17 vitest (PR #42) | #18 |
| F-MINCOST (max-flow yarısı) | Maks-Akış (Max-Flow) Çözücü — Edmonds-Karp BFS, augmenting-path, min-cut çıkarımı (S→T orijinal kenarlar), CLRS örneği + boru şebekesi; +16 vitest (PR #44). Min-Cost Flow ayrı backlog F-MINCOST2 olarak kaldı | #19 |
| F-MINCOST2 (min-cost yarısı) | Min-Cost Flow Çözücü — Successive Shortest Path, residüel grafta SPFA / Bellman-Ford, ileri +w / ters −w, hedef akış d (boşsa max-flow kadar), açgözlük tuzağı + 2×3 ulaştırma örneği; +18 vitest | #20 |
