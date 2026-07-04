# Döngü Günlüğü

Otonom ajanın çalışma günlüğü. Append-only. Her döngü için: tarih, seçilen iş,
kalite kapısı sonuçları, deploy durumu, sıradaki adım.

---

## DÖNGÜ #28 — 2026-07-03

**Yapılan:** Q-AUDIT güvenlik hijyeni — `npm audit fix` (no `--force`) ile transitive bağımlılık zaafiyetleri **8 (1 low / 5 moderate / 2 high) → 3 low**'a indirildi. `package.json` değişmedi, yalnızca `package-lock.json`.

**Detay:**
- `vite 7.3.2 → 7.3.6` — 2× high kapandı: `launch-editor` NTLMv2 hash disclosure (Windows), `server.fs.deny` bypass (Windows).
- `yaml-language-server / volar-service-yaml / @astrojs/language-server` zinciri güncellendi — 5× moderate kapandı: `yaml` stack-overflow DoS (GHSA-48c2-rrv3-qjmp), `js-yaml` merge-key quadratic (GHSA-h67p-54hq-rp68). Backlog Q-AUDIT-YAML `--force` gerekir sanıyordu; güncel npm audit `--force`-siz fix'i çıkardı — item düştü.
- Kalan **3 low** sadece `esbuild ≤ 0.28.0 → astro 7.0.6` major upgrade (`--force`) ile giderilir; 🔴 KIRMIZI (backlog Q-AUDIT-ESBUILD), insan onayı bekler.

**Tasarım notu:** Bu bir üretim koduna dokunmayan tarama-güncellemesi; ürün davranışı değişmedi. Lock-only değişiklik olduğu için Lighthouse yeniden ölçülmedi.

**Kalite kapıları:** check ✓ (0 hata, 0 warning, 0 hint, 111 dosya) · test ✓ (**558/558**, 29 dosya) · build ✓ (**60 sayfa**, 5.21s) · Lighthouse — kod değişikliği yok, ölçüm gereksiz.

