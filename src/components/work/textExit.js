/**
 * textExit.js — the DOM text choreography that rides the enter_world commit
 * (08-26, Nathan): as the WebGL scene dives into the world (enterTune.js),
 * the card + nav text elements animate OUT to sell the push-in, plus the
 * TEXT_TUNABLES live store its ?texttune=1 bench (TextTunePanel) writes.
 *
 * Fired by the same 'swm:enter-world' event the scene answers (listener
 * armed in FeaturedProjects). What plays, from t=0:
 *
 *   · SERVICE TAGS + CLIENT-NAME LETTERS — HARD CUTS (plain visibility
 *     writes, no fades) in RANDOM order, one every tagCutMs / charCutMs.
 *     The name is SplitText-split into chars AT FIRE TIME (client:only
 *     stale-DOM trap — never cache island DOM from mount effects).
 *   · PROJECT_## TAB — clipped away top → bottom edge over tabMs after
 *     tabDelayMs (clip-path inset, top edge eats downward).
 *   · [PREVIOUS] — wipes bottom → up (exits out the top of its slot);
 *     [NEXT] — wipes top → down (exits out the bottom); navMs after
 *     navDelayMs. Both on the enter curve (powInOut of ENTER_TUNABLES.pow).
 *   · SCALE — the whole card block (tab + name + meta + CTA + tags) and the
 *     prev/next chips ride the SAME master timeline + move channel as the
 *     scene's zoom/dolly ([moveStart, moveEnd] × pow from ENTER_TUNABLES),
 *     scaling to cardScale / navScale — one push-in, WebGL and DOM together.
 *     Nav chips scale through --tx-scale (multiplied into .fp-cta's
 *     transform) with their CSS transition suspended, so the per-frame
 *     writes aren't low-passed by the drag-mode 0.12s transform ease.
 *
 * dryRun (the benches' ▶): mirrors the scene — full ramp, hold holdMs,
 * unwind the scale over 0.6s, then restore every cut/clip/split instantly.
 * A real commit never restores (the ClientRouter swap replaces the DOM).
 */
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ENTER_TUNABLES, powInOut, seg } from './world/enterTune.js';

gsap.registerPlugin(SplitText);

const search = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const TEXT_TUNE_DEFAULTS = Object.freeze({
  tagCutMs: 60, // interval between service-tag hard cuts (random order), ms
  charCutMs: 35, // interval between client-name letter cuts (random order), ms
  tabDelayMs: 0, // wait before the PROJECT_## clip begins, ms
  tabMs: 240, // PROJECT_## clip duration (top edge eats downward), ms
  navDelayMs: 0, // wait before the prev/next wipes begin, ms
  navMs: 300, // prev/next wipe duration (prev exits up, next exits down), ms
  cardScale: 1.8, // card block scale destination (rides the enter move channel)
  navScale: 1.35, // prev/next chip scale destination (same channel)
});

const PARAM_KEYS = {
  tagCutMs: 'txtag',
  charCutMs: 'txchar',
  tabDelayMs: 'txtabdelay',
  tabMs: 'txtab',
  navDelayMs: 'txnavdelay',
  navMs: 'txnav',
  cardScale: 'txcard',
  navScale: 'txnavscale',
};

// Live, mutable tuning state (the panel writes; runTextExit reads at fire time).
export const TEXT_TUNABLES = { ...TEXT_TUNE_DEFAULTS };

// Seed from the URL — always, not just under ?texttune (house convention).
if (typeof window !== 'undefined') {
  const p = search();
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const n = parseFloat(p.get(param));
    if (Number.isFinite(n)) TEXT_TUNABLES[key] = n;
  }
}

