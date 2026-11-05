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
 */
import { sanityFetch } from './sanityClient.js';
import { DIRECTORY_QUERY } from './queries.js';
import { buildDirectoryTiles } from '../components/work/directory/buildDirectoryTiles.js';

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
      tiles: buildDirectoryTiles(data),
      shuffle: data.shuffle === true,
    }));
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
