#!/usr/bin/env node
/**
 * prep-client-logos — intake `Client Logos/` (untracked Dropbox dump, any
 * colour, any size) → tracked `src/assets/client-logos/` (white-on-
 * transparent, trimmed, ≤ MAX_H tall, kebab-case) + manifest.json.
 *
 *   node scripts/prep-client-logos.mjs            build the set
 *   node scripts/prep-client-logos.mjs --check    verify outputs are pure white
 *
 * Reads the intake folder directly — no hard-coded file list — so new logos
 * land by dropping them in the folder and re-running. Every output is white
 * on transparent (Nathan, 09-07): rasters get their alpha joined onto a solid
 * white plane; SVGs get every fill/stroke colour rewritten to #fff and a root
 * fill="#fff" so unfilled paths inherit it. Opaque JPGs have no alpha to lift
 * and are refused (flagged) — they need a transparent export first.
 *
 * The ticker (src/components/ClientLogoTicker.jsx) globs the OUTPUT folder and
 * joins it to manifest.json for intrinsic w/h — that is what makes the marquee
 * width deterministic at SSR.
 */
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = join(ROOT, 'Client Logos');
const OUT = join(ROOT, 'src', 'assets', 'client-logos');
const MAX_H = 240; // px — 2× the tallest display height (--logo-h ≤ 120px)
const CHECK = process.argv.includes('--check');

/** Intake files that must never ship (Nathan, 09-07). */
const DENY = new Set([
  'seshling-white.svg', // explicitly excluded ("do not use")
  'umg-white.png', // superseded by universal-music-group-logo.png
  'house-hats_logo_red_v2.svg', // the white lockup ships, not the red v2
  'smwp_logo_trace.png', // PNG trace of smwp_white.svg
  'wikka_logo.jpg', // opaque JPG — needs a transparent export
]);

/** Display names the filename can't yield (initialisms, odd exports). */
const NAMES = {
  hhs: 'Heavy House Society',
  coco: 'COCO',
  umg: 'Universal Music Group',
  'universal-music-group': 'Universal Music Group',
  hbd: 'HBD',
  hus: 'HUS',
  kdis: 'KDIS',
  oou: 'OOU',
  smwp: 'SMWP',
};

/** Filename noise that says nothing about the client. */
const NOISE = new Set([
  'logo', 'white', 'rev', 'sm', 'sm3', 'web', 'no', 'background', 'pure',
  'stacked', 'outline', 'nocircle', 'askew', 'trace', 'oval', 'black',
  'long', 'v2', '01', 'only',
]);

