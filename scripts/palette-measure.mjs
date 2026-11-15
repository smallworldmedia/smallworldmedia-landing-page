#!/usr/bin/env node
/**
 * palette-measure — which colour family does each pixel belong to, and how much of an image
 * does each family cover. The family classifier (OKLab / OKLCH) is exported for the scheme
 * probe's shares gate (scripts/lib/scheme-gate.mjs); the CLI prints the share table of an image:
 *
 *   node scripts/palette-measure.mjs <image>
 *
 * It reads RAW pixels through sharp (`sharp(...).raw()`). sharp's stats() ignores extract() and
 * returns the whole image, so a crop must be re-encoded or read as raw pixels, never stats()'d.
 *
 * Importing this module has no side effects (sharp is loaded only by the CLI).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lin = (v) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** sRGB 0..255 → OKLab [L, a, b]. */
export function oklab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** sRGB 0..255 → { L, C, h } (OKLCH, h in degrees 0..360). */
export function oklch(r, g, b) {
  const [L, a, bb] = oklab(r, g, b);
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

export const NEUTRALS = ['black', 'white', 'grey'];

/** Families by OKLCH: neutrals by chroma + lightness, chromatics by hue angle. */
export function family(L, C, h) {
  if (C < 0.035) return L < 0.28 ? 'black' : L > 0.86 ? 'white' : 'grey';
  if (L < 0.2) return 'black';
  if (h >= 10 && h < 48) return 'red';
  if (h >= 48 && h < 72) return 'orange';
  if (h >= 72 && h < 112) return 'yellow';
  if (h >= 112 && h < 175) return 'green';
  if (h >= 175 && h < 235) return 'cyan';
  if (h >= 235 && h < 285) return L > 0.72 ? 'periwinkle' : L < 0.36 ? 'navy' : 'blue';
  if (h >= 285 && h < 335) return 'purple';
  return 'magenta';
}

/** The family of one sRGB colour (0..255 channels). */
export function classify(r, g, b) {
  const { L, C, h } = oklch(r, g, b);
  return family(L, C, h);
}

/**
 * Pixel counts per family over a raw buffer ({ data, channels } as sharp's raw() gives them;
 * alpha, when present, is ignored). Returns a plain { family: count } object.
 */
export function countFamilies(data, channels = 3) {
  const counts = {};
  const memo = new Map();
  for (let i = 0; i + 2 < data.length; i += channels) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let k = memo.get(key);
    if (k === undefined) {
      k = classify(data[i], data[i + 1], data[i + 2]);
      memo.set(key, k);
    }
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

/** Chromatic-only shares (percent) of a { family: count } object: what the eye reads as "the colours". */
export function chromaticShares(counts) {
  const fams = Object.entries(counts).filter(([k]) => !NEUTRALS.includes(k));
  const total = fams.reduce((s, [, n]) => s + n, 0);
  return Object.fromEntries(fams.map(([k, n]) => [k, total ? (n / total) * 100 : 0]));
}

// ── CLI ──
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

async function cli(image) {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = info.width * info.height;
  const fam = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const k = classify(r, g, b);
    let f = fam.get(k);
    if (!f) fam.set(k, (f = { n: 0, r: [], g: [], b: [], q: new Map() }));
    f.n++;
    // sample for medians + a 5-bit quantised histogram for the modal swatch
    if (f.n % 7 === 0) { f.r.push(r); f.g.push(g); f.b.push(b); }
    const q = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    f.q.set(q, (f.q.get(q) || 0) + 1);
  }
  const med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1] ?? 0; };
  console.log(`image ${info.width}x${info.height}  pixels ${N}`);
  console.log('family      share   median    modal(5-bit)  modal share-of-family');
  const rows = [...fam.entries()].sort((a, b) => b[1].n - a[1].n);
  for (const [k, f] of rows) {
    const [q, qn] = [...f.q.entries()].sort((a, b) => b[1] - a[1])[0];
    const mr = ((q >> 10) & 31) * 8 + 4, mg = ((q >> 5) & 31) * 8 + 4, mb = (q & 31) * 8 + 4;
    console.log(
      k.padEnd(11),
      ((f.n / N) * 100).toFixed(2).padStart(6) + '%',
      hex(med(f.r), med(f.g), med(f.b)).padEnd(9),
      hex(mr, mg, mb).padEnd(13),
      ((qn / f.n) * 100).toFixed(1) + '%',
    );
  }
  console.log('\nchromatic-only shares:');
  const shares = chromaticShares(Object.fromEntries(rows.map(([k, f]) => [k, f.n])));
  for (const [k, v] of Object.entries(shares).sort((a, b) => b[1] - a[1])) console.log(' ', k.padEnd(11), v.toFixed(1) + '%');
  // Top 24 quantised colours overall (4-bit), for the actual swatch instances.
  const top = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const q = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    top.set(q, (top.get(q) || 0) + 1);
  }
  console.log('\ntop 24 swatches (4-bit bins):');
  for (const [q, n] of [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)) {
    console.log(' ', hex(((q >> 8) & 15) * 17, ((q >> 4) & 15) * 17, (q & 15) * 17), ((n / N) * 100).toFixed(2) + '%');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const image = process.argv[2];
  if (!image) {
    console.error('usage: node scripts/palette-measure.mjs <image>');
    process.exit(1);
  }
  await cli(image);
}
