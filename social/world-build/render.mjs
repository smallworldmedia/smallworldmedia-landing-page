/**
 * render.mjs — screenshots every built slide to a 1080×1350 PNG.
 *
 *   node build.mjs && node render.mjs [--only <deckId>]
 *
 * Zero-dependency on npm packages: drives the preinstalled Chromium's
 * headless --screenshot CLI. Fonts are embedded in the slide HTML, and
 * --virtual-time-budget gives @font-face decode time to settle.
 *
 * Capture note: new-headless --window-size includes ~90px of window UI,
 * so the viewport comes out shorter than requested and the PNG gets
 * black-padded to the window size. We render into a taller window than
 * the canvas and crop to the exact 1080×1350 document afterwards
 * (python3 + pillow — `pip install pillow` once per machine).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const WINDOW_H = CANVAS_H + 350; // headroom over the headless UI delta

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const PNG = join(DIST, 'png');
mkdirSync(PNG, { recursive: true });

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_BIN,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const chromium = CHROMIUM_CANDIDATES.find((p) => existsSync(p));
if (!chromium) {
  console.error('no chromium binary found; set CHROMIUM_BIN');
  process.exit(1);
}

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;

const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8')).filter(
  (m) => !only || m.deck === only
);

for (const m of manifest) {
  const out = join(DIST, m.png);
  execFileSync(
    chromium,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${CANVAS_W},${WINDOW_H}`,
      '--virtual-time-budget=4000',
      '--allow-file-access-from-files',
      '--disable-lcd-text',
      `--screenshot=${out}`,
      `file://${join(DIST, m.file)}`,
    ],
    { stdio: 'pipe' }
  );
  console.log(`✓ ${m.png}`);
}

// crop every capture to the exact canvas
execFileSync(
  'python3',
  [
    '-c',
    `
import sys
from PIL import Image
import json, os
dist = ${JSON.stringify(DIST)}
manifest = json.load(open(os.path.join(dist, 'manifest.json')))
only = ${only ? JSON.stringify(only) : 'None'}
for m in manifest:
    if only and m['deck'] != only: continue
    p = os.path.join(dist, m['png'])
    im = Image.open(p)
    if im.size != (${CANVAS_W}, ${CANVAS_H}):
        im.crop((0, 0, ${CANVAS_W}, ${CANVAS_H})).save(p)
print('cropped to ${CANVAS_W}x${CANVAS_H}')
`,
  ],
  { stdio: 'inherit' }
);
console.log(`rendered ${manifest.length} slides → dist/png/`);
