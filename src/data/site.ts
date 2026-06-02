export const SITE = {
  name: 'OR Araçları',
  shortName: 'OR Araçları',
  tagline:
    'Yöneylem Araştırması klasik problemleri için tarayıcıda çalışan ücretsiz Türkçe araçlar.',
  description:
    'Lig fikstürü, lineer programlama, TSP, atama, knapsack ve daha fazlası — sunucuya hiçbir veri göndermeden, doğrudan tarayıcıda. Yanında uzun-form Türkçe rehberler.',
  locale: 'tr-TR',
  language: 'tr',
  author: {
    name: 'M. Serdar Karaman',
    email: 'm.serdar.karaman@gmail.com',
    github: 'https://github.com/Mavrikant',
  },
  repo: 'https://github.com/Mavrikant/or-araclari',
} as const;

/**
 * Google Analytics 4 measurement ID (e.g. "G-XXXXXXXXXX").
 * Empty/undefined disables analytics entirely — useful for local dev and
 * preview builds. Set via PUBLIC_GA_ID env var (GH Actions repo secret).
 */
export const GA_ID = import.meta.env.PUBLIC_GA_ID ?? '';

/**
 * Google AdSense publisher ID (e.g. "ca-pub-1234567890123456").
 * Empty/undefined hides every AdSlot and skips loading the AdSense script.
 * Set via PUBLIC_ADSENSE_CLIENT_ID once the AdSense application is approved.
 */
export const ADSENSE_CLIENT_ID = import.meta.env.PUBLIC_ADSENSE_CLIENT_ID ?? '';

/**
 * Microsoft Clarity proje ID'si (örn. "abcd1234ef"). Heatmap + oturum
 * kayıtları. Boş bırakılırsa Clarity hiç yüklenmez. Yüklenmesi cookie
 * banner'da "Tümünü kabul et" tıklanmasına bağlıdır (conservative pattern):
 * GA gibi default-denied ile eager yüklenmez, çünkü Clarity'nin Google
 * Consent Mode'a karşılık gelen native bir kontratı yok.
 */
export const CLARITY_ID = import.meta.env.PUBLIC_CLARITY_ID ?? '';

/**
 * Google Search Console doğrulama tokenı — `google-site-verification`
 * meta etiketinin `content` değeri. Boşken meta etiketi hiç render edilmez.
 */
export const GSC_VERIFICATION = import.meta.env.PUBLIC_GSC_VERIFICATION ?? '';

/**
 * Plausible Analytics site alanı. Plausible siteleri `data-domain` ile
 * tanımlanır — ayrı bir sayısal/dizgi "site ID" yoktur ve domain herkese
 * açık bilgi olduğu için (sayfa kaynağında görünür) **secret gerektirmez**.
 *
 * Bu yüzden değer koda gömülüdür: üretim build'inde varsayılan olarak
 * `karaman.dev` ile **her zaman açıktır**. `astro dev`'de (PROD değilken)
 * varsayılan kapalıdır ki yerel geliştirme trafiği sayılmasın; istenirse
 * PUBLIC_PLAUSIBLE_DOMAIN ile override edilebilir, `""` set edilirse kapanır.
 *
 * Plausible çerezsizdir ve kişisel veri / kalıcı tanımlayıcı saklamaz; bu
 * yüzden GA4 ve Clarity'nin aksine onay kapısı olmadan eager yüklenir ve
 * çerez tercih bandını TETİKLEMEZ (KVKK/GDPR uyumlu, onaysız ölçüm).
 */
export const PLAUSIBLE_DOMAIN =
  import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN ?? (import.meta.env.PROD ? 'karaman.dev' : '');

/**
 * Plausible script kaynağı. Varsayılan Plausible Cloud scriptidir; kendi
 * sunucunda barındırma ya da script uzantıları (örn.
 * "https://plausible.io/js/script.outbound-links.js") için override edilir.
 * Yalnızca PLAUSIBLE_DOMAIN set iken kullanılır.
 */
export const PLAUSIBLE_SRC =
  import.meta.env.PUBLIC_PLAUSIBLE_SRC ?? 'https://plausible.io/js/script.js';

/**
 * Returns BASE_URL guaranteed to end with `/` so concatenations like
 * `${base}rehberler` always render as `/or-araclari/rehberler` with a single
 * separator, regardless of how Astro normalises BASE_URL across versions.
 */
export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export function withBase(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  return `${base}${trimmed}`;
}
