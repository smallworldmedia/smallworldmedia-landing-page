/**
 * build.mjs — emits the WORLD BUILD carousel decks to dist/.
 *
 *   node build.mjs
 *
 * Per template × project:
 *   dist/slides/{template}-{slug}-{n}.html   one slide per file, exact
 *                                            1080×1350 body (renderer input)
 *   dist/{template}-{slug}.html              contact sheet (quick eyeball)
 *   dist/manifest.json                       everything emitted, for render.mjs
 *
 * Every file is fully self-contained (fonts + globe mark embedded), so it
 * renders identically from file://, a browser, or CI.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { htmlPage, CANVAS } from './lib.mjs';
import { SERIES, PROJECTS } from './content.mjs';
import * as masthead from './templates/masthead.mjs';
import * as osboot from './templates/osboot.mjs';
import * as panel from './templates/panel.mjs';
import * as thread from './templates/thread.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const SLIDES = join(DIST, 'slides');
mkdirSync(SLIDES, { recursive: true });

const TEMPLATES = [masthead, osboot, panel, thread];

const manifest = [];

for (const tmpl of TEMPLATES) {
  for (const project of PROJECTS) {
    const slides = tmpl.slides(project, SERIES);
    const deckId = `${tmpl.meta.key}-${project.slug}`;

    slides.forEach((slideHtml, i) => {
      const name = `${deckId}-${String(i + 1).padStart(2, '0')}`;
      const page = htmlPage({
        title: name,
        css: `${tmpl.css()}
html, body { width: ${CANVAS.w}px; height: ${CANVAS.h}px; overflow: hidden; background: #000; }`,
        body: slideHtml,
      });
      writeFileSync(join(SLIDES, `${name}.html`), page);
      manifest.push({ deck: deckId, template: tmpl.meta.key, project: project.slug, n: i + 1, file: `slides/${name}.html`, png: `png/${name}.png` });
    });

    // contact sheet
    const sheet = htmlPage({
      title: `${deckId} — contact sheet`,
      css: `${tmpl.css()}
body { background: #161616; padding: 40px; display: flex; gap: 28px; overflow-x: auto; }
.frame { flex: none; width: ${CANVAS.w / 2}px; height: ${CANVAS.h / 2}px; outline: 1px solid #333; }
.frame .slide { transform: scale(0.5); transform-origin: top left; }`,
      body: slides.map((s) => `<div class="frame">${s}</div>`).join('\n'),
    });
    writeFileSync(join(DIST, `${deckId}.html`), sheet);
  }
}

writeFileSync(join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`built ${manifest.length} slides across ${TEMPLATES.length * PROJECTS.length} decks → dist/`);
