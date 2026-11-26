/**
 * projectSlug.js — Canonical slug for a Featured Project detail page.
 *
 * A Featured Project is identified by its client + curated collection
 * (the subfolder name recorded as sourceManifest at ingestion).
 * The route slug joins both so it stays unique across clients:
 *
 *   ("heavy-house-society", "Live Visuals 2026")
 *     → "heavy-house-society-live-visuals-2026"
 *
 * If a `project` document with this slug exists in Sanity, its editorial
 * copy (display title, overview) is layered onto the page.
 */

/** Kebab-case a display string (collection/folder names). */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (Malóne → malone)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build the /work/[slug] param for a featured project collection. */
export function toProjectSlug(clientSlug, collection) {
  const collSlug = slugify(collection);
  // Collapse when the collection name is the same as the client name
  // (e.g. Bellaire → "bellaire" not "bellaire-bellaire")
  if (collSlug === clientSlug) return clientSlug;
  // Strip client-name prefix from the collection when the folder is named
  // "{Client} {Qualifier}" (e.g. "COCO Branding 2026" under client "coco"
  // should produce "coco-branding-2026" not "coco-coco-branding-2026").
  const prefix = `${clientSlug}-`;
  if (collSlug.startsWith(prefix)) return collSlug;
  return `${clientSlug}-${collSlug}`;
}

/**
 * The featured projects that get a /work/[slug] page, in the incoming
 * (FEATURED_PROJECT_PATHS_QUERY, World) order, each with its route `slug`:
 * a row needs a collection and a client, the slug is the project doc's or
 * toProjectSlug's, and a repeated slug is dropped (two docs resolving to one
 * URL). Whatever links a detail page reads it, so a link can't miss a route.
 */
export function featuredRoutes(rows) {
  const seen = new Set();
  return rows
    .filter((h) => h.collection && h.clientSlug)
    .map((h) => ({ ...h, slug: h.slug || toProjectSlug(h.clientSlug, h.collection) }))
    .filter((h) => !seen.has(h.slug) && seen.add(h.slug));
}
