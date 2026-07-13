/**
 * gallery.mjs — builds the WORLD BUILD design-review page (dist/gallery.html).
 *
 * A single self-contained file: subset brand faces + the rotating outline
 * globe GIF embedded as data URIs, all four iterations mounted as LIVE
 * slides (not screenshots) inside IG-style snap reels. Every swipe fires
 * that slide's entrance choreography — scramble chips, masked line rises,
 * tag pops, Thread draws — on the site's own ease/duration tokens.
 *
 *   node gallery.mjs [--subset-dir <dir>]   (defaults to full site fonts)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseCss, fontFaceCss, globeSvg, CANVAS, esc } from './lib.mjs';
import { SERIES, PROJECTS } from './content.mjs';
import * as masthead from './templates/masthead.mjs';
import * as osboot from './templates/osboot.mjs';
import * as panel from './templates/panel.mjs';
import * as thread from './templates/thread.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

/* ---------- assets ---------- */

const subsetIx = process.argv.indexOf('--subset-dir');
const SUBSET_DIR = subsetIx > -1 ? process.argv[subsetIx + 1] : null;

function fonts() {
  if (!SUBSET_DIR || !existsSync(SUBSET_DIR)) return fontFaceCss();
  const face = (family, weight, file) =>
    `@font-face { font-family: '${family}'; src: url('data:font/woff2;base64,${readFileSync(join(SUBSET_DIR, file)).toString('base64')}') format('woff2'); font-weight: ${weight}; font-style: normal; font-display: block; }`;
  return [
    face('OT Neue Montreal Squeezed', 600, 'OTNeueMontreal-SemiBoldSqueezed.woff2'),
    face('PP Neue Montreal', 400, 'PPNeueMontreal-Book.woff2'),
    face('PP Neue Montreal', 500, 'PPNeueMontreal-Medium.woff2'),
    face('Iosevka Term', 500, 'IosevkaTermMedium.woff2'),
  ].join('\n');
}

const GLOBE_GIF = `data:image/gif;base64,${readFileSync(
  join(ROOT, 'SWM Globe Rotate White Outline.gif')
).toString('base64')}`;

/* ---------- deck assembly ---------- */

const TEMPLATES = { masthead, osboot, panel, thread };
const coco = PROJECTS[0];
const kamino = PROJECTS[1];

function reel(tmplKey, project, reelId) {
  const tmpl = TEMPLATES[tmplKey];
  const frames = tmpl
    .slides(project, SERIES)
    .map(
      (s, i) => `
      <div class="frame" data-n="${i + 1}">
        <div class="scaler">${s}</div>
      </div>`
    )
    .join('');
  return `
  <div class="igpost" id="${reelId}">
    <div class="ig-head">
      <span class="ig-avatar">${globeSvg()}</span>
      <span class="ig-user">smallworldmedia</span>
      <button class="ig-replay" data-reel="${reelId}" type="button">↻ replay_entrance</button>
    </div>
    <div class="reel" tabindex="0">${frames}</div>
    <div class="ig-dots">${[1, 2, 3, 4, 5].map((n) => `<span class="dot${n === 1 ? ' on' : ''}"></span>`).join('')}</div>
  </div>`;
}

/* ---------- rationale copy ---------- */

