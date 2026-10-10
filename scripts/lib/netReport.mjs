/**
 * netReport — the video diet's reader (P0, P0v). scripts/globe-probe.mjs logs
 * every Mux and Sanity request that ends (report.net.log) and what each
 * <video> played (LOOP_WATCH's sessions); this module buckets the log and
 * judges four gates. Pure (no Playwright), so the tests import it.
 *
 * Every master owes the clip of the surface that asked for it (owedClip):
 *  - pinned, i.e. the ASKED URL carries max_resolution: VideoSlotPool (the
 *    home globe, /lab, /work's World Near tier) clips at the preview window;
 *  - bare, on a detail page (/work/<slug>): MediaSlot and NextProjectBand
 *    clip at the detail cap;
 *  - anything else has no rule here and fails streamClip. /work/directory
 *    redirects today; when it returns, its MediaCard (the preview window) and
 *    its Lightbox (full length on purpose) each need a rule of their own.
 * The caller passes both windows in (the probe imports them from
 * src/components/work/imageConfig.js), so no second count is written here.
 *
 * The gates (report.net.detail[gate] = { n, floor, vacuous, worst, bound, … }):
 *  - streamClip: every master that reached Mux carries asset_end_time = the
 *    clip it owes.
 *  - segmentsPerRendition: no rendition fetches a segment that starts at or
 *    after its clip. Mux ends a clip on the first segment boundary at or after
 *    it, so what a clip keeps is read off each playlist's own EXTINF durations
 *    (cover), never assumed. A chunk that no logged playlist lists fails too,
 *    and so does a segment that two playlists list (an ambiguous attribution).
 *    A shared init chunk (EXT-X-MAP) is no conflict: it holds no media time,
 *    and Mux serves a track's one init to every clip of the asset.
 *  - loops: no <video> plays past its loop point (the window or its clip's
 *    real end, the same cover, whichever comes first) by more than LOOP_END_S,
 *    none fires `ended`, none sits frozen on its end frame (hls.js's stalled
 *    end of stream), and at least one wraps: jumps back from within LOOP_END_S
 *    of its loop point. A rewind from anywhere else (a detach, a seek) is not
 *    a wrap. Every player wraps at its window: the pool and MediaCard by their
 *    timeupdate guards, MediaSlot and NextProjectBand by wrapAtDetailCap, and
 *    a guard that fires a tick late still lands inside LOOP_END_S.
 *  - audio (P0v): no muted surface fetches audio. Every probed route is one,
 *    and each strips its master's audio group in the client (useHls's
 *    videoOnly), after the fetch, so the master on the wire still lists its
 *    audio rendition: n counts those masters (offered), which keeps the gate
 *    non-vacuous. worst = the audio rendition playlists fetched plus the
 *    chunks that map to an audio rendition, its init included; the bound is 0.
 *    The Lightbox plays with sound, so its masters are exempt: the only ones
 *    that ask for no clip (full length on purpose). /work/directory
 *    redirects, so no probe opens it today.
 * Each has a vacuity floor of one (none under reduced motion, where the globe
 * mounts no pool). The probe's --noclip is the clip gates' negative control;
 * players still wrap at their windows there, so loops is controlled by the
 * unit tests and by a build with the cap's seek removed (--hold). --noclip
 * leaves the client's audio strip alone: audio is controlled by the unit
 * tests and by the reports of a build without the strip (P0's).
 * net.refetch counts the chunks fetched more than once. It is listed, never
 * gated: a detail page's slots re-attach on re-entry, the pool reassigns
 * slots, and the probe runs with the HTTP cache off.
 */

/** timeupdate fires every 15 to 250 ms (the HTML spec), so a looping video can
 *  be seen up to one tick past its end before it wraps. */
export const TICK_S = 0.25;
/** LOOP_WATCH samples every tick; "at" an end or a loop point means within
 *  two ticks of it. */
export const LOOP_SAMPLE_MS = TICK_S * 1000;
export const LOOP_END_S = 2 * TICK_S;
/** An end frame held for eight samples is a stall, not a hiccup. */
export const STALL_MS = 8 * LOOP_SAMPLE_MS;

