/**
 * LivePanelScheduler.js — Migrates "live video" status between panels and
 * cycles hidden-hemisphere thumbnails through the asset pool.
 *
 * Called at ~2Hz (not per frame). Prominence score = panel center normal
 * rotated by the globe, read on the camera axis (.z): 1 = dead center,
 * -1 = fully hidden.
 *
 *  - Promote: score > PROMOTE_SCORE and a slot is free → HLS video fades in
 *    over the thumbnail (uMix 0→1) once frames are presenting.
 *  - Demote: score < DEMOTE_SCORE (hysteresis) after MIN_LIVE_DWELL —
 *    uMix fades back to the thumbnail, then the slot frees.
 *  - Hidden swap: score < SWAP_SCORE → texA quietly advances to the next
 *    pool asset; the inner sphere occludes the rear hemisphere so swaps are
 *    never visible. One swap per panel per trip behind the globe.
 *
 * Optional onLiveChange(panel, 'live'|'off') announces the transitions
 * outward (the home hero's tracking labels) — see the constructor JSDoc.
 * Events only; nothing outside ever polls scheduler internals.
 *
 * Globe-worlds population modes: a still tile (no playbackId) never promotes,
 * a tile mid-swap (panel.swapping — tileSwap.js) never promotes, and
 * dropLive(panel) frees a tile's video instantly, under a swap's dip.
 * setShared(true) (?poplive=shared) spends the decode budget per CLIP instead
 * of per tile: one slot, one <video>, one VideoTexture per playbackId, bound
 * on every tile showing it (see updateShared).
 *
 * The fast handoff (?pophandoff=fast, shared streams; Nathan 10-27): a change
 * starts its clips while its tiles still swap (update's `incoming`), on a
 * 0.1 s beat (HANDOFF_BEAT_S), and a stream that loads before its tiles land
 * waits for them. The director plans the next world's board ahead and fetches
 * the clips this scheduler would start on it (landingClips → predictStarts →
 * streamPrefetch) once handoffQuiet says this world's are in.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { computeCoverUv } from './TextureManager.js';
import { getPlaceholderTexture } from './panelMaterial.js';
import { TUNING as POP_TUNING } from './popConfig.js';
import {
  MAX_LIVE,
  RADIUS,
  PROMOTE_SCORE,
  DEMOTE_SCORE,
  SWAP_SCORE,
  MIN_LIVE_DWELL_SECONDS,
  MAX_LIVE_DWELL_SECONDS,
  RELIVE_COOLDOWN_SECONDS,
  CROSSFADE_SECONDS,
  GLOBE_STREAM_PARAMS,
  GLOBE_PREVIEW_SECONDS,
} from './globeConfig.js';
import { liveB, pictureAspect, mp, frameOf, rungAtMost, sourceShort, parseRatio, STREAM_RUNGS, TIER_RANK, pinShortOf } from './unitSpan.js';
import { windowA, setWindowA, setWindowB, shownWindowA } from './tileSwap.js';
import { planUrl } from './streamPrefetch.js';
import { primedPlaylist } from '../work/hlsPrimed.js';

// NDC margin for "on screen" — matters in mobile cover-overscan, where a
// panel can face the camera yet sit cropped outside the viewport
const VIEWPORT_NDC_LIMIT = 1.05;

const MAX_SWAPS_PER_UPDATE = 4; // spread thumbnail fetches out over time
// Spread Hls/MSE startups across beats — a drag release frees several slots
// at once, and refilling them all in one beat stacks player setups on a frame
const MAX_PROMOTES_PER_UPDATE = 2;
const TIER_PENDING_S = 2 * GLOBE_PREVIEW_SECONDS; // a pinned rung that hasn't presented within two loops is treated as missing
// The fast handoff's beat (useGlobeScene reads it): a change's clips start while it lands and a tile joins within a
// beat of landing, still at most MAX_PROMOTES_PER_UPDATE a beat.
export const HANDOFF_BEAT_S = 0.1;
const HANDOFF_QUIET_S = 0.3; // nothing loading and no start for this long: the world's videos are in (handoffQuiet)

function parseAspect(ratio) {
  if (typeof ratio !== 'string') return 1;
  const [w, h] = ratio.split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}

export default class LivePanelScheduler {
  /**
   * @param {Object} opts
   * @param {Array} opts.panels - panel records with { mesh, centerDir, panelAspect, asset }
   * @param {Array} opts.assets - full ordered asset pool
   * @param {Object} opts.poolHandle - VideoSlotPool imperative handle (ref.current)
   * @param {TextureManager} opts.textureManager
   * @param {(panel: Object, state: 'live'|'off') => void} [opts.onLiveChange]
   *        Live-transition events (home-hero labels, chunk 6): 'live' when a
   *        promotion's crossfade COMPLETES (the panel is actually showing
   *        video), 'off' at demote start and on any slot release/teardown.
   *        The liveAnnounced latch guarantees exactly one 'off' per 'live' —
   *        a pending rollback that never presented frames emits nothing.
   * @param {boolean} [opts.cycleThumbnails=true] - hidden-hemisphere thumbnail
   *        cycling. The home-hero ContentConveyor owns panel.asset/texA now, so
   *        it passes false to stop the scheduler fighting it over texA; lab and
   *        other callers keep the default rear-hemisphere swap.
   * @param {(cls: string) => ({ rung: number, floor: number }|null)} [opts.tierFor]
   *        Stream tiers (?poptier, shared streams under ?popunits): a stream's
   *        rung from its brightest unit class. null = the pool's pin for every stream.
   * @param {string} [opts.bucket] - the DPR bucket tierFor reads, for decodeStats
   * @param {string} [opts.pinParams=GLOBE_STREAM_PARAMS] - the pool's pin (a test seam)
   */
  constructor({
    panels,
    assets,
    poolHandle,
    textureManager,
    onLiveChange = null,
    cycleThumbnails = true,
    tierFor = null,
    bucket = null,
    pinParams = GLOBE_STREAM_PARAMS,
  }) {
    this.panels = panels;
    this.assets = assets;
    this.pool = poolHandle;
    this.textureManager = textureManager;
    this.onLiveChange = onLiveChange;
    this.cycleThumbnails = cycleThumbnails;
    this.tierFor = tierFor; // (unit class) → { rung, floor } | null (useGlobeScene); null = the pool's pin for every stream
    this.bucket = bucket; // the DPR bucket tierFor reads (useGlobeScene, load-time): decodeStats reports it
    this.pinShort = pinShortOf(pinParams); // the pool's pin (GLOBE_STREAM_PARAMS): by default 720 on desktop (Nathan 10-23, Q22) and 480 on phones, else ?globeres's rung
    this.decodeBudget = MAX_LIVE * mp(this.pinShort, 16 / 9); // MAX_LIVE × the served pin frame: today's at the default (R4)
    this.tierFail = new Set(); // playbackIds whose planned rung failed: their next start asks the pin itself
    this.pinParams = pinParams; // the pool's own URL params (streamPrefetch.planUrl, for the handoff's primed count)
    this.incoming = null; // the fast handoff, mid-change: the worlds coming in (update)
    this.camera = null; // the last update's camera: landingClips scores a board ahead with it
    this.lastStartAt = -Infinity; // when the last stream started (handoffQuiet)
    this.handoff = { starts: 0, ahead: 0, primed: 0 }; // the fast handoff's starts: all, mid-change, onto a primed clip
    this.disposed = false;

    // Next pool index for hidden swaps — starts after the initial assignment
    this.cursor = assets.length ? panels.length % assets.length : 0;
    /** @type {Array<Object|null>} slot index → panel currently holding it
     *  (shared mode: the stream holding it) */
    this.slots = Array(MAX_LIVE).fill(null);
    this.shared = false;
    /** shared mode: playbackId → { id, slot, state, texture, panels, since, maxDwell } */
    this.streams = new Map();
    this.clipLastEnd = new Map(); // shared mode: playbackId → when its stream ended (cooldown)

    this.scoreVec = new THREE.Vector3();
    this.projVec = new THREE.Vector3();
    this.now = 0;
    this.lastVisibleCount = 0;
  }

  /**
   * @param {THREE.Euler} rotation - current globe rotation
   * @param {number} now - seconds since scene start
   * @param {THREE.Camera} camera - for viewport visibility (overscan crop)
   * @param {boolean} [dragging=false] - user is mid-drag: skip promotions
   *        (no Hls startups during the gesture); demotes and hidden swaps
   *        still run
   * @param {Set<number>|null} [incoming=null] - the fast handoff only: a
   *        population change is landing these worlds, so their clips may
   *        start while the tiles still swap (useGlobeScene passes it while the
   *        director is busy instead of deferring as `dragging`)
   */
  update(rotation, now, camera, dragging = false, incoming = null) {
    if (this.disposed || !this.assets.length) return;
    this.now = now;
    this.incoming = this.handoffFast ? incoming : null;
    this.camera = camera;

    const scored = this.scoreAll(rotation, camera);
    this.lastVisibleCount = scored.filter((s) => s.visible).length;

    // Shared streams run on the scroll globe only, where the hidden-hemisphere
    // cycle below is off (cycleThumbnails false), so its latch never matters.
    if (this.shared) {
      this.updateShared(scored, dragging);
    } else {
      for (const { panel, score, visible } of scored) {
        // Reset the per-trip swap latch once the panel comes around front
        if (score > 0) panel.swappedWhileHidden = false;

        // Pole-adjacent panels never fall below the (low) demote threshold, so
        // a hard max dwell rotates every slot; the cooldown below stops the
        // same prominent panel from immediately re-winning it. Dwell is
        // jittered per promote (±25%) so slots filled together don't all
        // fade in one synchronized wave.
        if (
          panel.liveState === 'live' &&
          // Parked (past-pole, collapsed) scroll tiles demote immediately —
          // streaming video into an invisible about-to-recycle row is wasted.
          (panel.parked ||
            ((score < DEMOTE_SCORE || !visible) && now - panel.liveSince > MIN_LIVE_DWELL_SECONDS) ||
            now - panel.liveSince > (panel.liveMaxDwell ?? MAX_LIVE_DWELL_SECONDS))
        ) {
          this.demote(panel);
        }
      }

      // Promote the most prominent eligible on-screen panels into free slots.
      // Deferred entirely mid-drag — panels demoted by the gesture would refill
      // immediately and stutter the drag; the beat after release catches up.
      if (!dragging) {
        const candidates = scored
          .filter(
            ({ panel, score, visible }) =>
              !panel.liveState &&
              panel.asset?.playbackId && // stills have no stream
              !panel.asset.place && // members never promote per tile (stills in tile mode)
              (!panel.asset.tex || panel.shownAsset === panel.asset) && // B derives from the bound A
              !panel.swapping &&
              !panel.parked && // never stream into a collapsed past-pole scroll tile
              visible &&
              score > PROMOTE_SCORE &&
              now - (panel.lastLiveEnd ?? -Infinity) > RELIVE_COOLDOWN_SECONDS
          )
          .sort((a, b) => b.score - a.score);
        let promotes = 0;
        for (const { panel } of candidates) {
          if (promotes >= MAX_PROMOTES_PER_UPDATE) break;
          const slot = this.slots.indexOf(null);
          if (slot === -1) break;
          this.promote(panel, slot);
          promotes += 1;
        }
      }
    }

    // Hidden-hemisphere cycling — skipped when a ContentConveyor owns texA.
    if (this.cycleThumbnails) {
      let swaps = 0;
      for (const { panel, score } of scored) {
        if (swaps >= MAX_SWAPS_PER_UPDATE) break;
        if (score < SWAP_SCORE && !panel.liveState && !panel.swappedWhileHidden && !panel.swapping) {
          this.swapHidden(panel);
          swaps += 1;
        }
      }
    }
  }

  /** Every panel's prominence at `rotation`: its score (the rotated centre on the camera axis) and whether it is
   *  visible (facing, and inside the viewport when there is a camera). */
  scoreAll(rotation, camera = this.camera) {
    return this.panels.map((panel) => {
      const dir = this.scoreVec.copy(panel.centerDir).applyEuler(rotation);
      const score = dir.z;
      let visible = score > 0;
      if (visible && camera) {
        this.projVec.copy(dir).multiplyScalar(RADIUS).project(camera);
        visible =
          Math.abs(this.projVec.x) <= VIEWPORT_NDC_LIMIT &&
          Math.abs(this.projVec.y) <= VIEWPORT_NDC_LIMIT;
      }
      return { panel, score, visible };
    });
  }

  /**
   * The content conveyor advanced this panel's asset — any live video here now
   * streams the wrong tile. Demote it (crossfade back to the now-correct still);
   * the promote loop re-establishes video on the new asset if it stays prominent.
   * A 'pending' promotion is left alone: it's brief and will rotate off on its
   * own, and cancelling an in-flight pool assign cleanly isn't worth the churn.
   */
  notifyContentChange(panel) {
    if (this.disposed) return;
    if (this.shared) this.detach(panel); // the stream plays on for its other copies
    else if (panel.liveState === 'live') this.demote(panel);
  }

  /**
   * A population swap is changing this tile's asset under a dip to black or
   * blue — release its video NOW (no crossfade back to the still: the screen
   * is dark, and the still is about to change too). Pending promotions roll
   * back through the same liveState check the pool resolve already makes.
   */
  dropLive(panel) {
    if (this.disposed) return;
    if (this.shared) {
      this.detach(panel);
      return;
    }
    if (!panel.liveState) return;
    gsap.killTweensOf(panel.mesh.material.uniforms.uMix);
    this.freePanel(panel, { releasePool: true });
  }

  /**
   * Switch the live tier between one decode per tile (default) and shared
   * streams (the population modes, ?poplive). Everything live drops first; the
   * next update re-lights the prominent tiles under the new mode.
   */
  /** ?pophandoff=fast, read live: shared streams only (one decode per clip is what a clip fetched ahead feeds). */
  get handoffFast() {
    return this.shared && POP_TUNING.handoff === 'fast';
  }

  setShared(on) {
    const want = !!on;
    if (this.disposed || want === this.shared) return;
    for (const s of [...this.streams.values()]) this.releaseStream(s);
    for (const p of this.panels) {
      if (!p.liveState) continue;
      gsap.killTweensOf(p.mesh.material.uniforms.uMix);
      this.freePanel(p, { releasePool: true });
    }
    this.shared = want;
  }

  /* — Shared streams (?poplive=shared) — the decode budget is spent per CLIP,
     not per tile: one slot, one <video>, ONE VideoTexture per playbackId,
     bound into texB on every tile showing that clip (each with its own cover
     crop), so a world whose clips repeat across the globe lights every repeat
     for one decode — and the repeats run in sync, the same frame on every
     copy. A tile joins while it shows the clip (not parked, not mid-swap) and
     leaves the instant its content changes (recycle, a swap's dip,
     dropLive). A stream starts for the most prominent visible clips (their
     tiles' scores summed), ends when none of its tiles is on screen after
     MIN_LIVE_DWELL or at its jittered max dwell (every copy crossfades back
     to the still), then its clip cools down before it can win a slot again. — */
  updateShared(scored, dragging) {
    const now = this.now;
    const seen = new Set();
    for (const { panel, score, visible } of scored) {
      const s = panel.liveStream;
      if (!s) continue;
      if (panel.parked || panel.asset?.playbackId !== s.id || (panel.asset?.place?.uid ?? null) !== (panel.liveUid ?? null)) this.detach(panel);
      else if (visible && score >= DEMOTE_SCORE) seen.add(s);
    }
    // The fast handoff: a stream that loaded before its tiles landed waits for them while one is still on its way
    // (aheadScores), up to MIN_LIVE_DWELL unseen, instead of ending into its cooldown.
    const ahead = this.handoffFast ? this.aheadScores(scored) : null;
    for (const s of [...this.streams.values()]) {
      if (s.state !== 'live') continue;
      const age = now - s.since;
      if ((!s.panels.size && !ahead?.has(s.id)) || (!seen.has(s) && age > MIN_LIVE_DWELL_SECONDS) || age > s.maxDwell) {
        this.endStream(s);
      }
    }
    // Joining costs no decode — it runs mid-drag too.
    for (const { panel } of scored) {
      const grp = this.joinGroup(panel);
      if (!grp) continue;
      const s = this.streams.get(panel.asset.playbackId);
      if (s?.state === 'live') for (const m of grp) this.attach(m, s);
    }
    // New streams wait out a drag or a population relayout, like promotes —
    // except a fast handoff's change, which starts its own clips as it lands.
    if (dragging) return;
    const clips = new Map();
    if (this.incoming) {
      for (const [id, score] of ahead) {
        if (this.streams.has(id) || now - (this.clipLastEnd.get(id) ?? -Infinity) <= RELIVE_COOLDOWN_SECONDS) continue;
        clips.set(id, score);
      }
    } else for (const { panel, score, visible } of scored) {
      if (!visible || score <= PROMOTE_SCORE) continue;
      const grp = this.joinGroup(panel);
      if (!grp) continue;
      const id = panel.asset.playbackId;
      if (this.streams.has(id)) continue;
      if (now - (this.clipLastEnd.get(id) ?? -Infinity) <= RELIVE_COOLDOWN_SECONDS) continue;
      clips.set(id, (clips.get(id) || 0) + score * grp.length);
    }
    let starts = 0;
    for (const [id] of [...clips].sort((a, b) => b[1] - a[1])) {
      if (starts >= MAX_PROMOTES_PER_UPDATE) break;
      const slot = this.slots.indexOf(null);
      if (slot === -1) break;
      const plan = this.planOf(id);
      if (plan === false) break; // the most prominent clip that doesn't fit blocks this beat
      this.startStream(id, slot, plan);
      starts += 1;
    }
  }

  /* The shared-mode choke point: the join loop, the clip-score accumulation
     and the resolve-time attach sweep all pass through here, so what may join
     is decided in ONE place instead of three that could drift apart. */
  canJoin(panel) {
    return (
      !!panel.asset?.playbackId &&
      !panel.liveState &&
      !panel.parked &&
      !panel.swapping &&
      (!panel.asset.tex || panel.shownAsset === panel.asset)
    );
  }

  /** The fast handoff's look ahead: clip → its summed score over the visible tiles about to show it, a tile mid-swap
   *  by its incoming asset (swapAsset) and any other by its own, bound or not (aheadGroup). Mid-change only the
   *  incoming worlds' tiles count, so the world going out starts nothing. */
  aheadScores(scored) {
    const out = new Map();
    for (const { panel, score, visible } of scored) {
      if (!visible || score <= PROMOTE_SCORE) continue;
      const a = panel.swapAsset || panel.asset;
      if (!a?.playbackId || (this.incoming && !this.incoming.has(a.world))) continue;
      const grp = this.aheadGroup(panel, a);
      if (grp) out.set(a.playbackId, (out.get(a.playbackId) || 0) + score * grp.length);
    }
    return out;
  }

  /** joinGroup for the tiles about to show `a`: none parked, a unit whole in what its members will
   *  show, whether or not they are mid-swap, bound yet or lit. */
  aheadGroup(panel, a) {
    if (panel.parked) return null;
    const pl = a.place;
    if (!pl) return [panel];
    if (pl.members[0] !== panel) return null;
    return pl.members.every((m) => (m.swapAsset || m.asset)?.place?.uid === pl.uid && !m.parked) ? pl.members : null;
  }

  /** The tiles that join a stream together: a single-only tile alone, or a whole
   *  unit through its lead, all or none. One parked or mid-swap member keeps
   *  the whole unit off. */
  joinGroup(panel) {
    const pl = panel.asset?.place;
    if (!pl) return this.canJoin(panel) ? [panel] : null;
    if (pl.members[0] !== panel) return null;
    return pl.members.every((m) => m.asset?.place?.uid === pl.uid && this.canJoin(m)) ? pl.members : null;
  }

  /** A stream's plan: null = no tiers (the pool's pin, no admission), also under a pin below 480;
   *  else the rung its brightest tile class asks for in this DPR bucket, never
   *  above the source, one rung lower if that doesn't fit the decode budget, or
   *  false = doesn't fit (head-of-line). An id whose planned rung failed asks
   *  the pin itself, with no retry below it. */
  planOf(id) {
    if (!this.tierFor) return null;
    // A pin below 480 (?globeres=270p): the tiers stand down and every stream plays the pin, as with units off.
    // Tiered plans would start above the pin inside a budget sized to it, and under auto an id that asks the pin
    // (a failed rung, an unknown source) would sit below the 480 floor on every beat (§3.9).
    if (this.pinShort < 480) return null;
    let cls = 's';
    let ratio = null;
    let src = null;
    for (const p of this.panels) {
      const a = this.incoming ? p.swapAsset || p.asset : p.asset; // mid-change (the fast handoff): what the tile is about to show
      if (p.parked || a?.playbackId !== id) continue;
      const c = a.place ? a.place.cls : 's';
      if (TIER_RANK[c] > TIER_RANK[cls]) cls = c;
      ratio ??= parseRatio(a.videoAspectRatio);
      src ??= sourceShort(a); // the island's s (M2): TOP_RUNG when not carried, 0 when unknown
    }
    const t = this.tierFor(cls);
    if (!t) return null;
    // A failed rung (tierFail) falls back to the pin itself, the rendition the pool plays with no tiers, and
    // never retries below it: under ?globeres=720p a failed 480 plan would otherwise ask for 480 again.
    const failed = this.tierFail.has(id);
    let want = failed ? this.pinShort : t.rung;
    // Never above the source (M2): an upgrade takes the largest rung the source reaches; unknown (0) stays at the pin.
    if (want > this.pinShort) want = Math.max(this.pinShort, rungAtMost(Math.min(want, src ?? 0)));
    const k = STREAM_RUNGS.indexOf(want);
    const used = this.plannedMp();
    for (const rung of failed ? [want] : [want, STREAM_RUNGS[k - 1]]) {
      if (!(rung >= t.floor)) continue;
      const plan = this.rungPlan(rung, ratio ?? 16 / 9);
      if (used + plan.mp <= this.decodeBudget + 1e-9) return plan;
      if (this.incoming) return false; // mid-change the world going out still holds budget: wait for it, not a rung lower
    }
    return false;
  }

  /** The fast handoff's forecast: the plans `clips` (most wanted first, { id, asset }: the asset dressed as the unit
   *  class it should light) would start on, with nothing streaming: planOf's own admission, a false ending the walk
   *  as it ends a beat (head-of-line), at most one per slot. */
  predictStarts(clips) {
    let used = 0;
    const sim = Object.create(this, { panels: { value: [], writable: true }, incoming: { value: null }, plannedMp: { value: () => used } });
    const out = [];
    for (const { id, asset } of clips) {
      if (out.length >= this.slots.length) break;
      sim.panels = [{ parked: false, asset }];
      const plan = this.planOf.call(sim, id);
      if (plan === false) break;
      out.push({ id, plan });
      used += plan ? plan.mp : mp(this.pinShort, 16 / 9);
    }
    return out;
  }

  /** predictStarts before the scheduler exists (the intro hold defers it, useGlobeScene): a fresh one's admission. */
  static forecast(clips, { tierFor = null, pinParams = GLOBE_STREAM_PARAMS } = {}) {
    return new LivePanelScheduler({ panels: [], assets: [], poolHandle: null, textureManager: null, tierFor, pinParams }).predictStarts(clips);
  }

  /** The plan ahead (PopulationDirector.planAhead): the clips this scheduler would start as a board lands at
   *  `rotation`, its tiles already posed and dressed as they will be (swapAsset). Scored as a change scores them
   *  (aheadScores, every world counting), most wanted first, each clip dressed as its biggest unit class on an
   *  unparked tile (planOf's class), the clips already streaming left out: predictStarts' input. */
  landingClips(rotation) {
    const incoming = this.incoming;
    this.incoming = null;
    let weight;
    try {
      weight = this.aheadScores(this.scoreAll(rotation));
    } finally {
      this.incoming = incoming;
    }
    const best = new Map();
    for (const p of this.panels) {
      const a = p.swapAsset || p.asset;
      if (p.parked || !weight.has(a?.playbackId)) continue;
      const b = best.get(a.playbackId);
      if (!b || TIER_RANK[a.place?.cls ?? 's'] > TIER_RANK[b.place?.cls ?? 's']) best.set(a.playbackId, a);
    }
    return [...weight]
      .filter(([id]) => !this.streams.has(id))
      .sort((x, y) => y[1] - x[1])
      .map(([id, w]) => ({ id, w, asset: best.get(id) }));
  }

  /** landingClips before the scheduler exists: a fresh one's, with no camera (every facing tile on screen). */
  static landingClips(panels, rotation) {
    return new LivePanelScheduler({ panels, assets: [], poolHandle: null, textureManager: null }).landingClips(rotation);
  }

  /** The fast handoff's cue for the next world's loads: nothing is loading and nothing started for HANDOFF_QUIET_S. */
  handoffQuiet() {
    for (const s of this.streams.values()) if (s.state === 'pending') return false;
    return this.now - this.lastStartAt >= HANDOFF_QUIET_S;
  }

  handoffStats() {
    return { ...this.handoff };
  }

  /** The frame Mux serves at rung t for aspect r (unitSpan.frameOf). At the pin
   *  the plan requests the pool's pin verbatim (params null). short is null for a
   *  box-limited frame (wider than 16:9: its short side is below the rung), which
   *  the streamTier gate then skips. */
  rungPlan(t, r) {
    const [w, h] = frameOf(t, r);
    return {
      rung: t,
      short: Math.min(w, h) === t ? t : null,
      params: t === this.pinShort ? null : `min_resolution=${t}p&max_resolution=${t}p`,
      mp: (w * h) / 1e6,
    };
  }

  /** Σ planned decode MP of every stream started (a stream started without a plan counts at the pin). */
  plannedMp() {
    let n = 0;
    for (const s of this.streams.values()) n += s.plan ? s.plan.mp : mp(this.pinShort, 16 / 9);
    return n;
  }

  /** texB's window. A single-only asset: today's cover of the clip's metadata
   *  aspect. A class texture: the clip's picture V (Mux's exact ratio; the decoded
   *  frame only when that won't parse, unitSpan.pictureAspect) seen through the
   *  texA window (texA is the centre crop of frame 0 at aspect aTex: B = cover(V, aTex) ∘ A,
   *  with A's flat crop if it has one, P9). */
  liveWindow(panel, video) {
    const a = panel.asset;
    if (!a?.tex) {
      const { scale, offset } = computeCoverUv(parseAspect(a?.videoAspectRatio), panel.panelAspect);
      return { s: scale, o: offset };
    }
    const u = panel.mesh.material.uniforms;
    const aTex = u.texA.value?.userData?.aspect ?? a.tex.aspect;
    return liveB(pictureAspect(a, video), aTex, shownWindowA(u));
  }

  startStream(id, slot, plan = null) {
    const stream = { id, slot, state: 'pending', texture: null, panels: new Set(), since: this.now, maxDwell: 0, releaseCall: null, plan, tierCall: null };
    this.streams.set(id, stream);
    this.slots[slot] = stream;
    this.lastStartAt = this.now;
    if (this.handoffFast) {
      this.handoff.starts += 1;
      if (this.incoming) this.handoff.ahead += 1;
      if (primedPlaylist(planUrl(id, plan, this.pinParams)) != null) this.handoff.primed += 1;
    }
    if (plan?.params) {
      stream.tierCall = gsap.delayedCall(TIER_PENDING_S, () => {
        if (this.streams.get(id) !== stream || stream.state !== 'pending') return;
        this.tierFail.add(id); // the asset has no such rendition: cap it, and free the slot now
        this.releaseStream(stream);
      });
    }
    (plan?.params ? this.pool.assign(slot, id, plan.params) : this.pool.assign(slot, id))
      .then((video) => {
        stream.tierCall?.kill();
        if (this.disposed || this.streams.get(id) !== stream) return;
        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.NoColorSpace; // raw upload — the tile mode's contract (promote)
        texture.minFilter = THREE.LinearFilter;
        stream.texture = texture;
        stream.video = video; // measured decode (decodeStats)
        stream.state = 'live';
        stream.since = this.now;
        stream.maxDwell = MAX_LIVE_DWELL_SECONDS * (0.75 + Math.random() * 0.5);
        for (const p of this.panels) if (p.asset?.playbackId === id) { const grp = this.joinGroup(p); if (grp) for (const m of grp) this.attach(m, stream); }
        // Every copy left while it loaded — or, under the fast handoff, none has landed yet (updateShared ends it if none is coming).
        if (!stream.panels.size && !this.handoffFast) this.releaseStream(stream);
      })
      .catch(() => {
        // Slot released under it (releaseStream rejects the waiter) or the
        // stream failed — a released stream is already gone from the map.
        if (this.streams.get(id) === stream) { if (plan?.params) this.tierFail.add(id); this.releaseStream(stream); }
      });
  }

  attach(panel, stream) {
    const { uniforms } = panel.mesh.material;
    uniforms.texB.value = stream.texture;
    uniforms.uVideoB.value = 1;
    setWindowB(uniforms, this.liveWindow(panel, stream.video));
    stream.panels.add(panel);
    panel.liveStream = stream;
    panel.liveState = 'live';
    panel.liveUid = panel.asset?.place?.uid ?? null; // the unit this copy joined as
    gsap.to(uniforms.uMix, {
      value: 1,
      duration: CROSSFADE_SECONDS,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => {
        if (!this.disposed && panel.liveStream === stream && panel.liveState === 'live' && (!panel.liveUid || panel.asset?.place?.members[0] === panel)) this.announceLive(panel);
      },
    });
  }

  /** A copy leaves its stream at once (its content is changing or it has
   *  collapsed past a pole) — the stream plays on for the others. A unit member
   *  takes its whole unit with it (joined as one, leaves as one). */
  detach(panel) {
    const s = panel.liveStream;
    if (!s) return;
    const uid = panel.liveUid;
    for (const p of uid ? [...s.panels].filter((q) => q.liveUid === uid) : [panel]) {
      s.panels.delete(p);
      this.clearCopy(p);
    }
  }

  clearCopy(panel) {
    this.announceOff(panel);
    const { uniforms } = panel.mesh.material;
    gsap.killTweensOf(uniforms.uMix);
    uniforms.uMix.value = 0;
    uniforms.uVideoB.value = 0;
    uniforms.texB.value = getPlaceholderTexture(); // never leave a sampler unbound
    panel.liveStream = null;
    panel.liveState = null;
    panel.liveUid = null;
  }

  /** Every copy crossfades back to its still, then the slot frees. */
  endStream(stream) {
    if (stream.state !== 'live' || !stream.panels.size) {
      this.releaseStream(stream);
      return;
    }
    stream.state = 'demoting';
    for (const p of stream.panels) {
      p.liveState = 'demoting';
      this.announceOff(p); // the label fades with the crossfade, as in demote()
      gsap.to(p.mesh.material.uniforms.uMix, { value: 0, duration: CROSSFADE_SECONDS, ease: 'power2.out', overwrite: true });
    }
    stream.releaseCall = gsap.delayedCall(CROSSFADE_SECONDS, () => this.releaseStream(stream));
  }

  releaseStream(stream) {
    if (this.streams.get(stream.id) !== stream) return;
    stream.releaseCall?.kill();
    stream.tierCall?.kill();
    for (const p of stream.panels) this.clearCopy(p);
    stream.panels.clear();
    this.streams.delete(stream.id);
    this.clipLastEnd.set(stream.id, this.now);
    if (this.slots[stream.slot] === stream) {
      this.slots[stream.slot] = null;
      if (!this.disposed) this.pool.releaseSlot(stream.slot);
    }
    stream.texture?.dispose();
    stream.texture = null;
    stream.video = null;
  }

  promote(panel, slot) {
    panel.liveState = 'pending';
    this.slots[slot] = panel;
    panel.liveSlot = slot;
    const { playbackId } = panel.asset;

    this.pool
      .assign(slot, playbackId)
      .then((video) => {
        if (this.disposed || panel.liveState !== 'pending') return;
        const texture = new THREE.VideoTexture(video);
        // Raw upload by design: three forces a linear internal format for
        // video textures regardless of colorSpace, so the shader decodes
        // sRGB manually (uVideoB). NoColorSpace makes that contract explicit.
        texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        panel.videoTexture = texture;
        panel.liveVideo = video;

        const { uniforms } = panel.mesh.material;
        uniforms.texB.value = texture;
        uniforms.uVideoB.value = 1;
        setWindowB(uniforms, this.liveWindow(panel, video));

        panel.liveState = 'live';
        panel.liveSince = this.now;
        panel.liveMaxDwell = MAX_LIVE_DWELL_SECONDS * (0.75 + Math.random() * 0.5);
        gsap.to(uniforms.uMix, {
          value: 1,
          duration: CROSSFADE_SECONDS,
          ease: 'power2.out',
          overwrite: true,
          // 'live' fires only once frames are truly on screen. A demote
          // before then kills this tween (overwrite on the same uniform),
          // so a never-shown panel never announces.
          onComplete: () => {
            if (!this.disposed && panel.liveState === 'live') this.announceLive(panel);
          },
        });
      })
      .catch(() => {
        // Slot reassigned/released or stream failed — roll back cleanly
        if (panel.liveState === 'pending') this.freePanel(panel, { releasePool: true });
      });
  }

  /* — Label events (chunk 6) — the latch pair: announceLive marks the
     panel, announceOff only fires for a marked panel and clears the mark,
     so every consumer sees balanced live/off pairs no matter which path
     (demote, rollback, dispose) frees the slot. Null-safe: without a
     callback both are no-ops beyond the flag write. — */
  announceLive(panel) {
    if (!this.onLiveChange) return;
    panel.liveAnnounced = true;
    this.onLiveChange(panel, 'live');
  }

  announceOff(panel) {
    if (!this.onLiveChange || !panel.liveAnnounced) return;
    panel.liveAnnounced = false;
    this.onLiveChange(panel, 'off');
  }

  demote(panel) {
    panel.liveState = 'demoting';
    // 'off' at demote START — the label fades while the crossfade back to
    // the thumbnail plays, not after.
    this.announceOff(panel);
    const { uniforms } = panel.mesh.material;
    gsap.to(uniforms.uMix, {
      value: 0,
      duration: CROSSFADE_SECONDS,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => this.freePanel(panel, { releasePool: true }),
    });
  }

  freePanel(panel, { releasePool }) {
    this.announceOff(panel); // no-op when demote already announced (latch)
    const slot = panel.liveSlot;
    if (slot != null && this.slots[slot] === panel) {
      if (releasePool && !this.disposed) this.pool.releaseSlot(slot);
      this.slots[slot] = null;
    }
    if (panel.videoTexture) {
      const { uniforms } = panel.mesh.material;
      uniforms.uMix.value = 0;
      uniforms.uVideoB.value = 0;
      uniforms.texB.value = getPlaceholderTexture(); // never leave a sampler unbound
      panel.videoTexture.dispose();
      panel.videoTexture = null;
    }
    panel.liveSlot = null;
    panel.liveVideo = null;
    if (panel.liveState) panel.lastLiveEnd = this.now;
    panel.liveState = null;
  }

  swapHidden(panel) {
    const nextAsset = this.assets[this.cursor % this.assets.length];
    this.cursor += 1;
    panel.swapping = true;

    this.textureManager
      .loadThumbnail(nextAsset.playbackId)
      .then((texture) => {
        if (this.disposed) return;
        const previousId = panel.asset?.playbackId;
        const { uniforms } = panel.mesh.material;
        uniforms.texA.value = texture;
        setWindowA(uniforms, windowA(panel, nextAsset, texture));
        uniforms.uHasTexA.value = 1;
        panel.asset = nextAsset;
        if (previousId) this.textureManager.release(previousId);
      })
      .catch(() => {
        this.textureManager.release(nextAsset.playbackId);
      })
      .finally(() => {
        panel.swapping = false;
        panel.swappedWhileHidden = true;
      });
  }

  getStats() {
    if (this.shared) {
      const streams = [...this.streams.values()];
      return {
        live: streams.filter((s) => s.state === 'live').length, // decodes, not tiles
        pending: streams.filter((s) => s.state === 'pending').length,
        liveTiles: streams.reduce((n, s) => n + s.panels.size, 0),
        visible: this.lastVisibleCount,
        cursor: this.cursor,
      };
    }
    return {
      live: this.slots.filter((p) => p?.liveState === 'live').length,
      pending: this.slots.filter((p) => p?.liveState === 'pending').length,
      visible: this.lastVisibleCount,
      cursor: this.cursor,
    };
  }

  /** Measured decode for the probe: what the <video> elements on screen really
   *  decode (shared: every non-pending stream; tile: every live/demoting slot). */
  decodeStats() {
    const streams = [];
    const add = (id, video, plan) => {
      const w = video?.videoWidth || 0;
      const h = video?.videoHeight || 0;
      streams.push({ id, w, h, short: Math.min(w, h), mp: Math.round((w * h) / 1e4) / 100, plan: plan?.rung ?? null, planShort: plan?.short ?? null });
    };
    if (this.shared) {
      for (const s of this.streams.values()) if (s.state !== 'pending') add(s.id, s.video, s.plan);
    } else {
      for (const p of this.slots) if (p && (p.liveState === 'live' || p.liveState === 'demoting')) add(p.asset?.playbackId, p.liveVideo, null);
    }
    const mp = streams.reduce((n, s) => n + (s.w * s.h) / 1e6, 0);
    return { mp: Math.round(mp * 1000) / 1000, budget: Math.round(this.decodeBudget * 1000) / 1000, pinShort: this.pinShort, bucket: this.bucket, streams };
  }

  dispose() {
    this.disposed = true;
    for (const s of this.streams.values()) {
      s.releaseCall?.kill();
      s.tierCall?.kill();
      s.texture?.dispose();
    }
    this.streams.clear();
    this.panels.forEach((panel) => {
      this.announceOff(panel); // teardown counts as a release — labels clear
      gsap.killTweensOf(panel.mesh.material.uniforms.uMix);
      if (panel.videoTexture) {
        panel.videoTexture.dispose();
        panel.videoTexture = null;
      }
      panel.liveState = null;
      panel.liveSlot = null;
      panel.liveStream = null;
      panel.liveVideo = null;
    });
    this.slots.fill(null);
  }
}
