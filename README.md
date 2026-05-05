# OR Araçları

Yöneylem Araştırması (Operations Research) klasik problemleri için tarayıcıda çalışan ücretsiz, açık kaynak Türkçe araç koleksiyonu. Her aracın yanında uzun-form Türkçe rehber içerik bulunur.

**Canlı:** https://mavrikant.github.io/or-araclari/

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
npm run build      # ./dist/ üretir
npm run preview    # build çıktısını yerelde önizle
```

## Yol Haritası

| Faz | Kapsam | Durum |
|-----|--------|-------|
| 0 | Repo iskelet, GH Pages deploy | ✅ |
| 1 | Layout, anasayfa, hakkında/gizlilik | ⏳ |
| 2 | İlk araç: Lig Fikstürü Oluşturucu | ⏳ |
| 3 | Blog/rehber sistemi + 5 başlangıç yazısı | ⏳ |
| 4 | GA4 + AdSense altyapısı | ⏳ |
| 5 | LP, TSP, Atama, Knapsack, Çizelgeleme araçları | ⏳ |

## Lisans

[MIT](LICENSE) © 2026 Serdar Karaman
