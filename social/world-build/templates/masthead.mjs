/**
 * Iteration A — MASTHEAD
 *
 * The np-band grammar (label / rule / display title / tags) recomposed as
 * an editorial masthead. One constant: the horizon rule at y=310 runs
 * through every slide of the deck, so each swipe hands the line to the
 * next slide. Narrative slides run the info-panel emphasis pattern
 * (blue <em> inside white prose) and a giant electric-blue page index
 * cropped by the bottom edge — the number pulls the swipe forward.
 */

import { globeWord, esc, pad2, richText } from '../lib.mjs';

export const meta = {
  key: 'masthead',
  name: 'A — The Masthead',
  oneLiner:
    'np-band editorial grammar: mono label, horizon rule, stacked squeezed display, giant blue page numbers bleeding off-canvas.',
};

const RULE_Y = 310;
const PAD = 64;

export function css() {
  return `
/* ---------- A: MASTHEAD ---------- */
.mh { padding: ${PAD}px; }

.mh__chrome-top, .mh__chrome-bot {
  position: absolute;
  left: ${PAD}px;
  right: ${PAD}px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.mh__chrome-top { top: 56px; }
.mh__chrome-bot { bottom: 56px; }

.mh__rule {
  position: absolute;
  top: ${RULE_Y}px;
  left: ${PAD}px;
  right: ${PAD}px;
}

.mh__label {
  position: absolute;
  top: ${RULE_Y - 46}px;
  left: ${PAD}px;
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-l);
  line-height: 0.92;
  letter-spacing: var(--tracking-tight);
  color: var(--white);
}

/* cover */
.mh__title {
  position: absolute;
  top: ${RULE_Y + 58}px;
  left: ${PAD - 6}px;
  font-size: 292px;
  display: flex;
  flex-direction: column;
}
.mh__title .globe-o { height: 0.72em; margin: 0 0.015em; transform: translateY(0.055em); }
.mh__title .row { display: inline-flex; align-items: baseline; }
.mh__client {
  position: absolute;
  top: 1004px;
  left: ${PAD}px;
  right: ${PAD}px;
  display: flex;
  align-items: center;
  gap: 28px;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 64px;
  letter-spacing: -0.005em;
}
.mh__tags {
  position: absolute;
  top: 1124px;
  left: ${PAD}px;
  right: ${PAD}px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

/* narrative */
.mh__prose {
  position: absolute;
  top: ${RULE_Y + 76}px;
  left: ${PAD}px;
  width: 900px;
  font-size: 71px;
}
.mh__index {
  position: absolute;
  right: ${PAD - 10}px;
  bottom: -74px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 400px;
  line-height: 0.78;
  letter-spacing: -0.005em;
  color: var(--blue);
  font-variant-numeric: tabular-nums;
}
.mh__stagechip {
  position: absolute;
  top: ${RULE_Y + 24}px;
  right: ${PAD}px;
}

/* closer */
.mh__closer-title {
  position: absolute;
  top: ${RULE_Y + 58}px;
  left: ${PAD - 4}px;
  font-size: 218px;
  display: flex;
  flex-direction: column;
  color: var(--blue); /* np-band pinned state */
}
.mh__closer-line {
  position: absolute;
  top: 900px;
  left: ${PAD}px;
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 46px;
  letter-spacing: -0.005em;
}
.mh__ctas {
  position: absolute;
  top: 1010px;
  left: ${PAD}px;
  display: flex;
  align-items: center;
  gap: 22px;
}
.mh--pinned .mh__rule { background: var(--blue); }
`;
}

// rightSlot:false leaves the bottom-right corner to the giant page index
// on narrative slides (the chrome would collide with the digit's crop).
function chrome(series, p, n, { rightSlot = true } = {}) {
  return `
  <div class="mh__chrome-top">
    <span class="mono">⊙ ${esc(series.wordmark)}</span>
    <span class="mono nums">WB_${pad2(p.no)} — ${esc(p.slug)}</span>
  </div>
  <div class="mh__chrome-bot">
    <span class="mono">${esc(series.handle)}</span>
    ${rightSlot ? `<span class="mono nums">${pad2(n)} / ${pad2(series.slideCount)}${n === 1 ? '&ensp;·&ensp;swipe →' : ''}</span>` : ''}
  </div>`;
}

export function slides(p, series) {
  const out = [];

  // 01 — cover
  out.push(`
<div class="slide mh mh--cover">
  ${chrome(series, p, 1)}
  <div class="mh__label m-scr">world_build: ${esc(p.kicker.toLowerCase())}</div>
  <span class="rule mh__rule m-draw"></span>
  <h1 class="display mh__title">
    <span class="row m-rise" style="--d:.1s">${globeWord('WORLD', series.globeChar)}</span>
    <span class="row m-rise" style="--d:.22s">BUILD</span>
  </h1>
  <div class="mh__client m-pop" style="--d:.55s">
    <span>${esc(p.client)}</span>
    <span class="chip nums">⊙ ${esc(p.clientType)}</span>
    <span class="chip nums">${esc(p.years)}</span>
  </div>
  <div class="mh__tags">${p.tags.map((t, ti) => `<span class="tag m-pop" style="--d:${(0.72 + ti * 0.07).toFixed(2)}s">${esc(t)}</span>`).join('')}</div>
</div>`);

  // 02–04 — narrative
  p.arc.forEach((beat, i) => {
    out.push(`
<div class="slide mh mh--n${i + 1}">
  ${chrome(series, p, i + 2, { rightSlot: false })}
  <div class="mh__label m-scr">${pad2(i + 1)} — ${esc(beat.chip)}</div>
  <span class="rule mh__rule m-draw"></span>
  <span class="chip mh__stagechip m-pop" style="--d:.4s">${esc(p.slug)}</span>
  <p class="prose mh__prose m-fade" style="--d:.3s">${richText(beat.text, { em: true })}</p>
  <div class="mh__index nums m-rise" style="--d:.45s">${pad2(i + 1)}</div>
</div>`);
  });

  // 05 — closer
  out.push(`
<div class="slide mh mh--pinned">
  ${chrome(series, p, 5)}
  <div class="mh__label m-scr">next_world</div>
  <span class="rule mh__rule m-draw"></span>
  <h2 class="display mh__closer-title">
    <span class="m-rise" style="--d:.1s">YOUR</span>
    <span class="m-rise" style="--d:.22s">WORLD NEXT</span>
  </h2>
  <p class="mh__closer-line m-fade" style="--d:.5s">${esc(series.closer.line)} See the full world on ${esc(series.url)}.</p>
  <div class="mh__ctas m-pop" style="--d:.68s">
    <span class="cta-primary">${esc(series.closer.primary)}</span>
    <span class="chip">${esc(series.closer.secondary)}</span>
  </div>
</div>`);

  return out;
}
