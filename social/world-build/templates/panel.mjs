/**
 * Iteration C — DETAIL PANEL
 *
 * The /work/[slug] page's vertical rhythm compressed to 4:5 — black
 * masthead band / electric-blue ClientPanel / near-black blurb surface.
 * The most literal website extension of the four: narrative slides ARE
 * the project-blurb zone (near-black, left-set prose, detail-field pairs
 * at the foot), and the final narrative beat inverts to full blue —
 * the ClientPanel taking over the frame as the world lights up.
 */

import { globeWord, globeSvg, esc, pad2, richText } from '../lib.mjs';

export const meta = {
  key: 'panel',
  name: 'C — Detail Panel',
  oneLiner:
    'The detail page verbatim: blue ClientPanel band, near-black blurb surface, detail-field pairs — the carousel as a swipeable /work/[slug].',
};

const PAD = 56;

export function css() {
  return `
/* ---------- C: DETAIL PANEL ---------- */
.dp__band { position: absolute; left: 0; right: 0; }

/* cover bands */
.dp__mast {
  top: 0; height: 380px;
  background: var(--black);
  padding: 56px ${PAD}px 0;
}
.dp__mast-chrome { display: flex; justify-content: space-between; align-items: baseline; }
.dp__mast-title {
  position: absolute;
  bottom: 34px;
  left: ${PAD - 4}px;
  font-size: 200px;
  display: flex;
  align-items: baseline;
  white-space: pre;
}
.dp__mast-title .globe-o { height: 0.72em; margin: 0 0.02em; transform: translateY(0.055em); }

.dp__client-panel {
  top: 380px; height: 600px;
  background: var(--blue);
  padding: 44px ${PAD}px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
}
.dp__client-title {
  font-size: 258px;
  max-width: 960px;
  overflow-wrap: anywhere;
}
.dp__chips { display: flex; flex-wrap: wrap; gap: 12px; }
.dp__chips .chip { background: var(--near-black); }

.dp__foot {
  top: 980px; bottom: 0;
  background: var(--black);
  padding: 48px ${PAD}px 56px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.dp__foot-tags { display: flex; flex-wrap: wrap; gap: 14px; max-width: 100%; }
.dp__foot-chrome { display: flex; justify-content: space-between; align-items: baseline; }

/* narrative — the project-blurb surface */
.dp--n { background: var(--near-black); }
.dp__crumb {
  position: absolute; top: 56px; left: ${PAD}px;
  background: var(--black);
}
.dp__pageno { position: absolute; top: 56px; right: ${PAD}px; }
.dp__prose {
  position: absolute;
  top: 300px;
  left: ${PAD}px;
  width: 940px;
  font-size: 72px;
  line-height: 1.04;
}
.dp__details {
  position: absolute;
  bottom: 150px;
  left: ${PAD}px;
  display: flex;
  align-items: flex-end;
  gap: 72px;
}
.detail-field { display: flex; flex-direction: column; gap: 10px; white-space: nowrap; }
.detail-field__label {
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-s);
  line-height: 1;
  letter-spacing: -0.024em;
  color: var(--white);
  opacity: 0.65;
}
.detail-field__value {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 42px;
  line-height: 1;
  letter-spacing: -0.005em;
  color: var(--white);
}
.dp__rulefoot {
  position: absolute;
  bottom: 108px;
  left: ${PAD}px;
  right: ${PAD}px;
  opacity: 0.35;
}
.dp__foot-handle {
  position: absolute;
  bottom: 56px;
  left: ${PAD}px;
  right: ${PAD}px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

/* the light-up beat — full-blue ClientPanel takeover */
.dp--lit { background: var(--blue); }
.dp--lit .dp__crumb, .dp--lit .dp__pageno { background: var(--near-black); }
.dp--lit .dp__globewm {
  position: absolute;
  right: -170px;
  bottom: -190px;
  width: 640px;
  height: 640px;
  opacity: 0.16;
  --globe-fill: var(--white);
}
.dp--lit .dp__globewm .globe { width: 100%; height: 100%; }

/* closer */
.dp__closer-top {
  top: 0; height: 900px;
  background: var(--blue);
  padding: 56px ${PAD}px;
}
.dp__closer-title {
  position: absolute;
  bottom: 48px;
  left: ${PAD - 4}px;
  font-size: 230px;
  display: flex;
  flex-direction: column;
}
.dp__closer-bot {
  top: 900px; bottom: 0;
  background: var(--black);
  padding: 52px ${PAD}px 56px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.dp__ctas { display: flex; align-items: center; gap: 20px; }
.dp__credit {
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-s);
  letter-spacing: -0.024em;
  color: var(--white);
  opacity: 0.5;
}
`;
}

