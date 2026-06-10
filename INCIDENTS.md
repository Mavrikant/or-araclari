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
