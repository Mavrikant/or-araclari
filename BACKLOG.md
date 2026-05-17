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
| Q-README-LP | README "Faz 5" satırı "LP solver hâlâ yapım aşamasında" diyor ama `tools.ts` LP'yi `ready` olarak işaretliyor — README'yi güncelle | content | M | XS | open |
| Q-AUDIT | `npm audit` 6 zafiyet (5 moderate + 1 high) bildiriyor — incele, transitive ise ayrı PR'a böl | chore | M | S | open |
| Q-DEPENDABOT-14 | Dependabot PR #14 (`devalue` 5.8.0 → 5.8.1, patch) merge edilebilir mi değerlendir | chore | L | XS | open |
| Q-OG-IMAGE | OG/Twitter görselleri var mı? Yoksa her araç için statik OG kart üret | content | M | M | open |
| Q-CONTENT-CONFIG | `src/content.config.ts` `astro:schema`'dan `z` ile uyarı: `'z' is deprecated` (13 uyarı) — yeni Astro 6 önerisine geç | refactor | L | S | open |
| Q-UNUSED | 3 kullanılmayan değişken/tip (`Schedule`, `ys`, `slackPanel`) — temizle | refactor | L | XS | open |

## Yeni Araç Fikirleri (sıra dışı, fırsat olursa)

| id | başlık | tür | değer | efor | durum |
|---|---|---|---|---|---|
| F-TRANSPORT | Ulaştırma Problemi Çözücü (North-West Corner + MODI) | feature | H | L | open |
| F-MINCOST | Min-Cost Flow / Maks-Akış Çözücü (Ford-Fulkerson, Edmonds-Karp) | feature | M | L | open |
| F-MARKOV | Markov Zinciri Sabit Dağılım Hesaplayıcı | feature | M | M | open |
| F-DECISION | Karar Ağacı / Beklenen Değer Çözücü (EMV, EVPI) | feature | M | M | open |
| F-GAME | İki Kişilik Sıfır Toplamlı Oyun (saddle point + karışık strateji LP) | feature | M | M | open |
| F-MM_C | M/M/c, M/M/1/K, M/M/c/K kuyrukları | feature | M | M | open |
| F-EBQ | Üretim Lot Boyu (EPQ/EBQ) + ROP/Güvenlik Stoğu hesabı | feature | M | S | open |

---

## Tamamlananlar

| id | başlık | döngü |
|---|---|---|
| Q-TYPECHECK | `npm run check` 4 TypeScript hatasını gider | #1 |
