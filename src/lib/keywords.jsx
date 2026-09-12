/**
 * keywords — the keyword-highlight choreography (09-08, Nathan).
 *
 * AUTHORING: wrap a keyword in double brackets inside any blurb string —
 * `"the [[core]] of your world"` — in processContent.js or straight in the
 * Sanity `description` field (plain text, no schema change). LINKS (09-10,
 * Nathan — cross-linking projects/clients from a blurb) are markdown-style:
 * `[HHS](/work/heavy-house-society-branding-2024-2025)` is a plain underlined
 * link, `[[HHS]](/work/…)` a highlighted keyword that is ALSO a link (the box
 * is the affordance; hover lifts it). Internal `/…` hrefs ride ClientRouter;
 * anything else opens in a new tab. `renderKeywords`
 * turns each keyword into a <mark class="kw"> carrying THREE layers:
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
import { Fragment } from 'react';
import gsap from 'gsap';

export const KW_DURATION_S = 0.5;
export const KW_STAGGER_S = 0.09;
/** Fraction of KW_STAGGER_S between the word fragments of ONE keyword. */
export const KW_FRAG_STAGGER = 0.4;
// A keyword absorbs the punctuation glued to it (`[[audience]],` → the
// comma rides inside the box) — 09-08 (Nathan): a comma left outside gets
// lost in the gap between two highlights.
// One pass, two shapes: `[[keyword]]` (+ optional `(href)`), or `[label](href)`.
const KW_RE = /\[\[(.+?)\]\]([,.;:!?…]*)(?:\(([^\s()]+)\))?|\[([^[\]]+?)\]\(([^\s()]+)\)/g;

const isInternal = (href) => href.startsWith('/') || href.startsWith('#');

/** A prose link: internal hrefs soft-navigate (ClientRouter), external open in a new tab. */
function linkTo(href, className, children, key) {
  const external = !isInternal(href);
  return (
    <a
      className={className}
      href={href}
      key={key}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

/** Plain string → React nodes; keywords become <mark class="kw">, links <a>. */
export function renderKeywords(text) {
  if (!text) return text;
  const out = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(KW_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `kw-${i++}`;
    if (m[4] !== undefined) {
      out.push(linkTo(m[5], 'prose-link', m[4], key));
    } else {
      const word = m[1] + (m[2] || '');
      // One inline-block per WORD so a long keyword wraps at word boundaries
      // like plain prose (09-10, Nathan). Each fragment keeps its trailing
      // space INSIDE the box (white-space: pre) so the highlight stays
      // continuous across the gap; a zero-width space between fragments is
      // the break opportunity. The wipe staggers fragment to fragment, so a
      // phrase still reads as one left-to-right sweep.
      const tokens = word.split(' ');
      const mark = tokens.map((tok, t) => {
        const frag = t < tokens.length - 1 ? `${tok} ` : tok;
        return (
          <Fragment key={`${key}-${t}`}>
            {t > 0 && '\u200B'}
            <mark className="kw" data-kw={i}>
              <span className="kw__box" aria-hidden="true" />
              <span className="kw__base">{frag}</span>
              <span className="kw__ink" aria-hidden="true">
                {frag}
              </span>
            </mark>
          </Fragment>
        );
      });
      out.push(m[3] ? linkTo(m[3], 'kw-link', mark, key) : <Fragment key={key}>{mark}</Fragment>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

/** Strip the markers — for aria-labels, meta, anything that wants prose. */
export const stripKeywords = (text) =>
  text ? text.replace(KW_RE, (_, kw, punct, _href, label) => (label !== undefined ? label : kw + (punct || ''))) : text;

/**
 * Append the wipe to `tl` at `at` for every .kw under `root`.
 * Returns the number of keywords found (0 = nothing appended).
 */
export function kwWipe(tl, root, at = 0, { duration = KW_DURATION_S, stagger = KW_STAGGER_S } = {}) {
  const marks = root ? Array.from(root.querySelectorAll('.kw')) : [];
  if (!marks.length) return 0;
  const boxes = marks.map((m) => m.querySelector('.kw__box'));
  const inks = marks.map((m) => m.querySelector('.kw__ink'));
  // `stagger` is the beat between KEYWORDS; the word fragments of one
  // keyword (same data-kw) chain much tighter so a phrase reads as one
  // sweep and a long blurb doesn't take seconds to settle.
  const fragStagger = stagger * KW_FRAG_STAGGER;
  const delays = [];
  let group = null;
  let groupAt = -stagger;
  let frag = 0;
  for (const m of marks) {
    if (m.dataset.kw !== group) {
      group = m.dataset.kw;
      groupAt += stagger;
      frag = 0;
    } else {
      frag += 1;
    }
    delays.push(groupAt + frag * fragStagger);
  }
  const each = (i) => delays[i];
  tl.to(boxes, { scaleX: 1, duration, stagger: each, ease: 'power3.out' }, at).to(
    inks,
    { clipPath: 'inset(-0.35em 0% -0.35em 0)', duration, stagger: each, ease: 'power3.out' },
    at,
  );
  return marks.length;
}

/** Snap every keyword under `root` to its final (1) or resting (0) state. */
export function kwSet(root, on) {
  if (!root) return;
  gsap.set(root.querySelectorAll('.kw__box'), { scaleX: on ? 1 : 0 });
  gsap.set(root.querySelectorAll('.kw__ink'), { clipPath: on ? 'inset(-0.35em 0% -0.35em 0)' : 'inset(-0.35em 100% -0.35em 0)' });
}
