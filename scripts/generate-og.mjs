#!/usr/bin/env node
// Generate the default Open Graph card (1200x630 PNG) under public/og-default.png.
//
// Why a build-time script: the page-level og:image / twitter:image tags need a
// stable PNG/JPG URL, and the site is %100 statik (no runtime image API).
// sharp is already available transitively via Astro, so no extra dep.
//
// Run with: node scripts/generate-og.mjs (or `npm run og`)
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '..', 'public', 'og-default.png');

// Brand colors mirror src/styles/global.css (brand-950, brand-800, accent-500).
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1d36"/>
      <stop offset="100%" stop-color="#142d54"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#4a72ad"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle grid texture (operations-research feel). -->
  <g stroke="#ffffff" stroke-opacity="0.05" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630"/>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 90}" x2="1200" y2="${i * 90}"/>`).join('')}
  </g>

  <!-- Decorative graph ornament: nodes + edges (top-right). -->
  <g transform="translate(820,90)" fill="#2dd4bf" stroke="#2dd4bf" stroke-width="3">
    <line x1="40" y1="40" x2="180" y2="20" stroke-opacity="0.6"/>
    <line x1="40" y1="40" x2="120" y2="170" stroke-opacity="0.6"/>
    <line x1="180" y1="20" x2="260" y2="120" stroke-opacity="0.6"/>
    <line x1="120" y1="170" x2="260" y2="120" stroke-opacity="0.6"/>
    <line x1="260" y1="120" x2="300" y2="260" stroke-opacity="0.6"/>
    <circle cx="40" cy="40" r="14"/>
    <circle cx="180" cy="20" r="14"/>
    <circle cx="120" cy="170" r="14"/>
    <circle cx="260" cy="120" r="14"/>
    <circle cx="300" cy="260" r="14"/>
  </g>

  <!-- Accent bar -->
  <rect x="90" y="180" width="120" height="8" rx="4" fill="url(#accent)"/>

  <!-- Brand title -->
  <text x="90" y="280"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="800"
        font-size="104"
        fill="#ffffff"
        letter-spacing="-2">OR Araçları</text>

  <!-- Tagline -->
  <text x="90" y="360"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="500"
        font-size="36"
        fill="#b3c9e3">Yöneylem Araştırması klasik problemleri</text>
  <text x="90" y="408"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="500"
        font-size="36"
        fill="#b3c9e3">için tarayıcıda çalışan Türkçe araçlar.</text>

  <!-- Footer URL -->
  <text x="90" y="560"
        font-family="'SF Mono', Menlo, Consolas, monospace"
        font-weight="600"
        font-size="28"
        fill="#5eead4">karaman.dev/or-araclari</text>

  <!-- Right-side accent bar -->
  <rect x="1080" y="0" width="6" height="630" fill="url(#accent)"/>
</svg>`;

await mkdir(dirname(outPath), { recursive: true });
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, palette: false })
  .toFile(outPath);

const sizeKb = (await sharp(outPath).metadata()).size / 1024;
console.log(`wrote ${outPath} (${sizeKb.toFixed(1)} KB)`);
