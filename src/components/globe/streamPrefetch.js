/**
 * streamPrefetch.js — a globe clip, fetched ahead of its stream: the fast
 * handoff (?pophandoff=fast; Nathan 10-27).
 *
 * A pool clip (VideoSlotPool) is a Mux master playlist pinned to one rendition
 * and clipped at GLOBE_PREVIEW_SECONDS: the master, ONE rendition playlist, an
 * init and ONE 5 s segment (curl, 10-27). Mux serves both playlists no-store,
 * so their text goes to hlsPrimed, where the pool's hls.js reads it (useHls
 * `primed`). The init and the segment are cacheable for 7 days
 * (max-age=604800), so fetching them leaves them in the HTTP cache for the
 * player's own requests. The director asks for the clips it expects a world to
 * start (LivePanelScheduler.predictStarts) once the world on screen has its
 * own videos running: a few at a time, at low fetch priority, each URL once.
 */
import { muxStream } from '../work/imageConfig.js';
import { primePlaylist, primedPlaylist, playlistKey } from '../work/hlsPrimed.js';
import { GLOBE_PREVIEW_SECONDS, GLOBE_STREAM_PARAMS, IS_MOBILE } from './globeConfig.js';

/** The URL a pool slot plays: `params` pins one rendition (min = max); the clip goes last, once (muxStream). */
export const poolStreamUrl = (playbackId, params) => muxStream(playbackId, GLOBE_PREVIEW_SECONDS, params);

/** The home globe pool's URL for a scheduler plan (LivePanelScheduler.planOf): the plan's own pin, or the pool's
 *  (VideoGlobe mounts its pool on GLOBE_STREAM_PARAMS) when the plan has none. */
export const planUrl = (playbackId, plan, pinParams = GLOBE_STREAM_PARAMS) => poolStreamUrl(playbackId, plan?.params || pinParams);

const attr = (attrs, name) => new RegExp(`(?:^|,)${name}=([^,]*)`).exec(attrs)?.[1];
const lower = (a, b) => (a.h !== b.h ? a.h < b.h : a.fps !== b.fps ? a.fps < b.fps : a.bw < b.bw);

/** The variant hls.js plays under preferMinQuality: level 0 of its sort (height, then frame rate, then the average
 *  bandwidth). A pinned master has just the one. */
export function lowestVariant(master, base) {
  const lines = master.split(/\r?\n/);
  let best = null;
  lines.forEach((line, i) => {
    if (!line.startsWith('#EXT-X-STREAM-INF:')) return;
    const attrs = line.slice('#EXT-X-STREAM-INF:'.length);
    const uri = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#'))?.trim();
    if (!uri) return;
    const v = {
      url: new URL(uri, base).href,
      h: Number(/^\d+x(\d+)$/.exec(attr(attrs, 'RESOLUTION') ?? '')?.[1] ?? 0),
      fps: Number(attr(attrs, 'FRAME-RATE') ?? 0),
      bw: Number(attr(attrs, 'AVERAGE-BANDWIDTH') ?? attr(attrs, 'BANDWIDTH') ?? 0),
    };
    if (!best || lower(v, best)) best = v;
  });
  return best?.url ?? null;
}

/** A rendition's init (EXT-X-MAP) and first segment, resolved. null for byte ranges: one file fetched in pieces,
 *  where a whole-file fetch is not what the player asks for. */
export function firstMedia(playlist, base) {
  if (playlist.includes('BYTERANGE')) return null;
  const map = /#EXT-X-MAP:(?:.*,)?URI="([^"]+)"/.exec(playlist)?.[1];
  const lines = playlist.split(/\r?\n/);
  const at = lines.findIndex((l) => l.startsWith('#EXTINF'));
  const seg = at < 0 ? null : lines.slice(at + 1).find((l) => l.trim() && !l.startsWith('#'))?.trim();
  return seg ? { init: map ? new URL(map, base).href : null, segment: new URL(seg, base).href } : null;
}

const queue = [];
const inflight = new Map(); // master key → its prefetch
let running = 0;
const stats = { asked: 0, done: 0, failed: 0, bytes: 0 };

/** Fetch one clip: master and rendition primed, init and segment into the HTTP cache. Resolves with the bytes. */
export async function prefetchClip(url, fetchImpl = globalThis.fetch) {
  const get = async (u) => {
    const r = await fetchImpl(u, { priority: 'low' });
    if (!r.ok) throw new Error(`${r.status} ${u}`);
    return r;
  };
  const master = await (await get(url)).text();
  primePlaylist(url, master);
  const variant = lowestVariant(master, url);
  if (!variant) return 0;
  const rendition = await (await get(variant)).text();
  primePlaylist(variant, rendition);
  const media = firstMedia(rendition, variant);
  if (!media) return 0;
  const bodies = await Promise.all([media.init, media.segment].filter(Boolean).map(async (u) => (await get(u)).arrayBuffer()));
  return bodies.reduce((n, b) => n + b.byteLength, 0);
}

function pump(concurrency, fetchImpl) {
  while (running < concurrency && queue.length) {
    const { url, key, resolve } = queue.shift();
    running += 1;
    const job = prefetchClip(url, fetchImpl)
      .then((bytes) => {
        stats.done += 1;
        stats.bytes += bytes;
      })
      .catch(() => {
        stats.failed += 1;
      })
      .finally(() => {
        inflight.delete(key);
        running -= 1;
        resolve();
        pump(concurrency, fetchImpl);
      });
    inflight.set(key, job);
  }
}

/** Queue clips (most wanted first) and run `concurrency` at a time. The newest list replaces what an older one left
 *  unstarted; a clip already primed (and fresh) or in flight is not fetched again. Resolves once this list's clips
 *  have all settled; never rejects. */
export function prefetchClips(urls, { concurrency = IS_MOBILE ? 2 : 3, fetchImpl = globalThis.fetch } = {}) {
  for (const q of queue.splice(0)) q.resolve();
  const waits = [];
  for (const url of urls) {
    const key = playlistKey(url);
    if (inflight.has(key)) waits.push(inflight.get(key));
    else if (primedPlaylist(url) == null && !queue.some((q) => q.key === key)) {
      stats.asked += 1;
      waits.push(new Promise((resolve) => queue.push({ url, key, resolve })));
    }
  }
  if (fetchImpl) pump(concurrency, fetchImpl);
  return Promise.allSettled(waits);
}

export const prefetchStats = () => ({ ...stats, queued: queue.length, running });

/** The tests' reset. */
export function clearPrefetch() {
  for (const q of queue.splice(0)) q.resolve();
  inflight.clear();
  running = 0;
  Object.assign(stats, { asked: 0, done: 0, failed: 0, bytes: 0 });
}
