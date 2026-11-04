/**
 * clientCoverage.js — Client Coverage and the Client Roster (CONTEXT.md).
 *
 * A client's coverage is its own media plus the media of every client whose
 * affiliations name it (client.affiliations[].entity: "related labels,
 * management companies, or parent entities"). One hop only: a label, manager
 * or owner pulls in its children's work, and an artist never pulls in a whole
 * label's catalogue. Munchietown names DJ Tennis (label-of), so DJ Tennis
 * covers Munchietown's media; Munchietown covers only its own.
 *
 * Pure; `clients` is DIRECTORY_QUERY's list: { name, slug, umbrellas } with
 * `umbrellas` the slugs a client's affiliations name.
 */

/** The client slugs a name covers (itself first), or null for an unknown slug. */
export function coverageOf(slug, clients) {
  if (!slug || !clients.some((c) => c.slug === slug)) return null;
  const covered = new Set([slug]);
  for (const c of clients) if (c.umbrellas?.includes(slug)) covered.add(c.slug);
  return covered;
}

const NAME_ORDER = { sensitivity: 'base', ignorePunctuation: true };

/**
 * The drawer's Client Roster: every client by name, `live` when its coverage
 * holds at least one directory tile (a live name filters the directory; the
 * rest stay plain until their links land).
 */
export function toDrawerRoster(clients, tiles) {
  const withTiles = new Set(tiles.map((t) => t.client));
  return clients
    .filter((c) => c.slug && c.name)
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      live: [...coverageOf(c.slug, clients)].some((s) => withTiles.has(s)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', NAME_ORDER) || (a.slug < b.slug ? -1 : 1));
}
