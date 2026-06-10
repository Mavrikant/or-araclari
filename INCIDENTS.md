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