const kebab = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const humanize = (slug) => {
  if (NAMES[slug]) return NAMES[slug];
  const words = slug.split('-').filter((w) => w && !NOISE.has(w));
  const key = words.join('-');
  if (NAMES[key]) return NAMES[key];
  return words
    .map((w) => (NAMES[w] ? NAMES[w] : w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
};

// ── SVG: rewrite every colour to white ──────────────────────────────────
const isNoColor = (v) => /^(none|transparent|inherit|currentcolor)$/i.test(v.trim());
const whitenSvg = (src) => {
  let s = src;
  // Attribute form: fill="#f15e53" / stroke="#000000" / fill="rgb(…)"
  s = s.replace(/\b(fill|stroke)\s*=\s*"([^"]*)"/g, (m, k, v) =>
    isNoColor(v) || v.startsWith('url(') ? m : `${k}="#fff"`,
  );
  // CSS form: fill: #f1f1f1; / stroke:#000 (inside <style> or style="")
  s = s.replace(/\b(fill|stroke)\s*:\s*([^;"}]+)/g, (m, k, v) =>
    isNoColor(v) || v.trim().startsWith('url(') ? m : `${k}: #fff`,
  );
  // Root fill so paths with no fill at all (circus-music) inherit white.
  if (!/<svg\b[^>]*\bfill=/.test(s)) s = s.replace(/<svg\b/, '<svg fill="#fff"');
  // Strip the XML prolog + fixed width/height so it scales via CSS (house
  // prep, see HeroIntro.jsx) — the viewBox stays the layout basis.
  s = s.replace(/<\?xml[^>]*\?>\s*/, '').replace(/<!--[\s\S]*?-->\s*/g, '');
  s = s.replace(/<svg\b([^>]*)>/, (m, attrs) => {
    const a = attrs.replace(/\s(width|height)="[^"]*"/g, '');
    return `<svg${a}>`;
  });
  return s;
};
const svgSize = (s) => {
  const vb = s.match(/viewBox="([^"]+)"/);
  if (vb) {
    const [, , w, h] = vb[1].trim().split(/[\s,]+/).map(Number);
    return { w, h };
  }
  const w = Number((s.match(/\bwidth="([\d.]+)/) || [])[1]);
  const h = Number((s.match(/\bheight="([\d.]+)/) || [])[1]);
  return { w, h };
};

// ── Raster: trim, downscale, join alpha onto white ─────────────────────
const whitenRaster = async (file) => {
  const meta = await sharp(file).metadata();
  if (!meta.hasAlpha) throw new Error('opaque raster — no alpha to lift; needs a transparent export');
  // Trim transparent padding, then cap height. Two passes because trim
  // needs the pre-resize pixels and resize needs the trimmed dims.
  const trimmed = await sharp(file).ensureAlpha().trim().png().toBuffer();
  const tm = await sharp(trimmed).metadata();
  const h = Math.min(MAX_H, tm.height);
  const w = Math.round((tm.width * h) / tm.height);
  const sized = await sharp(trimmed).resize({ height: h, width: w, fit: 'fill' }).png().toBuffer();
  const alpha = await sharp(sized).extractChannel('alpha').raw().toBuffer();
  const out = await sharp({ create: { width: w, height: h, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { buf: out, w, h };
};

// ── --check: every opaque pixel is white ────────────────────────────────
const checkRaster = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bad = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 8 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)) bad++;
  }
  return bad;
};
const checkSvg = (s) => {
  const colours = [...s.matchAll(/\b(fill|stroke)\s*[:=]\s*"?\s*([^;"}\s>]+)/g)]
    .map((m) => m[2].trim())
    .filter((v) => !isNoColor(v) && !/^#fff(fff)?$/i.test(v) && !v.startsWith('url('));
  return colours;
};

const main = async () => {
  if (CHECK) {
    const files = (await readdir(OUT)).filter((f) => /\.(svg|png)$/i.test(f));
    let fail = 0;
    for (const f of files) {
      const p = join(OUT, f);
      if (f.endsWith('.svg')) {
        const bad = checkSvg(await readFile(p, 'utf8'));
        if (bad.length) { fail++; console.log(`FAIL ${f}: ${bad.join(', ')}`); }
      } else {
        const bad = await checkRaster(p);
        if (bad) { fail++; console.log(`FAIL ${f}: ${bad} non-white opaque px`); }
      }
    }
    console.log(`${files.length} files, ${fail} not white`);
    process.exit(fail ? 1 : 0);
  }

  const intake = (await readdir(IN)).filter((f) => !f.startsWith('.'));
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const manifest = [];
  const skipped = [];
  for (const f of intake.sort((a, b) => a.localeCompare(b))) {
    if (DENY.has(f)) { skipped.push(`${f} (deny-list)`); continue; }
    const ext = extname(f).toLowerCase();
    const slug = kebab(basename(f, ext));
    try {
      if (ext === '.svg') {
        const out = whitenSvg(await readFile(join(IN, f), 'utf8'));
        const { w, h } = svgSize(out);
        await writeFile(join(OUT, `${slug}.svg`), out);
        manifest.push({ file: `${slug}.svg`, name: humanize(slug), w, h, src: f });
      } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        const { buf, w, h } = await whitenRaster(join(IN, f));
        await writeFile(join(OUT, `${slug}.png`), buf);
        manifest.push({ file: `${slug}.png`, name: humanize(slug), w, h, src: f });
      } else {
        skipped.push(`${f} (unsupported ${ext})`);
      }
    } catch (e) {
      skipped.push(`${f} (${e.message})`);
    }
  }
  manifest.sort((a, b) => a.file.localeCompare(b.file));
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  let bytes = 0;
  for (const m of manifest) bytes += (await stat(join(OUT, m.file))).size;
  console.log(`${manifest.length} logos → ${OUT} (${(bytes / 1024).toFixed(0)} KB)`);
  for (const m of manifest) console.log(`  ${m.file.padEnd(38)} ${String(m.w).padStart(5)}×${String(m.h).padEnd(4)} ${m.name}`);
  if (skipped.length) console.log(`skipped:\n  ${skipped.join('\n  ')}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
