#!/usr/bin/env node
/**
 * prep-directory-logos — the Project Directory's logo marks, baked from Sanity.
 *
 *   node scripts/prep-directory-logos.mjs            read Sanity, bake the set, print the report
 *   node scripts/prep-directory-logos.mjs --check    verify the baked set (offline): every mark pure white
 *   node scripts/prep-directory-logos.mjs --alpha    re-measure the faces' transparency (src/data/directory-alpha.json)
 *
 * --alpha (SQ-20): every published image with an alpha channel that Sanity
 * doesn't call opaque, measured at 300px (alphaStats): `clear`, the share of
 * pixels under alpha 250, and `lum`, the ink's mean luminance, keyed by IMAGE
 * asset id with the title for reading. buildDirectoryTiles letterboxes only a
 * face that measures clear (fitOf) and gives dark ink a light ground. Re-run
 * after uploading transparent PNGs; until then a new one contains, as before.
 *
 * A logo tile is a white mark on black (Nathan, 11-05). Sanity keeps each
 * logo in whatever colour it was exported in, so this script bakes one white
 * mark per image: pure #fff on transparent, cropped to its ink, with the
 * numbers the page scales and centres it by, and `trim`, the ink's box inside the
 * original as fractions (the detail page places the original by it; scripts/lib/logoInk.mjs, and
 * src/components/work/directory/logoTile.js for the layout). Read-only
 * against Sanity: published still images that are a `logo` or carry the
 * logo-design tag, fetched from the CDN.
 *
 * Output (tracked): src/data/directory-logos/<hash>.png and
 * src/data/directory-logos.json, keyed by the IMAGE asset id (a re-upload is a
 * new id, so a stale mark can never show on a new file):
 *   { file, w, h, aspect, density, cx, cy, trim, title, client }     a mark
 *   { hold, title, client }                                    held back
 *   { twinOf, ... }                                            the same mark as `twinOf`
 * buildDirectoryTiles reads it: a mark becomes a logo tile, a held logo-typed
 * image and a twin are left out of the directory, anything else renders as it
 * always did. Re-run after any logo changes in Sanity; the report lists what
 * was held back and why.
 *
 * Why held: a mark's colours separate its shapes (`multi-colour`: outlines
 * against fills, a gradient glitch, a mascot), the ground is not plain
 * (`busy-ground`), or the file is not a single mark (HOLD below, a judgement).
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALPHA_SIDE, alphaStats, analyseLogo, silhouette, twinScore } from './lib/logoInk.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { createClient } = require('@sanity/client');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data', 'directory-logos');
const MANIFEST = join(ROOT, 'src', 'data', 'directory-logos.json');
const ALPHA = join(ROOT, 'src', 'data', 'directory-alpha.json');
const CHECK = process.argv.includes('--check');

/** Two marks overlapping by this much (twinScore) are one mark in two files. */
const TWIN_MIN = 0.97;

/** Files a person has judged are not a single clean mark, by image asset id. */
const HOLD = {
  'image-a93a7906f6a7c6503e86a35238e48f43c0916724-1200x1200-jpg': 'two copies of the mark in one file',
  'image-cf109be3b7e2859051b3d443e91f577bd01dc9ee-3356x1698-png': 'a board of logo options, not a mark',
};

const QUERY = `*[_type == "mediaAsset" && !(_id in path("drafts.**")) && defined(image.asset) && !defined(video.asset)
  && (mediaType == "logo" || "logo-design" in services[]->slug.current)] | order(client->name asc, orderRank asc) {
  _id, title, mediaType,
  "client": client->name,
  "clientSlug": client->slug.current,
  "assetId": image.asset._ref,
  "url": image.asset->url,
  "mime": image.asset->mimeType
}`;

const checkSet = async () => {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const files = new Set((await readdir(OUT)).filter((f) => f.endsWith('.png')));
  let bad = 0;
  const used = new Set();
  for (const [id, m] of Object.entries(manifest)) {
    if (!m.file) continue;
    used.add(m.file);
    if (!files.has(m.file)) {
      bad++;
      console.log(`FAIL ${id}: ${m.file} is missing`);
      continue;
    }
    const { data, info } = await sharp(join(OUT, m.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let off = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i + 3] > 8 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)) off++;
    }
    if (off) {
      bad++;
      console.log(`FAIL ${m.file}: ${off} non-white opaque px`);
    }
  }
  for (const f of files) {
    if (!used.has(f)) {
      bad++;
      console.log(`FAIL ${f}: not in the manifest`);
    }
  }
  console.log(`${used.size} marks, ${bad} problems`);
  process.exit(bad ? 1 : 0);
};

