/**
 * buildContentFlow — Content Population Hierarchy for Featured Project pages.
 *
 * Turns a featured project's asset collection (already sorted by orderRank,
 * set via drag-to-order in Studio) into categorised asset buckets. The masonry grid handles
 * visual layout — this module just separates asset categories:
 *
 *  1. The hero is always assets[0] (first in drag-to-order ranking).
 *     It is excluded from the flow and rendered in the hero band above
 *     the project blurb.
 *  2. `album-art` assets are held out for the AlbumArtOrbit — but only
 *     when the collection clears ORBIT_MIN.
 *     Below the gate the covers fold back into the showcase flow at
 *     their original orderRank positions (they tessellate as squares).
 *  3. `brand-deck` assets are held out for the BrandDeckViewer, grouped
 *     by displayGroup: group order = first appearance (lowest-orderRank
 *     member, per the controlled-adjacency convention), pages sequenced
 *     by brandDeckOrder within each group.
 *  4. `carousel-slide` assets are held out — reserved for the
 *     Carousel component, grouped by displayGroup like decks (group order =
 *     first appearance, orderRank within a group).
 *  5. banner assets (09-10, Nathan — COCO SoundCloud banners) are held
 *     out for the BannerViewer: any asset whose displayGroup ends in
 *     `banner`/`banners` (e.g. `soundcloud-banners`), grouped by that
 *     displayGroup in orderRank order. No dedicated mediaType — the
 *     group name IS the classification, so Studio needs no schema change.
 *  6. process/supporting assets (contentRole) are excluded —
 *     reserved for the future BTS section.
 *  7. Everything else is `showcase` — rendered in the masonry grid
 *     in orderRank order.
 *  8. sequences (10-31, Nathan): stills whose displayGroup ends in
 *     `sequence` (e.g. `imperfect-records-wide-logo-sequence`) collapse into
 *     ONE showcase item at the first member's position, carrying `frames`
 *     (src/lib/mediaSequence.js) — checked first, so any still can join one.
 *     A group of one stays a plain showcase item; a video member keeps its
 *     own tile.
 *  9. chunks (11-05, Nathan): a showcase video flagged `splitIntoThirds`
 *     becomes three tiles in its place, each its own third (expandChunks).
 * 10. group types (11-10, Nathan): a set's `groupType` (album-art, deck,
 *     banner, admat, carousel, merch, visuals, live-footage — a mediaAsset
 *     field) says which surfaces open its viewer (GROUP_SURFACES). Pass
 *     `surface` and a piece whose set does not open there is dropped (except
 *     visuals and live-footage, below); leave it out and the lanes above run
 *     as they always did. groupTypeOf reads the field and, on a document from
 *     before the field, infers the type from mediaType / displayGroup.
 *     `admat` sets (still flyers, displayGroup `…-admats`) group like decks,
 *     pages in brandDeckOrder; a set of one rides the showcase at its place.
 *     A motion member (an animated flyer) joins its set on `detail`, where
 *     the wall plays it; on the globe and the directory it keeps its own
 *     tile. Without a surface the admats bucket stays empty and admat pages
 *     ride the decks, as before.
 * 11. US-4 (11-11, Nathan): three more types.
 *     `merch` stills collapse like a `-sequence` group (lane 'sequence', keyed
 *     by displayGroup) on every surface, so a merch set is the cycler album
 *     art gets on the globe; a motion merch piece keeps its own tile.
 *     `visuals` (videos) and `live-footage` (clips and photos) sets open on
 *     detail and directory only: `visuals` / `liveFootage` hold one
 *     {group, items} per set of two or more, items in input (orderRank)
 *     order, and a set of one rides the showcase at its place. On the globe
 *     and /work their pieces are NOT dropped: they ride 'role' / 'showcase'
 *     as ordinary pieces (OFF_SURFACE_ORDINARY).
 * 12. US-5 (11-11, Nathan): two more types, each with a lane per surface
 *     (SURFACE_LANE, assetLane).
 *     `mockups` open on globe, detail and directory (NOT /work, where their
 *     pieces are dropped): a cycling sequence on the globe, and on detail a
 *     `mockups` bucket (one {group, items} per set of two or more, items in
 *     input order, a set of one riding the showcase at its place).
 *     `flyer-progression` opens on globe, /work and detail: a cycling
 *     sequence on the globe and /work, and the carousel lane on detail (a set
 *     of one rides the showcase at its place, as every set of one does). On
 *     the directory a mockups set rides the 'sequence' lane, one tile that
 *     flips through the set's members (Nathan 11-11); a flyer progression does
 *     not open there, and each of its flyers is a tile of its own (Nathan
 *     11-16, OFF_SURFACE_ORDINARY). In a sequence an animated member joins as its poster still (posterStill)
 *     instead of keeping its own tile, so a mostly-animated progression still
 *     cycles; merch keeps its stills-only rule.
 * 13. static logos (11-14, Nathan: "static logo files do not display on
 *     /work"): a still typed `logo` is dropped on the 'work' surface, before
 *     every other lane, so it is not a tile there and not a frame of a
 *     sequence either (isStaticLogo). An animated logo is a video, so it
 *     stays. Detail and the directory still show the logo (their logo
 *     canvas); the globe already leaves the type out (buildWorldPools). The
 *     hero is assets[0] whatever its type and never reaches this check.
 * 14. US-10 (11-16, Nathan): a set can lead the project page. On `detail`, when the
 *     hero's set may lead (leadsAsSet, src/lib/setHero.js: its Set document's "Can be
 *     the hero", or a legacy deck), the output also carries `heroSet: {group, type,
 *     items}`: every member, the hero included, in rank order. Those members are in no
 *     bucket and the set has no rank seat, so it is never drawn twice. Without a
 *     leading set the output has no `heroSet` key and is as it always was.
 *     `heroSetPreview` (?heroset=1) lets any first piece's set lead.
 *
 * Which bucket an asset joins is assetLane's precedence (sequence first,
 * showcase last), exported so other grids sort assets the same way.
 *
 * @param {Array<Object>} assets - mediaAsset docs ordered by orderRank
 * @param {{surface?: 'globe'|'work'|'detail'|'directory', orbitMin?: number, chunks?: {only?: string[], gap?: number}, heroSetPreview?: boolean}} [opts] - surface: the GROUP_SURFACES column to apply (none = every set opens); ORBIT_MIN override (live tuning); expandChunks' ?chunks / ?chunkgap; heroSetPreview: ?heroset=1 (detail only)
 * @returns {{heroSet?: {group: string, type: string, items: Array<Object>}, showcase: Array<Object>, albumArt: Array<Object>, brandDecks: Array<{group: string, pages: Array<Object>}>, carousels: Array<{group: string, pages: Array<Object>}>, banners: Array<{group: string, items: Array<Object>}>, admats: Array<{group: string, items: Array<Object>}>, visuals: Array<{group: string, items: Array<Object>}>, liveFootage: Array<{group: string, items: Array<Object>}>, mockups: Array<{group: string, items: Array<Object>}>, bts: Array<Object>}}
 */

