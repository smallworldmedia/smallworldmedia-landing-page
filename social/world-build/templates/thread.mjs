/**
 * Iteration D — THE THREAD
 *
 * The process-page grammar applied to one project's story. The Thread
 * (hop-by-hop polyline, node dots, caption pings) crosses every slide,
 * entering and exiting at the same edge height (y=675) — swipe after
 * swipe, the line continues across the deck and finally terminates in
 * the assembled Core. Fragment specks scatter with the site's seeded
 * PRNG (mulberry32/hashSeed, seededLayout.js) and thin out as the world
 * pulls together: discovery → core → a full electric-blue light-up.
 */

import { globeWord, globeSvg, esc, pad2, richText, hashSeed, mulberry32, CANVAS } from '../lib.mjs';

export const meta = {
  key: 'thread',
  name: 'D — The Thread',
  oneLiner:
    'Process-page kinetics: the Thread runs continuously through all five slides, fragments assemble as you swipe, and the world lights up full blue.',
};

const PAD = 64;
const HANDOFF_Y = 675; // the Thread's edge height — constant across the deck

/* ---------- SVG builders ---------- */

function threadSvg({ points, active = -1, terminal = false, onBlue = false }) {
  const c = onBlue ? '#ffffff' : '#ffffff';
  const accent = onBlue ? '#ffffff' : '#0000ff';
  const poly = points.map((p) => p.join(',')).join(' ');
  const nodes = points
    .slice(1, terminal ? points.length : points.length - 1)
    .map((p, i) => {
      const idx = i + 1;
      if (idx === active) {
        return `
    <circle cx="${p[0]}" cy="${p[1]}" r="30" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.3" class="halo"/>
    <circle cx="${p[0]}" cy="${p[1]}" r="17" fill="none" stroke="${accent}" stroke-width="3"/>
    <circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${accent}"/>`;
      }
      return `<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${c}"/>`;
    })
    .join('');
  return `
  <svg class="th__thread" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" xmlns="http://www.w3.org/2000/svg">
    <polyline class="th__line" points="${poly}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.92"/>
    ${nodes}
  </svg>`;
}

/** Seeded fragment scatter — clearRects keep type zones clean. */
function fragments(seedKey, count, clearRects = [], { onBlue = false } = {}) {
  const rand = mulberry32(hashSeed(seedKey));
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const x = 34 + rand() * (CANVAS.w - 68);
    const y = 34 + rand() * (CANVAS.h - 68);
    if (clearRects.some(([rx, ry, rw, rh]) => x > rx && x < rx + rw && y > ry && y < ry + rh)) continue;
    const s = 4 + rand() * 8;
    const rot = (rand() - 0.5) * 80;
    const blue = !onBlue && rand() < 0.25;
    const op = (blue ? 0.34 : 0.1 + rand() * 0.16).toFixed(2);
    out.push(
      `<span class="th__frag" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;transform:rotate(${rot.toFixed(0)}deg);background:${blue ? '#0000ff' : '#ffffff'};opacity:${op};"></span>`
    );
  }
  return `<div class="th__frags">${out.join('')}</div>`;
}

/** The closer's settled orbit ring. */
function orbitRing(cx, cy, r, n, seedKey) {
  const rand = mulberry32(hashSeed(seedKey));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.2;
    const rr = r + (rand() - 0.5) * 26;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.86;
    const s = 5 + rand() * 6;
    out.push(
      `<span class="th__frag" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;transform:rotate(${((rand() - 0.5) * 80).toFixed(0)}deg);background:#ffffff;opacity:0.5;"></span>`
    );
  }
  return `<div class="th__frags">${out.join('')}</div>`;
}

export function css() {
  return `
/* ---------- D: THE THREAD ---------- */
.th__thread { position: absolute; inset: 0; width: 100%; height: 100%; }
.th__frags { position: absolute; inset: 0; }
.th__frag { position: absolute; display: block; }

.th__chrome {
  position: absolute;
  left: ${PAD}px; right: ${PAD}px;
  display: flex; justify-content: space-between; align-items: baseline;
}
.th__chrome--top { top: 56px; }
.th__chrome--bot { bottom: 56px; }

/* cover */
.th__title {
  position: absolute;
  top: 336px;
  left: ${PAD - 4}px;
  font-size: 246px;
  display: flex;
  flex-direction: column;
}
.th__title .row { display: inline-flex; align-items: baseline; }
.th__title .globe-o {
  position: relative;
  height: 0.72em;
  margin: 0 0.02em;
  transform: translateY(0.055em);
  --globe-fill: var(--white);
}
.th__title .globe-o::after {
  content: '';
  position: absolute;
  inset: -0.09em;
  border: 3px solid var(--blue);
  border-radius: 50%;
  opacity: 0.9;
}
.th__cover-meta {
  position: absolute;
  top: 828px;
  left: ${PAD}px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 26px;
}
.th__cover-client {
  display: flex;
  align-items: center;
  gap: 26px;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 60px;
  letter-spacing: -0.005em;
}
.th__cover-tags { display: flex; flex-wrap: wrap; gap: 13px; max-width: 950px; }

/* narrative */
.th__stagerow {
  position: absolute;
  top: 170px;
  left: ${PAD}px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.th__tab {
  padding: 8px 20px;
  background: var(--blue);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-m);
  letter-spacing: var(--tracking-tight);
  color: var(--white);
}
.on-blue .th__tab { background: var(--near-black); }
.th__headline {
  position: absolute;
  top: 268px;
  left: ${PAD - 3}px;
  font-size: 150px;
}
.th__prose {
  position: absolute;
  top: 452px;
  left: ${PAD}px;
  width: 900px;
  font-size: 60px;
}
.th__ping {
  position: absolute;
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-s);
  letter-spacing: -0.024em;
  color: var(--white);
  opacity: 0.85;
}

/* blue light-up slide */
.th--lit { background: var(--blue); }
.th--lit .th__globewm {
  position: absolute;
  left: 50%; top: 54%;
  width: 780px; height: 780px;
  transform: translate(-50%, -50%);
  opacity: 0.12;
  --globe-fill: var(--white);
}
.th--lit .th__globewm .globe { width: 100%; height: 100%; }

/* closer */
.th__core {
  position: absolute;
  left: 540px; top: 560px;
  width: 300px; height: 286px;
  transform: translate(-50%, -50%);
  --globe-fill: var(--blue);
}
.th__core .globe { width: 100%; height: 100%; }
.th__closer-title {
  position: absolute;
  top: 856px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 160px;
  text-align: center;
  white-space: nowrap;
}
.th__closer-ctas {
  position: absolute;
  top: 1052px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 20px;
}
`;
}

