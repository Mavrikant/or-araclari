# Olaylar (Incidents)

Kırılan her şey: belirti, kök neden, düzeltme, önlem.

---

## 2026-06-10 — Döngü #13 docs PR'ı tekrarlandı (PR #31 + PR #32 aynı içerik)

**Belirti:** `main` üzerinde döngü #13 docs commit'i iki ardışık SHA olarak göründü (`1de96f1` ve `8f3366a`); ikinci squash-merge boş diff'li no-op çıktı.

**Kök neden:** Aynı `docs/cycle-13-record` dalı önceki çalışmada commit + push edilip PR (#31) açılmış ve merge edilmişti; bu döngüye yeniden girince ajan branch'in zaten merge edildiğini fark etmeden ikinci bir PR (#32) açıp squash-merge etti. `gh pr list --head <branch>` çağrısı yalnızca **açık** PR'ları döndürdüğünden mevcut merge edilmiş #31 atlandı.

**Düzeltme:** İkinci commit gerçek bir değişiklik içermiyor (diff boş); kalıcı bir sorun yok, sadece tarihçede gürültü ve gereksiz bir deploy çalıştırması (run 27269710345).

**Önlem:**
- Yeni PR açmadan önce `gh pr list --head <branch> --state all` ile **tüm** PR'lara bak.
- Bir cycle/* veya docs/* dalı için commit'ler push edilmişse ve `git log main..HEAD` boşsa, dalın zaten merge olduğunu varsay; çalışmayı tekrar yapma.

---

## 2026-06-10 — Döngü #13 CYCLES.md kaydı çift yazıldı

**Belirti:** `CYCLES.md` içinde `## DÖNGÜ #13 — 2026-06-10` başlığı iki ayrı içerik bloğuyla art arda yer aldı (commit `1de96f1` ve `b2ad1f5`, sırasıyla PR #31 ve onun yamasız çiftleyici PR'ı). Önceki "Önlem" notu yamayı "boş diff" sandı; gerçekte iki farklı +44 satır eklenmişti (her biri 22 satırlık tam bir cycle kaydı).

**Kök neden:** Eş zamanlı/birbiri ardına çalışan iki ajan turu, aynı F-DECISION teslimatı için bağımsız olarak cycle #13 metni yazıp ayrı PR'lar açtı. Append-only bir günlüğü PR yarışmasına bıraktığımız için iki ekleme de orada kaldı.

**Düzeltme:** Daha düşük teknik detayı içeren (yanlış satır sayıları: 213/207/551/275 — gerçek dosya boyutları 265/219/674/351) birinci #13 bloğu çıkarıldı; doğru olan korundu. CYCLES.md'de tek bir #13 kaydı kaldı (cycle/cycles-dedup).

**Önlem:**
- Cycle kaydını yazmadan önce `grep -c "DÖNGÜ #${n}" CYCLES.md` ile aynı numaranın zaten yazılıp yazılmadığını doğrula.
- Append-only günlükte mevcut son cycle numarası > beklenen ise, kayıt zaten yazılmıştır; yeni docs PR'ı açma.

---

## 2026-06-15 — Döngü #19 paralel ajan çakışması (üçüncü kez)

**Belirti:** Otonom tick başladığında main son commit `d5d5242` (cycle #18) idi; ajan F-MINCOST'u (Max-Flow) seçip yeni `cycle/maks-akis` dalı açtı, `src/lib/maxflow.ts` (+test) yazıp testleri geçirdi. Tool sayfasını `Write` ile yazmaya çalışınca "file already read first" hatası geldi — paralel bir ajan oturumu **aynı tick içinde** F-MINCOST'u zaten yapmış, `max-flow.ts` (tire ile), `max-flow.test.ts`, `maks-akis-cozucu.astro` dosyalarını oluşturup PR #44'ü açıp squash-merge etmişti (commit `5b9eb5c`). Üstelik docs PR #45 (cycle #19 kaydı) da açık ama merge edilmeden kalmıştı. Lokal HEAD bir önceki ajanın yarattığı `docs/cycle-19` dalında bulundu — `git checkout -b cycle/maks-akis` çıktısı "Switched" demesine rağmen.

**Kök neden:** İki ajan oturumu aynı zaman aralığında autonomous tick'i tetikledi; ikinci ajan (bu oturum) başlatılırken birincinin çalışması mid-flight idi. §6'nın (yeni araç şablonu) bağımsız yapısı aynı backlog item'ında çakışan iki paralel implementation'a izin veriyor. Cycle #16 ve cycle #13'teki çakışmaların aynı sınıfının üçüncü tekrarı.

**Düzeltme:** (1) Ajanın `maxflow.ts` ve `maxflow.test.ts` duplicate'leri silindi (untracked, kayıp yok). (2) PR #45 (docs/cycle-19) merge edildi → cycle #19 finalize, `352f349` commit'i ile main güncel. (3) Substantive max-flow tool çalışması PR #44'ten korundu — duplicate iş ziyan oldu ama main üretim regresyonu yok.

**Önlem:**
- **Tick başlangıcında zorunlu check:** `git fetch origin main` + `git log origin/main --oneline -5` ile sonuncu commit'te referans verilen PR numarasını al; sonra `gh pr list --state all --head cycle/<plan>` ile aynı backlog item'ı için açık/merge PR olup olmadığına bak.
- **"Sıradaki" planını kararlaştırmadan önce backlog "Tamamlananlar" tablosunu güncel main üzerinden oku**; cycle #18'in "Sıradaki" notu F-MINCOST'u önerdi ama F-MINCOST'un yarısı zaten paralel bir tick'te bitmişti.
- Bu önlem hâlâ yetersiz — iki ajan eşzamanlı tick içinde her ikisi de "yapılmamış" görür. Gerçek çözüm: backlog'a in-progress kaydı yazmadan implementation'a girişmeme (PR-açıkken-merge-bekle deseni gibi), veya tick'leri serileştirecek bir kilit (Issue label, branch reservation, vb.) — 🔴 KIRMIZI: ajan tek başına bu mimari kararı veremez.

---