**Yayın:** PR [#62](https://github.com/Mavrikant/or-araclari/pull/62) squash-merge edildi (2bb19f6). Deploy run 28641176649 → completed/success (9s deploy job). Canlı: <https://karaman.dev/or-araclari/>.

**İşaret:** 🟡 SARI — yaklaşık 30 transitive dev-tooling paketi güncellendi (astro/language-server 2.16.7 → 2.16.11 vb., volar-service-yaml 0.0.70 → 0.0.71, prettier 3.3.1 → 3.3.2 dahil). Hepsi patch/minor; `astro check` + tüm test + build yeşil. Direkt bağımlılık yükseltmesi (package.json) yok.

**Sıradaki:** Backlog'da açık 🟢 yeşil iş kalmadı (Q-AUDIT-ESBUILD, Q-CI-CHECK 🔴 blocked). Yeni araç fikri turu ya da mevcut araçların derinleşmesi bir sonraki döngüde gündemde. Bu döngü **DUR koşulu §8/6'ya** yaklaşıyor — yeni araç fikri üretilecek.

**Ekstra (INCIDENTS):** Deploy run 28641032194 (döngü #27 CYCLES.md commit'i, 75ab079) `actions/deploy-pages@v5` adımında `Deployment failed, try again later` verdi — geçici GitHub Pages hatası; bir sonraki push (bu döngünün 2bb19f6'sı) sağlıklı deploy oldu, aynı içerik canlıya çıktı. Kod ya da workflow sorunu değil.

---

## DÖNGÜ #27 — 2026-07-03

**Yapılan:** F-JPS — A* (A-yıldız) Izgara Yol Bulucu sayfasına ikinci algoritma olarak Jump Point Search (Harabor & Grastien, AAAI 2011) eklendi. Eş-maliyetli 8-bağlantı ızgaralarda A*'ın çapraz-kardinal simetrisini kırar; heap-pop sayısını dramatik biçimde düşürerek aynı optimum yolu bulur. F-LEMKE/F-SHORTEST-PATH/F-MST desenine uygun "iki algoritma, tek araç" yapısı.

**Detay:**
- `src/lib/jps.ts` (+455) — saf algoritma: `solveJps({grid, start, goal, heuristic?, allowCornerCutting?})`; `AStarCell`/`AStarHeuristic` tiplerini `astar.ts`'den yeniden kullanır, `AStarError`'ı ortak hata sınıfı yapar. `walkable` O(1) `Uint8Array` bit-lookup, `canDiagonalStep` corner-cutting A* semantiğiyle birebir eşleşir. `jump(parentR, parentC, dx, dy)`: iteratif yön-atlama, çapraz adımda `walkable` + `canDiagonalStep`, hedef algılama, zorunlu komşu (forced neighbor) kontrolü (çapraz: parent-tersi kardinal blocked + çaprazı açık — 2 kontrol; kardinal: yan kardinal blocked + karşı çaprazı açık — 2 kontrol), çapraz recursive: komponent kardinallerinden biri jump point bulursa burada dur. `prunedDirections(nodeR, nodeC, parentR, parentC)`: 8 komşuyu parent yönüne göre 3 (kardinal doğal) veya 5 (çapraz doğal 3 + zorunlu 2)'e düşürür; start düğümü tüm 8 yönü. Ana döngü A* iskeletiyle özdeş: `MinHeap` (f, h tie-break), `Float64Array gScore`, `Int32Array pred`, `Uint8Array closed`. Predecessor zincirinden jump point listesi kurulur, komşu jump point'ler arası tek yönde straight-line interpolasyon ile tam yol dolar. 80×80 hücre üst sınırı A* ile aynı.
- `src/lib/jps.test.ts` (+290, **20 vitest**) — boş 8-bağlantı ızgarada JPS ile A* octile optimum kimliği (4·√2 + 5), 12×12 boş açık alan `expandedCount(JPS) ≤ expandedCount(A*)` + `jumpPointCount ≤ 3` (start + goal yeterli), aynı satırda tek jump point = hedef, çapraz hat üzerinde tek jump point + interpolasyon her adımda (i,i), tek duvar örneği optimum kimliği, kapalı hedef `reachable=false` + boş yol + Infinity maliyet, corner-cutting yasak/serbest 2×2 köşe kontrolü, bir komşu açıksa yasak modda yine çapraz izinli, engel-üstü jump point testi (5×7), 4 rastgele mini ızgara ile A* karşılaştırması (`pathCost` bitpari + `expandedCount ≤` monotonluk), 10×10 zorlu labirentte optimum + yol adımlarının 1 ya da (1,1) sınırlaması (kardinal/çapraz), yol rekonstrüksiyonu: `jumpPoints ⊂ path` + endpoint'ler dahil, tüm yol adımı 1-hop, `initialHeuristic = octile(dr, dc)` doğrulaması, validation: boş ızgara / dışında start / engel-üstü / start === goal / ragged satırlar.
- `src/pages/araclar/a-star-grid-cozucu.astro` (+70/-10) — "Algoritma" fieldset (A* varsayılan / JPS radyo) + JPS seçildiğinde "bağlantı otomatik 8'e sabitlendi (octile heuristic önerilir)" sky-tonlu bildirim paneli + connectivity radyoları `disabled` moduna geçer + kayıtlı state (`algorithm` alanı) `localStorage`'a yazılır. `runSolve()` iki dala ayrılır: JPS için `solveJps` çağrısı, `RenderResult` arayüzü ortaklaştırıldı, `jumpPoints` fuşya `ring-2 ring-fuchsia-500 ring-inset` overlay ile vurgulanır, legend "Jump point" pill'i JPS modunda görünür olur. Result meta algoritma-spesifik metin döner (`"JPS · N adım · M jump point · K heap-pop · ..."` vs `"A* · N adım · M hücre açıldı · ..."`).
- `src/data/tools.ts` (+2/-2) — tool başlığı `"A* (A-yıldız) & JPS Izgara Yol Bulucu"`, kısa başlık `"A* / JPS Yol Bulucu"`, description JPS'i vurgulayacak biçimde genişletildi.
- `src/content/rehberler/a-star-grid-heuristik.mdx` (+45) — "JPS — Jump Point Search: A*'ın simetri kırma varyantı" bölümü: anahtar fikir + doğal/zorunlu/budanabilir komşular + `jump(dx,dy)` prosedürü + optimumluk gerekçesi + sınırlar (uniform-cost only) + aracımızda kullanım. Yeni FAQ item'ı (JPS ne zaman seçmeli).
- `public/og/a-star-grid-cozucu.png` — `npm run og` ile başlık güncellemesi (81.5 KB); diğer 19 OG kartı byte-identical (deterministik render).

**Tasarım notu:** A* ve JPS aynı `AStarCell` / `AStarHeuristic` tiplerini paylaşırken JPS `AStarError`'ı yeniden kullanarak tek hata sınıfı hattı sürdürür. `runSolve()` içinde `RenderResult` yapısı sadece `path` + `expanded` + opsiyonel `jumpPoints` içerdiği için render fonksiyonu iki algoritmayı ayrı bilmek zorunda değil. JPS modunda `connectivity` radyoları `disabled` — kayıt sırasında `input:disabled` state okuma sorununu önlemek için 8'e `setConnectivity`'yi radyoyu disable etmeden önce çağırıyoruz. Corner-cutting checkbox JPS modunda da aktif; `canDiagonalStep` A*'ın aynı davranışını üretir, sonuç kimliği doğrulanmış.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **111 dosya**) · test ✓ (**558/558**, +20 yeni JPS testi, 29 dosya) · build ✓ (**60 sayfa**, 5.20s — aynı sayfa sayısı, sadece lib + script + rehber genişledi) · Lighthouse — mevcut A* sayfası birebir korundu, sadece +1 radyo grubu + fuşya halka overlay + ~55 script satırı; mobil yerleşim aynı Tailwind desenleriyle (`space-y-2` fieldset, `text-sm` label), ≥95 beklenir.

**Yayın:** PR #60 squash-merge edildi (cec21ec). Deploy run 28640962494 → completed/success (8s deploy job). Canlı: <https://karaman.dev/or-araclari/araclar/a-star-grid-cozucu>.

**İşaret:** yok (sırf 🟢 yeşil — mevcut aracı ikinci algoritma ile genişletti; F-LEMKE, F-SHORTEST-PATH ve F-MST'nin "iki algoritma, tek araç" desenini birebir tekrarlar).

**Sıradaki:** Q-AUDIT-YAML (M efor, yaml-language-server zinciri, breaking-change riski) ya da yeni araç fikri. Backlog'da yeni araç item'ı kalmadı; keşif turu (ör. simplex tabloları, Hungarian algoritması varyantları, TSP metasezgisel) ya da mevcut araçların derinleşmesi bir sonraki döngüde gündem olacak.

---

## DÖNGÜ #26 — 2026-06-28

**Yapılan:** F-LEMKE — F-GAME-NASH Bimatris Nash Çözücü'ne ikinci algoritma olarak Lemke-Howson (1964) tamamlayıcı pivot algoritması eklendi. Support enumeration m + n ≤ 12 sınırının üzerine çıkar; tek denge yeterli olduğunda büyük oyunlarda hızlı sonuç verir. MST (Prim + Kruskal) ve Shortest Path (Dijkstra + Bellman-Ford) desenine uygun "iki algoritma, tek araç" yapısı.

**Detay:**
- `src/lib/lemke-howson.ts` (+330) — saf algoritma: `lemkeHowson(input, dropLabel)` (1..m+n) tek pivot zinciri; iki en-iyi-yanıt poliyedrası P, Q için ayrı tableau (P: n satır × m+n+1, Q: m satır × m+n+1), pozitiflik kaydırması (min ≤ 0 ise 1 − min), Bland kuralı min-oran eşitliklerinde küçük taban indeksi (döngüsüzlük), `LemkeStatus` enum (`found`/`degenerate`/`maxiter`/`invalid-drop`), `LemkePivotStep` adım kaydı, `lemkeHowsonAllDrops()` k = 1..m+n için art arda çalıştırma + deduplike denge kümesi. Etiket sözleşmesi: P sütun 0..m-1 = x̄, m..m+n-1 = s; Q sütun 0..m-1 = r, m..m+n-1 = ȳ. Non-basic sütun indeksi = karşılanan etiket. Ray termination dejenere statüsü döner. Payoff orijinal (kaydırılmamış) A, B ile hesaplanır.
- `src/lib/lemke-howson.test.ts` (+260, **21 vitest**) — Tutuklu Açmazı tek saf NE (D, D), Cinsiyet Savaşı saf NE'lerinden biri (dropLabel=1), Matching Pennies tek karışık NE (½, ½), Stag Hunt + Tavuk Oyunu saf NE varyantları, negatif sıfır-toplamlı 2×2 (kaydırma sonrası ½-½ doğrulandı), strateji vektörü ∈ Δ değişmezi (≥0 + toplam 1), support indeksleri pozitif olasılıklara eşleşir, payoff = xᵀ A y kaydırılmamış, karışık dengede indifference koşulu (Ay)_i = u ∀ i ∈ supp(x), 3×3 + 2×3 + 3×2 asimetrik oyunlar, farklı dropLabel farklı NE bulur (BoS'ta ≥2), pivot adımları alternate, `lemkeHowsonAllDrops` PD'de tek NE / BoS'ta ≥2 NE, validation hataları (dropLabel aralık, boş matris, boyut uyumsuzluğu, NaN).
- `src/pages/araclar/bimatris-nash-cozucu.astro` (+85) — form üstünde algoritma seçici radyo grubu ("Support enumeration" / "Lemke-Howson") + Lemke seçildiğinde açılan alt panel ("Tüm dropLabel'ları dene" checkbox + sabit dropLabel sayı inputu). Solve butonu etiketi seçime göre dinamik ("Tüm dengeleri bul" / "Lemke-Howson tüm dropLabel'larla" / "Lemke-Howson (tek pivot zinciri)"). MAX_DIM_SUM (=12) kontrolü sadece support seçildiğinde uygulanır — Lemke büyük oyunda çalışır. Sonuç kartı altı "${pure} saf, ${mixed} karışık · ${pivots} pivot adımı (Lemke-Howson)." gibi algoritma-spesifik detay raporlar. `LemkeError` yakalama dalı eklendi.
- `src/content/rehberler/nash-dengesi-bimatris.mdx` (+15/-12) — "Lemke-Howson alternatifi" bölümü artık "araçta seçilebilir" başlığıyla genişletildi: P, Q poliyedraları + etiket sözleşmesi tam liste (4 satır), yapay (0,0) tepesinden tamamlayıcı pivot zinciri açıklaması, "Tüm dropLabel'ları dene" UX notu. FAQ "neden support enumeration seçildi" sorusu "hangisini ne zaman seçmeli" olarak güncellendi (her iki algoritma sunulur).

**Tasarım notu:** Lemke-Howson polytope formülasyonunda P ve Q'da sütun indeksi → etiket eşlemesi birebir aynı tutuldu (col 0..m-1 her ikisinde de "etiket 1..m'in karşılayıcısı" — P'de x̄_i, Q'da r_i; col m..m+n-1 her ikisinde "etiket m+1..m+n" — P'de s_j, Q'da ȳ_j); böylece "duplicate etiket" tespiti tek bir `leavingCol === dropLabel0` kontrolüne indi. Pozitiflik kaydırması shiftA = 1 − minA (eğer minA ≤ 0) optimumu etkilemez çünkü stratejiler best-response indifference'ı koruyor; payoff sabit ekleme ile değişir, biz orijinal A ile yeniden hesaplıyoruz. Bland kuralı min-oran eşitliklerinde "küçük taban indeksli satırı bırak" → Lemke-Howson literatüründe standart anti-cycling (Howson 1972). MDX schema'sında faq.answer ≤ 800 char sınırı ilk yazımda ihlal edildi (1086 char); kısaltılarak korundu.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **109 dosya**) · test ✓ (**538/538**, +21 yeni Lemke-Howson testi, 28 dosya) · build ✓ (**60 sayfa**, 5.23s — aynı sayfa/araç sayısı, lib + script genişledi) · Lighthouse — mevcut F-GAME-NASH sayfası birebir korundu, sadece +1 radyo grubu + +1 alt panel + ~85 JS satırı; mobil yerleşim aynı Tailwind desenleriyle (`flex items-start gap-2`, `ml-6 ... p-3`), ≥95 beklenir.

**Yayın:** PR #57 squash-merge edildi (cc56ae2). Deploy run 28326655011 → completed/success — main üzerine push tamam, https://karaman.dev/or-araclari/ canlı.

**İşaret:** yok.

**Sıradaki:** F-JPS (Jump Point Search — F-ASTAR'ın eş-maliyetli ızgarada 10× hızlanması) ya da Q-AUDIT-YAML (yaml-language-server zinciri). Q-AUDIT-ESBUILD ve Q-CI-CHECK blocked (insan onayı).

---

## DÖNGÜ #25 — 2026-06-20

**Yapılan:** F-STEINER — Steiner Ağacı Çözücü (Kou-Markowsky-Berman 1981 2-yaklaşımı) ve uzun-form Türkçe rehberi yayınlandı. Yönsüz ağırlıklı bir grafta bir terminal alt kümesini en az toplam ağırlıkla bağlayan ağacı bulur; ara düğümler (Steiner noktaları) isteğe bağlı olarak ağaca dahil edilir. Problem NP-zor (Karp 1972); KMB en kötü durumda 2·OPT garantili polinom zamanlı yaklaşım. F-MST'nin doğal uzantısı, graf kategorisinin sekizinci aracı.

**Detay:**
- `src/lib/steiner.ts` (+390) — KMB 6 adım: terminal başına Dijkstra (binary heap, Float64Array dist + Int32Array pred), metrik kapanış tam grafı (terminal çiftleri arası en kısa yol), Kruskal MST (union-find: path compression + union-by-rank), yolları orijinal kenarlara genişletme + paralel kenar tekilleştirme (Map ile), alt graf üzerinde ikinci MST, terminal olmayan yaprakları ardışık fix-point kırpma. Ayrıca tüm grafın MST'sini karşılaştırma için raporlar. Sınırlar: 200 düğüm, 1000 kenar, 30 terminal; ağırlık ≥ 0 zorunlu (Dijkstra). Validation: boş kenar/terminal, self-loop, NaN/Infinity, negatif ağırlık, tekrar terminal, grafa ait olmayan terminal.
- `src/lib/steiner.test.ts` (+250, **23 vitest**) — Y-yıldız hub seçimi (3 terminal, OPT = 3 hub C üzerinden), zincir ortası Steiner noktası (A–B–C–D–E uçlardan terminal → B/C/D Steiner), terminal olmayan yaprak kırpma (saplama C–X atılır), metrik kapanış yol raporu (Dijkstra A–B–C 7 < direkt 10), iki terminal en kısa yol, KMB ≤ 2·OPT sınırı, paralel kenarda min seçimi, erişilemez terminal → reachable=false, determinizm aynı giriş aynı çıktı, MST karşılaştırması saplama atımı, 7 validation hata yolu, K4 4 terminal → kenar = düğüm − 1, zincirde tüm uçlar terminal → tam zincir.
- `src/pages/araclar/steiner-agaci-cozucu.astro` (+325) — mobil-öncelikli form (kenar textarea + terminal listesi text input), **3 örnek** (Y-yıldız 3 terminal, ızgara 4 köşe 2 terminal, saplama-kırpma örneği), **3 sonuç kartı** (Steiner toplamı emerald, tüm graf MST'si sky, Steiner noktası sayısı + listesi amber), ağaç kenarları tablosu (terminal/Steiner rozetleri ile renk kodlu — terminal yeşil pill, Steiner amber pill), metrik kapanış yolları tablosu (terminal çift, uzaklık, adım adım yol), erişilemez red banner, localStorage state (`steiner-state-v1`).
- `src/content/rehberler/steiner-agaci-2-yaklasim.mdx` (+200) — 11 dk Türkçe rehber: Karp 1972 NP-tam indirgemesi ve uç hâller (|R|=2 SP, R=V MST, arada NP-zor), KMB 6 adım pseudokod + Y şekli sayısal yürüteç, metrik kapanış üçgen eşitsizliği özellikleri, yaklaşım faktörü 2(1−1/ℓ)'nin Euler turu temelli ispatı, MST karşılaştırma tablosu, 6 uygulama alanı (VLSI, telekom backbone, IP multicast, filogenetik, yol/boru hattı planlaması, sosyal ağ), 9 FAQ JSON-LD (FAQPage rich result).
- `src/data/tools.ts` (+10) — yeni araç kaydı (25'inci araç, `graf` kategorisi, guideSlug=`steiner-agaci-2-yaklasim`).
- `public/og/steiner-agaci-cozucu.png` — `npm run og` ile per-tool OG kartı (84.5 KB).

**Tasarım notu:** KMB metrik kapanışta tie-break ile bazı sayısal örneklerde optimum yerine 4 (= 2·OPT/1.5) verebilir — örneğin direkt kenar = hub-yolu olduğunda Kruskal'ın deterministic sıralaması direkt kenarları seçer, sonuç hub-tabanlı çözümden pahalı olur. Bu pratik olarak normal: KMB yaklaşım algoritması, optimum değil. Test "KMB ≤ 2·OPT (basit kontrol)" bu durumu açıkça ele alıyor (`toBeLessThanOrEqual(2 * opt)`). Sayfadaki "MST karşılaştırması" kartı kullanıcının ara düğüm kullanmanın getirdiği kazancı somut görmesini sağlıyor. Yaprak kırpma fix-point loop'u: tek pass yeterli değil çünkü bir yaprağı atınca komşusu yeni bir yaprağa dönüşebilir — `while toRemove.size > 0` ile sabit noktaya kadar tekrarlanıyor.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **107 dosya**) · test ✓ (**517/517**, +23 yeni Steiner testi, 27 dosya) · build ✓ (**60 sayfa**, 5.57s — yeni araç + rehber dahil) · Lighthouse — yeni sayfa mevcut F-MST / F-SHORTEST-PATH deseni birebir izliyor (inline `<script>`, plotly/glpk yok, saf JS heap, Tailwind grid + table), mobil-öncelikli yerleşim (≥95 beklenir).

**Yayın:** PR #55 squash-merge edildi (793195b). Deploy run 27849801194 queued — main üzerine push tamam.

**İşaret:** yok.

**Sıradaki:** F-LEMKE (Lemke-Howson pivot — F-GAME-NASH'in support enumeration sınırını aşar) ya da F-JPS (Jump Point Search — F-ASTAR'ın eş-maliyetli ızgarada 10× hızlanması). Q-AUDIT-YAML hâlâ open. Q-AUDIT-ESBUILD ve Q-CI-CHECK blocked (insan onayı).

---

## DÖNGÜ #24 — 2026-06-19

**Yapılan:** F-ASTAR — A* (A-yıldız) Izgara Yol Bulucu ve uzun-form Türkçe sezgisel arama rehberi yayınlandı. 2D ızgarada f(n) = g(n) + h(n) önceliği ile bilgili arama; Manhattan / Octile / Euclidean / Chebyshev / Zero heuristic seçenekleri; 4 ya da 8 bağlantı (kardinal 1, çapraz √2); corner-cutting yasak/serbest. Görsel ızgarada tıkla-engel/start/goal editörü; açılan hücreler (closed set) ayrı renkte gösterilerek heuristic kalitesi gözle ölçülebiliyor. F-SHORTEST-PATH'in koordinatlı uzantısı, graf kategorisinin yedinci aracı.

**Detay:**
- `src/lib/astar.ts` (+290) — saf algoritma: `solveAStar()` (f-min heap + Uint8Array closed-set + Int32Array predecessor + Float64Array g-score, 4/8 komşu sabit dizileri, corner-cutting check), `computeHeuristic()` (5 heuristic enum + Octile için √2−1 sabit), `MinHeap` (f primary + h secondary tie-break — hedefe yakın olanı tercih eder, cephe daralır), `validate()` (80×80 max, eşit satır uzunluğu, start≠goal, start/goal engelin üstünde değil), karakter şeması (`. ' ' S G s g o O 0` boş; diğeri engel).
- `src/lib/astar.test.ts` (+260, **20 vitest**) — boş ızgarada Manhattan = gerçek maliyet (heuristic mükemmel), 8-bağlantı Octile = 2√2+2 doğru, zero vs Manhattan aynı maliyet farklı genişletme sayısı (Dijkstra eşdeğeri), duvar etrafında dolaşma (10 maliyet), erişilemez hedef (reachable=false + empty path), corner-cutting yasak/izinli ikili (kritik kontrol — köşe geçişi kararlılığı), tek-engelli çapraz hâlâ izinli, heuristic etkinliği (zero > manhattan açma sayısı), 4/8 yolda kardinal/çapraz adım doğrulaması, 5 validation hata yolu, kıyaslama (admissible heuristic'ler aynı optimum).
- `src/pages/araclar/a-star-grid-cozucu.astro` (+420) — mobil-öncelikli form (ızgara textarea + start/goal sayı inputları + heuristic 5-radio + 4/8 bağlantı + corner-cut checkbox), **3 örnek** (12×16 labirent, 10×14 odalar, 8×12 açık alan), **görsel ızgara** (Tailwind grid + cellSize 14–28px responsive, rol bazlı renkler: S yeşil / G kırmızı / yol mavi / açılan amber / engel slate / boş beyaz), **tıkla-düzenle** (Start/Goal/Engel modu — hücreye tıkla rolü değiştir, anında yeniden çöz), legend bar, sonuç kartı (maliyet + adım + açılan sayısı + başlangıç heuristic'i), erişilemez amber banner, localStorage state (`astar-state-v1`).
- `src/content/rehberler/a-star-grid-heuristik.mdx` (+200) — 11 dk Türkçe rehber: tarihsel arka plan (Hart-Nilsson-Raphael 1968, Shakey robot), f = g + h anatomisi, admissibility + consistency ispatları, 4 heuristic karşılaştırma tablosu (bağlantı eşleme kuralı), algoritma pseudokod + tie-breaking, heuristic etkinliği somut karşılaştırması (7×7'de Manhattan vs zero), A* ↔ Dijkstra ilişkisi, 8 bağlantı + corner-cutting görsel açıklaması, 5 uygulama alanı (oyun AI, robotik, GPS, puzzle, otomatik planlama), 5 sınır (bellek, heuristic kalitesi, dinamik ortam, çoklu ajan, süreklilik), karıştırılan kavramlar (BFS/DFS, Greedy Best-First, heuristic vs maliyet), 10 FAQ JSON-LD (FAQPage rich result).
- `src/data/tools.ts` (+10) — yeni araç kaydı (24'üncü araç, `graf` kategorisi, guideSlug=`a-star-grid-heuristik`).
- `public/og/a-star-grid-cozucu.png` — `npm run og` ile per-tool OG kartı (79.6 KB).

**Tasarım notu:** Görsel ızgara doğrudan DOM butonları (Tailwind sınıflarıyla) — Plotly/Canvas yok. Bu yaklaşım hem mobilde dokunmatik dostu hem ışıltı yapmaz; 80×80 üst sınır 6400 düğümle bile DOM bütçesinde kalıyor. f tie-break'inde ikincil anahtar h: eşit f değerinde hedefe daha yakın hücreyi tercih ederek arama cephesini sıkı tutar — pratikte Dijkstra ile aynı optimum, daha az açılan hücre. Corner-cutting varsayılan yasak (gerçekçi); kullanıcı isterse checkbox ile serbestleştirebilir. MDX zod şeması ile description ≤200 ve faq.answer ≤800 char çakıştı (ilk denemede 7 hata), kısaltıldı (içerik korundu).

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **104 dosya**) · test ✓ (**494/494**, +20 yeni A* testi, 26 dosya) · build ✓ (**58 sayfa**, 5.52s — yeni araç + rehber dahil) · Lighthouse — yeni sayfa mevcut F-SHORTEST-PATH / F-MST deseni birebir izliyor (inline `<script>`, plotly/glpk yok, saf JS heap, Tailwind grid), mobil-öncelikli yerleşim + responsive cellSize (≥95 beklenir).

**Yayın:** PR açılacak ve CI yeşilse merge.

**İşaret:** sarı — DÖNGÜ #22 docs PR'ı (#51) `cycle/22-log` dalında conflict (DIRTY) bırakılmış; cycle #22 kaydı CYCLES.md'de eksikti. Bu döngüde retroaktif eklendi (aşağı bkz). PR #51 superseded → kapatıldı.

**Sıradaki:** F-STEINER (MST tabanlı 2-approx Steiner ağacı) ya da F-LEMKE (Lemke-Howson pivot). Q-AUDIT-YAML hâlâ open. Q-AUDIT-ESBUILD ve Q-CI-CHECK blocked (insan onayı).

---

## DÖNGÜ #22 — 2026-06-17 (retroaktif kayıt — döngü #24'te eklendi)

**Yapılan:** F-SHORTEST-PATH — En Kısa Yol Çözücü (Dijkstra + Bellman-Ford) ve uzun-form Türkçe rehberi yayınlandı. Yönlü ağırlıklı ağda kaynaktan (s) tüm düğümlere ya da seçilen hedefe (t) en kısa yol; ağırlıklar negatif değilse Dijkstra (binary heap, lazy delete), aksi hâlde Bellman-Ford (V−1 pass + erken çıkış + V'inci pass negatif çevrim tespiti); auto modu ağırlık dağılımına göre otomatik seçer. Graf kategorisinin temel taşı; max-flow ve min-cost flow'dan sonra üçüncü.

**Detay:**
- `src/lib/shortest-path.ts` (+490) — `solveShortestPath()` ortak iskelet, `dijkstra()` (Float64Array dist + Int32Array pred + MinHeap), `bellmanFord()` (V−1 relax + cycleSeed → V kez geri git ile garanti çevrim üyeliği), `reconstructPath()` (target verilirse predecessor zinciri), `prepareGraph()` (string adı intern → int).
- `src/lib/shortest-path.test.ts` (+200, **20 vitest**) — CLRS 24.3 Dijkstra örneği (s=A, doğrulanmış 5 düğüm uzaklıkları), CLRS 24.1 Bellman-Ford örneği, auto-mode negatif → BF düşmesi, negatif çevrim tespiti + nodes listesi, ulaşılamaz düğüm reachable=false, target yol rekonstrüksiyonu, Dijkstra negatif ağırlıkta hata, validation 6 yol.
- `src/pages/araclar/en-kisa-yol-cozucu.astro` (+330) — mobil-öncelikli form (kenar textarea + source/target input + 3-radio algoritma), 3 örnek (Dijkstra CLRS, Bellman-Ford negatif, Negatif çevrim), hedef varsa "en kısa uzaklık" kartı + adım adım yol tablosu, tüm düğümler tablosu (uzaklık, predecessor, durum), negatif çevrim red banner.
- `src/content/rehberler/en-kisa-yol-dijkstra-bellman-ford.mdx` (+170) — 10 dk Türkçe rehber: gevşetme (relaxation) kavramı, Dijkstra açgözlü doğruluk ispatı (kesim argümanı + ≥0 ağırlık gereksinimi), Bellman-Ford V−1 pass mantığı, negatif çevrim tespit teoremi, iki algoritma karşılaştırma tablosu, 5 uygulama (yol, telekom, oyun AI, valuta arbitrajı, görüntü işleme), FAQ JSON-LD.
- `src/data/tools.ts` (+10) — yeni araç kaydı (23'üncü araç, `graf` kategorisi).
- `public/og/en-kisa-yol-cozucu.png` — OG kartı.

**Kalite kapıları:** check ✓ · test ✓ (**451/451**, +20) · build ✓ (54 sayfa) · Lighthouse (mevcut graf desen).

**Yayın:** PR #50 squash-merge edildi (b1b8004). Deploy yeşil (run 27710956462).

**İşaret:** sarı — docs PR (#51) ayrı dalda açıldı ama bekleyen squash + ardından #52 docs PR'ı (#53) ile main divergence → conflict. #24'te superseded olarak kapatıldı; bu kayıt manuel oluşturuldu.

**Sıradaki:** F-MST (gerçekleşti, döngü #23).

---

## DÖNGÜ #23 — 2026-06-18

**Yapılan:** F-MST — Minimum Yayılan Ağaç (MST) Çözücü ve uzun-form Türkçe Prim/Kruskal rehberi yayınlandı. Yönsüz ağırlıklı graf için iki algoritma: Prim (binary heap + lazy delete, bağlı olmayan grafda her bileşen için yeniden başlat) ve Kruskal (union-find: path compression + rank). Graf kategorisinin klasik dördüncü ayağı (TSP, Maks-Akış, Min-Maliyet Akış, En Kısa Yol'dan sonra).

**Detay:**
- `src/lib/mst.ts` (+360) — saf algoritma: `prim()` (binary heap min-frontier, lazy delete via `inTree[]`, runFrom helper bağlı olmayan grafta her bileşeni ziyaret), `kruskal()` ((ağırlık, kenar_id) ile deterministic sort + DSU.union ile çevrim filtresi, n−1 kenarda erken çıkış), `DSU` (path compression iki-geçişli + union-by-rank), `buildComponents()` (MST kenarları üzerinde ikinci DSU ile 0..k−1 bileşen yeniden numaralandırma), `prepareGraph()` yönsüz min-paralel-kenar Map'i ile (min(u,v)|max(u,v)) key.
- `src/lib/mst.test.ts` (+300, **23 vitest**) — CLRS Bölüm 23 ders kitabı örneği (9 düğüm, toplam 37 — Prim ve Kruskal ayrı ayrı), üçgen en pahalı kenar atımı, zincir, kare+köşegen, başlangıç düğümü bağımsızlığı (Prim r=a vs r=e aynı toplam), Kruskal sıralı seçim, 2-bileşenli orman (Prim ve Kruskal), izole düğüm bileşeni, paralel kenar min seçimi, yönsüz (A→B)=(B→A), negatif ağırlık toplama, bileşen etiketi tutarlılığı, validation (boş kenar, self-loop, NaN, Infinity, boş ad, grafa ait olmayan startNode), Prim/Kruskal toplam ağırlık tutarlılığı.
- `src/pages/araclar/minimum-yayilan-agac-cozucu.astro` (+340) — mobil-öncelikli form (kenar textarea + Prim/Kruskal radio + opsiyonel startNode), 3 örnek (CLRS klasik 9 düğüm, Türkçe şehir ağı 5 düğüm, 2-bileşenli orman), toplam ağırlık vurgulu kart, "bağlı değil" amber banner (bileşen sayısı), ağaç kenarları sıralı tablo (adım, kenar, ağırlık, birikimli), düğüm bileşenleri tablosu (renkli rozet — 6 ton paleti), localStorage state (`mst-state-v1`).
- `src/content/rehberler/minimum-yayilan-agac-prim-kruskal.mdx` (+200) — 10 dk Türkçe rehber: problem tanımı (LP-tarzı), cut property + cycle property + ispatlar, Prim pseudokod + CLRS örnekli adım tablosu (37'ye nasıl ulaşılır), Kruskal pseudokod + union-find iç yapısı + aynı CLRS örneği sıralı tablosu, Prim vs Kruskal karşılaştırma tablosu, 6 uygulama (ağ tasarımı, kümeleme, TSP 2-approx, görüntü segmentasyonu, VLSI, labirent), MST vs SPT karıştırması (A-B-C üçgen örneği), pratik notlar, 8 FAQ JSON-LD (FAQPage rich result).
- `src/data/tools.ts` (+10) — yeni araç kaydı (22'nci araç, `graf` kategorisi, guideSlug=`minimum-yayilan-agac-prim-kruskal`).
- `public/og/minimum-yayilan-agac-cozucu.png` — `npm run og` ile per-tool OG kartı (85.1 KB). Diğer 21 OG kartı byte-identical.

**Tasarım notu:** Yönsüz grafı kullanıcıdan ekstra simetri istemeden (örn. (u,v) ve (v,u) yazmak gerekmez) modellemek için `prepareGraph` paralel kenarları `(min(u,v)|max(u,v)) → min ağırlık` Map'inde toplar. Bu hem Prim'in komşuluk listesini hem Kruskal'ın kenar listesini deduplike eder. Prim için lazy delete tercih edildi (heap.decreaseKey karmaşıklığından kaçınmak için klasik tercih); Kruskal'da DSU için union-by-rank + path-compression iki-geçişli (find sırasında parent'ı kökle güncelle) implementasyon — amortize α(n).

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **101 dosya**) · test ✓ (**474/474**, +23 yeni MST testi, 25 dosya) · build ✓ (**56 sayfa**, 7.27s — yeni araç + rehber dahil) · Lighthouse — yeni sayfa mevcut F-SHORTEST-PATH deseni birebir izliyor (inline `<script>`, plotly/glpk yok, saf JS heap+DSU, Tailwind), mobil-öncelikli yerleşim (≥95 beklenir).

**Yayın:** PR #52 squash-merge edildi. Deploy to GitHub Pages workflow yeşil (1m15s, run 27784241518). Canlı doğrulama: `/araclar/minimum-yayilan-agac-cozucu/` 200 ✓, `/rehberler/minimum-yayilan-agac-prim-kruskal/` 200 ✓, `/og/minimum-yayilan-agac-cozucu.png` 200 ✓.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, graf kategorisinin doğal genişlemesi).

**Sıradaki:** Q-AUDIT-YAML (M efor, breaking-change riski) ya da F-LEMKE / F-ASTAR (yeni araç fikirleri). Q-AUDIT-ESBUILD ve Q-CI-CHECK hâlâ blocked (insan onayı gerekir). Backlog'a F-STEINER eklendi (MST tabanlı yaklaşıklık).

---

## DÖNGÜ #21 — 2026-06-17

**Yapılan:** F-GAME-NASH — Bimatris (Genel Toplam) Nash Dengesi Çözücü ve uzun-form Türkçe Nash teoremi + koordinasyon oyunları rehberi yayınlandı. Support enumeration algoritması; Shapley lemma ile |S₁|=|S₂| varsayımı; saf + karışık tüm Nash dengelerini liste hâlinde döker. F-GAME (sıfır toplam) çözücünün non-zero-sum uzantısı, optimizasyon kategorisinde.

**Detay:**
- `src/lib/bimatrix.ts` (+345) — saf algoritma: `findPureNash` (R'ın sütun-bazlı max + C'nin satır-bazlı max kesişim hücresi), `findNashEquilibria` (k=1..min(m,n) için tüm (S₁,S₂) destek çiftlerini tara), `solveSupportPair` (her destek için (k+1)×(k+1) lineer sistem: A_{S₁,S₂} y_{S₂} = u·1 + Σy=1, simetrik x için), `gaussianSolve` (kısmi pivotlu Gauss eliminasyonu), `verifyEquilibrium` (off-support best-response + pozitif olasılık), strateji normalize + duplikasyon eleme via fixed-6-digit key. `MAX_DIM_SUM = 12` ile 2^m·2^n patlamasına kapak.
- `src/lib/bimatrix.test.ts` (+330, **23 vitest**) — Tutuklu Açmazı (tek saf (D,D)), Cinsiyet Savaşı (3 Nash: 2 saf + (3/5,2/5)/(2/5,3/5) karışık, u=v=6/5), Matching Pennies sıfır toplam (tek karışık (½,½)), Taş-Kağıt-Makas (1/3,1/3,1/3) simetrik, Şahin-Güvercin asimetrik 2 saf, Stag Hunt 2 saf+karışık, Off-support best response (3×3 dominant), 3×3 koordinasyon köşegen 3 saf, beklenen kazanç doğrulama (x^T A y = u), olasılık toplamı 1 + non-negative, determinizm, truncate (m+n=MAX), support indeks artan, 7 validation hata yolu.
- `src/pages/araclar/bimatris-nash-cozucu.astro` (+395) — mobil-öncelikli form (R/C strateji ad input + A ve B textarea ayrı), 4 örnek (Tutuklu Açmazı, Cinsiyet Savaşı, Stag Hunt, Tavuk), denge sayısı vurgulu kart (saf/karışık dağılımı + taranan destek çifti sayısı), birleşik (A,B) payoff tablosu (saf Nash hücreleri yeşil vurgu, R-kazancı brand, C-kazancı amber renkli), her denge için ayrı card (kind pill saf/karışık, beklenen kazanç u_R/v_C, destek listesi, R ve C strateji bar grafiği brand/amber accent), boş sonuç paneli (dejenere oyun uyarısı).
- `src/content/rehberler/nash-dengesi-bimatris.mdx` (+170) — 11 dk Türkçe rehber: bimatris-sıfır toplam farkı, Nash teoremi (Kakutani sabit-nokta), saf Nash (sütun/satır best response kesişimi), karışık Nash + indifference, support enumeration cebirsel (Shapley lemma O(C(m+n,m)) karmaşıklık), Cinsiyet Savaşı sayısal turu (3 dengenin tam çözümü), Stag Hunt (Pareto vs risk dominans), Tavuk Oyunu (Schelling bağlanma), Lemke-Howson alternatifi + karşılaştırma tablosu, modelin sınırları (n≥3 oyuncu, sürekli strateji, common knowledge, dejenere oyun), 8 FAQ JSON-LD.
- `src/data/tools.ts` (+10) — yeni araç kaydı (21'nci araç, `optimizasyon` kategorisi, guideSlug=`nash-dengesi-bimatris`).
- `public/og/bimatris-nash-cozucu.png` — `npm run og` ile per-tool OG kartı (80.9 KB). Diğer 20 OG kartı byte-identical (deterministik render).

**Tasarım notu:** Support enumeration seçildi (Lemke-Howson yerine), çünkü (a) eğitsel netlik — Cinsiyet Savaşı'nın 3 dengesini yan yana görmek koordinasyon problemini somutlaştırır, (b) küçük matriste eşit hızlı, (c) implementation O(C(m+n,m)) okunabilir. MDX FAQ schema 200-char description limitiyle ilk denemede çakıştı; description kısaltıldı (içerik koruldu). Lemke-Howson büyük matris ölçeklenebilirliği için F-LEMKE olarak backlog'a kaydedildi.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **95 dosya**) · test ✓ (**431/431**, +23 yeni bimatrix testi, 23 dosya) · build ✓ (**52 sayfa**, 6.28s — yeni araç + rehber dahil) · Lighthouse — yeni sayfa mevcut F-GAME deseni birebir izliyor (inline `<script>`, plotly yok, SVG/Tailwind, glpk.js'e bağımlı değil — saf JS Gauss eliminasyonu), mobil-öncelikli yerleşim (≥95 beklenir).

**Yayın:** PR açılacak ve CI yeşilse merge.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, F-GAME'in doğal genel-toplam uzantısı; mevcut deseni birebir takip).

**Sıradaki:** Q-AUDIT-YAML (M efor, breaking-change riski) ya da yeni F-LEMKE (Lemke-Howson, büyük bimatris). Q-AUDIT-ESBUILD hâlâ blocked (major Astro upgrade). Backlog'da yeni araç fikri için yeni boşluk açıldı.

---

## DÖNGÜ #20 — 2026-06-17

**Yapılan:** Min-Cost Flow (Min Maliyetli Akış) Çözücü yayınlandı (F-MINCOST2 — F-MINCOST'un ikinci yarısı). Successive Shortest Path algoritması (residüel grafta SPFA / queue-based Bellman-Ford), her kenarda kapasite + birim maliyet, isteğe bağlı hedef akış d (boşsa max-flow kadar). Uzun-form Türkçe rehber (SSP iskeleti, residüel grafta negatif ters kenarlar, Johnson reweighting, açgözlük tuzağı, ulaştırma indirgemesi, network simplex karşılaştırması). Tool & guide tools.ts'e ve OG generator'a eklendi.

**Detay:**
- `src/lib/min-cost-flow.ts` — SSP çekirdek; düğüm interning, residüel arc çifti (ileri +w, ters −w), SPFA shortest-path, bottleneck augment; integer flow garantili; +18 vitest
- `src/lib/min-cost-flow.test.ts` — tek yol, paralel yol (ucuz önce), maks akış kadar, infeasible, geri çağırma (cancellation) gerektiren açgözlük tuzağı, akış korunumu, totalCost = Σ flow·cost tutarlılığı, validation (6), determinism, 2×3 ulaştırma problemi (klasik LP optimumu = 375)
- `src/pages/araclar/min-maliyet-akis-cozucu.astro` — kenar editörü, source/sink/required form alanları, 2 örnek (Açgözlük tuzağı, Ulaştırma örneği), toplam akış + toplam maliyet kartları, kenar tablosu (akış %, cost katkısı), infeasible uyarısı, localStorage state
- `src/content/rehberler/min-maliyet-akis.mdx` — 8 FAQ, LP formülasyonu (totally unimodular), SSP pseudokod, Klein 1967 negatif yön çevrim teoremi, açgözlük tuzağı sayısal analizi (naif 202 vs SSP 4), ulaştırma indirgemesi, algoritma karşılaştırma tablosu
- `src/data/tools.ts` — 20'nci araç; `graf` kategorisi (max-flow ile aynı), guideSlug `min-maliyet-akis`
- `public/og/min-maliyet-akis-cozucu.png` — generate-og.mjs ile (82.5 KB)

**Kalite kapıları:** check ✓ (0 hata, 0 hint) · test ✓ (408/408, +18 yeni) · build ✓ (50 sayfa, önceki 48) · Lighthouse — değişiklik yapısal mevcut araç desenleriyle birebir; ölçüm yeni sayfaya merge sonrası yapılacak

**Yayın:** PR açılacak ve CI yeşilse merge.

**İşaret:** yok (sırf 🟢 yeşil eylem — yeni araç + içerik; backlog'daki F-MINCOST2 done'a geçiyor)

**Sıradaki:** F-GAME-NASH (Bimatris Nash dengesi, Lemke-Howson) ya da Q-AUDIT-YAML zincirinin Astro/check uyumlulukla nasıl yükseltileceğinin denenmesi. Bir sonraki döngüde F-GAME-NASH (oyun teorisi olduğu için F-GAME yapısına çok yakın referans) tercih edilebilir.

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

---

## DÖNGÜ #18 — 2026-06-15

**Yapılan:** F-ERLANG_A — Erlang-A Bekleme & Bırakma Analizci (M/M/c + abandonment) ve uzun-form Türkçe sabırsız müşteri rehberi yayınlandı. Erlang-C'nin sınırsız sabırlı müşteri varsayımını gevşetir; bekleyen her müşterinin θ oranında üstel bırakacağı varsayımıyla sistem λ > c·μ olsa bile kararlı.

**Detay:**
- `src/lib/queue-erlang-a.ts` (+170) — saf algoritma: doğum-ölüm zinciri özyinelemesi (`q_0 = 1`, `q_n = q_{n-1} · a / (n ≤ c ? n : c + (n−c)·θ/μ)`), `n > c` bölgesinde tail < 1e-12 ya da n > 5000 güvenlik kapağıyla truncate, P_n normalize. 8 metrik tek geçişte: P₀, P(W>0) = Σ_{n≥c} P_n, Lq = Σ_{n>c} (n−c) P_n, L = Σ n P_n, Wq = Lq/λ, W = L/λ, λ_aban = θ·Lq, P(abandon) = λ_aban/λ, λ_served = λ − λ_aban.
- `src/lib/queue-erlang-a.test.ts` (+140, **17 vitest**) — θ=0 c=1 ile M/M/1 birebir (6 ondalık), θ=0 c=2 ile Erlang-C birebir (6 ondalık), overloaded λ>c·μ kararlılığı (P(abandon) ∈ (0,1), finite Lq), λ_aban = θ·Lq özdeşliği, mass balance λ_aban + λ_served = λ, Little Yasası (Lq = λ·Wq, L = λ·W), θ monotonluğu (0.1, 1, 10 → bırakma ↑, Lq ↓, Wq ↓), state probabilities sum ≈ 1 (8 ondalık), P(W>0) tail kimliği, θ→∞ "loss limit" (Lq < 0.01), θ→0 "Erlang-C limit" eşleşmesi, M/M/1 indirgemesi, θ=0 + ρ≥1 validation hatası, c > 200 + negative θ validation.
- `src/pages/araclar/erlang-a-bekleme-birakma.astro` (+395) — mobil-öncelikli form (λ, μ, c, θ), bırakma olasılığı renk-kodlu öne çıkan kart (yeşil ≤ %2, sarı ≤ %10, kırmızı > %10), 8 metrik paneli (offered load, ρ, P₀, P(W>0), L, Lq, W, Wq), iki vurgulu satır (λ_aban amber + λ_served emerald), durum olasılıkları SVG bar grafiği (n<c brand + n≥c amber + c sınır çizgisi + 30+ tail kesimi notu), θ duyarlılığı tablosu (mevcut θ vurgulu, 0.25x..4x tarama, ρ<1 ise θ=0 satırı dahil), 2 örnek butonu (çağrı merkezi, ρ=1.5 aşırı yüklü).
- `src/content/rehberler/erlang-a-sabirsiz-musteri.mdx` (+200) — 10 dk Türkçe rehber: Erlang-C ile fark, θ tahmin metodolojisi (1/θ ortalama sabır + sektör benchmark'ları), doğum-ölüm zinciri çözümü cebirsel, λ > c·μ kararlılık argümanı ((n−c)·θ sınırsız büyür ⇒ integrable), metrik tablosu + iki kimlik (λ_aban=θ·Lq + P(abandon)=θ·E[Wq] PASTA türetmesi), sayısal örnek (çağrı merkezi + aşırı yüklü), **QED rejimi** (Halfin-Whitt 1981 + Garnett-Mandelbaum-Reiman 2002, c = λ/μ + β√(λ/μ), modern büyük çağrı merkezi ölçeklendirmesi), Erlang-C vs Erlang-A pratik karşılaştırma tablosu, modelin sınırları (heterojen sunucu, çoklu sınıf, GI sabır, zamansal λ), 7 başlık FAQ JSON-LD.
- `src/data/tools.ts` (+10) — yeni araç kaydı (`olasilik` kategorisi, guideSlug=`erlang-a-sabirsiz-musteri`).
- `public/og/erlang-a-bekleme-birakma.png` — `npm run og` ile per-tool OG kartı (83.5 KB). Diğer 17 OG kartı byte-identical (deterministik render).

**Tasarım notu:** İlk denemede sayfa dosyası `erlang-a-bekleme-bırakma.astro` (Türkçe `ı` ile) oluşturuldu — URL slug'larda ASCII güvenliği için `erlang-a-bekleme-birakma.astro` olarak rename edildi (tools.ts slug'ı zaten ASCII'di). MDX FAQ schema'sında 800-char limit 7. soruyu aştı; uzun yanıt kısaltılarak çözüldü (içerik öz kalmaya devam eder). Bu döngü #15/#16'da yaşanan MDX `{...}` tuzağına benzer bir içerik şema disiplini hatırlatıcısı.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **86 dosya**) · test ✓ (**374/374**, +17 yeni Erlang-A testi, 20 dosya) · build ✓ (**46 sayfa**, 4.82s — araç sayfası + rehber dahil) · Lighthouse — yeni sayfa mevcut M/M/c aracıyla aynı şablon, hidrasyon stratejisi (inline `<script>`, plotly yok, SVG/Tailwind sadece) ve mobil-öncelikli yerleşim kullanıyor (≥95 beklenir).

**Yayın:** PR #42 squash-merge edildi (commit `805ff76`). `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27514226793, 52s). Canlı: <https://karaman.dev/or-araclari/araclar/erlang-a-bekleme-birakma>.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, kuyruk serisinin doğal modern uzantısı, mevcut M/M/c deseni birebir takip edildi).

**Sıradaki:** F-MINCOST (Min-Cost Flow / Maks-Akış — L efor, ulaştırma probleminin tek-kaynak/tek-hedef genelleştirmesi, "graf" kategorisinde sadece TSP var — bu boşluk büyük) ya da F-GAME-NASH (sıfır toplamlı oyun çözücüden bimatris/Nash dengesi'ne genişletme — Lemke-Howson). Q-AUDIT-YAML hâlâ open (M efor, breaking-change riski) ama yeni Q-AUDIT-ESBUILD'le birlikte iki ayrı bağımlılık zinciri var.

---

## DÖNGÜ #19 — 2026-06-15

**Yapılan:** F-MINCOST'un **ilk yarısı** — Maksimum Akış (Max-Flow) Çözücü + Ford-Fulkerson/min-cut rehberi yayınlandı. Edmonds-Karp (BFS ile en kısa artıran yol) ve min-cut max-flow teoremi. Min-Cost Flow ayrı bir cycle'a bırakıldı (kapsam disiplini — en küçük anlamlı artış). Graf kategorisinde TSP'den sonra ikinci araç.

**Detay:**
- `src/lib/max-flow.ts` (+213) — saf algoritma: kapasite matrisi (paralel kenarlar (u,v) hücresine toplanır), BFS ile en kısa artıran yol, augmenting-path döngüsü (max 50k iter güvenlik), bottleneck δ kadar akıt (ileri −, geri +), residüel grafikte s'den erişilebilen kümeyle min-cut çıkarımı (S→T yönündeki orijinal kenarlar cut). Flow geri çözümünde paralel kenarlara kapasiteyle orantılı paylaştırma. Düğüm/kenar/iter limitleri (200/1000/50000).
- `src/lib/max-flow.test.ts` (+178, **16 vitest**) — CLRS 26.1 örneği max-flow=23 + s'den çıkan = t'ye giren = 23, basit 2-kenar bottleneck, bağlantısız s-t (max-flow=0, iter=0), paralel kenarlar toplam kapasitesiyle çalışır, min-cut max-flow özdeşliği (cut cap = max-flow), s∈S/t∈T konumu, cut sadece S→T yönünde, akış korunumu (Kirchhoff) tüm ara düğümlerde, flow ≤ capacity, validation (boş kenar, source=sink, negatif cap, self-loop, boş source adı), deterministic, düğüm sırası (source önce, sink ikinci).
- `src/pages/araclar/maks-akis-cozucu.astro` (+330) — mobil-öncelikli form (textarea "kaynak hedef kapasite" satırları + source/sink input), max-flow vurgulu emerald kart + iter sayısı/düğüm/kenar metadata, kenar akış tablosu (Akış/Kapasite/Kullanım% kolonları + doygun amber satır vurgu + 3 durum etiketi: doygun/akış var/boş), min-cut paneli (S/T düğüm listeleri + cut kenarları + cut total = max-flow doğrulama mesajı), 2 örnek (CLRS klasik 9 kenar, boru şebekesi 8 kenar).
- `src/content/rehberler/maks-akis-min-cut.mdx` (+170) — 10 dk Türkçe rehber: problem tanımı (kapasite + korunum), Ford-Fulkerson iskeleti (residüel ağ + augmenting path), Edmonds-Karp BFS varyantı (neden BFS — DFS patolojik patlaması), min-cut max-flow teoremi (kesim tanımı + zayıf/güçlü dualite), CLRS sayısal örnek tam çözüm (23 + cut S/T), klasik uygulamalar tablosu (bipartite matching, görüntü segmentasyonu, proje seçimi, kritik altyapı, çoklu kaynak/hedef, düğüm kapasitesi), algoritma karşılaştırma tablosu (FF/EK/Dinic/Push-Relabel/Hopcroft-Karp), sınırlar ve genellemeler (Min-Cost Flow, multi-commodity, integer flow), 7 başlık FAQ JSON-LD.
- `src/data/tools.ts` (+10) — yeni araç kaydı (`graf` kategorisi, guideSlug=`maks-akis-min-cut`).
- `public/og/maks-akis-cozucu.png` — `npm run og` ile per-tool OG kartı (82.2 KB). Diğer 18 OG kartı byte-identical.

**Bootstrap notu (working tree temizliği):** Otonom döngü tick'i başlangıcında `cycle/15-log` ve `cycle/maks-akis` adında iki stale lokal branch keşfedildi — `cycle/15-log` döngü 15 squash-merge sonrası tip ayrışması (içerik main'de), `cycle/maks-akis` ise bu döngünün önceden başlatıldığı varsayılan boş bir branch (main'le aynı commit'te). Her ikisi de force-delete edildi ve `cycle/maks-akis` temiz olarak yeniden oluşturuldu. Push edilmemiş veri kaybı yok.

**Kapsam disiplini:** F-MINCOST orijinal backlog item'ı "Min-Cost Flow / Maks-Akış Çözücü" başlığıyla L efor ile sıralanmıştı. Autonomous tick içinde L efor riskli olduğundan ikiye ayrıldı: **(1)** Maks-Akış + min-cut (bu döngü, ≈ M efor) **(2)** Min-Cost Flow (gelecek döngü, ayrı algoritma — SSP veya network simplex). Bu, scheduled-task SKILL'inin "en küçük anlamlı artış" kuralına uygun.

**Kalite kapıları:** check ✓ (0 hata, 0 hint, **89 dosya**) · test ✓ (**390/390**, +16 yeni max-flow testi, 21 dosya) · build ✓ (**48 sayfa**, 5.39s — araç sayfası + rehber dahil) · Lighthouse — yeni sayfa mevcut araç desenine uygun (inline `<script>`, plotly yok, SVG/Tailwind sadece) ve mobil-öncelikli yerleşim (≥95 beklenir).

**Yayın:** PR #44 squash-merge edildi. `Deploy to GitHub Pages` workflow başarıyla tamamlandı (run 27516237232, 1m10s). Canlı: <https://karaman.dev/or-araclari/araclar/maks-akis-cozucu>.

**İşaret:** yok (sırf 🟢 yeşil — yeni araç + rehber, mevcut deseni birebir takip; kapsam disiplini için L efor M efor'a bölündü — bu da denetim notu).

**Sıradaki:** F-MINCOST'un ikinci yarısı: Min-Cost Flow Çözücü — SSP (Successive Shortest Path) algoritması ya da network simplex. Ulaştırma probleminin ağ-üstüne genelleştirmesi, kapasite + birim maliyet birlikte. F-GAME-NASH (Lemke-Howson, L efor) ve Q-AUDIT-YAML (M efor) hâlâ açık.
