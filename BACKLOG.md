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
| Q-AUDIT-ESBUILD | `npm audit` kalan 3 low zafiyet `esbuild ≤ 0.28.0 → astro → @astrojs/mdx` zincirinde; fix `--force` **Astro 7.0.6** major upgrade ister — 🔴 KIRMIZI: major Astro upgrade insan onayı ister (Astro 6 → 7 breaking changes: content collections API, integration API) | chore | M | L | blocked |

## Yeni Araç Fikirleri (sıra dışı, fırsat olursa)

| id | başlık | tür | değer | efor | durum |
|---|---|---|---|---|---|
| F-CDS-NEH | Johnson aracına m ≥ 4 makina için CDS (Campbell-Dudek-Smith 1970) + NEH (Nawaz-Enscore-Ham 1983) ikinci algoritma paneli — JPS'i A*'a eklediğim desenle, mevcut Gantt görselleştirmesi + U/V panelinin üzerine | feature | M | M | open |
| F-BIN-PACKING | Bin Packing Sezgisel Çözücü — First-Fit-Decreasing + Best-Fit-Decreasing + Next-Fit, LP alt sınırı, kutu görselleştirme, Vazirani ders kitabı 1.5-yaklaşım analizi | feature | M | M | open |
| Q-INVENTORY-XLINK | 5 envanter aracı rehberi (EOQ / EPQ / Newsvendor / Wagner-Whitin / ROP) alt bölümüne F-INVENTORY-COMPARE meta rehberine cross-link ekle — ROP rehberinde F-INVENTORY-COMPARE'e link zaten var, kalan 4 rehberi de bağla | content | M | XS | open |

---

## Tamamlananlar