const SECTIONS = [
  {
    tmpl: 'masthead',
    tag: 'ITERATION_A',
    title: 'THE MASTHEAD',
    lede: 'The np-band grammar — mono label, 1px rule, squeezed display, tag row — recomposed as an editorial front page.',
    points: [
      'The horizon rule holds one fixed Y on all five slides: every swipe hands the line to the next slide, so the deck reads as one continuous surface.',
      'Narrative slides quote the info panel’s blue-emphasis pattern — one payoff phrase per beat runs electric inside the white prose.',
      'The giant electric page index bleeds off the bottom-right crop — the unfinished digit is the pull to swipe.',
      'Closer = the np-band pinned state: title and rule flip to blue, exactly like the site’s next-project threshold.',
    ],
  },
  {
    tmpl: 'osboot',
    tag: 'ITERATION_B',
    title: 'PROJECT_## (OS BOOT)',
    lede: 'The /work World identity card, slide-sized: blue PROJECT_## tab, centered squeezed stack, white fp-tag pills.',
    points: [
      'Narrative slides read as a boot log — `> stage_01: discovery` over a block meter set in the house scramble charset (░▒▓█).',
      'The meter fills 2/5 → 5/5 as you swipe: the world literally loads to 100% on the closer.',
      'Corner chrome (swm_os, sig_lock, [ 01 / 05 ]) mirrors the ?debug register — the quietest, most systematic of the four.',
      'Closer hands off to the next post: `next_up: project_02 — kamino` makes the series self-chaining.',
    ],
  },
  {
    tmpl: 'panel',
    tag: 'ITERATION_C',
    title: 'THE DETAIL PANEL',
    lede: 'The detail page’s vertical rhythm at 4:5 — black masthead, electric ClientPanel band, near-black blurb surface.',
    points: [
      'The cover is the /work/[slug] fold, verbatim: squeezed client title on the blue band, client_type / est chips, service-tag pills below.',
      'Narrative slides are the project-blurb zone — near-black ground, left-set prose, and the client / date / stage detail-fields at the foot.',
      'The final beat inverts to full blue with the globe watermark: the ClientPanel takes the frame as the world lights up.',
      'The most literal website extension of the four — a swipeable detail page. Credits ride the closer’s footer like the site’s chrome.',
    ],
  },
  {
    tmpl: 'thread',
    tag: 'ITERATION_D',
    title: 'THE THREAD',
    lede: 'The process page’s language pointed at one project: Fragments, the Thread, the light-up, the assembled Core.',
    points: [
      'The Thread crosses every slide at one fixed edge height — exit right, enter left — so the drawn line survives every swipe and finally terminates in the Core.',
      'Fragment specks scatter with the site’s own seeded PRNG and thin out as the world pulls together: 26 at discovery, 6 by the light-up.',
      'STAGE_ tabs, caption pings (references_folded → core_assembled → world_in_motion) and squeezed stage headlines run the process register.',
      'Beat three floods the frame electric blue — the highest-contrast moment in the feed, the same light-up the site gives the Core.',
    ],
  },
];

/* ---------- page css ---------- */

const S_DESK = 0.36;
const S_MOB = 0.295;