const ALPHA_QUERY = `*[_type == "mediaAsset" && !(_id in path("drafts.**")) && defined(image.asset)
  && image.asset->metadata.hasAlpha == true && image.asset->metadata.isOpaque != true] {
  title,
  "assetId": image.asset._ref,
  "url": image.asset->url,
  "mime": image.asset->mimeType
}`;

const bakeAlpha = async () => {
  const client = createClient({ projectId: 'b60h4u7o', dataset: 'production', apiVersion: '2024-01-01', useCdn: false });
  const docs = await client.fetch(ALPHA_QUERY);
  const out = {};
  for (const d of docs) {
    if (out[d.assetId] || d.mime === 'image/svg+xml') continue;
    const res = await fetch(`${d.url}?w=${ALPHA_SIDE}&fit=max`);
    if (!res.ok) throw new Error(`${d.title}: ${res.status} ${d.url}`);
    out[d.assetId] = { ...(await alphaStats(Buffer.from(await res.arrayBuffer()))), title: d.title };
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(ALPHA, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`${Object.keys(sorted).length} faces → src/data/directory-alpha.json`);
  for (const m of Object.values(sorted).sort((a, b) => a.clear - b.clear)) {
    console.log(`  ${m.title.slice(0, 44).padEnd(44)} clear ${(100 * m.clear).toFixed(1).padStart(5)}%  lum ${m.lum.toFixed(2)}`);
  }
};

const main = async () => {
  if (CHECK) return checkSet();
  if (process.argv.includes('--alpha')) return bakeAlpha();

  const client = createClient({ projectId: 'b60h4u7o', dataset: 'production', apiVersion: '2024-01-01', useCdn: false });
  const docs = await client.fetch(QUERY);

  // One entry per image; a `logo` outranks a still that merely carries the tag.
  const byAsset = new Map();
  for (const d of docs) {
    const prior = byAsset.get(d.assetId);
    if (!prior || (prior.mediaType !== 'logo' && d.mediaType === 'logo')) byAsset.set(d.assetId, d);
  }
  const items = [...byAsset.values()].sort(
    (a, b) =>
      (a.clientSlug ?? '').localeCompare(b.clientSlug ?? '') ||
      (a.mediaType === 'logo' ? 0 : 1) - (b.mediaType === 'logo' ? 0 : 1) ||
      a.title.localeCompare(b.title)
  );

  const manifest = {};
  const marks = [];
  for (const d of items) {
    const svg = d.mime === 'image/svg+xml';
    const res = await fetch(svg ? d.url : `${d.url}?w=1400&fit=max`);
    if (!res.ok) throw new Error(`${d.title}: ${res.status} ${d.url}`);
    const r = await analyseLogo(Buffer.from(await res.arrayBuffer()), { svg });
    const entry = { title: d.title, client: d.client, doc: d._id };
    const hold = HOLD[d.assetId] ?? r.hold;
    if (hold) {
      manifest[d.assetId] = { hold, ...entry };
      continue;
    }
    const file = `${d.assetId.split('-')[1].slice(0, 12)}.png`;
    manifest[d.assetId] = {
      file,
      w: r.w,
      h: r.h,
      aspect: r.aspect,
      density: r.density,
      cx: r.cx,
      cy: r.cy,
      trim: r.trim,
      ...entry,
    };
    marks.push({ d, file, png: r.png, sil: await silhouette(r.png) });
  }

  // One mark in two files (a black and a white export, a colourway): the first stays.
  for (let i = 0; i < marks.length; i++) {
    for (let j = 0; j < i; j++) {
      if (marks[i].d.clientSlug !== marks[j].d.clientSlug || manifest[marks[j].d.assetId].twinOf) continue;
      if (twinScore(marks[i].sil, marks[j].sil) >= TWIN_MIN) {
        manifest[marks[i].d.assetId].twinOf = marks[j].d.assetId;
        break;
      }
    }
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  let bytes = 0;
  for (const m of marks) {
    await writeFile(join(OUT, m.file), m.png);
    bytes += m.png.length;
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');

  console.log(`${marks.length} marks → src/data/directory-logos (${(bytes / 1024).toFixed(0)} KB)`);
  for (const [id, m] of Object.entries(manifest)) {
    const note = m.hold ? `HELD ${m.hold}` : m.twinOf ? `twin of ${manifest[m.twinOf].title}` : `${m.aspect}:1 d=${m.density}`;
    console.log(`  ${(m.client ?? '-').slice(0, 20).padEnd(20)} ${m.title.slice(0, 36).padEnd(36)} ${note}`);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