import { isSequenceGroup, makeSequence, posterStill } from '../../../lib/mediaSequence.js';
import { chunkRanges, chunkWindow } from '../imageConfig.js';
import { setCanLead, leadsAsSet } from '../../../lib/setHero.js';

/** Ratio below which an asset is considered portrait/square. */
const PORTRAIT_THRESHOLD = 1.2;

/**
 * Minimum covers for the album wall (AlbumArtViewer; the name is from the
 * retired orbit ring). 10-27, Nathan: 4, so Hurry Up Slowly's four releases
 * get the wall instead of sitting in the grid (was 6). The wall repeats
 * covers to fill its columns, so a short catalog still fills the frame.
 * Below the gate, covers fold back into the showcase flow as square tiles.
 */
export const ORBIT_MIN = 4;

/** displayGroup convention that routes an asset to the BannerViewer. */
const BANNER_GROUP_RE = /(^|-)banners?$/i;
export const isBannerGroup = (group) => BANNER_GROUP_RE.test(group ?? '');

/**
 * Ratios encoded directly in the mediaType suffix.
 * These are explicitly set during ingestion and represent the
 * editorial classification — they take priority over Mux metadata,
 * which can be stale or incorrect for assets still "preparing".
 *
 * ASPECT RATIO RESOLUTION ORDER (used by ratioOf):
 *   1. mediaType-encoded ratio (e.g. motion_9x16 → 9/16) — editorial truth
 *   2. Mux `data.aspect_ratio` (e.g. "25:32") — authoritative for _other types
 *   3. Sanity image `metadata.dimensions` — authoritative for images
 *   4. Title-hint parsing (e.g. "…3x4…" or "…9x16…") — naming convention
 *   5. Ultimate fallback: 16 / 9
 *
 * INGESTION RULE: Every mediaAsset MUST have either:
 *   - A ratio-encoding mediaType (e.g. static_3x4, motion_9x16), OR
 *   - A Mux video with `data.aspect_ratio` back-synced, OR
 *   - A Sanity image with metadata dimensions, OR
 *   - A ratio hint in the title (e.g. "Promo 3x4", "Reel 9x16")
 */