/* pub/sub — bench fields only (the choreography reads live at fire time). */
const subs = new Set();
export function subscribeTextTune(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function setTextTune(key, value) {
  if (TEXT_TUNABLES[key] === value) return;
  TEXT_TUNABLES[key] = value;
  subs.forEach((fn) => fn());
}
export function resetTextTune() {
  Object.assign(TEXT_TUNABLES, TEXT_TUNE_DEFAULTS);
  subs.forEach((fn) => fn());
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;

/** Shareable tuning URL — texttune=1 plus only the off-default params. */
export function textTuneCopyUrl() {
  const p = new URLSearchParams(window.location.search);
  p.set('texttune', '1');
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    if (Math.abs(TEXT_TUNABLES[key] - TEXT_TUNE_DEFAULTS[key]) > 1e-9) {
      p.set(param, String(round4(TEXT_TUNABLES[key])));
    } else {
      p.delete(param);
    }
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// One run at a time: a re-fire (double dry-run) tears the previous run down
// to its restored state first, so cuts/splits never stack.
let activeRun = null;

export function cancelTextExit() {
  activeRun?.restore();
  activeRun = null;
}

/**
 * Play the text-exit choreography. `duration` seconds (defaults to the
 * enter store's enterMs), `dryRun` restores everything after the unwind.
 */
export function runTextExit({ duration, dryRun = false } = {}) {
  cancelTextExit();

  // Query at fire time (client:only stale-DOM trap): the active entering
  // card + the fixed nav chips, as they exist THIS run.
  const wrap = document.querySelector('.fp-card-wrap[data-phase="enter"]');
  const tab = wrap?.querySelector('.fp-card__tab') || null;
  const client = wrap?.querySelector('.fp-card__client') || null;
  const tags = wrap ? Array.from(wrap.querySelectorAll('.fp-tag')) : [];
  const prev = document.querySelector('.fp-prev');
  const next = document.querySelector('.fp-next');
  const navEls = [prev, next].filter(Boolean);
  if (!wrap && !navEls.length) return;

  const T = TEXT_TUNABLES;
  const E = ENTER_TUNABLES;
  const durS = duration ?? E.enterMs / 1000;
  const enterEase = (t) => powInOut(t, E.pow); // the house enter curve

  const tweens = [];
  const calls = [];
  const cutEls = [];

  // Client name → chars, split now, cut in random order (plain style writes
  // + delayedCall clocks — the Hero lockup-beat convention; gsap.set
  // visibility was observed not to stick for hard cuts).
  let split = null;
  if (client) {
    // words,chars — NOT chars alone (08-31, Nathan's report: chars-only
    // splitting drops the inter-word spaces, so a two-line name like
    // HEAVY HOUSE SOCIETY lost its wrap points and collapsed to one line
    // mid-exit; word wrappers preserve the resting line geometry).
    split = SplitText.create(client, { type: 'words,chars' });
  }
  const scheduleCuts = (els, stepMs) => {
    shuffle(els).forEach((el, i) => {
      calls.push(
        gsap.delayedCall((i * stepMs) / 1000, () => {
          el.style.visibility = 'hidden';
          cutEls.push(el);
        })
      );
    });
  };
  if (tags.length) scheduleCuts([...tags], T.tagCutMs);
  if (split?.chars?.length) scheduleCuts([...split.chars], T.charCutMs);

  // PROJECT_## tab — clip away top → bottom (the top inset eats downward).
  if (tab) {
    tweens.push(
      gsap.fromTo(
        tab,
        { clipPath: 'inset(0% 0% 0% 0%)' },
        {
          clipPath: 'inset(100% 0% 0% 0%)',
          duration: T.tabMs / 1000,
          delay: T.tabDelayMs / 1000,
          ease: enterEase,
        }
      )
    );
  }

  // Nav wipes — prev exits up (bottom inset eats upward), next exits down.
  const wipe = (el, to) =>
    tweens.push(
      gsap.fromTo(
        el,
        { clipPath: 'inset(0% 0% 0% 0%)' },
        { clipPath: to, duration: T.navMs / 1000, delay: T.navDelayMs / 1000, ease: enterEase }
      )
    );
  if (prev) wipe(prev, 'inset(0% 0% 100% 0%)');
  if (next) wipe(next, 'inset(100% 0% 0% 0%)');

  // Scale — the SAME master timeline + move channel as the scene's zoom/dolly
  // (linear master, window + pow from ENTER_TUNABLES), so DOM and WebGL push
  // in as one. Nav transitions suspended: the 0.12s drag-mode transform ease
  // would low-pass the per-frame --tx-scale writes.
  for (const el of navEls) el.style.transition = 'none';
  const prog = { p: 0 };
  const applyScale = () => {
    const m = powInOut(seg(prog.p, E.moveStart, E.moveEnd), E.pow);
    if (wrap) gsap.set(wrap, { scale: 1 + (T.cardScale - 1) * m });
    const nav = String(1 + (T.navScale - 1) * m);
    for (const el of navEls) el.style.setProperty('--tx-scale', nav);
  };
  const master = gsap.to(prog, {
    p: 1,
    duration: durS,
    ease: 'none',
    onUpdate: applyScale,
    onComplete: dryRun
      ? () => {
          // Mirror the scene's dry-run return: hold, unwind the scale, then
          // restore every cut/clip/split so the next ▶ starts clean.
          calls.forEach((c) => c.kill()); // cuts that outlive the ramp stop here
          tweens.push(
            gsap.to(prog, {
              p: 0,
              duration: 0.6,
              delay: E.holdMs / 1000,
              ease: 'expo.out',
              onUpdate: applyScale,
              onComplete: () => activeRun?.restore(),
            })
          );
        }
      : undefined,
  });
  tweens.push(master);

  activeRun = {
    restore() {
      calls.forEach((c) => c.kill());
      tweens.forEach((t) => t.kill());
      for (const el of cutEls) el.style.visibility = '';
      cutEls.length = 0;
      if (tab) gsap.set(tab, { clearProps: 'clipPath' });
      for (const el of navEls) {
        gsap.set(el, { clearProps: 'clipPath' });
        el.style.removeProperty('--tx-scale');
        el.style.transition = '';
      }
      if (wrap) gsap.set(wrap, { scale: 1 });
      split?.revert();
      activeRun = null;
    },
  };
}
