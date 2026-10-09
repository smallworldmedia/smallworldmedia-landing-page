/**
 * siteCopy — the site-wide studio copy, from Sanity (10-08, Nathan).
 *
 * The footer blurb and the tagline used to be hard-coded word arrays in
 * SiteTagline.jsx (`TAGLINE_LONG_LINES`, `TAGLINE_LINES`). They are now two
 * fields on the `siteSettings` singleton, written in the house marker format
 * (src/lib/keywords.jsx): `**bold**`, `[[highlight]]`, `[[highlight]](/href)`,
 * `[label](/href)`. A newline is a LINE BREAK — that is how the tagline pill's
 * three-line lockup survives an editor rewording it.
 *
 * WHY PROPS AND NOT A MODULE LOOKUP: the consumers are React islands, two of
 * them `transition:persist`. A module-level value set in .astro frontmatter is
 * visible on the SERVER only — the island's client bundle would hydrate with
 * the build-time default and React would see a mismatch, flashing the old copy.
 * So the strings travel as serialized props from the .astro files that mount
 * the islands, and this module's job is to make that cheap: ONE fetch for the
 * whole build.
 *
 * THE FETCH IS MEMOIZED ON THE PROMISE, not the result. BaseLayout runs its
 * frontmatter once per page — 23 pages at the last count — and index.astro
 * needs the same copy for Hero's footer. Caching the promise means the second
 * caller awaits the first request instead of issuing its own.
 *
 * IT CANNOT FAIL THE BUILD. A network error, a missing singleton or an empty
 * field each fall back to the strings below, which are the copy as it shipped,
 * so a Sanity outage degrades to the current site rather than to blank chrome.
 */
import { sanityFetch } from './sanityClient.js';
import { SITE_COPY_QUERY } from './queries.js';

/** The copy as of 10-08 — also the no-Sanity fallback. */
export const SITE_COPY_FALLBACK = Object.freeze({
  footerBlurb:
    '**Small World Media** is a multidisciplinary [[creative studio]] that builds ' +
    'high-impact [[brand worlds]] and [[visuals]] for the music industry.',
  // Three lines, as the pill sets them; line 1 carries the Medium cut.
  tagline: '**VISUAL WORLDS**\nfor the music\nindustry.',
});

const clean = (v, fallback) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || fallback;
};

let pending = null;

/**
 * The site copy, shaped `{ footerBlurb, tagline }` — marked strings, ready for
 * `keywordLines()`. Safe to await from any .astro frontmatter; only the first
 * caller in a build actually hits the network.
 */
export function getSiteCopy() {
  if (!pending) {
    pending = sanityFetch(SITE_COPY_QUERY)
      .then((doc) => ({
        footerBlurb: clean(doc?.footerBlurb, SITE_COPY_FALLBACK.footerBlurb),
        tagline: clean(doc?.tagline, SITE_COPY_FALLBACK.tagline),
      }))
      .catch((err) => {
        console.warn('[siteCopy] Sanity read failed, using the baked copy:', err?.message || err);
        return { ...SITE_COPY_FALLBACK };
      });
  }
  return pending;
}