/** The report.net bucket of a request URL, or null for a request it ignores. */
export function netBucket(url) {
  const { hostname: h, pathname: p } = new URL(url);
  if (h === 'stream.mux.com' && p.endsWith('.m3u8')) return 'mux-master';
  if (h.endsWith('.mux.com') && p.endsWith('.m3u8')) return 'mux-playlist';
  if (h === 'image.mux.com') return 'mux-thumb';
  if (h.endsWith('.mux.com')) return 'mux-segment';
  if (h === 'cdn.sanity.io') return 'sanity-image';
  return null;
}

/** The playback id of a master URL. */
export const masterId = (url) => new URL(url).pathname.slice(1).replace(/\.m3u8$/, '');

/** A pool master: the page ASKED for a pinned rendition. Read off the asked
 *  URL, so --noclip's in-flight rewrite never changes what a master owes. */
export const pinnedMaster = (asked) => new URL(asked).searchParams.has('max_resolution');

/** The Lightbox's master: the one stream the client asks for with no clip
 *  (full length on purpose, with sound), so the audio gate exempts it. Read
 *  off the asked URL, so --noclip's rewrite never exempts a muted surface. */
const lightboxMaster = (asked) => !new URL(asked).searchParams.has('asset_end_time');

/** The clip, in seconds, a stream owes: the preview window for the pool (a
 *  pinned master, or a pool <video>), the detail cap for a bare stream on a
 *  detail page, else null (no rule: judged bad). */
export function owedClip(route, pooled, { preview, detail }) {
  if (pooled) return preview;
  return /^\/work\/(?!directory\/?$)[^/]+\/?$/.test(route) ? detail : null;
}

/** What a clip at `clip` seconds keeps of a playlist whose segments last
 *  `durs`: Mux keeps every segment that starts before the clip, so `needed`
 *  segments, ending at `end` (the first boundary at or after the clip, or the
 *  asset's own end when it is shorter). */
export function cover(durs, clip) {
  let needed = 0;
  let end = 0;
  for (const d of durs) {
    if (end >= clip - 1e-6) break;
    end += d;
    needed += 1;
  }
  return { needed, end: Math.round(end * 1e6) / 1e6 };
}

const linesOf = (body) => body.split('\n').map((l) => l.trim()).filter(Boolean);

/** A master's renditions, resolved against its URL: each EXT-X-STREAM-INF's
 *  URI (video) and each EXT-X-MEDIA URI (audio). */
function renditionsOf(body, base) {
  const ls = linesOf(body);
  const out = [];
  ls.forEach((l, i) => {
    const media = l.startsWith('#EXT-X-MEDIA:') && /URI="([^"]+)"/.exec(l);
    if (media) out.push({ path: new URL(media[1], base).pathname, type: /TYPE=AUDIO/.test(l) ? 'audio' : 'media' });
    if (l.startsWith('#EXT-X-STREAM-INF:')) {
      const uri = ls.slice(i + 1).find((x) => !x.startsWith('#'));
      if (uri) out.push({ path: new URL(uri, base).pathname, type: 'video' });
    }
  });
  return out;
}

/** A rendition playlist's init chunk (EXT-X-MAP) and its segments in order. */
function segmentsOf(body, base) {
  let init = null;
  let dur = 0;
  const segs = [];
  for (const l of linesOf(body)) {
    const map = /^#EXT-X-MAP:.*URI="([^"]+)"/.exec(l);
    const inf = /^#EXTINF:([\d.]+)/.exec(l);
    if (map) init = new URL(map[1], base).pathname;
    else if (inf) dur = Number(inf[1]);
    else if (!l.startsWith('#')) {
      segs.push({ path: new URL(l, base).pathname, dur });
      dur = 0;
    }
  }
  return { init, segs };
}

/** report.net and its four gates. `log` holds the requests that ended, in
 *  the probe's shape ({ route, bucket, asked, sent, bytes, failed? }); `bodies`
 *  the master and playlist entries with their `body`; `sessions` what
 *  LOOP_WATCH saw ({ id, pooled, route, n, maxT, jumps, ended, maxStillMs,
 *  dur }, jumps holding where each backward jump started). A chunk maps to its
 *  rendition by PATH: a refetched playlist varies its host and query while the
 *  paths stay put, and a different query (a pin, a clip) lists different
 *  rendition and chunk paths. A chunk two playlists list stays with the first
 *  (the first claim stands): a shared init's fetches credit the first playlist
 *  that lists it (renditions[].init). */
