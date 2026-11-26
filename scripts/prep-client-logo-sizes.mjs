#!/usr/bin/env node
/**
 * prep-client-logo-sizes (SQ-150) — the ticker's logos at the pixels they are drawn at.
 *
 *   node scripts/prep-client-logo-sizes.mjs           write src/assets/client-logos/sized/
 *   node scripts/prep-client-logo-sizes.mjs --check   verify the files match what a run would write
 *
 * The tracked logos (prep-client-logos.mjs) are up to 240 px tall and drawn at 12-56 CSS px.
 * For each PNG this writes the three densities the ticker offers (1x, 2x, 3x: DPR is capped at
 * 3) as lossless WebP at the height the logo is drawn at, x its density, never past the source's
 * own height (no upscale: that density is the original file, listed without a copy). The
 * ticker's srcset reads sized/manifest.json. SVGs are vectors: they stay as they are.
 *
 * "Drawn at" = LOGO_H x the optical factor (--lf), the SAME rule as ClientLogoTicker.jsx
 * (BAL_*, balance()); the --logo-h bake is 28 px desktop, 22 px phone, so the 28 px marks are
 * sharp on both. scripts/test/image-sharp.test.mjs keeps these constants equal to the
 * component's. Reads the tracked outputs, not the untracked intake, so it runs anywhere.
 */
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src', 'assets', 'client-logos');
const OUT = join(SRC, 'sized');
const CHECK = process.argv.includes('--check');

// Mirror of ClientLogoTicker.jsx / global.css (--logo-h desktop). Pinned by the test.
export const LOGO_H = 28;
export const BAL_K = 0.5;
export const BAL_REF_AR = 3;
export const BAL_MIN = 0.55;
export const BAL_MAX = 2;
export const DENSITIES = [1, 2, 3];

export const balance = (w, h) => Math.min(BAL_MAX, Math.max(BAL_MIN, Math.pow(BAL_REF_AR / (w / h), BAL_K)));

/** The rungs of one logo: [{x, h, w, file}] (file null = the original), widest never past `srcH`. */
export function rungs(slug, w, h) {
  const drawn = LOGO_H * balance(w, h);
  return DENSITIES.map((x) => {
    const rh = Math.min(h, Math.ceil(drawn * x));
    return rh >= h ? { x, h, w, file: null } : { x, h: rh, w: Math.ceil((w * rh) / h), file: `${slug}-${rh}.webp` };
  });
}

const run = async () => {
  const manifest = JSON.parse(await readFile(join(SRC, 'manifest.json'), 'utf8'));
  const index = {};
  const want = new Map(); // file -> {slug rung, source}
  for (const m of manifest) {
    if (!m.file.endsWith('.png')) continue;
    const slug = m.file.replace(/\.png$/, '');
    const meta = await sharp(join(SRC, m.file)).metadata();
    const r = rungs(slug, meta.width, meta.height);
    index[m.file] = r.map(({ x, h, w, file }) => ({ x, h, w, file }));
    for (const rung of r) if (rung.file) want.set(rung.file, { rung, from: m.file });
  }

  const json = JSON.stringify(index, null, 2) + '\n';
  if (CHECK) {
    let bad = 0;
    const have = new Set((await readdir(OUT).catch(() => [])).filter((f) => f.endsWith('.webp')));
    for (const [file, { rung, from }] of want) {
      if (!have.has(file)) { bad++; console.log(`MISSING ${file}`); continue; }
      const meta = await sharp(join(OUT, file)).metadata();
      if (meta.width !== rung.w || meta.height !== rung.h) { bad++; console.log(`SIZE ${file} ${meta.width}x${meta.height} want ${rung.w}x${rung.h} (${from})`); }
    }
    for (const f of have) if (!want.has(f)) { bad++; console.log(`STALE ${f}`); }
    if ((await readFile(join(OUT, 'manifest.json'), 'utf8').catch(() => '')) !== json) { bad++; console.log('manifest.json differs'); }
    console.log(`${want.size} sized files, ${bad} problems`);
    process.exit(bad ? 1 : 0);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  let bytes = 0;
  for (const [file, { rung, from }] of want) {
    const buf = await sharp(join(SRC, from))
      .resize({ width: rung.w, height: rung.h, fit: 'fill' })
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    bytes += buf.length;
    await writeFile(join(OUT, file), buf);
  }
  await writeFile(join(OUT, 'manifest.json'), json);
  console.log(`${want.size} files → ${OUT} (${(bytes / 1024).toFixed(0)} KB)`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) run().catch((e) => { console.error(e); process.exit(1); });