const pageCss = `
${baseCss()}

/* ---------- gallery shell ---------- */
html { scroll-behavior: smooth; }
body {
  background: var(--black);
  color: var(--cream);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1240px; margin: 0 auto; padding: 0 28px; }

.g-chrome {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 26px 0 0;
  font-family: var(--font-mono); font-size: 13px; letter-spacing: -0.024em;
  color: rgba(250,250,250,.72);
}

/* hero */
.g-hero { padding: 72px 0 40px; border-bottom: 1px solid rgba(250,250,250,.16); }
.g-hero-title {
  font-family: var(--font-display); font-weight: 600;
  font-size: clamp(88px, 14.5vw, 196px);
  line-height: 0.8; letter-spacing: -0.005em; text-transform: uppercase;
  display: flex; flex-wrap: wrap; align-items: baseline;
}
.g-hero-title .o {
  display: inline-block; height: 0.74em; width: 0.74em;
  transform: translateY(0.09em); margin: 0 0.02em;
}
.g-hero-title .o img { width: 100%; height: 100%; display: block; }
.g-hero-title .o svg { width: 100%; height: 100%; display: none; --globe-fill: var(--cream); }
@media (prefers-reduced-motion: reduce) {
  .g-hero-title .o img { display: none; }
  .g-hero-title .o svg { display: block; }
}
.g-hero-sub {
  margin-top: 34px; max-width: 640px;
  font-size: 19px; line-height: 1.45; letter-spacing: -0.005em;
  color: rgba(250,250,250,.82);
}
.g-hero-sub em { font-style: normal; color: var(--blue); background: var(--cream); padding: 0 4px; }
.g-meta {
  margin-top: 30px; display: flex; flex-wrap: wrap; gap: 10px;
}
.g-meta .chip { font-size: 13px; padding: 3px 10px; background: var(--near-black); }

/* jump nav */
.g-nav {
  position: sticky; top: 0; z-index: 40;
  background: rgba(0,0,0,.88); backdrop-filter: blur(6px);
  border-bottom: 1px solid rgba(250,250,250,.14);
}
.g-nav .wrap { display: flex; gap: 6px; overflow-x: auto; padding-top: 10px; padding-bottom: 10px; }
.g-nav a {
  font-family: var(--font-mono); font-size: 13px; letter-spacing: -0.02em;
  color: var(--cream); padding: 4px 12px; background: var(--near-black);
  white-space: nowrap;
}
.g-nav a:hover { background: var(--blue); }

/* iteration sections */
.iter { padding: 78px 0 30px; border-bottom: 1px solid rgba(250,250,250,.16); }
.iter-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.iter-tab {
  font-family: var(--font-mono); font-size: 14px; letter-spacing: -0.02em;
  background: var(--blue); color: var(--white); padding: 4px 12px;
}
.iter-title {
  font-family: var(--font-display); font-weight: 600;
  font-size: clamp(44px, 6vw, 84px); line-height: 0.82;
  letter-spacing: -0.005em; text-transform: uppercase;
}
.iter-lede {
  margin-top: 18px; max-width: 620px;
  font-size: 18px; line-height: 1.45; color: rgba(250,250,250,.82);
}
.iter-cols {
  margin-top: 40px;
  display: grid; grid-template-columns: minmax(300px, 1fr) auto; gap: 48px;
  align-items: start;
}
.iter-points { display: flex; flex-direction: column; gap: 0; }
.iter-points li {
  list-style: none; padding: 16px 0; border-top: 1px solid rgba(250,250,250,.14);
  font-size: 15.5px; line-height: 1.5; color: rgba(250,250,250,.85);
  max-width: 560px;
}
.iter-points li::before {
  content: '↳'; font-family: var(--font-mono); color: var(--blue);
  margin-right: 10px;
}
.iter-points li code {
  font-family: var(--font-mono); font-size: 13.5px; color: var(--cream);
  background: var(--near-black); padding: 1px 6px;
}

/* IG post mock */
.igpost { width: calc(${CANVAS.w}px * var(--s) + 2px); max-width: 100%; }
.ig-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 2px;
}
.ig-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid rgba(250,250,250,.35);
  display: inline-flex; align-items: center; justify-content: center;
  --globe-fill: var(--cream);
}
.ig-avatar .globe { width: 18px; height: 17px; }
.ig-user { font-family: var(--font-mono); font-size: 13px; letter-spacing: -0.02em; }
.ig-replay {
  margin-left: auto;
  font-family: var(--font-mono); font-size: 12px; letter-spacing: -0.02em;
  color: var(--cream); background: var(--near-black);
  border: 1px solid rgba(250,250,250,.25); padding: 4px 10px; cursor: pointer;
}
.ig-replay:hover { background: var(--blue); border-color: var(--blue); }
.ig-replay:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

.reel {
  display: flex; gap: 10px;
  overflow-x: auto; overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  border: 1px solid rgba(250,250,250,.18);
  background: var(--near-black);
  scrollbar-width: none;
}
.reel::-webkit-scrollbar { display: none; }
.reel:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
.frame {
  flex: none;
  width: calc(${CANVAS.w}px * var(--s));
  height: calc(${CANVAS.h}px * var(--s));
  scroll-snap-align: start;
  scroll-snap-stop: always;
  overflow: hidden; position: relative;
}
.scaler {
  width: ${CANVAS.w}px; height: ${CANVAS.h}px;
  transform: scale(var(--s)); transform-origin: top left;
}
.ig-dots { display: flex; justify-content: center; gap: 6px; padding: 12px 0 4px; }
.ig-dots .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(250,250,250,.28); transition: background .2s;
}
.ig-dots .dot.on { background: var(--blue); }

:root { --s: ${S_DESK}; }
@media (max-width: 1120px) {
  .iter-cols { grid-template-columns: 1fr; }
  .igpost { margin: 0 auto; }
}
@media (max-width: 720px) { :root { --s: ${S_MOB}; } }

/* proof + pipeline + reco */
.proof { padding: 78px 0; border-bottom: 1px solid rgba(250,250,250,.16); }
.proof-cols { display: grid; grid-template-columns: minmax(300px,1fr) auto; gap: 48px; align-items: start; margin-top: 40px; }
@media (max-width: 1120px) { .proof-cols { grid-template-columns: 1fr; } }

.pipe { padding: 78px 0; border-bottom: 1px solid rgba(250,250,250,.16); }
.pipe-grid { margin-top: 36px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
.pipe-card { background: var(--near-black); padding: 20px; border-top: 2px solid var(--blue); }
.pipe-card h3 { font-family: var(--font-mono); font-weight: 500; font-size: 13px; letter-spacing: -0.02em; margin-bottom: 12px; color: var(--cream); }
.pipe-card p { font-size: 14.5px; line-height: 1.5; color: rgba(250,250,250,.78); }
.pipe-card code { font-family: var(--font-mono); font-size: 12.5px; color: var(--cream); background: #000; padding: 1px 5px; }

.reco { padding: 78px 0 96px; }
.reco-body { margin-top: 26px; max-width: 680px; font-size: 18px; line-height: 1.5; color: rgba(250,250,250,.88); display: flex; flex-direction: column; gap: 16px; }
.reco-body strong { font-weight: 500; color: var(--cream); background: var(--blue); padding: 0 5px; }

.g-footer {
  display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 10px;
  padding: 22px 0 42px; border-top: 1px solid rgba(250,250,250,.16);
  font-family: var(--font-mono); font-size: 12.5px; color: rgba(250,250,250,.6);
}

h2.sec-title {
  font-family: var(--font-display); font-weight: 600;
  font-size: clamp(40px, 5.4vw, 72px); line-height: 0.82;
  letter-spacing: -0.005em; text-transform: uppercase;
  text-wrap: balance;
}
.sec-lede { margin-top: 18px; max-width: 640px; font-size: 18px; line-height: 1.45; color: rgba(250,250,250,.82); }

/* ---------- slide entrance choreography (gallery-only) ---------- */
.slide .m-rise, .slide .m-pop, .slide .m-fade, .slide .m-draw { will-change: transform, opacity; }
.slide.play .m-rise {
  animation: mRise .8s var(--ease-panel) both; animation-delay: var(--d, 0s);
}
@keyframes mRise {
  from { opacity: 0; transform: translateY(48px); clip-path: inset(0 0 100% 0); }
  to   { opacity: 1; transform: none; clip-path: inset(-12% 0 -12% 0); }
}
.slide.play .m-pop {
  animation: mPop .38s var(--ease-micro) both; animation-delay: var(--d, 0s);
}
@keyframes mPop {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: none; }
}
.slide.play .m-fade {
  animation: mFade .7s ease-out both; animation-delay: var(--d, 0s);
}
@keyframes mFade { from { opacity: 0; } to { opacity: 1; } }
.slide.play .m-draw {
  animation: mDraw .9s var(--ease-panel) both; animation-delay: var(--d, 0s);
  transform-origin: left center;
}
@keyframes mDraw { from { transform: scaleX(0); } to { transform: none; } }

/* 122bpm pulse on the Thread cover's node ring (the site's rhythm anchor) */
.slide.play .th__title .globe-o::after { animation: pulse122 0.9836s ease-in-out infinite; }
@keyframes pulse122 { 0%, 100% { opacity: .9; } 50% { opacity: .45; } }

@media (prefers-reduced-motion: reduce) {
  .slide.play .m-rise, .slide.play .m-pop, .slide.play .m-fade, .slide.play .m-draw,
  .slide.play .th__title .globe-o::after { animation: none; }
}
`;