export function netReport(log, bodies, sessions, { preview, detail, rm = false, noclip = false }) {
  const windows = { preview, detail };
  const buckets = {};
  const byRoute = {};
  for (const e of log) {
    for (const into of [buckets, (byRoute[e.route] ||= {})]) {
      const b = (into[e.bucket] ||= { n: 0, bytes: 0 });
      b.n += 1;
      b.bytes += e.bytes;
    }
  }

  // Masters: the clip each one owes, and who lists each rendition.
  const masters = log
    .filter((e) => e.bucket === 'mux-master' && !e.failed)
    .map((e) => ({ route: e.route, sent: e.sent, owed: owedClip(e.route, pinnedMaster(e.asked), windows) }));
  const owner = new Map(); // rendition path → { id, type, owed }; the stricter clip wins a shared path
  const audioPaths = new Set(); // audio rendition paths a muted surface's master lists
  let offered = 0; // muted surfaces' masters whose body on the wire lists an audio rendition
  for (const m of bodies.filter((b) => b.bucket === 'mux-master')) {
    const owed = owedClip(m.route, pinnedMaster(m.asked), windows);
    const listed = renditionsOf(m.body, m.sent);
    for (const r of listed) {
      const had = owner.get(r.path);
      if (!had || (owed ?? Infinity) < (had.owed ?? Infinity)) owner.set(r.path, { id: masterId(m.sent), type: r.type, owed });
    }
    if (lightboxMaster(m.asked)) continue; // it plays with sound
    const audio = listed.filter((r) => r.type === 'audio');
    if (audio.length) offered += 1;
    for (const r of audio) audioPaths.add(r.path);
  }

  // Playlists: each rendition's segment durations; every chunk path → (rendition, position).
  const rends = new Map(); // rendition path → { id, type, owed, durs, fetched, init }
  const chunkAt = new Map(); // chunk path → { rendition, position }; the init's position is null
  let conflicts = 0; // segment paths a second rendition also lists (the first claim stands)
  for (const p of bodies.filter((b) => b.bucket === 'mux-playlist')) {
    const path = new URL(p.sent).pathname;
    const { init, segs } = segmentsOf(p.body, p.sent);
    const r = rends.get(path) ?? { ...(owner.get(path) ?? { id: null, type: null, owed: null }), durs: [], fetched: new Set(), init: false };
    if (segs.length > r.durs.length) r.durs = segs.map((s) => s.dur);
    rends.set(path, r);
    const claim = (chunk, position) => {
      const had = chunkAt.get(chunk);
      if (!had) chunkAt.set(chunk, { rendition: path, position });
      else if (had.rendition !== path && position != null) conflicts += 1; // a shared init is none
    };
    if (init) claim(init, null);
    segs.forEach((s, i) => claim(s.path, i));
  }
  // audio: each request a muted surface made of an audio rendition (its playlist, its init, a segment)
  const audioBad = []; // { route, bucket, id, path }
  for (const e of log.filter((x) => x.bucket === 'mux-playlist' && !x.failed)) {
    const path = new URL(e.sent).pathname;
    if (audioPaths.has(path)) audioBad.push({ route: e.route, bucket: e.bucket, id: owner.get(path).id, path });
  }
  const audioPlaylists = audioBad.length;
  let unmapped = 0;
  const timesFetched = new Map(); // chunk path → fetches (net.refetch)
  for (const c of log.filter((e) => e.bucket === 'mux-segment' && !e.failed)) {
    const chunk = new URL(c.sent).pathname;
    timesFetched.set(chunk, (timesFetched.get(chunk) ?? 0) + 1);
    const at = chunkAt.get(chunk);
    if (!at) unmapped += 1;
    else {
      const r = rends.get(at.rendition);
      if (at.position != null) r.fetched.add(at.position);
      else r.init = true;
      if (audioPaths.has(at.rendition)) audioBad.push({ route: c.route, bucket: c.bucket, id: r.id, path: chunk });
    }
  }
  const audioChunks = audioBad.length - audioPlaylists;
  const refetch = {
    chunks: [...timesFetched.values()].reduce((n, k) => n + k, 0),
    dupPaths: [...timesFetched.values()].filter((k) => k > 1).length,
  };
  const renditions = [...rends.values()]
    .filter((r) => r.fetched.size)
    .map((r) => {
      const c = r.owed == null ? null : cover(r.durs, r.owed);
      const maxIndex = Math.max(...r.fetched);
      return {
        id: r.id, type: r.type, owed: r.owed, listed: r.durs.length, needed: c?.needed ?? null, clipEnd: c?.end ?? null,
        fetched: r.fetched.size, init: r.init, maxIndex, past: c ? Math.max(0, maxIndex + 1 - c.needed) : null,
      };
    });

  // Each stream's real clip end, per (id, owed): the cover of its video renditions.
  const endOf = new Map();
  for (const r of rends.values()) {
    if (r.type !== 'video' || r.owed == null || !r.durs.length) continue;
    const k = `${r.id}|${r.owed}`;
    endOf.set(k, Math.max(endOf.get(k) ?? 0, cover(r.durs, r.owed).end));
  }
  const played = sessions
    .filter((s) => s.id)
    .map((s) => {
      const owed = owedClip(s.route, s.pooled, windows);
      const end = owed == null ? null : endOf.get(`${s.id}|${owed}`) ?? null;
      const jumps = s.jumps ?? [];
      const wraps = end == null ? 0 : jumps.filter((from) => from >= Math.min(owed, end) - LOOP_END_S).length;
      const why =
        end == null ? 'no clip end' : s.ended ? 'ended' : s.maxStillMs >= STALL_MS ? 'frozen on its end frame' : s.maxT > Math.min(owed, end) + LOOP_END_S ? 'played past its clip' : null;
      return { id: s.id, route: s.route, pooled: s.pooled, owed, end, maxT: s.maxT, wraps, rewinds: jumps.length - wraps, ended: s.ended, maxStillMs: s.maxStillMs, why };
    });

  const clipBad = masters.filter((m) => m.owed == null || new URL(m.sent).searchParams.get('asset_end_time') !== String(m.owed));
  const segBad = renditions.filter((r) => r.past == null || r.past > 0);
  const loopBad = played.filter((s) => s.why);
  const wraps = played.reduce((n, s) => n + s.wraps, 0);
  const over = played.filter((s) => s.end != null).map((s) => s.maxT - Math.min(s.owed, s.end));
  const floor = rm ? 0 : 1; // reduced motion mounts no globe pool: nothing to judge there
  const gate = (n, more) => ({ n, floor, vacuous: n < floor, ...more });
  const detailOf = {
    streamClip: gate(masters.length, { worst: clipBad.length, bound: 0, bad: clipBad.slice(0, 5) }),
    segmentsPerRendition: gate(renditions.length, {
      worst: Math.max(0, ...renditions.map((r) => r.past ?? 0)), bound: 0, unowed: renditions.filter((r) => r.past == null).length, unmapped, conflicts, bad: segBad.slice(0, 5),
    }),
    loops: gate(played.length, { worst: over.length ? Math.round(Math.max(...over) * 1000) / 1000 : null, bound: LOOP_END_S, wraps, bad: loopBad.slice(0, 5) }),
    audio: gate(offered, { worst: audioPlaylists + audioChunks, bound: 0, playlists: audioPlaylists, chunks: audioChunks, bad: audioBad.slice(0, 5) }),
  };
  return {
    pass: {
      streamClip: !detailOf.streamClip.vacuous && clipBad.length === 0,
      segmentsPerRendition: !detailOf.segmentsPerRendition.vacuous && unmapped === 0 && conflicts === 0 && segBad.length === 0,
      loops: !detailOf.loops.vacuous && loopBad.length === 0 && (played.length === 0 || wraps >= 1),
      audio: !detailOf.audio.vacuous && detailOf.audio.worst === 0,
    },
    net: { windows, noclip, buckets, byRoute, renditions, sessions: played, detail: detailOf, refetch, log },
  };
}
