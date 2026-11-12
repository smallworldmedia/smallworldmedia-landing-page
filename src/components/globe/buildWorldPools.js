/**
 * buildWorldPools.js — featured-project media pools for the home globe's
 * population modes (docs/globe-worlds-plan.md). Pure.
 *
 * Build time (src/pages/index.astro): buildWorldPools() turns the SAME
 * FEATURED_WORLDS_QUERY rows /work renders into one pool per featured
 * project, partitioned by the Content Population Hierarchy
 * (buildContentFlow) — so a cluster on the globe holds exactly the media of
 * that project's /work World: the hero, the showcase Tiles and the album art.
 * Which group types show is the surface table (GROUP_SURFACES, 11-10): album
 * art, admats and merch (stills cycle as a sequence) open on the globe; deck
 * pages, carousels, banners, logos and process/BTS assets stay out (wide or
 * transparent sheets never read in a square tile). Visuals and live-footage
 * pieces ride as ordinary tiles (assetLane, US-4). Mockups and flyer-progression
 * sets (US-5) are one cycling panel each, an animated member in it as its
 * poster still (posterStill).
 *
 * Client (PopulationDirector): selectPool() narrows a pool live for the
 * ?popmedia / ?popcap bench knobs. Both sides select round-robin across the
 * media kinds, then restore editorial (orderRank) order — so a cap never
 * starves a project's album art or stills behind a long run of videos.
 *
 * Globe asset shape: { kind: 'video'|'still'|'art', playbackId?, imageUrl?,
 * videoAspectRatio?, u?, s? } — no ids and no nulls: the pools ride the home
 * island's props (WORLD_POOL_CAP bounds them), and the texture key (assetKey)
 * is all a tile needs. Stills load as square Sanity crops (TextureManager);
 * kind only filters, playbackId alone decides whether a tile can go live.
 * `u` is the span class `mediaClass.classOf` decides at build from the label
 * and the native ratio; absent means single only. `s` is a video's source
 * short side, present only below `TOP_RUNG`, or 0 when unknown
 * (docs/globe-worlds-plan.md § Media spans).
 *
 * Sequences (src/lib/mediaSequence.js, 10-31): an authored `-sequence` group
 * arrives from buildContentFlow as one item, and a project's still album art
 * (two covers or more) collapses here into one more, so ONE panel cycles the
 * covers and the rest are free for other media. An admat set (two stills or
 * more under one displayGroup) is one such panel too. Animated covers and
 * motion admats keep their own tiles. A sequence asset adds `frames` ([{ imageUrl, alpha? }], frame 0 = its
 * imageUrl) and `ar`, the tile ratio every frame is cut to.
 */
import { buildContentFlow, ratioOf, groupTypeOf, assetLane } from '../work/detail/buildContentFlow.js';
import { makeSequence } from '../../lib/mediaSequence.js';
import { toProjectSlug } from '../../lib/projectSlug.js';
import { classOf } from './mediaClass.js';
import { TOP_RUNG } from './unitSpan.js';

export const WORLD_POOL_CAP = 32; // per project — bounds the island payload
export const WORLD_KINDS = ['video', 'still', 'art'];
// A kind filter that leaves fewer than this falls back to the whole pool
// (Munchietown has 1 video; a video-only cluster of it would be one clip).
export const MIN_KIND_POOL = 3;

const PLAYABLE = ['ready', 'preparing']; // the buildAssetPool rule (stale Mux snapshots)

function kindOf(asset) {
  if (groupTypeOf(asset) === 'album-art') return 'art';
  if (asset.playbackId) return 'video';
  return asset.imageUrl ? 'still' : null;
}

function toGlobeAsset(asset) {
  if (!asset || asset.mediaType === 'logo' || asset.contentRole) return null;
  // The surface table, for the hero too (buildContentFlow skips assets[0]): a deck, carousel or
  // banner page never tiles.
  if (groupTypeOf(asset) && assetLane(asset, 'globe') === null) return null;
  if (asset.playbackId && asset.videoStatus && !PLAYABLE.includes(asset.videoStatus)) return null;
  const kind = kindOf(asset);
  if (!kind) return null;
  const out = { kind };
  if (asset.playbackId) out.playbackId = asset.playbackId;
  else out.imageUrl = asset.imageUrl;
  if (asset.frames) {
    out.frames = asset.frames.map((f) => (f.imageHasAlpha ? { imageUrl: f.imageUrl, alpha: true } : { imageUrl: f.imageUrl }));
    out.ar = asset.sequenceRatio;
  }
  if (asset.playbackId && asset.videoAspectRatio) out.videoAspectRatio = asset.videoAspectRatio;
  // The span class per shape set (mediaClass.js), decided once, here: u = classic ('h' | 'v' | 'q'),
  // uw = wide ('w' | 'v' | 'q', Nathan 10-24). ?popshapes picks which one the director reads.
  const u = classOf(asset);
  if (u) out.u = u;
  const uw = classOf(asset, { shapes: 'wide' });
  if (uw) out.uw = uw;
  // s: a video's SOURCE short side (the Mux video track), carried only below
  // TOP_RUNG; 0 = Sanity holds no track size. Absent = at least TOP_RUNG.
  // unitSpan.sourceShort reads it: quad election, class-texture and rung clamps.
  if (asset.playbackId) {
    const t = asset.videoTrack;
    const s = t?.max_width > 0 && t?.max_height > 0 ? Math.min(t.max_width, t.max_height) : 0;
    if (s < TOP_RUNG) out.s = s;
  }
  return out;
}