export function slides(p, series) {
  const out = [];
  const crumb = `↳ world_build: ${esc(p.slug)}`;

  // 01 — cover: black masthead / blue client panel / black tags
  out.push(`
<div class="slide dp dp--cover">
  <div class="dp__band dp__mast">
    <div class="dp__mast-chrome">
      <span class="mono">⊙ ${esc(series.wordmark)}</span>
      <span class="mono nums">WB_${pad2(p.no)}</span>
    </div>
    <h1 class="display dp__mast-title m-rise" style="--d:.08s">${globeWord('WORLD BUILD', series.globeChar)}</h1>
  </div>
  <div class="dp__band dp__client-panel">
    <h2 class="display dp__client-title m-rise" style="--d:.26s">${esc(p.client)}</h2>
    <div class="dp__chips m-pop" style="--d:.6s">
      <span class="chip">⊙ client_type <span style="opacity:.65">${esc(p.clientType)}</span></span>
      <span class="chip nums">est ${esc(p.years)}</span>
      <span class="chip">${esc(p.kicker.toLowerCase())}</span>
    </div>
  </div>
  <div class="dp__band dp__foot">
    <div class="dp__foot-tags">${p.tags.map((t, ti) => `<span class="tag m-pop" style="--d:${(0.72 + ti * 0.07).toFixed(2)}s">${esc(t)}</span>`).join('')}</div>
    <div class="dp__foot-chrome">
      <span class="mono">${esc(series.handle)}</span>
      <span class="mono nums">${pad2(1)} / ${pad2(series.slideCount)} · swipe →</span>
    </div>
  </div>
</div>`);

  // 02–04 — narrative (last beat lights up blue)
  p.arc.forEach((beat, i) => {
    const lit = i === p.arc.length - 1;
    out.push(`
<div class="slide dp dp--n ${lit ? 'dp--lit on-blue' : ''}">
  ${lit ? `<span class="dp__globewm">${globeSvg()}</span>` : ''}
  <span class="chip dp__crumb m-scr">${crumb}</span>
  <span class="chip dp__pageno nums">${pad2(i + 2)} / ${pad2(series.slideCount)}</span>
  <p class="prose dp__prose m-fade" style="--d:.28s">${richText(beat.text)}</p>
  <div class="dp__details m-pop" style="--d:.5s">
    <div class="detail-field">
      <span class="detail-field__label">client</span>
      <span class="detail-field__value">${esc(p.client)}</span>
    </div>
    <div class="detail-field">
      <span class="detail-field__label">date</span>
      <span class="detail-field__value nums">${esc(p.years)}</span>
    </div>
    <div class="detail-field">
      <span class="detail-field__label">stage</span>
      <span class="detail-field__value">${esc(beat.chip)}</span>
    </div>
  </div>
  <span class="rule dp__rulefoot m-draw"></span>
  <div class="dp__foot-handle">
    <span class="mono">${esc(series.handle)}</span>
    <span class="mono nums">${pad2(i + 1)} — ${esc(beat.chip)}</span>
  </div>
</div>`);
  });

  // 05 — closer: inverted cover
  out.push(`
<div class="slide dp dp--closer">
  <div class="dp__band dp__closer-top">
    <div class="dp__mast-chrome">
      <span class="chip" style="background: var(--near-black);">${crumb}</span>
      <span class="mono nums">${pad2(5)} / ${pad2(series.slideCount)}</span>
    </div>
    <h2 class="display dp__closer-title">
      <span class="m-rise" style="--d:.1s">YOUR</span>
      <span class="m-rise" style="--d:.2s">WORLD</span>
      <span class="m-rise" style="--d:.3s">NEXT</span>
    </h2>
  </div>
  <div class="dp__band dp__closer-bot">
    <div class="dp__ctas m-pop" style="--d:.55s">
      <span class="cta-primary">${esc(series.closer.primary)}</span>
      <span class="chip">${esc(series.closer.secondary)}</span>
    </div>
    <div class="dp__foot-chrome">
      <span class="mono">${esc(series.handle)} · ${esc(series.url)}</span>
      ${p.credit ? `<span class="dp__credit">${esc(p.credit.toLowerCase())}</span>` : ''}
    </div>
  </div>
</div>`);

  return out;
}
