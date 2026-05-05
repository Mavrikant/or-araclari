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
 * Returns BASE_URL guaranteed to end with `/` so concatenations like
 * `${base}rehberler` always render as `/or-araclari/rehberler` with a single
 * separator, regardless of how Astro normalises BASE_URL across versions.
 */
export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export function withBase(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  return `${base}${trimmed}`;
}