const MEDIA_TYPE_RATIOS = {
  static_1x1: 1,
  static_3x4: 3 / 4,
  static_4x5: 4 / 5,
  static_9x16: 9 / 16,
  static_16x9: 16 / 9,
  motion_1x1: 1,
  motion_3x4: 3 / 4,
  motion_4x3: 4 / 3,
  motion_4x5: 4 / 5,
  motion_9x16: 9 / 16,
  motion_16x9: 16 / 9,
  'album-art': 1,
  'brand-deck': 16 / 9,
  'featured-project-reel': 16 / 9,
  // no `logo` entry: logos don't encode a ratio (live set is 1.14–2.0),
  // so they fall through to real image dimensions.
};

/**
 * Parse ratio hints embedded in asset titles.
 * Matches patterns like "3x4", "9x16", "4x5", "16x9", "1x1".
 * Returns w/h or null if no match.
 */
const TITLE_RATIO_RE = /\b(\d{1,2})\s*[xX×]\s*(\d{1,2})\b/;
function ratioFromTitle(title) {
  if (!title) return null;
  const m = title.match(TITLE_RATIO_RE);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w && h) return w / h;
  }
  return null;
}

/**
 * Best-known aspect ratio for an asset.
 *
 * Resolution cascade:
 *   mediaType map → Mux data → Sanity image dims → title hint → 16:9
 *
 * The mediaType is checked first because it represents the editorial
 * classification set during ingestion. Mux `data.aspect_ratio` can be
 * stale or incorrect — especially when status is "preparing" — leading
 * to orientation mismatches (e.g. 9:16 assets reported as 16:9).
 * For generic types (motion_other, static_other), Mux data is the
 * primary source.
 */
export function ratioOf(asset) {
  // A sequence: the tile shape that crops its frames least (makeSequence).
  if (asset.frames?.length) return asset.sequenceRatio;

  // A directory logo tile: the canvas it was given (1 square, 2 landscape;
  // directory/logoTile.js), whatever its mark's own shape.
  if (asset.tileRatio) return asset.tileRatio;

  // 0. brand-deck pages with real image dims (08-25): the native page
  //    aspect outranks the historical 16:9 default — a COMPILED poster
  //    deck (SA tour, 4:5 stills regrouped as a deck) keeps its aspect
  //    everywhere (DeckScroller wall, directory grid); true 16:9 deck
  //    exports resolve identically to the old constant.
  if (
    asset.mediaType === 'brand-deck' &&
    asset.imageDimensions?.width &&
    asset.imageDimensions?.height
  ) {
    return asset.imageDimensions.width / asset.imageDimensions.height;
  }

  // 1. mediaType-encoded ratio — editorial truth
  const typeRatio = MEDIA_TYPE_RATIOS[asset.mediaType];
  if (typeRatio != null) return typeRatio;

  // 2. Mux data — authoritative for _other types with processed video
  if (asset.videoAspectRatio) {
    const [w, h] = asset.videoAspectRatio.split(':').map(Number);
    if (w && h) return w / h;
  }

  // 3. Sanity image dimensions — authoritative for static images
  if (asset.imageDimensions?.width && asset.imageDimensions?.height) {
    return asset.imageDimensions.width / asset.imageDimensions.height;
  }

  // 4. Title hint — naming convention fallback
  const titleRatio = ratioFromTitle(asset.title);
  if (titleRatio) return titleRatio;

  // 5. Ultimate fallback
  return 16 / 9;
}

