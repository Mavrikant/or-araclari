export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/araclar', label: 'Araçlar' },
  { href: '/rehberler', label: 'Rehberler' },
  { href: '/hakkinda', label: 'Hakkında' },
] as const;

export const FOOTER_NAV: readonly NavItem[] = [
  { href: '/iletisim', label: 'İletişim' },
  { href: '/gizlilik', label: 'Gizlilik' },
  { href: '/cerezler', label: 'Çerezler' },
] as const;
