# OR Araçları

Yöneylem Araştırması (Operations Research) klasik problemleri için tarayıcıda çalışan ücretsiz, açık kaynak Türkçe araç koleksiyonu. Her aracın yanında uzun-form Türkçe rehber içerik bulunur.

**Canlı:** https://karaman.dev/or-araclari/

## Felsefe

- **%100 statik.** Sunucu yok, backend yok, hesaplamalar tarayıcıda.
- **Mobil-öncelikli.** TR organik trafiğin büyük kısmı mobilden.
- **i18n hazır.** İlk içerik Türkçe; mimari ileride EN eklenmesine açık.
- **Lighthouse 95+** her sayfa için hedef (Performance / SEO / Accessibility / Best Practices).

## Teknoloji

- [Astro](https://astro.build/) 6 (statik çıktı, partial hydration)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [MDX](https://mdxjs.com/) (içerik + interaktif bileşenler)
- [glpk.js](https://github.com/jvail/glpk.js) — LP/MILP çözücü (tarayıcıda)
- Saf JS algoritmaları — round-robin, TSP heuristic, Hungarian, knapsack
- GitHub Pages + GitHub Actions ile yayın

## Geliştirme

Gereksinimler: Node.js ≥ 22.12.

```bash
npm install        # bağımlılıkları kur
npm run dev        # http://localhost:4321
npm run check      # Astro + TypeScript tip kontrolü
npm run test       # vitest ile saf algoritma testleri
npm run build      # ./dist/ üretir
npm run preview    # build çıktısını yerelde önizle
```

## Ortam değişkenleri

Tüm değişkenler `PUBLIC_*` ön ekiyle istemciye gömülür. Yerel geliştirmede
`.env.local` dosyası kullanılabilir; CI'da GitHub Actions secrets üzerinden
verilir ve `withastro/action@v3` build sırasında işin ortamına geçirir.

| Değişken | Zorunlu mu? | Açıklama |
|---|---|---|
| `PUBLIC_GA_ID` | Hayır | Google Analytics 4 measurement ID (örn. `G-XXXXXXXXXX`). Boş bırakılırsa analitik scripti hiç yüklenmez. |
| `PUBLIC_ADSENSE_CLIENT_ID` | Hayır | AdSense publisher ID (örn. `ca-pub-1234567890123456`). Boşken `<AdSlot>` bileşenleri hiçbir şey render etmez ve AdSense kütüphanesi yüklenmez. |

İki değişkenin biri set edildiği anda BaseLayout otomatik olarak çerez tercih
bandını göstermeye başlar; consent verilmeden hiçbir kişisel veri
yollanmaz (Google Consent Mode v2).

## AdSense yayını için ek adımlar

`PUBLIC_ADSENSE_CLIENT_ID` set etmek tek başına yetmez; AdSense onayı sonrası
şunlar da gerekir:

1. **`ads.txt` dosyası** — AdSense yalnızca **kök domain** seviyesinden
   `ads.txt`'i okur (`karaman.dev/ads.txt`), repo alt yolundan değil
   (`karaman.dev/or-araclari/ads.txt` etkisiz). Dolayısıyla bu repoda
   tutulmaz; karaman.dev kök sitesinde tek satırlık dosya olarak yer
   almalıdır:
   ```
   google.com, ca-pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
   ```
2. **AdSlot ID'leri** — `src/pages/index.astro` ve
   `src/pages/rehberler/[...slug].astro` içindeki `slot="anasayfa-hero-alt"`
   gibi placeholder isimleri AdSense panelinden alınan gerçek 10-haneli
   sayısal ID'lerle değiştirilmelidir.
3. **Ek `<AdSlot>` çağrıları** — Mevcut iki strategik nokta dışında ek
   reklam istenirse `import AdSlot` edip yerleştir; AdSense politikası
   sayfa başına 3 reklamı tavsiye eder, daha fazlası onaylanmayabilir.

## Yol Haritası

| Faz | Kapsam | Durum |
|-----|--------|-------|
| 0 | Repo iskelet, GH Pages deploy | ✅ |
| 1 | Layout, anasayfa, hakkında/gizlilik | ✅ |
| 2 | İlk araç: Lig Fikstürü Oluşturucu | ✅ |
| 3 | Blog/rehber sistemi + 5 başlangıç yazısı | ✅ |
| 4 | GA4 + AdSense altyapısı | ✅ |
| 5 | TSP, Atama, Knapsack, Ders Programı (LP solver hâlâ yapım aşamasında) | ✅ |

## Lisans

[MIT](LICENSE) © 2026 Serdar Karaman