/* ---------- page js ---------- */

const pageJs = `
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CHARS = '01<>[]{}/\\\\|=+*#%░▒▓█—'; // src/lib/scramble.js charset
  const SCRAMBLE_MS = 1400;                  // SCRAMBLE_DURATION
  const TICK = 45;

  function scramble(el, delay = 0) {
    if (RM) return;
    if (!el.dataset.t) el.dataset.t = el.textContent;
    const target = el.dataset.t;
    clearInterval(el._siv); clearTimeout(el._sto);
    el._sto = setTimeout(() => {
      const t0 = performance.now();
      el._siv = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / SCRAMBLE_MS);
        const reveal = Math.floor(k * target.length);
        let out = target.slice(0, reveal);
        for (let i = reveal; i < target.length; i++) {
          const ch = target[i];
          out += ch === ' ' ? ' ' : CHARS[(Math.random() * CHARS.length) | 0];
        }
        el.textContent = out;
        if (k >= 1) { clearInterval(el._siv); el.textContent = target; }
      }, TICK);
    }, delay);
  }

  function drawThread(slide) {
    slide.querySelectorAll('.th__line').forEach((line) => {
      const L = line.getTotalLength();
      line.style.transition = 'none';
      line.style.strokeDasharray = L;
      line.style.strokeDashoffset = L;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(0.22,1,0.36,1) 0.25s';
      requestAnimationFrame(() => { line.style.strokeDashoffset = '0'; });
    });
  }

  function play(slide) {
    if (RM) return;
    slide.classList.remove('play');
    void slide.offsetWidth;
    slide.classList.add('play');
    slide.querySelectorAll('.m-scr').forEach((el, i) => scramble(el, i * 140));
    drawThread(slide);
  }

  // every swipe fires that slide's entrance
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const slide = e.target.querySelector('.slide');
        if (!slide) return;
        if (e.isIntersecting && e.intersectionRatio > 0.55) {
          if (!e.target._played) { e.target._played = true; play(slide); }
        } else if (e.intersectionRatio < 0.2) {
          e.target._played = false; // re-arm for the next swipe-back
        }
      });
    },
    { threshold: [0.2, 0.55] }
  );
  document.querySelectorAll('.frame').forEach((f) => io.observe(f));

  // dot indicators
  document.querySelectorAll('.igpost').forEach((post) => {
    const reelEl = post.querySelector('.reel');
    const dots = [...post.querySelectorAll('.dot')];
    reelEl.addEventListener('scroll', () => {
      const w = reelEl.querySelector('.frame').offsetWidth + 10;
      const ix = Math.min(dots.length - 1, Math.round(reelEl.scrollLeft / w));
      dots.forEach((d, i) => d.classList.toggle('on', i === ix));
    }, { passive: true });
  });

  // replay buttons — back to the cover, run the boot again
  document.querySelectorAll('.ig-replay').forEach((btn) => {
    btn.addEventListener('click', () => {
      const post = document.getElementById(btn.dataset.reel);
      const reelEl = post.querySelector('.reel');
      reelEl.scrollTo({ left: 0, behavior: 'smooth' });
      const cover = reelEl.querySelector('.frame');
      setTimeout(() => { cover._played = true; play(cover.querySelector('.slide')); }, 350);
    });
  });
})();
`;

