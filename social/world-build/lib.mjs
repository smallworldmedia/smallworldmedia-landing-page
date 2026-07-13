/**
 * lib.mjs — shared infrastructure for the WORLD BUILD slide templates.
 *
 * Everything here quotes the site's design system directly:
 *   - tokens mirror global.css values (colors, tracking, ease/duration)
 *   - fonts are the site's own files, base64-embedded so every emitted
 *     HTML is fully self-contained (renders identically from file://,
 *     the artifact viewer, or a future automation pipeline)
 *   - the globe mark is public/icons/swm-globe-mark.svg inlined, fill
 *     driven by --globe-fill so each template colors it in place
 *   - mulberry32/hashSeed reproduce the seeded-scatter technique from
 *     src/components/work/world/seededLayout.js
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* ---------- canvas ---------- */

export const CANVAS = { w: 1080, h: 1350 }; // IG portrait 4:5

/* ---------- fonts (site files, embedded) ---------- */

const FONT_DIR = join(ROOT, 'src', 'assets', 'fonts');

function fontDataUri(file, mime) {
  const b64 = readFileSync(join(FONT_DIR, file)).toString('base64');
  return `data:${mime};base64,${b64}`;
}

let _fontCss = null;
export function fontFaceCss() {
  if (_fontCss) return _fontCss;
  const faces = [
    ['OT Neue Montreal Squeezed', 600, 'OTNeueMontreal-SemiBoldSqueezed.otf', 'font/otf', 'opentype'],
    ['PP Neue Montreal', 400, 'PPNeueMontreal-Book.otf', 'font/otf', 'opentype'],
    ['PP Neue Montreal', 500, 'PPNeueMontreal-Medium.otf', 'font/otf', 'opentype'],
    ['Iosevka Term', 500, 'IosevkaTermMedium.woff2', 'font/woff2', 'woff2'],
  ];
  _fontCss = faces
    .map(
      ([family, weight, file, mime, format]) => `@font-face {
  font-family: '${family}';
  src: url('${fontDataUri(file, mime)}') format('${format}');
  font-weight: ${weight};
  font-style: normal;
  font-display: block;
}`
    )
    .join('\n');
  return _fontCss;
}

/* ---------- the globe mark ---------- */

// swm-globe-mark.svg: single path, fill="var(--fill-0, #0000FF)".
// Re-emitted with a class hook + proper aspect handling (the source ships
// preserveAspectRatio="none" for its nav slot; slides need `meet`).
let _globePath = null;
function globePath() {
  if (_globePath) return _globePath;
  const raw = readFileSync(join(ROOT, 'public', 'icons', 'swm-globe-mark.svg'), 'utf8');
  _globePath = raw.match(/ d="([^"]+)"/)[1];
  return _globePath;
}

export function globeSvg(cls = '') {
  return `<svg class="globe ${cls}" viewBox="0 0 43 41" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-label="o"><path d="${globePath()}" fill="var(--globe-fill, #0000FF)"/></svg>`;
}

/**
 * Series title with the globe mark swapped in for the O.
 * "WORLD BUILD" → W ⊕ R L D — the O slot is a flex-embedded svg sized
 * to cap-height, kept perfectly round (the mark is never distorted).
 */
export function globeWord(word, globeChar, cls = '') {
  return [...word]
    .map((ch, i) =>
      i === globeChar
        ? `<span class="globe-o ${cls}">${globeSvg()}</span>`
        : ch === ' '
          ? // explicit gap span — a bare space text node is an anonymous
            // whitespace-only flex item and may not render inside flex rows
            `<span class="word-gap" style="display:inline-block;width:0.22em;"></span>`
          : `<span>${ch}</span>`
    )
    .join('');
}

/* ---------- seeded scatter (seededLayout.js technique) ---------- */

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- shared tokens + slide base ---------- */

