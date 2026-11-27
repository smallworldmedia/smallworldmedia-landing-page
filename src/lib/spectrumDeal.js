/**
 * spectrumDeal.js — the spectrum scheme's per-project palette key, decided ONCE per
 * build (US-7: ribbons on black). Build time only (Astro frontmatter); the key travels
 * to the DOM as `data-spectrum` and the CSS of the spectrum scheme selects on it.
 *
 * The deal is by POSITION in the /work order (colorScheme.spectrumDeal: a smooth
 * weighted round-robin over the measured shares of color-ref.png), not a hash of the
 * slug: with about a dozen featured projects a hash cannot hold the image's
 * proportions. So the deal needs ONE canonical ordered list: the featured projects in
 * the order /work shows them. Every project with a detail page is a featured project,
 * so that list also covers every detail page; a project missing from it deals to
 * null, which the spectrum sheet reads as blue.
 *
 * The rows come from FEATURED_PROJECT_PATHS_QUERY through featuredRoutes: the query
 * `/featured-projects/[slug]` builds its pages (and its next-project chain) from, ordered
 * identically to FEATURED_WORLDS_QUERY (queries.js says so), and featuredRoutes is
 * the same client + collection filter and slug derivation /work's `worlds` map uses.
 * No second ordering is written here.
 */
import { spectrumDeal } from './colorScheme.js';
import { FEATURED_PROJECT_PATHS_QUERY } from './queries.js';
import { featuredRoutes } from './projectSlug.js';

/**
 * { slug: key } for rows already in the /work order (each carrying its route `slug`).
 * A row with no slug is skipped and takes no position, so it cannot shift the keys
 * after it; a repeated slug keeps its first position.
 */
export function dealForRoutes(rows) {
  const slugs = [];
  const seen = new Set();
  for (const row of rows || []) {
    const slug = row?.slug;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return spectrumDeal(slugs);
}

let pending = null;

/**
 * The build's deal, `{ [slug]: paletteKey }`. Safe to await from any .astro
 * frontmatter; only the first caller in a build hits the network. A failed read
 * rejects (and is not remembered wrongly: the pages' own Sanity reads fail the
 * build the same way).
 */
export function getSpectrumDeal() {
  if (!pending) {
    // Dynamic: sanityClient reads import.meta.env, which does not exist under plain
    // Node, so the pure half above stays importable by the unit tests.
    pending = import('./sanityClient.js')
      .then(({ sanityFetch }) => sanityFetch(FEATURED_PROJECT_PATHS_QUERY))
      .then((rows) => dealForRoutes(featuredRoutes(rows)));
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