export { PORTRAIT_THRESHOLD, MEDIA_TYPE_RATIOS };

const OTHER_TYPE_RE = /_other$/;

/**
 * Whether an asset is labelled `static_other` / `motion_other`: a shape no
 * ratio bucket suits, so its own (ratioOf) is the only truth about it. Such
 * media fill their container, and a surface that picks the container's shape
 * picks the one that crops them least (flushGrid.tileClassOf). A sequence
 * counts when any of its frames does.
 */
export function isOtherAsset(asset) {
  return OTHER_TYPE_RE.test(asset.mediaType ?? '') || !!asset.frames?.some((f) => OTHER_TYPE_RE.test(f.mediaType ?? ''));
}

/** The group types (mediaAsset.groupType); mirrors scripts/lib/cms/contract.mjs,
 *  which site code never imports. */
export const GROUP_TYPES = ['album-art', 'deck', 'banner', 'admat', 'carousel', 'merch', 'visuals', 'live-footage', 'mockups', 'flyer-progression'];

/** Where each type opens its viewer or cycler (11-10, Nathan). A surface a
 *  type leaves out does not show its pieces. */
export const GROUP_SURFACES = {
  'album-art': ['globe', 'work', 'detail', 'directory'],
  deck: ['work', 'detail', 'directory'],
  banner: ['detail', 'directory'],
  admat: ['globe', 'detail', 'directory'],
  carousel: ['work', 'detail', 'directory'],
  merch: ['globe', 'work', 'detail', 'directory'],
  visuals: ['detail', 'directory'],
  'live-footage': ['detail', 'directory'],
  mockups: ['globe', 'detail', 'directory'],
  'flyer-progression': ['globe', 'work', 'detail'],
};

/** The lane a type's piece rides on each surface it opens on, for the types
 *  whose lane differs by surface (US-5). A surface a type leaves out of
 *  GROUP_SURFACES never gets here: that piece is dropped. The directory tile
 *  flips through a mockups set like a sequence (Nathan 11-11), so it rides
 *  the 'sequence' lane there. */
const SURFACE_LANE = {
  mockups: { globe: 'sequence', detail: 'mockups', directory: 'sequence' },
  'flyer-progression': { globe: 'sequence', work: 'sequence', detail: 'carousel' },
};

/** Types whose pieces are NOT dropped off their surfaces (US-4 decision): they
 *  ride the 'role' / 'showcase' lane there as ordinary pieces. A flyer
 *  progression is off only the directory, where each flyer is its own tile
 *  (Nathan 11-16: "display all assets as their own"). */
const OFF_SURFACE_ORDINARY = ['visuals', 'live-footage', 'flyer-progression'];

/** displayGroup convention that marks a brand-deck set as admats (flyers). */
const ADMAT_GROUP_RE = /(^|-)admats?$/i;

/**
 * An asset's group type: its `groupType` when it is one of GROUP_TYPES, else
 * the inference documents from before the field rely on. null = not grouped.
 */
export function groupTypeOf(asset) {
  if (GROUP_TYPES.includes(asset.groupType)) return asset.groupType;
  if (asset.mediaType === 'album-art') return 'album-art';
  if (asset.mediaType === 'brand-deck') return ADMAT_GROUP_RE.test(asset.displayGroup ?? '') ? 'admat' : 'deck';
  if (asset.mediaType === 'carousel-slide') return 'carousel';
  if (isBannerGroup(asset.displayGroup)) return 'banner';
  return null;
}

/**
 * A static logo file: a still typed `logo` (the Logo media type in Studio). An
 * animated logo is a video, typed by its ratio. /work shows none of these
 * (Nathan 11-14); a logo still labelled with a ratio type is not one, so
 * retype it Logo in Studio to keep it off /work.
 */
export function isStaticLogo(asset) {
  return asset.mediaType === 'logo' && !!asset.imageUrl && !asset.playbackId;
}

/** Does this asset's set open its viewer on `surface`? false for an ungrouped asset. */
export function opensOn(asset, surface) {
  const type = groupTypeOf(asset);
  return !!type && GROUP_SURFACES[type].includes(surface);
}