/**
 * Round-robin across kinds (each kind in pool order) up to `cap`, then back
 * into pool order. `kinds` null = every kind. `budget` (?popequiv, units on):
 * Σ weigh(asset) may not exceed it — a lane whose next asset doesn't fit skips it.
 */
export function selectPool(pool, { kinds = null, cap = WORLD_POOL_CAP, budget = null, weigh = null } = {}) {
  let src = pool;
  if (kinds) {
    const want = new Set(kinds);
    const filtered = pool.filter((a) => want.has(a.kind));
    if (filtered.length >= MIN_KIND_POOL) src = filtered;
  }
  if (budget == null && src.length <= cap) return src.slice();
  const byKind = new Map();
  src.forEach((a, i) => {
    if (!byKind.has(a.kind)) byKind.set(a.kind, []);
    byKind.get(a.kind).push(i);
  });
  const lanes = [...byKind.values()];
  const picked = [];
  let used = 0;
  for (let pass = 0, open = true; open && picked.length < cap; pass++) {
    open = false;
    for (const lane of lanes) {
      if (pass >= lane.length || picked.length >= cap) continue;
      open = true;
      const w = budget == null ? 0 : weigh(src[lane[pass]]);
      if (budget != null && used + w > budget) continue;
      used += w;
      picked.push(lane[pass]);
    }
  }
  return picked.sort((a, b) => a - b).map((i) => src[i]);
}

/**
 * @param {Array} projects - FEATURED_WORLDS_QUERY rows (orderRank order)
 * @returns {Array<{slug, clientName, title, projectColor, services, assets}>}
 *          one entry per featured project with at least one tile-able asset,
 *          in the /work World order
 */
export default function buildWorldPools(projects = []) {
  return (projects || [])
    .filter((p) => p.clientSlug && p.collection) // the /work World filter
    .map((p) => {
      const assets = p.assets || [];
      const flow = buildContentFlow(assets, { surface: 'globe' });
      // The still covers → one sequence at the first cover's place, uncapped:
      // the globe loads a sequence one frame ahead (PopulationDirector.stepSequences).
      // Below ORBIT_MIN the covers ride the showcase, so both lists are searched.
      // A cover HERO (buildContentFlow skips assets[0]) leads the sequence as its
      // frame 0 (11-05: HHS Pre-2026's Hidde van Wee hero stayed a static tile
      // and took the world's 2×2 from the cycling covers).
      const tiles = [...flow.showcase, ...flow.albumArt];
      const isCover = (a) => a && groupTypeOf(a) === 'album-art' &&!a.frames && a.imageUrl && !a.playbackId;
      const covers = [assets[0], ...tiles].filter(isCover);
      const coverMedia =
        covers.length > 1
          ? [makeSequence('sequence:album-art', covers, covers.map(ratioOf), { cap: Infinity }), ...tiles.filter((a) => !covers.includes(a))]
          : tiles;
      // Each admat set (buildContentFlow: two stills or more) is one more panel, at its first
      // item's place and uncapped like the covers. Its items ride only here, never as tiles
      // of their own. An admat HERO of the same group leads the set as frame 0, as a cover
      // hero does.
      const heroSet = flow.admats.find(
        (s) => s.group === (assets[0]?.displayGroup ?? 'admat') && groupTypeOf(assets[0]) === 'admat' && assets[0].imageUrl && !assets[0].playbackId
      );
      const admatMedia = flow.admats.map((s) => {
        const frames = s === heroSet ? [assets[0], ...s.items] : s.items;
        return makeSequence(`sequence:admat:${s.group}`, frames, frames.map(ratioOf), { cap: Infinity });
      });
      const media = [...coverMedia, ...admatMedia];
      // Editorial order across the partition: the hero leads, then showcase
      // and album art interleave back at their orderRank positions (a
      // sequence at its first frame's).
      const rank = new Map(assets.map((a, i) => [a._id, i]));
      const at = (a) => rank.get(a.frames?.[0]._id ?? a._id) ?? 0;
      const hero = heroSet || (covers.length > 1 && covers[0] === assets[0]) ? [] : [assets[0]]; // a cover or admat hero rides its sequence
      const ordered = [...hero, ...media].filter(Boolean).sort((a, b) => at(a) - at(b));
      const seen = new Set();
      const pool = [];
      for (const a of ordered) {
        const g = toGlobeAsset(a);
        if (!g) continue;
        const key = g.playbackId || g.imageUrl;
        if (seen.has(key)) continue; // one texture per tile-able source
        seen.add(key);
        pool.push(g);
      }
      // Service tags (the chips' bracketed line): p.services is already the
      // union of the project's media tags (queries.js PROJECT_SERVICES).
      const services = (p.services || []).filter((s) => s?.slug);
      return {
        slug: p.slug || toProjectSlug(p.clientSlug, p.collection),
        clientName: p.clientName,
        title: p.title || null,
        projectColor: p.projectColor || null,
        services: services.map(({ name, slug }) => ({ name, slug })),
        assets: selectPool(pool, { cap: WORLD_POOL_CAP }),
      };
    })
    .filter((w) => w.assets.length);
}