/* ---------- assemble ---------- */

const iterSections = SECTIONS.map((s, i) => {
  const t = TEMPLATES[s.tmpl];
  return `
<section class="iter" id="${s.tmpl}">
  <div class="wrap">
    <div class="iter-head">
      <span class="iter-tab">${s.tag}</span>
      <h2 class="iter-title">${s.title}</h2>
    </div>
    <p class="iter-lede">${s.lede}</p>
    <div class="iter-cols">
      <ul class="iter-points">${s.points.map((pt) => `<li>${pt}</li>`).join('')}</ul>
      ${reel(s.tmpl, coco, `reel-${s.tmpl}`)}
    </div>
  </div>
</section>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>WORLD BUILD — carousel system</title>
<style>
${fonts()}
${pageCss}
${masthead.css()}
${osboot.css()}
${panel.css()}
${thread.css()}
</style>
</head>
<body>

<header class="g-hero">
  <div class="wrap">
    <div class="g-chrome">
      <span>⊙ small_world_media™ / instagram_carousel_system</span>
      <span>2026-07-13</span>
    </div>
    <h1 class="g-hero-title" style="margin-top:56px">
      <span>W</span><span class="o"><img src="${GLOBE_GIF}" alt="">${globeSvg()}</span><span>RLD&nbsp;BUILD</span>
    </h1>
    <p class="g-hero-sub">
      An editorial carousel series for the featured projects — the detail page,
      re-cut for the feed. Cover: <em>WORLD BUILD</em> with the globe as the O,
      client, service tags. Then the project blurb, elaborated across three
      swipe beats on black, closing on <em>your world next</em>. Four layout
      systems below, all set in the site's own faces, tokens and chrome —
      swipe the reels; every slide plays its entrance.
    </p>
    <div class="g-meta">
      <span class="chip">1080 × 1350 · 4:5</span>
      <span class="chip">5 slides / project</span>
      <span class="chip">fed by the sanity project docs</span>
      <span class="chip">demo world: coco</span>
      <span class="chip">motion: house tokens</span>
    </div>
  </div>
</header>

<nav class="g-nav" aria-label="iterations">
  <div class="wrap">
    <a href="#masthead">A — masthead</a>
    <a href="#osboot">B — os_boot</a>
    <a href="#panel">C — detail_panel</a>
    <a href="#thread">D — the_thread</a>
    <a href="#proof">any_world</a>
    <a href="#pipeline">pipeline</a>
    <a href="#reco">recommendation</a>
  </div>
</nav>

${iterSections}

<section class="proof" id="proof">
  <div class="wrap">
    <h2 class="sec-title">One template, any world</h2>
    <p class="sec-lede">
      The decks are pure functions of the project record — client, tags, years,
      and the detail blurb cut into three beats. Same system, different world:
      Kamino through the Detail Panel. Adding a project to the series is one
      record in <span style="font-family:var(--font-mono);font-size:15px">content.mjs</span>, sourced from the same Sanity fields the site already reads.
    </p>
    <div class="proof-cols">
      <ul class="iter-points">
        <li>Client name scales into the ClientPanel band at any length — KAMINO sets as confidently as COCO.</li>
        <li>Tags, chips, years, credits: all conditional, all from the CMS record — nothing hand-placed per post.</li>
        <li>The arc beats follow the process stages (discovery → core_identity → living_world), so every project tells the same world-build story the site tells.</li>
      </ul>
      ${reel('panel', kamino, 'reel-kamino')}
    </div>
  </div>
</section>

<section class="pipe" id="pipeline">
  <div class="wrap">
    <h2 class="sec-title">From CMS to feed</h2>
    <div class="pipe-grid">
      <div class="pipe-card">
        <h3>01 — content</h3>
        <p><code>content.mjs</code> — one record per featured project: client, tags, years, and the detail-page description elaborated into three beats (with <code>[[…]]</code> emphasis markers). Pulled from the same <code>project</code> docs the site renders.</p>
      </div>
      <div class="pipe-card">
        <h3>02 — build + render</h3>
        <p><code>node build.mjs</code> emits self-contained 1080×1350 HTML slides; <code>node render.mjs</code> screenshots them to post-ready PNGs with headless Chromium. Both live in <code>social/world-build/</code>.</p>
      </div>
      <div class="pipe-card">
        <h3>03 — motion slide</h3>
        <p>The same slides carry an entrance choreography on the house tokens — scramble chips, masked line rises, tag pops, Thread draw. Screen-record the cover to MP4 and slide 1 posts as video, rotating outline globe as the O.</p>
      </div>
      <div class="pipe-card">
        <h3>04 — back into the cms</h3>
        <p>Finished decks archive per client under the existing carousel convention: <code>mediaType: carousel-slide</code>, one <code>displayGroup</code> per deck, slides in <code>sortOrder</code> — ready for the future Carousel component.</p>
      </div>
    </div>
  </div>
</section>

<section class="reco" id="reco">
  <div class="wrap">
    <h2 class="sec-title">Recommendation</h2>
    <div class="reco-body">
      <p><strong>C — the Detail Panel as the series backbone.</strong> It is the website at feed scale — the blue band is instantly Small World Media before a word is read, it survives any client name or tag count, and the light-up beat gives every deck its blue moment.</p>
      <p><strong>D — the Thread as the flagship treatment</strong> for the biggest world-builds and for the video covers: the continuous line is the strongest swipe mechanic of the four, and it carries the process-page narrative into the feed.</p>
      <p>A's giant blue index is worth stealing for text-heavy decks; B's boot meter is the sleeper move if the series leans more systematic. All four ship from the same content records — mixing per project costs nothing.</p>
    </div>
  </div>
</section>

<footer class="g-footer">
  <div class="wrap" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:0 28px;">
    <span>⊙ world_build · iteration review</span>
    <span>source: social/world-build/ · branch claude/max-effort-nbx20u</span>
  </div>
</footer>

<script>${pageJs}</script>
</body>
</html>`;

writeFileSync(join(HERE, 'dist', 'gallery.html'), html);
console.log(`gallery → dist/gallery.html (${(html.length / 1e6).toFixed(2)} MB)`);