/**
 * The content-flow lane an asset rides, first match wins: 'sequence',
 * 'album-art', 'deck', 'carousel', 'banner', 'admat', 'visuals',
 * 'live-footage', 'mockups', 'role' (any contentRole), 'showcase'. null for an empty shell (no uploaded media).
 *
 * With no `surface` the lanes follow mediaType / displayGroup alone (every
 * admat rides 'deck'). With a `surface` they follow the asset's group type
 * (groupTypeOf), and null also means its set does not open on that surface.
 * 'admat' is for still members only on the globe, where a motion admat rides
 * 'role' / 'showcase' as its own tile. On 'detail' a motion admat is a member
 * too (it plays in the set's wall, SQ-52), and on 'directory' (SQ-53) it is a
 * frame of the set's cycling tile, which plays it through on the shared beat.
 * A `merch` still rides 'sequence' on every surface (a motion one is an
 * ordinary piece). `visuals` / `live-footage` take their own lane where they
 * open and ride 'role' / 'showcase' elsewhere, never null (OFF_SURFACE_ORDINARY).
 * `mockups` and `flyer-progression` follow SURFACE_LANE where they open,
 * motion members included (a sequence shows a motion member as its poster);
 * mockups on 'work' is null, and a flyer progression on 'directory' is an
 * ordinary piece. A static logo (isStaticLogo) on 'work' is null before any
 * of that, sequence membership included.
 */
export function assetLane(asset, surface) {
  if (!asset.playbackId && !asset.imageUrl) return null;
  if (surface === 'work' && isStaticLogo(asset)) return null;
  if (isSequenceGroup(asset.displayGroup) && asset.imageUrl && !asset.playbackId) return 'sequence';
  if (surface === undefined) {
    if (asset.mediaType === 'album-art') return 'album-art';
    if (asset.mediaType === 'brand-deck') return 'deck';
    if (asset.mediaType === 'carousel-slide') return 'carousel';
    if (isBannerGroup(asset.displayGroup)) return 'banner';
  } else {
    const type = groupTypeOf(asset);
    if (type) {
      const still = asset.imageUrl && !asset.playbackId;
      if (!opensOn(asset, surface)) {
        if (!OFF_SURFACE_ORDINARY.includes(type)) return null;
      } else if (type === 'merch') {
        if (still) return 'sequence';
      } else if (SURFACE_LANE[type]) return SURFACE_LANE[type][surface];
      else if (type !== 'admat') return type;
      else if (surface !== 'globe' || still) return 'admat';
    }
  }
  if (asset.contentRole) return 'role';
  return 'showcase';
}

/** Does `want` (an entry of ?chunks) name this asset: its _id, or the tail of
 *  its _id after the `mediaAsset-` prefix or after any `-` (its slug). */
const namesAsset = (want, asset) =>
  asset._id === want || asset._id === `mediaAsset-${want}` || asset._id.endsWith(`-${want}`);

/**
 * Chunks (11-05, Nathan): a showcase video flagged `splitIntoThirds` in
 * Sanity (or named by the dev override `?chunks=<slug or id>[,…]`) becomes
 * CHUNK_COUNT tiles in its place, each a copy of the asset carrying its own
 * `chunk` range (chunkRanges, imageConfig) and a `<_id>~<k>of<n>` id.
 * `gap` tiles (?chunkgap, default 0) sit between one chunk and the next. A
 * video with no known duration stays one tile. The hero is not in this list;
 * splitHero (below) splits it.
 */