| id | başlık | döngü |
|---|---|---|
| F-INVENTORY-COMPARE | "Hangi envanter modeli ne zaman?" karar rehberi — EOQ / EPQ / Newsvendor / Wagner-Whitin / (Q, R) beşlisini üç eksende (talep / ufuk / tedarik) konumlandıran meta rehber (~10 dk); karar ağacı + 5 sayısal senaryo (otomotiv balata, kot pantolon sezon, motor bloğu EPQ, rüzgâr türbini WW, EOQ+(Q,R) melez); 5 yanlış eşleştirme + akrabalık ağacı (Harris 1913 → Taft 1918 → Wilson 1934 → Edgeworth/AHM → WW 1958 → Hadley-Whitin 1963 → Peterson-Silver 1979); 9 FAQ JSON-LD; her araca site-içi linkli dolaşım listesi | #34 |
| F-ROP | Yeniden Sipariş Noktası & Emniyet Stoğu (ROP · SS) — Sürekli-izleme (Q, R) modeli; μ_d, σ_d, L, σ_L ve hedef servis seviyesinden R = μL + z·σ_DL + SS = z·σ_DL; kombine varyans σ_DL = √(L·σ_d² + μ_d²·σ_L²) toplam varyans yasasıyla; Type-I (cycle service α = Φ(z)) + Type-II (fill rate β = 1 − σ_DL·L(z)/Q, L(z) bisection ile ters çevirme); Beasley-Springer-Moro Φ⁻¹ + Abramowitz-Stegun Φ + standart normal kayıp L(z); opsiyonel EOQ türetimi (√(2DK/h)) + toplam yıllık maliyet (D/Q)·K + (Q/2)·h + SS·h; testere-dişi stok SVG (R kırmızı çizgi, SS amber koridor), servis seviyesi α = 0.5 → 0.999 duyarlılık tablosu; iki hazır örnek (Silver-Peterson deterministik / Chopra-Meindl rasgele tedarik); +38 vitest + ~12 dk uzun-form Türkçe rehber (kombine varyans türetimi, Type-I vs Type-II ayrımı, EOQ + SS toplam maliyet sayısal örneği, EOQ/EPQ/Newsvendor/Wagner-Whitin/(Q,R) karşılaştırma tablosu, tarih Wilson → Arrow-Harris-Marschak → Hadley-Whitin → Peterson-Silver, 9 FAQ) | #33 |
| F-JOHNSON | Johnson Kuralı 2/3 Makina Akış-Tipi Çizelgeleme Çözücü — F₂ ‖ Cmax için 1954 kapalı-form kuralı (U = { α ≤ β } α artan, V = { α > β } β azalan, sıra U + V); F₃ için Johnson-Bellman indirgemesi `min p₁ ≥ max p₂` VEYA `min p₃ ≥ max p₂` sağlanınca optimum, sağlanmazsa sezgisel (UI etikette exact/heuristic); iki-tarafın komşu-değiştirme kanıtı `min(a_i, b_j) ≤ min(a_j, b_i)` rehberde; Gantt SVG (M1/M2/M3 + Cmax dikey çizgi), U/V grup tablosu, M2 boş süresi ambar renkte; iki hazır örnek (Taha 5-iş F2, 3-makina koşul-sağlanan); +28 vitest (Taha Cmax=28 hand-verified, 12 seed brute-force birebir, invariantlar) + ~12 dk uzun-form Türkçe rehber (flow-shop/job-shop farkı, ikili-değiştirme ispatı, m ≥ 4 CDS/NEH/Palmer literatürü, Bellman/Nash/1954 tarih bağlamı, 9 FAQ) | #32 |
| F-WAGNER-WHITIN | Wagner-Whitin Dinamik Lot Boyutlandırma Çözücü — çok-dönemli deterministik + zaman-değişken talep, kurulum ve taşıma maliyetleri altında forward DP O(T²); Zero Inventory Ordering ile ardışık lot bloklarına indirgeme; zaman-değişken K_t/h_t/c_t desteği; blok maliyeti kümülatif taşıma katsayısıyla; Silver-Meal (1973) sezgiseli aynı API ile karşılaştırma; iki hazır örnek (Nahmias 10-dönem, 6-dönem küçük) + localStorage state; +27 vitest (hand-verified 3-dönem, ZIO invariant, 5-period exhaustive 2^4 optimallik, WW ≤ Silver-Meal dominance) + ~12 dk uzun-form Türkçe rehber (ZIO ispat sezgisi, ileri DP formülasyonu, Nahmias sayısal, Silver-Meal/LUC/PPB/POQ/LFL karşılaştırma, rolling horizon + MRP nervousness, kapasiteli/multi-item/stokastik sınırlar, 9 FAQ) | #31 |
| F-NEWSVENDOR | Newsvendor (Tek-Dönem Envanter) Çözücü — critical fractile F(Q*) = Cu/(Cu+Co) kapalı-form, normal + üniform talep, direct (Cu/Co) veya priced (p, c, s, g) maliyet modu, Beasley-Springer-Moro Φ⁻¹ + Abramowitz-Stegun Φ + standart normal kayıp L(z), E[eksik] · Cu + E[fazla] · Co + toplam U-eğrisi + Q\* dikey çizgi; servis seviyesi (Type I) + fill rate (Type II) + beklenen kâr; iki hazır örnek + localStorage state; +35 vitest + ~12 dk uzun-form Türkçe rehber (marjinal analiz türetimi, z-tablosu, sezonluk bot ucundan-uca örnek, EOQ karşılaştırması, yaygın 5 hata, Edgeworth → Arrow-Harris-Marschak tarihi + risk-averse/distribution-free uzantılar, 9 FAQ) | #30 |
| Q-PERT-REHBER | PERT/CPM aracının eksik uzun-form Türkçe rehberi yazıldı (`pert-cpm-kritik-yol.mdx`, ~12 dk, 9 FAQ JSON-LD, ileri/geri pas + PERT üç-tahmin + slack türleri + Gantt slack koridoru); `tools.ts`'ye `guideSlug` bağlandı. HARD CONSTRAINT eksiği kapandı — artık tüm 26 aracın rehberi var | #29 |
| Q-AUDIT-YAML | `npm audit fix` (no `--force`) ile vite 7.3.2 → 7.3.6 + yaml-language-server zinciri güncellendi; 2× high + 5× moderate kapandı (8 → 3 low). package.json değişmedi | #28 |
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
| F-GAME-NASH | Bimatris (Genel Toplam) Nash Dengesi Çözücü — support enumeration, Shapley lemma ile |S₁|=|S₂| varsayımı, saf + karışık tüm denge tarama, m+n ≤ 12 sınırı; Tutuklu Açmazı, Cinsiyet Savaşı, Stag Hunt, Tavuk Oyunu örnekleri + 11 dk Türkçe rehber; +23 vitest | #21 |
| F-SHORTEST-PATH | En Kısa Yol Çözücü — Dijkstra (binary heap + lazy delete) + Bellman-Ford (V−1 pass + erken çıkış + V'inci pass negatif çevrim tespiti), auto-mode (negatif varsa BF), kaynak → tüm düğüm + opsiyonel hedefe adım adım yol rekonstrüksiyonu; CLRS 24.3 + CLRS 24.1 + negatif çevrim örnekleri; +20 vitest | #22 |
| F-MST | Minimum Yayılan Ağaç Çözücü — Prim (binary heap + lazy delete, çoklu bileşen için yeniden başlat) + Kruskal (union-find: path compression + rank), paralel kenarda min ağırlık, negatif ağırlık desteği, bağlı olmayan grafda orman; CLRS 23 ders kitabı örneği + şehir ağı + orman örnekleri; +23 vitest | #23 |
| F-ASTAR | A* (A-yıldız) Izgara Yol Bulucu — f = g + h, Manhattan/Octile/Euclidean/Chebyshev/Zero heuristic, 4/8 bağlantı, corner-cutting yasak/serbest, görsel ızgarada tıkla-engel/start/goal editörü, açılan kapalı küme görselleştirmesi; labirent + odalar + açık alan örnekleri; +20 vitest | #24 |
| F-STEINER | Steiner Ağacı Çözücü (KMB 2-yaklaşım) — her terminalden Dijkstra → metrik kapanış tam grafı → Kruskal MST → orijinal yollara genişletme + paralel kenar dedup → alt graf MST → terminal olmayan yaprak ardışık kırpma; Y-yıldız (hub seçimi) + ızgara 4 köşe + saplama-kırpma örnekleri; tüm grafın MST karşılaştırması; +23 vitest | #25 |
| F-LEMKE | Lemke-Howson (1964) tamamlayıcı pivot — F-GAME-NASH bimatris aracına ikinci algoritma olarak eklendi (m + n > 12 büyük oyunlarda çalışır); iki en-iyi-yanıt poliyedrası P/Q tableau, pozitiflik kaydırması, Bland kuralı anti-cycling, ray-termination dejenere statüsü; "Tüm dropLabel'ları dene" k=1..m+n art arda deduplike denge kümesi; +21 vitest | #26 |
| F-JPS | Jump Point Search — A* araç sayfasına ikinci algoritma olarak eklendi (Harabor & Grastien 2011); 8-bağlantı eş-maliyetli ızgarada `jump(dx,dy)` iteratif yön-atlama, doğal + zorunlu komşu ayrımı, `prunedDirections` (parent yönüne göre 8 → 3–5 daralma), corner-cutting A* semantiği ile aynı, aynı UI'da radio ile seçim (JPS'te bağlantı 8'e sabitlenir), jump point'ler fuşya halka ile vurgulanır; +20 vitest, A* ile bit-bit optimum kimliği doğrulanır | #27 |