function chrome(series, p, n, bl, { onBlue = false } = {}) {
  return `
  <div class="th__chrome th__chrome--top">
    <span class="mono">⊙ ${esc(series.wordmark)}</span>
    <span class="mono nums">${pad2(n)} / ${pad2(series.slideCount)}</span>
  </div>
  <div class="th__chrome th__chrome--bot">
    <span class="mono">${esc(bl)}</span>
    <span class="mono">${n === 1 ? 'swipe →' : esc(series.handle)}</span>
  </div>`;
}

export function slides(p, series) {
  const out = [];
  const W = CANVAS.w;

  // 01 — cover: the Thread threads the globe-O itself. The title block
  // paints after the SVG, so the globe-O waypoint's dot tucks behind the
  // mark — the blue ring on the O (CSS) is what reads as the node.
  const coverPts = [
    [0, HANDOFF_Y],
    [150, 780],
    [298, 470],
    [620, 585],
    [880, 730],
    [W, HANDOFF_Y],
  ];
  out.push(`
<div class="slide th th--cover">
  ${fragments(`${p.slug}:cover`, 22, [[40, 300, 1000, 560], [40, 800, 1000, 320]])}
  ${threadSvg({ points: coverPts, active: -1 })}
  <h1 class="display th__title">
    <span class="row m-rise" style="--d:.1s">${globeWord('WORLD', series.globeChar)}</span>
    <span class="row m-rise" style="--d:.22s">BUILD</span>
  </h1>
  <div class="th__cover-meta">
    <div class="th__cover-client m-pop" style="--d:.55s">
      <span>${esc(p.client)}</span>
      <span class="chip nums">⊙ ${esc(p.clientType)} · ${esc(p.years)}</span>
    </div>
    <div class="th__cover-tags">${p.tags.map((t, ti) => `<span class="tag m-pop" style="--d:${(0.7 + ti * 0.07).toFixed(2)}s">${esc(t)}</span>`).join('')}</div>
  </div>
  ${chrome(series, p, 1, 'STAGE_00: signal_received')}
</div>`);

  // 02–04 — narrative stages
  const stagePts = [
    [[0, HANDOFF_Y], [230, 870], [540, 950], [820, 830], [W, HANDOFF_Y]],
    [[0, HANDOFF_Y], [330, 830], [540, 905], [750, 830], [W, HANDOFF_Y]],
    [[0, HANDOFF_Y], [380, 860], [700, 930], [W, HANDOFF_Y]],
  ];
  const pings = ['references_folded', 'core_assembled', 'world_in_motion'];
  const pingPos = [
    [590, 990],
    [590, 945],
    [750, 970],
  ];
  const fragCounts = [26, 14, 6];

  p.arc.forEach((beat, i) => {
    const lit = i === p.arc.length - 1;
    out.push(`
<div class="slide th th--n${i + 1} ${lit ? 'th--lit on-blue' : ''}">
  ${lit ? `<span class="th__globewm">${globeSvg()}</span>` : ''}
  ${fragments(`${p.slug}:n${i + 1}`, fragCounts[i], [[40, 240, 1000, 500]], { onBlue: lit })}
  ${threadSvg({ points: stagePts[i], active: 2, onBlue: lit })}
  <div class="th__stagerow">
    <span class="th__tab m-scr">${esc(beat.stage)}</span>
    <span class="chip m-scr">${esc(beat.chip)}</span>
  </div>
  <h2 class="display th__headline m-rise" style="--d:.2s">${esc(beat.headline)}</h2>
  <p class="prose th__prose m-fade" style="--d:.4s">${richText(beat.text)}</p>
  <span class="th__ping m-scr" style="left:${pingPos[i][0]}px;top:${pingPos[i][1]}px;">— ${esc(pings[i])}</span>
  ${chrome(series, p, i + 2, `${esc(beat.stage)}: ${esc(beat.chip)}`, { onBlue: lit })}
</div>`);
  });

  // 05 — closer: the Thread terminates in the assembled Core
  const closerPts = [
    [0, HANDOFF_Y],
    [240, 700],
    [418, 610],
  ];
  out.push(`
<div class="slide th th--closer">
  ${orbitRing(540, 560, 250, 14, `${p.slug}:orbit`)}
  ${threadSvg({ points: closerPts, terminal: true })}
  <span class="th__core m-fade" style="--d:.5s">${globeSvg()}</span>
  <h2 class="display th__closer-title m-rise" style="--d:.7s">YOUR WORLD NEXT</h2>
  <div class="th__closer-ctas m-pop" style="--d:.95s">
    <span class="cta-primary">${esc(series.closer.primary)}</span>
    <span class="chip">${esc(series.closer.secondary)}</span>
  </div>
  ${chrome(series, p, 5, `core_assembled: ${esc(p.slug)}`)}
</div>`);

  return out;
}
