#!/usr/bin/env node
// Generate Open Graph cards (1200x630 PNG).
//
// Outputs:
//   - public/og-default.png         — site-wide fallback
//   - public/og/<tool-slug>.png     — one per tool (title + category pill)
//
// Why a build-time script: the page-level og:image / twitter:image tags need
// stable PNG URLs, and the site is %100 statik (no runtime image API).
// sharp is already available transitively via Astro, so no extra dep.
//
// Run with: node scripts/generate-og.mjs (or `npm run og`)
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { TOOLS, CATEGORY_LABELS } from '../src/data/tools.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

// Brand colors mirror src/styles/global.css (brand-950, brand-800, accent-500).
const BG_TOP = '#0a1d36';
const BG_BOTTOM = '#142d54';
const ACCENT_FROM = '#2dd4bf';
const ACCENT_TO = '#4a72ad';
const TITLE_FG = '#ffffff';
const SUBTITLE_FG = '#b3c9e3';
const FOOTER_FG = '#5eead4';

const escapeXml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

// Greedy word-wrap into at most `maxLines` lines, each capped at `maxChars`.
// If the title overflows, the last line is truncated with an ellipsis — but
// every tool title currently fits in two lines so this is a safety net.
const wrapTitle = (text, maxChars, maxLines) => {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxChars - 1)}…`;
  }
  return lines;
};

const decorativeGraph = `
  <!-- Decorative graph ornament: nodes + edges (top-right). -->
  <g transform="translate(820,90)" fill="${ACCENT_FROM}" stroke="${ACCENT_FROM}" stroke-width="3">
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
  </g>`;

const baseDefs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG_TOP}"/>
      <stop offset="100%" stop-color="${BG_BOTTOM}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${ACCENT_FROM}"/>
      <stop offset="100%" stop-color="${ACCENT_TO}"/>
    </linearGradient>
  </defs>`;

const baseGrid = `
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g stroke="#ffffff" stroke-opacity="0.05" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630"/>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 90}" x2="1200" y2="${i * 90}"/>`).join('')}
  </g>`;

// Site-default card (the same artwork as before).
const defaultSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  ${baseDefs}
  ${baseGrid}
  ${decorativeGraph}

  <rect x="90" y="180" width="120" height="8" rx="4" fill="url(#accent)"/>

  <text x="90" y="280"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="800"
        font-size="104"
        fill="${TITLE_FG}"
        letter-spacing="-2">OR Araçları</text>

  <text x="90" y="360"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="500"
        font-size="36"
        fill="${SUBTITLE_FG}">Yöneylem Araştırması klasik problemleri</text>
  <text x="90" y="408"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="500"
        font-size="36"
        fill="${SUBTITLE_FG}">için tarayıcıda çalışan Türkçe araçlar.</text>

  <text x="90" y="560"
        font-family="'SF Mono', Menlo, Consolas, monospace"
        font-weight="600"
        font-size="28"
        fill="${FOOTER_FG}">karaman.dev/or-araclari</text>

  <rect x="1080" y="0" width="6" height="630" fill="url(#accent)"/>
</svg>`;

// Per-tool card: eyebrow + category pill + wrapped title + footer URL.
const toolSvg = (tool) => {
  const titleLines = wrapTitle(tool.title, 22, 2);
  const fontSize = titleLines.length === 1 ? 92 : 80;
  const startY = titleLines.length === 1 ? 340 : 300;
  const lineHeight = Math.round(fontSize * 1.05);
  const category = CATEGORY_LABELS[tool.category];
  const pillWidth = category.length * 18 + 56;
  const footer = `karaman.dev/or-araclari/araclar/${tool.slug}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  ${baseDefs}
  ${baseGrid}
  ${decorativeGraph}

  <text x="90" y="138"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="700"
        font-size="26"
        fill="${FOOTER_FG}"
        letter-spacing="6">OR ARAÇLARI</text>

  <g transform="translate(90,170)">
    <rect width="${pillWidth}" height="44" rx="22" fill="${ACCENT_FROM}" fill-opacity="0.18" stroke="${ACCENT_FROM}" stroke-opacity="0.6" stroke-width="1.5"/>
    <text x="28" y="29"
          font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
          font-weight="600"
          font-size="22"
          fill="${ACCENT_FROM}">${escapeXml(category)}</text>
  </g>

  ${titleLines
    .map(
      (line, i) => `<text x="90" y="${startY + i * lineHeight}"
        font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
        font-weight="800"
        font-size="${fontSize}"
        fill="${TITLE_FG}"
        letter-spacing="-2">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}

  <text x="90" y="560"
        font-family="'SF Mono', Menlo, Consolas, monospace"
        font-weight="600"
        font-size="26"
        fill="${FOOTER_FG}">${escapeXml(footer)}</text>

  <rect x="1080" y="0" width="6" height="630" fill="url(#accent)"/>
</svg>`;
};

const renderToPng = async (svg, outPath) => {
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: false }).toFile(outPath);
  const sizeKb = (await stat(outPath)).size / 1024;
  console.log(`wrote ${outPath} (${sizeKb.toFixed(1)} KB)`);
};

await renderToPng(defaultSvg, resolve(publicDir, 'og-default.png'));

for (const tool of TOOLS) {
  await renderToPng(toolSvg(tool), resolve(publicDir, 'og', `${tool.slug}.png`));
}
