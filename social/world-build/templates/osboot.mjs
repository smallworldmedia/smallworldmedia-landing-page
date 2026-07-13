/**
 * Iteration B — PROJECT_## (OS BOOT)
 *
 * The /work World identity card as a slide: PROJECT_## blue tab, centered
 * squeezed display, fp-tag white pills, enter_world primary CTA. Narrative
 * slides read as a boot log — a mono status line with a block-character
 * progress meter (the scramble charset: ░▒▓█) filling as the deck advances,
 * so the swipe literally loads the world.
 */

import { globeWord, esc, pad2, richText } from '../lib.mjs';

export const meta = {
  key: 'osboot',
  name: 'B — Project_## (OS Boot)',
  oneLiner:
    'The World identity card grammar: blue PROJECT_## tab, centered display, white fp-tags, a block-meter boot log that fills as you swipe.',
};

const PAD = 64;

/** Block progress meter — ten cells of the house scramble charset. */
function meter(frac) {
  const cells = 10;
  const full = Math.round(frac * cells);
  return '█'.repeat(full) + '░'.repeat(cells - full);
}

export function css() {
  return `
/* ---------- B: OS BOOT ---------- */
.ob { display: flex; align-items: center; justify-content: center; }

.ob__corner {
  position: absolute;
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-s);
  letter-spacing: -0.024em;
  color: var(--white);
  opacity: 0.85;
}
.ob__corner--tl { top: 56px; left: ${PAD}px; }
.ob__corner--tr { top: 56px; right: ${PAD}px; text-align: right; }
.ob__corner--bl { bottom: 56px; left: ${PAD}px; }
.ob__corner--br { bottom: 56px; right: ${PAD}px; text-align: right; }

.ob__group {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0;
}
.ob__tab {
  align-self: flex-start;
  margin-left: 8px;
  margin-bottom: 34px;
  padding: 8px 20px;
  background: var(--blue);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-m);
  letter-spacing: var(--tracking-tight);
  color: var(--white);
}
.ob__tab--center { align-self: center; margin-left: 0; }

.ob__title {
  font-size: 236px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ob__title .row { display: inline-flex; align-items: baseline; }
.ob__title .globe-o { height: 0.72em; margin: 0 0.02em; transform: translateY(0.055em); }

.ob__client {
  margin-top: 44px;
  display: flex;
  align-items: baseline;
  gap: 24px;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 58px;
  letter-spacing: -0.005em;
}
.ob__client .mono { font-size: var(--mono-m); opacity: 0.7; }
.ob__tags {
  margin-top: 46px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  max-width: 900px;
}
.ob__cue {
  position: absolute;
  bottom: 132px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-m);
  letter-spacing: var(--tracking-tight);
  color: var(--white);
  opacity: 0.85;
}

/* narrative */
.ob__log {
  position: absolute;
  top: 190px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-m);
  letter-spacing: -0.024em;
  color: var(--white);
}
.ob__log .dim { opacity: 0.55; }
.ob__meter { color: var(--blue); font-size: var(--mono-l); letter-spacing: 0.08em; }
.on-blue .ob__meter { color: var(--white); }

.ob__prose {
  width: 830px;
  text-align: center;
  font-size: 64px;
  line-height: 1.1;
}
.ob__pageno {
  position: absolute;
  bottom: 150px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 20px;
  background: var(--blue);
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: var(--mono-m);
  letter-spacing: var(--tracking-tight);
  color: var(--white);
}

/* closer */
.ob__closer-title {
  font-size: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ob__cta { margin-top: 60px; }
.ob__next {
  margin-top: 46px;
}
`;
}

function corners(series, p, n, note) {
  return `
  <div class="ob__corner ob__corner--tl">swm_os / world_build</div>
  <div class="ob__corner ob__corner--tr nums">[ ${pad2(n)} / ${pad2(series.slideCount)} ]</div>
  <div class="ob__corner ob__corner--bl">${esc(note)}</div>
  <div class="ob__corner ob__corner--br">${esc(series.handle)}</div>`;
}

export function slides(p, series) {
  const out = [];

  // 01 — cover
  out.push(`
<div class="slide ob ob--cover">
  ${corners(series, p, 1, `sig_lock: ${p.slug}`)}
  <div class="ob__group">
    <span class="ob__tab m-scr">PROJECT_${pad2(p.no)}</span>
    <h1 class="display ob__title">
      <span class="row m-rise" style="--d:.12s">${globeWord('WORLD', series.globeChar)}</span>
      <span class="row m-rise" style="--d:.24s">BUILD</span>
    </h1>
    <div class="ob__client m-pop" style="--d:.58s">
      <span>${esc(p.client)}</span>
      <span class="mono nums">⊙ ${esc(p.clientType)} · ${esc(p.years)}</span>
    </div>
    <div class="ob__tags">${p.tags.map((t, ti) => `<span class="tag tag--fp m-pop" style="--d:${(0.74 + ti * 0.07).toFixed(2)}s">${esc(t)}</span>`).join('')}</div>
  </div>
  <div class="ob__cue m-fade" style="--d:1.15s">swipe_to_enter →</div>
</div>`);

  // 02–04 — narrative boot log
  p.arc.forEach((beat, i) => {
    const frac = (i + 2) / series.slideCount;
    out.push(`
<div class="slide ob ob--n${i + 1}">
  ${corners(series, p, i + 2, `sig_lock: ${p.slug}`)}
  <div class="ob__log">
    <span class="dim m-scr">&gt; loading_world: ${esc(p.slug)}</span>
    <span class="m-scr">&gt; ${esc(beat.stage.toLowerCase())}: ${esc(beat.chip)}</span>
    <span class="ob__meter nums m-scr">[${meter(frac)}]</span>
  </div>
  <p class="prose ob__prose m-fade" style="--d:.35s">${richText(beat.text)}</p>
  <span class="ob__pageno nums m-pop" style="--d:.5s">${pad2(i + 2)} / ${pad2(series.slideCount)}</span>
</div>`);
  });

  // 05 — closer
  out.push(`
<div class="slide ob ob--closer">
  ${corners(series, p, 5, 'world_complete')}
  <div class="ob__group">
    <span class="ob__tab ob__tab--center m-scr">PROJECT_${pad2(p.no)} — ${esc(p.slug)}</span>
    <h2 class="display ob__closer-title">
      <span class="row m-rise" style="--d:.12s">YOUR WORLD</span>
      <span class="row m-rise" style="--d:.24s">NEXT</span>
    </h2>
    <div class="ob__log" style="position: static; transform: none; margin-top: 44px;">
      <span class="ob__meter nums m-scr">[${meter(1)}]</span>
      <span class="dim">world_complete · ${esc(p.years)}</span>
    </div>
    <span class="cta-primary ob__cta m-pop" style="--d:.7s">${esc(series.closer.primary)}</span>
    <span class="chip ob__next m-pop" style="--d:.84s">next_up: project_${pad2(p.no + 1)} — ${esc(p.next)}</span>
  </div>
</div>`);

  return out;
}