// Mirrors global.css :root — same values, canvas-scaled type sizes.
export function baseCss() {
  return `
:root {
  --blue: rgb(0, 0, 255);
  --cream: rgb(250, 250, 250);
  --black: #000000;
  --white: #ffffff;
  --dark-gray: rgb(18, 18, 18);
  --near-black: #0a0a0a;

  --font-display: 'OT Neue Montreal Squeezed', sans-serif;
  --font-body: 'PP Neue Montreal', sans-serif;
  --font-mono: 'Iosevka Term', ui-monospace, monospace;

  --tracking-tight: -0.02em;
  --ease-panel: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-panel: 600ms;
  --ease-micro: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-micro: 220ms;

  /* canvas-scaled chrome sizes (site: 12.8px mono @ 1800w desktop) */
  --mono-s: 24px;
  --mono-m: 27px;
  --mono-l: 32px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
.slide {
  position: relative;
  width: ${CANVAS.w}px;
  height: ${CANVAS.h}px;
  overflow: hidden;
  background: var(--black);
  color: var(--cream);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* — mono chrome kit (client-chip / band-pager__counter family) — */
.mono {
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-m);
  line-height: 1.18;
  letter-spacing: -0.024em;
  color: var(--white);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  padding: 5px 16px;
  background: var(--near-black);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-m);
  line-height: 1.5;
  letter-spacing: -0.024em;
  color: var(--white);
  white-space: nowrap;
}
.chip--blue { background: var(--blue); }
.nums { font-variant-numeric: tabular-nums; }

/* — service tag pill (.service-tag: black fill / white stroke) — */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 9px 22px;
  border: 2px solid var(--white);
  border-radius: 999px;
  background: var(--black);
  color: var(--white);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-s);
  line-height: 1.15;
  letter-spacing: var(--tracking-tight);
  text-transform: uppercase;
  white-space: nowrap;
}
/* fp-tag variant (white fill / blue text — the World card family) */
.tag--fp { background: var(--white); color: var(--blue); border-color: var(--white); }
/* on-blue variant */
.tag--onblue { background: transparent; border-color: var(--white); color: var(--white); }

/* — display type (client-panel__title / np-band__title family) — */
.display {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 0.78;
  letter-spacing: -0.005em;
  text-transform: uppercase;
  color: var(--white);
}

/* — prose (project-blurb__text family) — */
.prose {
  font-family: var(--font-body);
  font-weight: 400;
  letter-spacing: -0.005em;
  line-height: 1.06;
  color: var(--white);
}
.prose em { font-style: normal; color: var(--blue); }
.on-blue .prose em { color: var(--white); }

/* — the globe-O — */
.globe-o {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: baseline;
}
.globe-o .globe { display: block; height: 100%; width: auto; }

/* — 1px rule (np-band__rule) — */
.rule { display: block; width: 100%; height: 2px; background: var(--white); }

/* — primary CTA pill (.cta-primary) — */
.cta-primary {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 34px;
  letter-spacing: var(--tracking-tight);
  background: var(--white);
  color: var(--blue);
  border-radius: 999px;
  padding: 18px 44px;
  white-space: nowrap;
}
`;
}

/* ---------- page wrapper ---------- */

export function htmlPage({ title, css, body, motion = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${fontFaceCss()}
${baseCss()}
${css}
</style>
</head>
<body${motion ? ' class="motion"' : ''}>
${body}
</body>
</html>`;
}

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Arc copy carries authorial [[...]] emphasis markers (the info-panel
 * blue-<strong> pattern). em:true renders them as <em>; em:false strips
 * them for templates that set prose plain.
 */
export function richText(text, { em = false } = {}) {
  const parts = String(text).split(/\[\[|\]\]/g);
  return parts
    .map((chunk, i) => (i % 2 === 1 && em ? `<em>${esc(chunk)}</em>` : esc(chunk)))
    .join('');
}

export const pad2 = (n) => String(n).padStart(2, '0');
