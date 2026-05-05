import type { APIRoute } from 'astro';
import { base } from '../data/site';

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error(
      'Astro `site` is required to generate robots.txt — set it in astro.config.mjs.',
    );
  }
  const sitemapUrl = new URL(`${base}sitemap-index.xml`, site).toString();
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
