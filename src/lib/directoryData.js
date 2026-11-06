/**
 * directoryData.js — the Project Directory's data, fetched once per build:
 * the service tags, the clients, the tiles (buildDirectoryTiles) and the
 * Studio's shuffle switch. The directory page and the drawer's Client Roster
 * both await it, so the two read one result and can't disagree.
 *
 * Unlike getSiteCopy there is no fallback: a failed read rejects, and each
 * caller decides — the directory page fails the build, the roster goes empty.
 * A rejection isn't kept, so the next caller (or the next dev request) asks
 * again.
 *
 * The logo marks (`src/data/directory-logos/`, baked by
 * scripts/prep-directory-logos.mjs) join here: their manifest is keyed by
 * image asset id, and each mark gets the URL Vite serves it at. So does the
 * faces' measured transparency (`src/data/directory-alpha.json`, the same
 * script's --alpha), which decides each face's fit (fitOf).
 */
import { sanityFetch } from './sanityClient.js';
import { DIRECTORY_QUERY } from './queries.js';
import { buildDirectoryTiles } from '../components/work/directory/buildDirectoryTiles.js';
import manifest from '../data/directory-logos.json';
import alpha from '../data/directory-alpha.json';

const MARK_URLS = import.meta.glob('../data/directory-logos/*.png', {
  eager: true,
  query: { url: true, 'no-inline': true },
  import: 'default',
});

/** The manifest with each mark's `src`; a mark whose file is not there is dropped. */
const LOGOS = Object.fromEntries(
  Object.entries(manifest).flatMap(([id, m]) => {
    if (!m.file) return [[id, m]];
    const src = MARK_URLS[`../data/directory-logos/${m.file}`];
    return src ? [[id, { ...m, src }]] : [];
  })
);

let pending = null;

/**
 * `{ tags, clients, tiles, shuffle }` — tags in Studio order, clients with
 * their `umbrellas` (clientCoverage.js), tiles in 'project' order, and
 * `shuffle` (siteSettings.directoryShuffle: true only when the Studio set it;
 * a missing field or document reads false, today's order). Only the first
 * caller in a build hits the network.
 */
export function getDirectoryData() {
  if (!pending) {
    pending = sanityFetch(DIRECTORY_QUERY).then((data) => ({
      tags: data.tags ?? [],
      clients: data.clients ?? [],
      tiles: buildDirectoryTiles({ ...data, logos: LOGOS, alpha }),
      shuffle: data.shuffle === true,
    }));
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