export function expandChunks(list, { only = [], gap = 0 } = {}) {
  const out = [];
  for (const asset of list) {
    const flagged = asset.playbackId && (asset.splitIntoThirds || only.some((w) => namesAsset(w, asset)));
    const ranges = flagged ? chunkRanges(asset.videoDuration) : null;
    if (!ranges) {
      out.push(asset);
      continue;
    }
    ranges.forEach((range, k) =>
      out.push({
        ...asset,
        _id: `${asset._id}~${k + 1}of${ranges.length}`,
        // the descriptor is read once, not once per tile
        ...(k > 0 ? { description: undefined } : {}),
        chunk: { of: asset._id, index: k, count: ranges.length, ...range, ...chunkWindow(range) },
      })
    );
  }
  if (!(gap > 0)) return out;
  // Spread: chunk k > 0 moves to `gap` tiles after chunk k - 1.
  const spread = out.filter((a) => !(a.chunk?.index > 0));
  for (const a of out) {
    if (!(a.chunk?.index > 0)) continue;
    const home = spread.findIndex((b) => b.chunk?.index === 0 && b.chunk.of === a.chunk.of);
    spread.splice(Math.min(home + a.chunk.index * (gap + 1), spread.length), 0, a);
  }
  return spread;
}

/** Where a split hero's thirds 2 and 3 land in the showcase (Nathan 11-12):
 *  the 5th and 6th tiles of the reading order, so index 4. A showcase of fewer
 *  than four tiles takes them at its end. */
export const HERO_SPLIT_AT = 4;

/** The hero (assets[0]) when it is a video flagged `splitIntoThirds` (or named
 *  by ?chunks): it keeps the hero slot as its third 1 and hands the other two
 *  thirds back as `rest`, to be spliced into the showcase at HERO_SPLIT_AT. An
 *  unflagged hero, one with no duration, or an image stays whole (`rest` []).
 *  ?chunkgap does not apply: the two thirds sit side by side. */
export function splitHero(hero, { only = [] } = {}) {
  if (!hero) return { hero, rest: [] };
  const [first, ...rest] = expandChunks([hero], { only });
  return { hero: first, rest };
}

const sortByDeckOrder = (pages) => [...pages].sort((a, b) => (a.brandDeckOrder ?? 0) - (b.brandDeckOrder ?? 0));

/** The lane a leading set's members ride on detail, by type (the types setHero.js lets lead). */
const HERO_SET_LANE = {
  'album-art': 'album-art',
  deck: 'deck',
  admat: 'admat',
  carousel: 'carousel',
  'flyer-progression': 'carousel',
  visuals: 'visuals',
  mockups: 'mockups',
  merch: 'sequence',
};

/**
 * The set that leads a project page in its own viewer (US-10, Nathan 11-16), or null. On `detail`
 * only: when the hero (assets[0]) belongs to a set that may lead (leadsAsSet, setHero.js: its Set
 * document's "Can be the hero", or a legacy deck), that set's every member, the hero included, in
 * rank order (a deck's and an admat's pages in brandDeckOrder, as their walls always sat).
 * `preview` (?heroset=1) treats any first piece's set as allowed, legacy sets included. A set of one
 * is no set (a deck of one keeps leading, as it did): the piece leads on its own.
 */
function heroSetOf(assets, surface, preview) {
  const first = assets[0];
  if (surface !== 'detail' || !first) return null;
  const type = groupTypeOf(first);
  const leads = preview ? setCanLead({ groupType: type, allowAsHero: true }) : leadsAsSet(first, type);
  if (!leads) return null;
  const key = first.displayGroup ?? type;
  const lane = HERO_SET_LANE[type];
  const sameSet = (a) =>
    first.setId
      ? a.setId === first.setId
      : groupTypeOf(a) === type && (type === 'album-art' || (a.displayGroup ?? type) === key);
  const items = [first, ...assets.slice(1).filter((a) => sameSet(a) && assetLane(a, surface) === lane)];
  if (items.length < 2 && type !== 'deck') return null;
  return { group: key, type, items: type === 'deck' || type === 'admat' ? sortByDeckOrder(items) : items };
}

/** The lanes whose members leave the tile flow as one set. */
const SET_LANES = new Set(['album-art', 'deck', 'carousel', 'admat', 'visuals', 'live-footage', 'mockups', 'banner']);
/** One key per set: the lane plus its group (the covers are one set, the wall). */
const setKey = (lane, group) => `${lane}:${lane === 'album-art' ? '' : group}`;

