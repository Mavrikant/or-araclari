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
 * Returns BASE_URL guaranteed to end with `/` so concatenations like
 * `${base}rehberler` always render as `/or-araclari/rehberler` with a single
 * separator, regardless of how Astro normalises BASE_URL across versions.
 */
export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export function withBase(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  return `${base}${trimmed}`;
}
