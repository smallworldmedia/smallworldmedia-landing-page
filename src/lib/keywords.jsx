/**
 * keywords — the keyword-highlight choreography (09-08, Nathan).
 *
 * AUTHORING: wrap a keyword in double brackets inside any blurb string —
 * `"the [[core]] of your world"` — in processContent.js or straight in the
 * Sanity `description` field (plain text, no schema change). `renderKeywords`
 * turns each into a <mark class="kw"> carrying THREE layers:
 *
 *   .kw__box   the highlight box — scaleX 0 → 1 from the left
 *   .kw__base  the word in the blurb's resting ink (always present)
 *   .kw__ink   the same word in the HIGHLIGHT ink, clip-path wiped 0 → 100%
 *              in lockstep with the box — a mask that REPLACES the resting
 *              ink state with the highlighted one, left to right.
 *
 * COLOUR is per blurb via two tokens on any ancestor: `--kw-bg` (the box)
 * and `--kw-ink` (the wiped-in text). The detail page binds them to the
 * project colour + its brightness-dependent ink (--project-color /
 * --project-color-fg, projectColor.js); the process page binds them per
 * data-bg field (process.css). Defaults: electric blue / white.
 *
 * MOTION: `kwWipe(tl, root, at)` appends the wipe to a GSAP timeline —
 * every keyword launches steep and settles smooth (power3.out, no
 * overshoot), each offset KW_STAGGER_S from the last, first to last in
 * reading order. It lives on the SAME timeline as the text entrance so a
 * reverse (leave-back) retracts it in kind. Reduced motion: final state.
 */
import gsap from 'gsap';

export const KW_DURATION_S = 0.5;
export const KW_STAGGER_S = 0.09;
const KW_RE = /\[\[(.+?)\]\]/g;

/** Plain string → React nodes; keywords become <mark class="kw">. */
export function renderKeywords(text) {
  if (!text) return text;
  const out = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(KW_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <mark className="kw" key={`kw-${i++}`}>
        <span className="kw__box" aria-hidden="true" />
        <span className="kw__base">{m[1]}</span>
        <span className="kw__ink" aria-hidden="true">
          {m[1]}
        </span>
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

/** Strip the markers — for aria-labels, meta, anything that wants prose. */
export const stripKeywords = (text) => (text ? text.replace(KW_RE, '$1') : text);

/**
 * Append the wipe to `tl` at `at` for every .kw under `root`.
 * Returns the number of keywords found (0 = nothing appended).
 */
export function kwWipe(tl, root, at = 0, { duration = KW_DURATION_S, stagger = KW_STAGGER_S } = {}) {
  const marks = root ? Array.from(root.querySelectorAll('.kw')) : [];
  if (!marks.length) return 0;
  const boxes = marks.map((m) => m.querySelector('.kw__box'));
  const inks = marks.map((m) => m.querySelector('.kw__ink'));
  tl.to(boxes, { scaleX: 1, duration, stagger, ease: 'power3.out' }, at).to(
    inks,
    { clipPath: 'inset(0 0% 0 0)', duration, stagger, ease: 'power3.out' },
    at,
  );
  return marks.length;
}

/** Snap every keyword under `root` to its final (1) or resting (0) state. */
export function kwSet(root, on) {
  if (!root) return;
  gsap.set(root.querySelectorAll('.kw__box'), { scaleX: on ? 1 : 0 });
  gsap.set(root.querySelectorAll('.kw__ink'), { clipPath: on ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)' });
}