/**
 * Every set carries its place in the Studio order (Nathan 11-14: "the order of
 * the sets is based on the position of the first media asset in the studio
 * ranking. Even if all of the set items were not together in order and one of
 * them was higher up, the whole set would get pushed up to that position"):
 *   rank  the index in `assets` of its first-ranked member. The hero counts,
 *         so the set it belongs to has rank 0 and leads the grid.
 *   at    the showcase index the set sits before: the first tile ranked after
 *         that member, or the showcase's length when none is. A split hero's
 *         thirds (unranked) and a split video's own thirds are never parted.
 * `albumArtSeat` is the cover wall's `{rank, at}`, null without a wall.
 */
export function buildContentFlow(assets, { surface, orbitMin = ORBIT_MIN, chunks, heroSetPreview = false } = {}) {
  // A leading set is the hero as a whole: it is in no bucket and has no seat, and the hero's own
  // thirds (a flagged video) do not split off it. Output without one is exactly as it always was.
  const heroSet = heroSetOf(assets, surface, heroSetPreview);
  const inHeroSet = new Set(heroSet?.items.map((a) => a._id));
  const albumArt = [];
  const bts = [];
  const showcase = [];
  // Map preserves insertion order → group order = first appearance =
  // lowest-orderRank member (controlled-adjacency convention).
  const deckGroups = new Map();
  const carouselGroups = new Map();
  const bannerGroups = new Map();
  const admatGroups = new Map();
  const visualsGroups = new Map();
  const footageGroups = new Map();
  const mockupGroups = new Map();
  const sequenceGroups = new Map();
  // A set's rank: its first member's index (the loop runs in rank order).
  const firstRank = new Map();
  const noteRank = (asset, lane, i) => {
    if (!SET_LANES.has(lane)) return;
    const key = setKey(lane, asset.displayGroup ?? lane);
    if (!firstRank.has(key)) firstRank.set(key, i);
  };
  const rankOf = (lane, group) => firstRank.get(setKey(lane, group));
  if (assets[0] && !heroSet) noteRank(assets[0], assetLane(assets[0], surface), 0);

  // assets[0] is the hero (first in drag-to-order ranking) — skip it.
  // showcase/albumArt entries carry their loop index so a gate fold-back
  // can restore the original orderRank interleaving.
  for (let i = 1; i < assets.length; i++) {
    const asset = assets[i];
    if (inHeroSet.has(asset._id)) continue;
    const lane = assetLane(asset, surface);

    // Skip empty shells — assets with no uploaded media can't render
    if (!lane) continue;
    noteRank(asset, lane, i);

    if (lane === 'sequence') {
      const key = asset.displayGroup ?? groupTypeOf(asset);
      if (!sequenceGroups.has(key)) sequenceGroups.set(key, []);
      sequenceGroups.get(key).push({ i, asset });
    } else if (lane === 'album-art') albumArt.push({ i, asset });
    else if (lane === 'deck') {
      const key = asset.displayGroup ?? 'deck';
      if (!deckGroups.has(key)) deckGroups.set(key, []);
      deckGroups.get(key).push(asset);
    } else if (lane === 'carousel') {
      const key = asset.displayGroup ?? 'carousel';
      if (!carouselGroups.has(key)) carouselGroups.set(key, []);
      carouselGroups.get(key).push({ i, asset });
    } else if (lane === 'admat') {
      const key = asset.displayGroup ?? 'admat';
      if (!admatGroups.has(key)) admatGroups.set(key, []);
      admatGroups.get(key).push({ i, asset });
    } else if (lane === 'visuals' || lane === 'live-footage' || lane === 'mockups') {
      const groups = lane === 'visuals' ? visualsGroups : lane === 'mockups' ? mockupGroups : footageGroups;
      const key = asset.displayGroup ?? lane;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ i, asset });
    } else if (lane === 'banner') {
      const key = asset.displayGroup;
      if (!bannerGroups.has(key)) bannerGroups.set(key, []);
      bannerGroups.get(key).push(asset);
    } else if (lane === 'role') bts.push(asset);
    else showcase.push({ i, asset });
  }

  // A sequence takes its first member's place in the flow.
  for (const [group, members] of sequenceGroups) {
    if (members.length < 2) {
      showcase.push(members[0]);
      continue;
    }
    // A motion member (flyer-progression, mockups) is a frame as its poster; the tile
    // shape is judged on the members' labels, which the poster twin would not carry.
    const frames = members.map((e) => posterStill(e.asset));
    showcase.push({ i: members[0].i, asset: makeSequence(`sequence:${group}`, frames, members.map((e) => ratioOf(e.asset))) });
  }

  // An admat set of one rides the showcase at its place, as a one-member
  // sequence does.
  const admats = [];
  for (const [group, members] of admatGroups) {
    if (members.length < 2) showcase.push(members[0]);
    else admats.push({ group, items: sortByDeckOrder(members.map((e) => e.asset)), rank: rankOf('admat', group) });
  }

  // Visuals, live-footage and mockups sets: two members or more make a set (items in
  // input order); a set of one rides the showcase at its place, as admats do.
  const setsOf = (groups, lane) => {
    const sets = [];
    for (const [group, members] of groups) {
      if (members.length < 2) showcase.push(members[0]);
      else sets.push({ group, items: members.map((e) => e.asset), rank: rankOf(lane, group) });
    }
    return sets;
  };
  const visuals = setsOf(visualsGroups, 'visuals');
  const liveFootage = setsOf(footageGroups, 'live-footage');
  const mockups = setsOf(mockupGroups, 'mockups');

  // Carousels group like decks: group order = first appearance, slides keep
  // their incoming order (orderRank, set via drag-to-order) within a group. A
  // flyer-progression of one rides the showcase at its place like any set of
  // one; a lone carousel slide stays a one-slide carousel, as it always was.
  const carousels = [];
  for (const [group, members] of carouselGroups) {
    if (members.length < 2 && groupTypeOf(members[0].asset) === 'flyer-progression') showcase.push(members[0]);
    else carousels.push({ group, pages: members.map((e) => e.asset), rank: rankOf('carousel', group) });
  }

  // ORBIT_MIN gate — below it, covers fold back into the showcase flow.
  const orbits = albumArt.length >= orbitMin;
  const ranked = (orbits ? showcase : [...showcase, ...albumArt]).sort((a, b) => a.i - b.i);
  const showcaseOut = expandChunks(ranked.map((e) => e.asset), chunks);
  const { rest: heroRest } = heroSet ? { rest: [] } : splitHero(assets[0], chunks);
  let heroAt = Math.min(HERO_SPLIT_AT, showcaseOut.length);
  // Never between another video's thirds: land right after the run it would cut.
  while (showcaseOut[heroAt]?.chunk?.index > 0 && showcaseOut[heroAt - 1]?.chunk?.of === showcaseOut[heroAt].chunk.of) heroAt += 1;
  showcaseOut.splice(heroAt, 0, ...heroRest);
  const albumArtOut = orbits ? albumArt.map((e) => e.asset) : [];

  // Decks: pages sequence by brandDeckOrder within each group (stable sort
  // keeps orderRank order for ties).
  const brandDecks = [...deckGroups.entries()].map(([group, pages]) => ({
    group,
    pages: sortByDeckOrder(pages),
    rank: rankOf('deck', group),
  }));

  // Banners keep incoming orderRank order within each group.
  const banners = [...bannerGroups.entries()].map(([group, items]) => ({ group, items, rank: rankOf('banner', group) }));

  // Each set's seat in the final showcase (the hero's thirds are in it now, and
  // carry no rank; a split video's thirds share their video's).
  const tileRank = new Map(ranked.map((e) => [e.asset._id, e.i]));
  const seatAt = (rank) => {
    const k = showcaseOut.findIndex((tile) => tileRank.get(tile.chunk?.of ?? tile._id) > rank);
    return k === -1 ? showcaseOut.length : k;
  };
  const seated = (sets) => sets.map((set) => ({ ...set, at: seatAt(set.rank) }));
  const coverRank = rankOf('album-art');
  const albumArtSeat = orbits ? { rank: coverRank, at: seatAt(coverRank) } : null;

  return {
    showcase: showcaseOut,
    albumArt: albumArtOut,
    albumArtSeat,
    brandDecks: seated(brandDecks),
    carousels: seated(carousels),
    banners: seated(banners),
    admats: seated(admats),
    visuals: seated(visuals),
    liveFootage: seated(liveFootage),
    mockups: seated(mockups),
    bts,
    ...(heroSet ? { heroSet } : {}),
  };
}
