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
// One pass, three shapes: `[[keyword]]` (+ optional `(href)`), `[label](href)`,
// or `**bold**` (10-08, Nathan) — the weight marker, added when the footer and
// tagline copy moved into Sanity. Until then the Medium opening cut was
// POSITIONAL (`LONG_EM_WORDS = 3` in SiteTagline), which cannot survive copy
// an editor can reword. It is a mark, not a highlight: no box, no wipe, no
// driver needed, so a surface that renders it without running kwWipe is still
// correct. Markers do NOT nest — `**[[a]]**` renders literally.
const KW_RE =
  /\[\[(.+?)\]\]([,.;:!?…]*)(?:\(([^\s()]+)\))?|\[([^[\]]+?)\]\(([^\s()]+)\)|\*\*(.+?)\*\*/g;

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
    if (m[6] !== undefined) {
      out.push(
        <b className="kw-em" key={key}>
          {m[6]}
        </b>
      );
    } else if (m[4] !== undefined) {
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
  text
    ? // The parameter list must name EVERY capture group in order — the bold
      // group is the 6th, after the link's href. Skipping one silently shifts
      // `bold` onto the href and a `**bold**` match falls through to the
      // keyword branch, which renders the string "undefined".
      text.replace(KW_RE, (_, kw, punct, _kwHref, label, _linkHref, bold) => {
        if (bold !== undefined) return bold;
        if (label !== undefined) return label;
        return kw + (punct || '');
      })
    : text;

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

/**
 * Marked string → per-WORD tokens, for surfaces that animate word by word.
 *
 * WHY A SECOND RENDERER (10-08): `renderKeywords` emits prose — marks and raw
 * strings. The footer blurb and the tagline pill animate each word on its own
 * (`.site-footer__blurb-word`, `.site-tagline__word`), so they need the words
 * BEFORE the markup, not nested inside it. One parser, two shapes: the grammar,
 * the punctuation rule and the `data-kw` reading order are shared, so copy
 * behaves the same whichever surface renders it.
 *
 * Returns one array per LINE — a newline in the CMS field is a line break, which
 * is how the pill's two-line lockup survives an editor rewording it. Each token:
 *
 *   text      what to draw (a kw fragment keeps its trailing space — see below)
 *   sep       what to emit BEFORE it, OUTSIDE any mark: '' | ' ' | '​'
 *   em        inside `**…**` → the Medium cut
 *   kw        inside `[[…]]` → wrap in the three-layer <mark class="kw">
 *   kwIndex   the data-kw group, counted across the whole string in reading
 *             order, so kwWipe's per-keyword stagger is unchanged
 *   href      a link target, from `[[kw]](href)` or `[label](href)`
 *
 * THE SPACE RULE IS THE SAME ONE renderKeywords USES, for the same reason: a
 * multi-word keyword's non-final fragments carry their trailing space inside
 * the box (`white-space: pre`) so the highlight stays continuous across the
 * gap, and the fragments are separated by a zero-width space, which is the
 * break opportunity. Separators are reproduced from the SOURCE, so `a[[b]]`
 * stays glued and `a [[b]]` keeps its space.
 */
export function keywordLines(text) {
  if (!text) return [];
  let kwIndex = 0;
  return text.split('\n').map((line) => {
    const out = [];
    let needSpace = false;
    let last = 0;
    const push = (tok) => out.push(tok);
    // A run of unmarked prose: one token per word, separators from the source.
    const plain = (run, flags) => {
      // BOTH EDGES COME FROM THE SOURCE. A run's own leading whitespace is the
      // separator after the marker that preceded it — read it before emitting,
      // or `**Small World Media** is` loses the space and reads "Mediais".
      if (/^\s/.test(run)) needSpace = true;
      const words = run.trim().split(/\s+/).filter(Boolean);
      words.forEach((w, j) => {
        push({ text: w, sep: j === 0 && !needSpace ? '' : ' ', em: false, kw: false, ...flags });
        needSpace = true;
      });
      needSpace = words.length ? /\s$/.test(run) : needSpace || /\s/.test(run);
    };
    for (const m of line.matchAll(KW_RE)) {
      if (m.index > last) plain(line.slice(last, m.index));
      if (m[6] !== undefined) {
        // `**bold**` — ordinary words that happen to carry the weight.
        const words = m[6].trim().split(/\s+/).filter(Boolean);
        words.forEach((w, j) => {
          push({ text: w, sep: j === 0 && !needSpace ? '' : ' ', em: true, kw: false });
        });
      } else if (m[4] !== undefined) {
        // `[label](href)` — a per-word link. Multi-word labels become one <a>
        // per word; the underline still reads as one run because the words sit
        // on the same baseline with a plain space between them.
        const words = m[4].trim().split(/\s+/).filter(Boolean);
        words.forEach((w, j) => {
          push({ text: w, sep: j === 0 && !needSpace ? '' : ' ', em: false, kw: false, href: m[5] });
        });
      } else {
        const ix = kwIndex++;
        const frags = (m[1] + (m[2] || '')).split(' ');
        frags.forEach((f, t) => {
          push({
            text: t < frags.length - 1 ? `${f} ` : f,
            sep: t === 0 ? (needSpace ? ' ' : '') : '​',
            em: false,
            kw: true,
            kwIndex: ix,
            ...(m[3] ? { href: m[3] } : {}),
          });
        });
      }
      needSpace = false;
      last = m.index + m[0].length;
    }
    if (last < line.length) plain(line.slice(last));
    return out;
  });
}

/** The same tokens, flattened — for a surface with no line structure. */
export const keywordWords = (text) => keywordLines(text).flat();

/**
 * One line of `keywordLines()` tokens → word spans, for the animated surfaces.
 *
 * The three callers (the footer blurb, the tagline pill, the mobile menu) each
 * have their own word class and their own Medium class, but the markup inside
 * a word is identical — and has to be, because `kwWipe` finds its targets by
 * `.kw__box` / `.kw__ink` and staggers by `data-kw`. So the class names are
 * arguments and the structure lives here.
 *
 * The separator is emitted OUTSIDE the span, from the token, so a keyword's
 * fragments stay glued by a zero-width space and plain words keep their real
 * one — the same rule `renderKeywords` follows.
 */
export function renderWordTokens(
  tokens,
  { wordClass, emClass, keyPrefix = 'w', separators = true }
) {
  return tokens.map((tok, i) => {
    const inner = tok.kw ? (
      <mark className="kw" data-kw={tok.kwIndex}>
        <span className="kw__box" aria-hidden="true" />
        <span className="kw__base">{tok.text}</span>
        <span className="kw__ink" aria-hidden="true">
          {tok.text}
        </span>
      </mark>
    ) : (
      tok.text
    );
    return (
      <Fragment key={`${keyPrefix}-${i}`}>
        {/* `separators: false` for a surface that spaces its words in CSS
            instead of with text — the tagline pill's short layer puts a margin
            between words so the capsule can track them. A keyword fragment
            still carries its own trailing space inside the box, so a phrase
            stays continuous there too. */}
        {separators ? tok.sep : null}
        <span className={`${wordClass}${tok.em && emClass ? ` ${emClass}` : ''}`}>
          {tok.href ? linkTo(tok.href, tok.kw ? 'kw-link' : 'prose-link', inner) : inner}
        </span>
      </Fragment>
    );
  });
}
