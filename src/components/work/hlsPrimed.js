/**
 * hlsPrimed — playlists fetched ahead of their player (the home globe's fast
 * handoff, ?pophandoff=fast; Nathan 10-27). Mux serves master and rendition
 * playlists no-store, so the HTTP cache never keeps them: the globe's prefetch
 * (globe/streamPrefetch.js) keeps their text here, by URL, and useHls's
 * `primed` loader hands it to hls.js instead of a round trip. The init and
 * segment the prefetch fetched sit in the HTTP cache (Mux: max-age 7 days).
 * Pure and import-free, so the tests load it as is.
 */

/** Well inside the life of the signed rendition URLs a master carries (Mux: about a week). */
export const PRIMED_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 256;

const texts = new Map(); // key → { text, at }
let served = 0;

/** One spelling per URL: hls.js normalizes the URLs it loads (url-toolkit), the prefetch resolves with URL. */
export function playlistKey(url) {
  try {
    return new URL(url).href;
  } catch {
    return String(url);
  }
}

export function primePlaylist(url, text, now = Date.now()) {
  const k = playlistKey(url);
  texts.delete(k); // re-inserted last, so the oldest entry is the first to go
  texts.set(k, { text, at: now });
  while (texts.size > MAX_ENTRIES) texts.delete(texts.keys().next().value);
}

/** The primed text for `url`, or null (never primed, or older than PRIMED_TTL_MS). */
export function primedPlaylist(url, now = Date.now()) {
  const k = playlistKey(url);
  const e = texts.get(k);
  if (!e) return null;
  if (now - e.at > PRIMED_TTL_MS) {
    texts.delete(k);
    return null;
  }
  return e.text;
}

/** primedPlaylist for a player: the same answer, counted (the bench readout and the probe report it). */
export function takePrimedPlaylist(url, now = Date.now()) {
  const text = primedPlaylist(url, now);
  if (text != null) served += 1;
  return text;
}

export const primedPlaylistStats = () => ({ entries: texts.size, served });

export function clearPrimedPlaylists() {
  texts.clear();
  served = 0;
}
