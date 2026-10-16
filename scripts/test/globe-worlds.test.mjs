// Globe-worlds population modes (docs/globe-worlds-plan.md) — the pure
// pieces: buildWorldPools over the real FEATURED_WORLDS_QUERY (groq-js, the
// cms-frontend fixture idiom), worldPatterns' tape layouts, the
// PopulationDirector's assignment, texture ownership and change clock on
// fake panels, and the scheduler's shared streams on a fake video pool.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as THREE from 'three'
import gsap from 'gsap'
import { parse, evaluate } from 'groq-js'
import { FEATURED_WORLDS_QUERY } from '../../src/lib/queries.js'
import { buildContentFlow } from '../../src/components/work/detail/buildContentFlow.js'
import buildWorldPools, { selectPool, WORLD_POOL_CAP } from '../../src/components/globe/buildWorldPools.js'
import { makePattern, makeField, PATTERNS } from '../../src/components/globe/worldPatterns.js'
import MeridianScroll, { initialBirth, poseTile, scrollZeroTheta } from '../../src/components/globe/MeridianScroll.js'
import TextureManager, { assetKey, computeCoverUv } from '../../src/components/globe/TextureManager.js'
import { loadTile, windowA, unitWindowOf, applyPlan, cancelSwap, placeKey, sharedDelays } from '../../src/components/globe/tileSwap.js'
import PopulationDirector from '../../src/components/globe/PopulationDirector.js'
import LivePanelScheduler from '../../src/components/globe/LivePanelScheduler.js'
import { TUNING, POP_DEFAULTS, setPopTune } from '../../src/components/globe/popConfig.js'
import {
  measureNameAspect,
  nameSpan,
  nameBandLimit,
  nameFaceLimit,
  namePinch,
  nameWindow,
  nameRendered,
  NAME_QUADS,
} from '../../src/components/globe/nameTicker.js'
import { GLOBE_PREVIEW_SECONDS, STREAM_PARAMS, THUMB_WIDTH } from '../../src/components/globe/globeConfig.js'
import { PREVIEW_SECONDS, DETAIL_MAX_SECONDS, muxStream, wrapAtDetailCap } from '../../src/components/work/imageConfig.js'
import { netReport, owedClip, cover, TICK_S, LOOP_END_S, STALL_MS } from '../lib/netReport.mjs'
import { LEVELS, unitGates, baselineOf, readBaselines, writeBaseline, classifyRequest, expectFail, checkPayload, classSizes } from '../lib/unitGates.mjs'
import { stripAudioFromMaster, AUDIO_CODEC } from '../../src/components/work/hlsVideoOnly.js'
import { videoOnlyLoader } from '../../src/components/work/useHls.js'
import buildCascadeTimeline, { DELAY_ORDERS, panelDelay, delayOwner } from '../../src/components/globe/cascade.js'
import { buildScrollingGlobeGeometry } from '../../src/components/globe/buildGlobeGeometry.js'
import {
  UNIT_EPS,
  T_ENTRANCE,
  TOP_RUNG,
  UNIT_SHAPE,
  SKEW_MARGIN,
  lattice,
  latticeOf,
  frac,
  unitAspect,
  kappaOwn,
  memberWindow,
  compose,
  coverWindow,
  rendered as spanRendered,
  unitA,
  thetaBound,
  unitSkewBound,
  frameOf,
  mp,
  sourceShort,
  texSpec,
  quadEligible,
  electQuads,
  eligibleH,
  eligibleVQ,
  liveB,
  pictureAspect,
  UNIT_CLASSES,
} from '../../src/components/globe/unitSpan.js'
import { classOf } from '../../src/components/globe/mediaClass.js'

/* — buildWorldPools over the real query — */
const ref = (_ref) => ({ _type: 'reference', _ref })
const image = { _type: 'image', asset: ref('image-page') }
const video = (id) => ({ _type: 'mux.video', asset: ref(id) })
const base = { _type: 'mediaAsset', client: ref('client-fixture'), project: ref('project-fixture'), sourceManifest: 'Branding' }
const media = (id, rank, fields) => ({ ...base, _id: id, orderRank: rank, title: id, ...fields })
const mux = (id, status = 'ready') => ({ _id: id, _type: 'mux.videoAsset', playbackId: `pb-${id}`, data: { status, aspect_ratio: '16:9', tracks: [{ type: 'video', max_width: 1920, max_height: 1080 }] } })
const documents = [
  { _id: 'client-fixture', _type: 'client', name: 'Fixture', slug: { current: 'fixture' } },
  { _id: 'svc', _type: 'service', name: 'Motion Design', slug: { current: 'motion-design' } },
  { _id: 'project-fixture', _type: 'project', title: 'Studio title', slug: { current: 'fixture-branding' }, client: ref('client-fixture'), isFeatured: true, orderRank: '0|hzzzzz:' },
  { _id: 'image-page', _type: 'sanity.imageAsset', url: 'https://cdn.example/page.jpg', metadata: { dimensions: { width: 1200, height: 1500 } } },
  mux('mux-hero'), mux('mux-a'), mux('mux-b'), mux('mux-bad', 'errored'),
  media('hero', '0|a:', { mediaType: 'featured-project-reel', video: video('mux-hero'), services: [ref('svc')] }),
  media('cover', '0|b:', { mediaType: 'album-art', image }),
  media('still', '0|c:', { mediaType: 'static_4x5', image: { _type: 'image', asset: ref('image-still') } }),
  media('clip-a', '0|d:', { mediaType: 'motion_16x9', video: video('mux-a') }),
  media('clip-dup', '0|e:', { mediaType: 'motion_16x9', video: video('mux-a') }), // same stream twice
  media('clip-bad', '0|f:', { mediaType: 'motion_16x9', video: video('mux-bad') }), // not playable
  media('deck-1', '0|g:', { mediaType: 'brand-deck', image, displayGroup: 'deck', brandDeckOrder: 1 }),
  media('slide-1', '0|h:', { mediaType: 'carousel-slide', image, displayGroup: 'carousel' }),
  media('logo', '0|i:', { mediaType: 'logo', image }),
  media('bts', '0|j:', { mediaType: 'motion_16x9', video: video('mux-b'), contentRole: 'process' }),
  { _id: 'image-still', _type: 'sanity.imageAsset', url: 'https://cdn.example/still.jpg', metadata: { dimensions: { width: 800, height: 1000 } } },
]
const query = async (source, dataset = documents) => (await evaluate(parse(source), { dataset })).get()

test('buildWorldPools holds exactly the /work World media: hero, showcase Tiles, album art', async () => {
  const rows = await query(FEATURED_WORLDS_QUERY)
  const [world] = buildWorldPools(rows)
  assert.equal(world.slug, 'fixture-branding')
  assert.equal(world.clientName, 'Fixture')
  assert.deepEqual(world.services, [{ name: 'Motion Design', slug: 'motion-design' }]) // asset-tag fallback
  // Deck pages, carousels, logos, process/BTS and unplayable streams stay out;
  // a duplicate stream is one texture.
  assert.deepEqual(world.assets.map(assetKey), ['pb-mux-hero', 'https://cdn.example/page.jpg', 'https://cdn.example/still.jpg', 'pb-mux-a'])
  assert.deepEqual(world.assets.map((a) => a.kind), ['video', 'art', 'still', 'video'])
  assert.deepEqual(Object.keys(world.assets[0]), ['kind', 'playbackId', 'videoAspectRatio', 'u']) // lean props: no ids, no nulls
  assert.deepEqual(world.assets.map((a) => a.u), ['h', 'q', 'q', 'h']) // hero · cover · still · clip-a (mediaClass.classOf)
  // u is the veto, not the label alone: clip-a's stream as a 1080×1920 source keeps its motion_16x9 label and classes v (RH8CMzFM's case, T8)
  const portrait = documents.map((d) => (d._id === 'mux-a' ? { ...d, data: { status: 'ready', aspect_ratio: '9:16', tracks: [{ type: 'video', max_width: 1080, max_height: 1920 }] } } : d))
  assert.equal(buildWorldPools(await query(FEATURED_WORLDS_QUERY, portrait))[0].assets.find((a) => a.playbackId === 'pb-mux-a').u, 'v')
  // s: the source short side, only below TOP_RUNG; 0 = no track size
  const withTrack = (track) => documents.map((d) => (d._id === 'mux-a' ? { ...d, data: { status: 'ready', aspect_ratio: '16:9', ...(track ? { tracks: [{ type: 'video', ...track }] } : {}) } } : d))
  assert.equal(buildWorldPools(await query(FEATURED_WORLDS_QUERY, withTrack({ max_width: 1280, max_height: 720 })))[0].assets[3].s, 720)
  assert.equal(buildWorldPools(await query(FEATURED_WORLDS_QUERY, withTrack(null)))[0].assets[3].s, 0)
  assert.equal('s' in world.assets[3], false) // NC: a 1080p source carries nothing
  assert.equal(world.assets.some((a) => !a.playbackId && 's' in a), false) // NC: s is a video's alone; no still or album art carries one, not even 0
  // Parity with the World itself: every non-hero tile is a showcase Tile or album art.
  const flow = buildContentFlow(rows[0].assets)
  const worldKeys = new Set([...flow.showcase, ...flow.albumArt].map((a) => a.playbackId || a.imageUrl))
  for (const a of world.assets.slice(1)) assert.ok(worldKeys.has(assetKey(a)), assetKey(a))
})

test('buildWorldPools drops projects without a client/collection or any tile-able media', async () => {
  const rows = await query(FEATURED_WORLDS_QUERY)
  assert.equal(buildWorldPools([{ ...rows[0], collection: null }]).length, 0)
  assert.equal(buildWorldPools([{ ...rows[0], assets: [rows[0].assets.find((a) => a._id === 'logo')] }]).length, 0)
})

const pool = (n, kind, tag = kind) => Array.from({ length: n }, (_, i) => ({ kind, playbackId: `${tag}${i}` }))

test('selectPool caps round-robin across kinds, then restores editorial order', () => {
  const src = [...pool(30, 'video'), ...pool(4, 'still'), ...pool(2, 'art')]
  const picked = selectPool(src, { cap: 12 })
  assert.equal(picked.length, 12)
  assert.equal(picked.filter((a) => a.kind === 'still').length, 4) // never starved behind 30 videos
  assert.equal(picked.filter((a) => a.kind === 'art').length, 2)
  const order = picked.map((a) => src.indexOf(a))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.equal(selectPool(src).length, WORLD_POOL_CAP)
  // A kind filter that leaves fewer than 3 falls back to the whole pool.
  assert.equal(selectPool(src, { kinds: ['art'], cap: 40 }).length, src.length)
  assert.ok(selectPool(src, { kinds: ['still'] }).every((a) => a.kind === 'still'))
})

/* — worldPatterns — */
const LON = 12
const tape = (fn, s0 = 0, s1 = 600) => {
  const out = []
  for (let s = s0; s < s1; s++) for (let lon = 0; lon < LON; lon++) out.push(fn(lon, s))
  return out
}

test('patterns are seed-deterministic', () => {
  for (const name of PATTERNS) {
    const a = makePattern(name, { seed: 7, weights: [1, 1], lon: LON })
    const b = makePattern(name, { seed: 7, weights: [1, 1], lon: LON })
    const c = makePattern(name, { seed: 8, weights: [1, 1], lon: LON })
    assert.deepEqual(tape(a.owner, 0, 80), tape(b.owner, 0, 80), name)
    assert.notDeepEqual(tape(a.owner, 0, 80), tape(c.owner, 0, 80), name)
  }
})

test('pattern shares track the weights within ±10%', () => {
  for (const name of PATTERNS) {
    for (const weights of [[1, 1], [1, 1, 1], [3, 1]]) {
      for (const seed of [1, 2, 3]) {
        const owners = tape(makePattern(name, { seed, weights, lon: LON }).owner)
        const total = weights.reduce((x, y) => x + y, 0)
        weights.forEach((w, r) => {
          const share = owners.filter((o) => o === r).length / owners.length
          assert.ok(Math.abs(share - w / total) <= 0.1, `${name} ${weights} seed ${seed} region ${r}: ${share.toFixed(3)}`)
        })
      }
    }
  }
})

test('patterns have no seam at the longitude wrap', () => {
  for (const name of PATTERNS) {
    const { owner } = makePattern(name, { seed: 5, weights: [1, 1, 1], lon: LON })
    let seam = 0
    let interior = 0
    const S = 600
    for (let s = 0; s < S; s++) {
      if (owner(LON - 1, s) !== owner(0, s)) seam += 1
      for (let lon = 0; lon < LON - 1; lon++) if (owner(lon, s) !== owner(lon + 1, s)) interior += 1
    }
    const seamRate = seam / S
    const interiorRate = interior / (S * (LON - 1))
    assert.ok(seamRate <= interiorRate * 2 + 0.05, `${name}: seam ${seamRate.toFixed(3)} vs interior ${interiorRate.toFixed(3)}`)
  }
})

test('a one-region pattern owns everything; the blend field is uniform', () => {
  assert.ok(tape(makePattern('continents', { seed: 1, weights: [1], lon: LON }).owner, 0, 50).every((o) => o === 0))
  const field = makeField(3, { lon: LON, grain: 2.5 })
  const values = tape(field.value)
  for (const m of [0.25, 0.5, 0.75]) {
    const frac = values.filter((v) => v < m).length / values.length
    assert.ok(Math.abs(frac - m) <= 0.06, `field below ${m}: ${frac.toFixed(3)}`)
  }
})

/* — The scroll-0 pose: the scene must pose the globe BEFORE it plans — */
test('pose: scrollZeroTheta reproduces the driver\'s own thetaForRow at scroll 0', () => {
  const N = 8
  const PITCH = Math.PI / 6
  const LO = -PITCH
  const SPAN = N * PITCH
  // MeridianScroll.thetaForRow with scroll = 0, transcribed.
  const thetaForRow = (j) => LO + ((((j * PITCH - LO) % SPAN) + SPAN) % SPAN)
  for (let j = 0; j < N; j++) {
    assert.ok(
      Math.abs(scrollZeroTheta(j, N) - thetaForRow(j)) < 1e-12,
      `row ${j}: ${scrollZeroTheta(j, N)} vs ${thetaForRow(j)}`
    )
  }
  // The last row is what the old `row * pitch` stamp got wrong: it read 210°
  // where the driver says -30°. Both poses are parked, so nothing moved on
  // screen — but the two numbers disagreeing is the smell that found the bug.
  assert.ok(scrollZeroTheta(N - 1, N) < 0, 'last row wraps above the top pole')
  assert.ok(Math.abs((N - 1) * PITCH - scrollZeroTheta(N - 1, N)) > 1, 'and the old stamp did not')
})

test('pose: poseTile gives honest latitudes, so the name band can refuse the poles', () => {
  const N = 8
  const BAND = Math.PI / 6 - 0.0192 // the built tile band, a shade under the pitch
  const tile = (row) => ({
    row,
    phiC: 0,
    bandHeight: BAND,
    centerDir: new THREE.Vector3(0, 0, 0), // the canonical-equator seed
    mesh: { material: { uniforms: { uPolarTop: { value: 0 } } } },
  })
  const posed = []
  for (let j = 0; j < N; j++) {
    const p = tile(j)
    poseTile(p, scrollZeroTheta(j, N))
    posed.push(p)
  }
  // Before the fix every one of these still read |y| = 0 — the geometry's
  // canonical-equator seed — because the scene stamped only uPolarTop. The band
  // gate then admitted all 8 rows, parked buffers included.
  assert.ok(
    posed.every((p) => p.mesh.material.uniforms.uPolarTop.value === scrollZeroTheta(p.row, N)),
    'the shader uniform is written'
  )
  assert.equal(posed.filter((p) => p.parked).length, 2, 'two of eight rows sit past a pole')

  // Row 0 sits ~14.5° from the north pole: the row the first world's strip
  // landed on, at |y| ≈ 0.968, vK ≈ 0.25 — four-times-condensed type, held for
  // the whole first world.
  assert.ok(Math.abs(posed[0].centerDir.y) > 0.95, `row 0 |y| ${posed[0].centerDir.y.toFixed(4)}`)
  assert.ok(namePinch(posed[0].centerDir.y) < 0.3, 'and badly pinched')

  // ...and the default band must now refuse it.
  const yLimit = nameBandLimit(POP_DEFAULTS.nameBand)
  assert.ok(Math.abs(posed[0].centerDir.y) > yLimit, 'row 0 falls outside the default name band')
  const eligible = posed.filter((p) => !p.parked && Math.abs(p.centerDir.y) <= yLimit)
  assert.ok(eligible.length >= 2, `eligible rows ${eligible.length} — a strip must have somewhere to go`)
  assert.ok(
    eligible.every((p) => namePinch(p.centerDir.y) >= 0.5),
    'every eligible row keeps the type under 2x condensed at birth'
  )
})

/* — PopulationDirector on fake panels — */
const ROWS = 8
function fakeScene() {
  const panels = []
  for (let lon = 0; lon < LON; lon++) {
    for (let row = 0; row < ROWS; row++) {
      const phi = ((lon + 0.5) / LON) * Math.PI * 2
      // MeridianScroll.applyScroll: 8 rows at a π/6 pitch, so two sit past a
      // pole — parked, their centerDir clamped pole-ward (|y| = 1).
      const thetaC = ((row + 0.5) / 6) * Math.PI
      const parked = !(thetaC > 0 && thetaC < Math.PI)
      const theta = Math.min(Math.max(thetaC, 0), Math.PI)
      const v2 = () => ({ value: new THREE.Vector2() })
      panels.push({
        lonIndex: lon,
        row,
        tapeS: initialBirth(row, ROWS),
        panelAspect: 1,
        parked,
        centerDir: new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)),
        mesh: {
          material: {
            uniforms: {
              uPower: { value: 1 },
              uBlueMix: { value: 0 },
              uHasTexA: { value: 0 },
              texA: { value: null },
              uvScaleA: v2(),
              uvOffsetA: v2(),
              texB: { value: null },
              uVideoB: { value: 0 },
              uvScaleB: v2(),
              uvOffsetB: v2(),
              uMix: { value: 0 },
            },
          },
        },
      })
    }
  }
  // Refcounting fake with the TextureManager surface loadTile/director use.
  // Each texture carries the aspect nameTicker stamps on the real thing —
  // tileSwap's cover-fit is what turns a region strip's span into a tile's
  // 1/span window, so a fake without it would test nothing.
  const texFor = (a) => ({
    k: assetKey(a),
    userData: {
      aspect:
        a.kind !== 'name' ? 1 : a.mode === 'band' ? measureNameAspect(a.text, a.size) : a.span * a.panelAspect,
    },
  })
  const textureManager = {
    cache: new Map(),
    loadAsset(a) {
      const k = assetKey(a)
      const e = this.cache.get(k) || { refs: 0, texture: texFor(a) }
      e.refs += 1
      this.cache.set(k, e)
      return Promise.resolve(e.texture)
    },
    peek(k) {
      return this.cache.get(k)?.texture ?? null
    },
    release(k) {
      const e = this.cache.get(k)
      if (!e) return
      e.refs -= 1
      if (e.refs <= 0) this.cache.delete(k)
    },
    stats() {
      let refs = 0
      for (const e of this.cache.values()) refs += e.refs
      return { mib: 0, peak: 0, entries: this.cache.size, refs, pending: 0, failed: 0 }
    },
    refs() {
      let n = 0
      for (const e of this.cache.values()) n += e.refs
      return n
    },
  }
  return { panels, textureManager }
}
const worldsFixture = () =>
  ['Alpha', 'Beta', 'Gamma'].map((name, i) => ({
    slug: name.toLowerCase(),
    clientName: name,
    title: null,
    services: [],
    assets: pool(10, 'video', `${name}-`),
  }))

function assertNeighboursDiffer(panels) {
  const at = new Map(panels.map((p) => [`${p.lonIndex}:${p.tapeS}`, p]))
  for (const p of panels) {
    const right = at.get(`${(p.lonIndex + 1) % LON}:${p.tapeS}`)
    const up = at.get(`${p.lonIndex}:${p.tapeS + 1}`)
    for (const q of [right, up]) {
      if (q) assert.notEqual(assetKey(q.asset), assetKey(p.asset), `L${p.lonIndex} s${p.tapeS} vs L${q.lonIndex} s${q.tapeS}`)
    }
  }
}

test('director: clustered layout follows the pattern, no neighbour repeats, rows keep pouring in', () => {
  // names off: a strip's adjacent tiles share its texture by design (tested below)
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 42, group: 2, chaos: 0, names: 0 })
  const { panels, textureManager } = fakeScene()
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(0.8, 0, 0),
    canAnimate: () => false,
  })
  director.initialLayout(director.byProminence())
  const g = director.grouping
  assert.equal(g.members.length, 2)
  for (const p of panels) {
    assert.equal(p.asset.world, g.regionWorld[g.pattern.owner(p.lonIndex, p.tapeS)])
    assert.equal(p.mesh.material.uniforms.uHasTexA.value, 1) // warm texture bound synchronously
  }
  assertNeighboursDiffer(panels)
  // MeridianScroll's recycle, emulated: the oldest row is re-born on top.
  const rows = new Map()
  for (const p of panels) rows.set(p.row, [...(rows.get(p.row) || []), p])
  let next = ROWS
  for (let k = 0; k < 24; k++) {
    const oldest = [...rows.values()].sort((a, b) => a[0].tapeS - b[0].tapeS)[0]
    for (const p of oldest) p.tapeS = next
    next += 1
    const picks = director.assignRow(oldest)
    oldest.forEach((p, i) => loadTile(director, p, picks[i]))
    assertNeighboursDiffer(panels)
    for (const p of oldest) assert.equal(p.asset.world, g.regionWorld[g.pattern.owner(p.lonIndex, p.tapeS)])
  }
  director.dispose()
})

test('director: texture refs balance — one per tile, plus the warm set until dispose', () => {
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 9, group: 2, chaos: 0 })
  const { panels, textureManager } = fakeScene()
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(),
    canAnimate: () => false,
  })
  director.initialLayout(director.byProminence())
  assert.equal(textureManager.refs(), panels.length + director.warm.size)
  // ⏭ lands warm: the next grouping (relay A+B → B+C) is already held.
  assert.deepEqual(director.upcoming.members, [director.grouping.members[1], (director.grouping.members[1] + 1) % 3])
  for (const a of director.upcoming.pools.flat()) assert.ok(director.warm.has(assetKey(a)), assetKey(a))
  // A re-lay onto the next grouping (the cut path), then the cold refs drop.
  director.step += 1
  director.grouping = director.upcoming
  director.lead = director.grouping.members[0]
  const plan = director.planAll(director.byProminence())
  for (const [p, a] of plan) loadTile(director, p, a)
  director.warmGrouping()
  director.releaseCold()
  assert.equal(textureManager.refs(), panels.length + director.warm.size)
  director.dispose()
  assert.equal(textureManager.refs(), panels.length) // the tiles still own what they show
})

/* — P2: one world at a time, changing on its own clock — */
function makeDirector(tuning, opts = {}) {
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides' }, tuning)
  const { panels, textureManager } = fakeScene()
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(),
    canAnimate: () => false,
    ...opts,
  })
  director.initialLayout(director.byProminence())
  return { director, panels, textureManager }
}
const settleTicks = (ms = 0) => new Promise((r) => setTimeout(r, ms))

test('director: a world holds, then the next pours in on a tide — one full span, steep launch, no overshoot', () => {
  const seen = []
  const scroller = { span: 10, steps: [], advance(d) { this.steps.push(d) } }
  const { director } = makeDirector(
    { seed: 3, chaos: 0, hold: 2, holdJit: 0, trans: 1, transitions: ['tide'] },
    { getScroller: () => scroller, canAnimate: () => true, onWorld: (w, info) => seen.push([w.slug, info.animate]) },
  )
  assert.equal(director.grouping.members.length, 1) // one world by default (Nathan, 09-26)
  const first = director.lead
  director.update(0.1) // the entrance has landed — the first world takes its colour
  assert.deepEqual(seen, [[director.worlds[first].slug, true]])
  let frames = 1
  while (!director.tide && frames < 100) {
    director.update(0.1)
    frames += 1
  }
  assert.ok(frames >= 19 && frames <= 21, `held ${frames} frames`)
  assert.equal(director.lead, (first + 1) % 3) // chaos 0 walks the /work order
  assert.deepEqual(seen.at(-1), [director.worlds[director.lead].slug, true]) // the colour turns as the tide starts
  assert.equal(director.sample(new THREE.Euler()).phase, 'transition')
  while (director.tide) director.update(1 / 60)
  const total = scroller.steps.reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - scroller.span) < 1e-9, `rolled ${total}`) // every row re-births once
  assert.ok(scroller.steps.every((d) => d >= 0)) // never backwards — no overshoot
  assert.ok(scroller.steps[0] > scroller.steps.at(-1) * 100) // steep launch, smooth settle
  const stats = director.sample(new THREE.Euler())
  assert.equal(stats.phase, 'hold')
  assert.equal(stats.world, director.worlds[director.lead].clientName)
  assert.equal(stats.holdLeft, 2)
  director.dispose()
})

test('director: chaos 0 walks the /work order and the set in turn; chaos 1 never revisits a recent world', () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({ slug: `w${i}`, clientName: `W${i}`, title: null, services: [], assets: pool(4, 'video', `w${i}-`) }))
  const set = ['tide', 'blink', 'cut']
  const { director } = makeDirector({ seed: 11, chaos: 0, transitions: set }, { worlds: eight })
  for (let step = 1; step <= 6; step++) {
    assert.equal(director.nextLead(step), (director.lead + 1) % 8)
    assert.equal(director.nextKind(step), set[step % 3])
  }
  TUNING.chaos = 1
  const kinds = new Set()
  for (let step = 1; step <= 60; step++) {
    const lead = director.nextLead(step)
    assert.ok(![director.lead, ...director.history].includes(lead), `step ${step}: ${lead}`)
    kinds.add(director.nextKind(step))
    director.history = [director.lead, ...director.history].slice(0, 4)
    director.lead = lead
  }
  assert.equal(kinds.size, set.length) // every transition in the set gets drawn
  director.dispose()
})

test('director: an in-place change re-lays every tile onto the next world at once (cut)', async () => {
  const seen = []
  const { director, panels, textureManager } = makeDirector({ seed: 4, chaos: 0 }, { onWorld: (w) => seen.push(w.slug) })
  director.greet(false) // reduced motion's greeting — at once
  director.next() // the screens aren't free to animate → a cut
  assert.equal(director.changing, 'cut')
  await settleTicks() // the warm textures settle, the plan lands
  for (const p of panels) assert.equal(p.asset.world, director.lead)
  assert.deepEqual(seen, [director.worlds[(director.lead + 2) % 3].slug, director.worlds[director.lead].slug])
  await settleTicks(60) // the settle (a zero-length delayedCall on the ticker)
  assert.equal(director.busy, false)
  assert.equal(textureManager.refs(), panels.length + director.warm.size)
  director.dispose()
})

/** fakeScene, posed the way MeridianScroll poses a real scroll globe. */
function fakeScrollScene() {
  const scene = fakeScene()
  const band = Math.PI / 6 - THREE.MathUtils.degToRad(1.1) // max(pitch − latGap, 0.02)
  for (const p of scene.panels) {
    p.bandHeight = band
    p.phiC = ((p.lonIndex + 0.5) / LON) * Math.PI * 2
    p.canonTop = Math.PI / 2 - band / 2
    Object.assign(p.mesh.material.uniforms, { uPolarTop: { value: 0 }, uUsePolarScroll: { value: 0 }, uCanonTop: { value: 0 } })
    poseTile(p, scrollZeroTheta(p.row, ROWS))
  }
  const tm = scene.textureManager
  const load = tm.loadAsset.bind(tm)
  tm.loadAsset = (a) => {
    const pending = load(a)
    if (a.tex) tm.cache.get(assetKey(a)).texture.userData.aspect = a.tex.aspect // the requested aspect (TextureManager measures the decoded one)
    return pending
  }
  return scene
}

test('director: a re-born row cancels its in-flight swap, so the born asset survives (P0a)', async () => {
  const random = Math.random
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', transitions: ['blink'], chaos: 0, names: 0 })
  const { panels, textureManager } = fakeScrollScene()
  let scroller = null
  let born = null
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager,
    getScheduler: () => null,
    getScroller: () => scroller,
    getRotation: () => new THREE.Euler(),
    canAnimate: () => true,
  })
  try {
    director.initialLayout(director.byProminence())
    scroller = new MeridianScroll({ panels, assets: [], textureManager, cascadeSpeed: 0, scheduler: null, assignRow: (tiles) => (born = director.assignRow(tiles)) })
    Math.random = () => 0.99 // every swap waits 0.594 s (0.99 × spread 0.6 = ?poptrans 0.9 − the 0.3 s blink)
    director.advance()
    await settleTicks()
    const row6 = panels.filter((p) => p.row === 6)
    assert.ok(row6.every((p) => p.swapAsset))
    const victim = panels.find((p) => p.row === 2 && p.swapAsset)
    const stale = victim.swapAsset
    scroller.advance(Math.PI / 6)
    scroller.update(0) // row 6 wraps past the south pole → recycle
    await settleTicks()
    row6.forEach((p, i) => {
      assert.ok(p.swapTl === null) // not equal: failing, it would inspect the live timeline 1000 levels deep and never return
      assert.equal(p.swapAsset, null)
      assert.equal(p.shownAsset, born[i])
    })
    assert.equal(scroller.bornCancelled, 12)
    assert.equal(director.staleLanded ?? 0, 0)
    // NC: the old path, a re-born stamp with no cancel: the planned swap lands over the born asset, and is counted.
    victim.tapeS += 100
    loadTile(director, victim, born[0])
    for (const p of panels) p.swapTl?.progress(1)
    await settleTicks()
    assert.equal(director.staleLanded, 1)
    row6.forEach((p, i) => assert.equal(p.shownAsset, born[i]))
    assert.equal(victim.shownAsset, stale)
  } finally {
    Math.random = random
    director.dispose()
  }
})

/* — 10-07: client-name placement (SQ-8) — camera-relative, no ticker — */
const Y_LIMIT = nameBandLimit(POP_DEFAULTS.nameBand)
const Z_LIMIT = nameFaceLimit(POP_DEFAULTS.nameFace)
const TILT = () => new THREE.Euler(THREE.MathUtils.degToRad(40), 0, 0) // the brand tilt
const strips = (panels) => panels.filter((p) => p.shownAsset?.kind === 'name')
/** One tile's natural share of its strip (cover-fit's x scale) and the strip
 *  range it really renders — re-derived here from the live uniforms and the
 *  tile's own latitude, which is what the probe's namesSlice gate measures. */
const sliceOf = (p) => Math.min(1, p.panelAspect / (p.mesh.material.uniforms.texA.value?.userData?.aspect || 1))
const rendered = (p) => {
  const u = p.mesh.material.uniforms
  return shaderRenders(u.uvScaleA.value.x, u.uvOffsetA.value.x, namePinch(p.centerDir.y))
}
const SPAN_CLAMP = { min: POP_DEFAULTS.nameSpanMin, max: POP_DEFAULTS.nameSpanMax }

test('names: the span comes from the measured name — a longer name takes more tiles, and is never cut', () => {
  const size = POP_DEFAULTS.nameSize
  assert.ok(
    nameSpan('Hurry Up Slowly Records', size, 1, SPAN_CLAMP) > nameSpan('COCO', size, 1, SPAN_CLAMP),
    'a long name must occupy more tiles than a short one'
  )
  for (const name of ['A', 'COCO', 'Imperfect Records', 'Hurry Up Slowly Records']) {
    const aspect = measureNameAspect(name, size)
    const span = nameSpan(name, size, 1, SPAN_CLAMP)
    assert.ok(span >= SPAN_CLAMP.min && span <= SPAN_CLAMP.max, `${name}: ${span}`)
    // A tile shows panelAspect/stripAspect of the strip, so the whole name
    // reads iff span ≥ stripAspect/panelAspect — unless the clamp capped it,
    // where loadNameTexture shrinks the type instead of cutting the name.
    assert.ok(span * 1 >= aspect || span === SPAN_CLAMP.max, `${name}: span ${span} for aspect ${aspect.toFixed(2)}`)
  }
  // Smaller type needs no more tiles, and a wider tile needs fewer.
  assert.ok(nameSpan('Imperfect Records', 0.4, 1, SPAN_CLAMP) <= nameSpan('Imperfect Records', 0.9, 1, SPAN_CLAMP))
  assert.ok(nameSpan('Imperfect Records', size, 2, SPAN_CLAMP) <= nameSpan('Imperfect Records', size, 1, SPAN_CLAMP))
  // The clamp is honoured from both ends.
  assert.equal(nameSpan('A', size, 1, { min: 4, max: 6 }), 4)
  assert.equal(nameSpan('Hurry Up Slowly Records', size, 1, { min: 1, max: 2 }), 2)
})

// What panelMaterial's fragment stage does to a scroll tile's sampling —
// mUv.x = 0.5 + (vUv.x − 0.5)·vK, so vUv.x 0..1 renders [u(0), u(1)].
const shaderRenders = (scaleX, offsetX, vK) =>
  [0, 1].map((x) => (0.5 + (x - 0.5) * vK) * scaleX + offsetX)

test('names: a tile renders its WHOLE slice through panelMaterial’s pole pinch', () => {
  // nameRendered must be the shader's own arithmetic, or it measures nothing.
  for (const vK of [0.3, 0.527, 1]) {
    assert.deepEqual(nameRendered(0.25 / vK, 0.1, vK), shaderRenders(0.25 / vK, 0.1, vK))
  }
  // vK = sin θ for the latitude centerDir.y = cos θ — panelMaterial's own vK.
  for (const theta of [0.4, 1.0, Math.PI / 2, 2.4]) {
    assert.ok(Math.abs(namePinch(Math.cos(theta)) - Math.sin(theta)) < 1e-12, `θ ${theta}`)
  }
  assert.ok(namePinch(1) > 0, 'a parked row must not divide by zero')
  for (const span of [2, 3, 5, 6]) {
    const slice = 1 / span
    for (const vK of [1, 0.9, 0.707, 0.527, 0.3]) {
      for (let k = 0; k < span; k++) {
        const { scaleX, offsetX } = nameWindow(k, slice, vK)
        const [lo, hi] = shaderRenders(scaleX, offsetX, vK)
        assert.ok(Math.abs(lo - k * slice) < 1e-12, `span${span} vK${vK} k${k}: lo ${lo}`)
        assert.ok(Math.abs(hi - (k + 1) * slice) < 1e-12, `span${span} vK${vK} k${k}: hi ${hi}`)
        // The rendered range never leaves the texture, so region mode's
        // slightly negative offset at k = 0 is never clamped.
        assert.ok(lo >= -1e-12 && hi <= 1 + 1e-12, `span${span} vK${vK} k${k}: [${lo}, ${hi}]`)
      }
    }
  }
  // The negative control, and the "TOHOST" defect itself: resting tile k on
  // slice k WITHOUT undoing the pinch (scaleX = slice, offsetX = k·slice) —
  // every CPU-side value right, the render cut to the middle vK of the slice.
  const vK = 0.527 // the band edge at ?popnameband 0.65 (|y| 0.851)
  const slice = 1 / 5
  const [lo, hi] = shaderRenders(slice, 2 * slice, vK)
  assert.ok(Math.abs(hi - lo - slice * vK) < 1e-12, 'uncompensated renders only vK of its slice')
  assert.ok(hi - lo < slice * 0.6, `${(hi - lo) / slice} of the slice — TOBEHONEST read "TOHOST"`)
  assert.ok(Math.abs(lo - 2 * slice) > 0.04, 'and starts well inside its own slice')
})

test('names: band mode’s wrapped window still renders its own slice of the repeat', () => {
  const slice = 0.37 // a natural strip (name + gap) wider than one tile
  for (const vK of [1, 0.8, 0.527]) {
    for (let k = 0; k < 12; k++) {
      const { scaleX, offsetX } = nameWindow(k, slice, vK, { band: true })
      assert.ok(offsetX >= 0 && offsetX < 1, `k${k}: ${offsetX} must sit inside the repeat`)
      const [lo, hi] = shaderRenders(scaleX, offsetX, vK)
      assert.ok(Math.abs(hi - lo - slice) < 1e-12, `k${k}: width ${hi - lo}`)
      const off = lo - k * slice
      assert.ok(Math.abs(off - Math.round(off)) < 1e-12, `k${k}: ${off} is not a whole repeat`)
    }
  }
})

test('names: a world places its strip mid-latitude, front-facing, read once across its tiles', () => {
  const { director, panels } = makeDirector({ seed: 5, names: 1 }, { getRotation: TILT })
  const placed = director.namePlaced
  assert.equal(placed.mode, 'region')
  assert.equal(placed.relaxed, null) // band + facing + quadrant all satisfiable
  const run = strips(panels)
  assert.equal(run.length, placed.span)
  assert.ok(placed.span >= 2, `span ${placed.span}`)
  // The two gates, re-measured here rather than taken from the director.
  const rot = TILT()
  for (const p of run) {
    assert.ok(Math.abs(p.centerDir.y) <= Y_LIMIT, `row ${p.row}: |y| ${p.centerDir.y.toFixed(3)} > ${Y_LIMIT}`)
    const z = p.centerDir.clone().applyEuler(rot).z
    assert.ok(z >= Z_LIMIT, `L${p.lonIndex} r${p.row}: z ${z.toFixed(3)} < ${Z_LIMIT}`)
    assert.ok(!p.parked)
  }
  // One row, adjacent tiles, each slice of the strip exactly once.
  assert.equal(new Set(run.map((p) => p.row)).size, 1)
  assert.deepEqual(
    run.map((p) => p.shownAsset.k).sort((a, b) => a - b),
    Array.from({ length: placed.span }, (_, i) => i)
  )
  const lons = run.map((p) => p.lonIndex)
  for (const p of run) assert.equal(lons.includes((p.lonIndex + 1) % LON) || p.shownAsset.k === placed.span - 1, true)
  // The RENDERS tile the strip edge to edge: tile k renders slice k past the
  // pole pinch, and span slices cover the whole strip (no repeat, nothing
  // cut). Measured off the live uniforms + latitude, as the probe does.
  director.update(1 / 60)
  const byK = [...run].sort((a, b) => a.shownAsset.k - b.shownAsset.k)
  assert.ok(Math.abs(sliceOf(byK[0]) * placed.span - 1) < 1e-6, `slice × ${placed.span}`)
  let edge = 0
  for (const p of byK) {
    const slice = sliceOf(p)
    const [lo, hi] = rendered(p)
    assert.ok(Math.abs(lo - p.shownAsset.k * slice) < 1e-9, `k${p.shownAsset.k}: lo ${lo}`)
    assert.ok(Math.abs(lo - edge) < 1e-9, `k${p.shownAsset.k}: a gap at ${edge}`)
    edge = hi
  }
  assert.ok(Math.abs(edge - 1) < 1e-9, `the run renders ${edge} of the strip`)
  director.dispose()
})

test('names: a row re-born at the pole never carries a strip — names refresh at a change', () => {
  const { director, panels } = makeDirector({ seed: 5, names: 1 }, { getRotation: TILT })
  assert.ok(strips(panels).length > 0)
  const rows = new Map()
  for (const p of panels) rows.set(p.row, [...(rows.get(p.row) || []), p])
  let next = ROWS
  for (let k = 0; k < 16; k++) {
    const oldest = [...rows.values()].sort((a, b) => a[0].tapeS - b[0].tapeS)[0]
    for (const p of oldest) p.tapeS = next
    next += 1
    const picks = director.assignRow(oldest)
    assert.ok(
      picks.every((a) => a.kind !== 'name'),
      `re-born row ${oldest[0].row} took a strip`
    )
    oldest.forEach((p, i) => loadTile(director, p, picks[i]))
  }
  director.dispose()
})

test('names: consecutive worlds place in diagonally opposite quadrants', () => {
  const { director } = makeDirector({ seed: 5, names: 1, chaos: 0 }, { getRotation: TILT })
  const seen = []
  for (let i = 0; i < 8; i++) {
    seen.push({ want: director.grouping.nameQuad, ...director.namePlaced })
    director.step += 1
    director.grouping = director.makeGrouping({ step: director.step, lead: director.nextLead(director.step) })
    director.planAll(director.byProminence())
  }
  // The cursor walks NAME_QUADS — Nathan's lower-left then upper-right.
  const from = NAME_QUADS.indexOf(seen[0].want)
  assert.ok(from >= 0)
  seen.forEach((x, i) => assert.equal(x.want, NAME_QUADS[(from + i) % 4]))
  // Every world honoured it — and landed in a different quadrant each time.
  for (const x of seen) {
    assert.equal(x.relaxed, null, `step ${x.step} relaxed: ${x.relaxed}`)
    assert.equal(x.quad, x.want, `step ${x.step}`)
    assert.ok(x.tiles > 0)
    assert.ok(x.yMax <= x.yLimit, `step ${x.step}: yMax ${x.yMax} > ${x.yLimit}`)
    assert.ok(x.zMin >= x.zLimit, `step ${x.step}: zMin ${x.zMin} < ${x.zLimit}`)
  }
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i].quad, seen[i - 1].quad)
  // LL ↔ UR and UL ↔ LR: the first move crosses the region on both axes.
  const [a, b] = [seen[0].quad, seen[1].quad]
  assert.notEqual(a[0], b[0])
  assert.notEqual(a[1], b[1])
  director.dispose()
})

test('names: band mode draws the name across a whole latitude row, inside the band', () => {
  const { director, panels } = makeDirector({ seed: 5, names: 1, nameMode: 'band' }, { getRotation: TILT })
  const run = strips(panels)
  assert.equal(director.namePlaced.mode, 'band')
  assert.equal(run.length, LON) // a full horizontal band
  assert.equal(new Set(run.map((p) => p.row)).size, 1)
  assert.deepEqual(
    run.map((p) => p.shownAsset.k).sort((a, b) => a - b),
    Array.from({ length: LON }, (_, i) => i)
  )
  for (const p of run) assert.ok(Math.abs(p.centerDir.y) <= Y_LIMIT, `row ${p.row}`)
  // The natural strip repeats around the row: tile k+1 renders where tile k
  // stopped (mod the strip's period), each one a full slice wide.
  director.update(1 / 60)
  const byK = [...run].sort((a, b) => a.shownAsset.k - b.shownAsset.k)
  for (const p of byK) {
    const [lo, hi] = rendered(p)
    assert.ok(Math.abs(hi - lo - sliceOf(p)) < 1e-9, `k${p.shownAsset.k}: renders ${hi - lo}`)
    // the offset stays inside the repeat, so RepeatWrapping does the tiling
    const off = p.mesh.material.uniforms.uvOffsetA.value.x
    assert.ok(off >= 0 && off < 1, `k${p.shownAsset.k}: offset ${off} outside the repeat`)
  }
  for (let k = 1; k < byK.length; k++) {
    const d = rendered(byK[k])[0] - rendered(byK[k - 1])[1]
    assert.ok(Math.abs(d - Math.round(d)) < 1e-9, `k${k}: ${d} is not a whole repeat`)
  }
  director.dispose()
})

test('names: one shared texture per world + style + layout, and the strips hold still', () => {
  const { director, panels, textureManager } = makeDirector({ seed: 5, names: 1 }, { getRotation: TILT, canAnimate: () => true })
  const world = director.worlds[director.lead]
  const run = strips(panels)
  const key = `name:${world.slug}:ink:${POP_DEFAULTS.nameSize}:region${director.namePlaced.span}`
  assert.ok(run.length > 1)
  for (const p of run) {
    assert.equal(assetKey(p.shownAsset), key)
    assert.equal(p.shownAsset.text, world.clientName)
    assert.equal(p.shownAsset.world, director.lead)
  }
  assert.ok(director.warm.has(key)) // warmed with the grouping
  assert.equal(textureManager.cache.get(key).refs, run.length + 1) // one texture, refcounted per tile
  // No ticker: the RENDERED slice never moves — not as the clock runs, and
  // not as the row scrolls pole-ward, where the pinch changes and the
  // uniforms MUST move for the render to stay put. That is why placeNames
  // reconciles every frame: a window frozen at the change would lose register
  // at every seam as its row travelled (~10% of a slice over one hold).
  director.update(0.5)
  const was = run.map(rendered)
  for (let i = 0; i < 20; i++) director.update(0.25)
  assert.deepEqual(run.map(rendered), was)
  const scales = () => run.map((p) => p.mesh.material.uniforms.uvScaleA.value.x)
  const before = scales()
  for (const p of run) {
    // MeridianScroll.applyScroll: the row travels down, centerDir rewritten.
    const theta = Math.acos(p.centerDir.y) + 0.21 // ~12°, about one hold's travel
    const st = Math.sin(theta)
    const r = Math.hypot(p.centerDir.x, p.centerDir.z) || 1
    p.centerDir.set((p.centerDir.x / r) * st, Math.cos(theta), (p.centerDir.z / r) * st)
  }
  director.update(1 / 60)
  assert.notDeepEqual(scales(), before, 'the window must track the pinch as the row scrolls')
  run.forEach((p, i) => {
    const [lo, hi] = rendered(p)
    assert.ok(Math.abs(lo - was[i][0]) < 1e-9, `k${p.shownAsset.k}: lo moved ${was[i][0]} → ${lo}`)
    assert.ok(Math.abs(hi - was[i][1]) < 1e-9, `k${p.shownAsset.k}: hi moved ${was[i][1]} → ${hi}`)
  })
  // A longer name takes more tiles on the globe, not a cut strip.
  const long = [{ slug: 'long', clientName: 'Hurry Up Slowly Records', title: null, services: [], assets: pool(10, 'video', 'long-') }]
  const { director: d2, panels: p2 } = makeDirector({ seed: 5, names: 1 }, { getRotation: TILT, worlds: long })
  assert.ok(strips(p2).length > run.length, `${strips(p2).length} vs ${run.length}`)
  assert.equal(strips(p2).length, d2.namePlaced.span)
  director.dispose()
  d2.dispose()
})

test('scheduler: shared streams — one decode per clip lights every copy of it', async () => {
  const { panels, textureManager } = fakeScene()
  const clips = ['c0', 'c1', 'c2'].map((id) => ({ kind: 'video', playbackId: id, videoAspectRatio: '16:9' }))
  panels.forEach((p, i) => {
    p.asset = clips[i % clips.length]
    p.parked = false
  })
  const pool = {
    assigned: [],
    released: [],
    assign(slot, id) {
      this.assigned.push(id)
      return Promise.resolve({ videoWidth: 16, videoHeight: 9 })
    },
    releaseSlot(slot) {
      this.released.push(slot)
    },
  }
  const scheduler = new LivePanelScheduler({ panels, assets: clips, poolHandle: pool, textureManager, cycleThumbnails: false })
  scheduler.setShared(true)
  const rot = new THREE.Euler()
  scheduler.update(rot, 0, null)
  await settleTicks()
  assert.equal(pool.assigned.length, 2) // two new streams per update, one decode each
  scheduler.update(rot, 0.5, null)
  await settleTicks()
  assert.deepEqual([...pool.assigned].sort(), ['c0', 'c1', 'c2']) // never a second decode of a clip
  assert.ok(panels.every((p) => p.liveState === 'live')) // every copy joined
  assert.equal(scheduler.getStats().live, 3)
  scheduler.notifyContentChange(panels[0]) // a recycle: that copy leaves, the stream plays on
  assert.equal(panels[0].liveState, null)
  assert.equal(scheduler.streams.size, 3)
  scheduler.setShared(false) // back to one decode per tile: everything drops first
  assert.equal(pool.released.length, 3)
  assert.ok(panels.every((p) => !p.liveState && p.mesh.material.uniforms.uMix.value === 0))
  scheduler.dispose()
})

/* — P0c: the globe device knobs — */
test('device knobs: ?globedpr clamps, ?globeres takes a Mux rung or keeps the pin, /work renders at full res (P0c)', async () => {
  // load-time knobs: stub the window, evaluate a fresh copy of the module, restore the window in finally
  let fresh = 0
  const load = async (file, search, mobile, devicePixelRatio) => {
    const had = globalThis.window
    globalThis.window = {
      location: { search },
      matchMedia: (q) => ({ matches: mobile && q.includes('max-width') }),
      ...(devicePixelRatio === undefined ? {} : { devicePixelRatio }),
    }
    try {
      return await import(`../../src/components/${file}?t=p0c-${++fresh}`)
    } finally {
      if (had === undefined) delete globalThis.window
      else globalThis.window = had
    }
  }
  const low = await load('globe/globeConfig.js', '?globedpr=0&globeres=999p', true)
  assert.equal(low.GLOBE_DPR_MAX, 1) // PARAM reads 0: the clamp is what makes it 1
  assert.equal(low.GLOBE_STREAM_PARAMS, STREAM_PARAMS) // not a rung: the pin stands
  const high = await load('globe/globeConfig.js', '?globedpr=9&globeres=720p', true)
  assert.equal(high.GLOBE_DPR_MAX, 3)
  assert.equal(high.GLOBE_STREAM_PARAMS, 'min_resolution=720p&max_resolution=720p')
  for (const mobile of [false, true]) {
    const globe = await load('globe/globeConfig.js', '', mobile)
    assert.equal(globe.DPR_MAX, mobile ? 1.5 : 2) // /process shares DPR_MAX: unchanged
    // Nathan, 10-09 (Q10): "yes to phone globe at full res" — phones bake 3, desktop keeps DPR_MAX
    assert.equal(globe.GLOBE_DPR_MAX, mobile ? 3 : globe.DPR_MAX)
    assert.equal(globe.GLOBE_STREAM_PARAMS, STREAM_PARAMS) // "i think we can stay at 480p"
    const world = await load('work/world/worldConfig.js', '', mobile)
    assert.equal(world.DPR_MAX, mobile ? 3 : 2) // Nathan, 10-09: full res
  }
  assert.equal((await load('work/world/worldConfig.js', '?dpr=1.5', true)).DPR_MAX, 1.5) // ?dpr still A/Bs
  assert.equal((await load('globe/globeConfig.js', '?globedpr=1.5', true)).GLOBE_DPR_MAX, 1.5) // the old phone look
  // The name strips scale with the ratio the canvas RENDERS at over the old default, not the caps'.
  const strip = async (search, mobile, dpr) => (await load('globe/globeConfig.js', search, mobile, dpr)).NAME_STRIP_H
  assert.equal(await strip('', true, 3), 512) // DSF-3 phone: 3 / 1.5
  assert.equal(await strip('', true, 2), 341) // DSF-2 phone: 2 / 1.5 (the caps' ratio drew 512)
  assert.equal(await strip('', false, 1), 256)
  assert.equal(await strip('', false, 2), 256)
  assert.equal(await strip('?globedpr=3', false, 2), 256) // a 2× screen still renders 2 (the caps' ratio drew 384)
  assert.equal(await strip('?globedpr=3', false, 3), 384)
  assert.equal(await strip('?globedpr=1.5', true, 3), 256)
  // the rung regex is anchored at both ends and case-exact: P0c's surviving mutations X5 and X7
  // ('720px' holds the trailing anchor, which the other three let go)
  for (const bad of ['1720p', '540p', '720P', '720px']) {
    assert.equal((await load('globe/globeConfig.js', `?globeres=${bad}`, true)).GLOBE_STREAM_PARAMS, STREAM_PARAMS)
  }
})

test('wall canvas: desktop keeps the 08-27 texel ratio above pixel ratio 1.5, phones stay 896; ?fpstol clamps (PF)', async () => {
  // load-time knobs: stub the window (with the screen's pixel ratio), import a fresh copy, restore the window in finally
  let fresh = 0
  const load = async (search, mobile = false, dpr = 1) => {
    const had = globalThis.window
    const stub = { location: { search }, devicePixelRatio: dpr, matchMedia: (q) => ({ matches: mobile && q.includes('max-width') }) }
    if (search === null) delete globalThis.window // SSR: no window at all
    else globalThis.window = stub
    try {
      return await import(`../../src/components/work/world/worldConfig.js?t=pf-${++fresh}`)
    } finally {
      if (had === undefined) delete globalThis.window
      else globalThis.window = had
    }
  }
  for (const [dpr, px] of [[1, 1152], [1.5, 1152], [2, 1536], [3, 1536]]) {
    assert.equal((await load('', false, dpr)).WALL_CANVAS_PX, px, `desktop at DPR ${dpr}`) // DPR_MAX (2) caps a 3× screen
  }
  for (const dpr of [1, 2, 3]) assert.equal((await load('', true, dpr)).WALL_CANVAS_PX, 896, `phone at DPR ${dpr}`)
  assert.equal((await load('?wallpx=640', false, 2)).WALL_CANVAS_PX, 640) // ?wallpx still overrides
  assert.equal((await load('?dpr=1.5', false, 2)).WALL_CANVAS_PX, 1152) // the World's ratio, not the screen's
  assert.equal((await load(null)).WALL_CANVAS_PX, 1152) // SSR: the floor
  assert.equal((await load('', false, 2)).FPS_TOL_MS, 0) // default: the strict gate, today's cadence
  assert.equal((await load('?fpstol=2', false, 2)).FPS_TOL_MS, 2)
  assert.equal((await load('?fpstol=-1', false, 2)).FPS_TOL_MS, 0) // the clamp's ends
  assert.equal((await load('?fpstol=9', false, 2)).FPS_TOL_MS, 2.5)
  assert.equal((await load('', false, 2)).FPS_GATE_S, 1 / 60) // the tick's gate, in seconds: the strict 1/FPS_CAP
  assert.equal((await load('?fpstol=2', false, 2)).FPS_GATE_S, 1 / 60 - 0.002) // 2 ms of slack = 0.002 s (pins the ms → s units)
})

/* — P0: the video diet (Mux instant clipping; Nathan, 10-09) — */
test('video diet: one preview window, one detail cap, the clip last and once (P0)', () => {
  assert.equal(GLOBE_PREVIEW_SECONDS, PREVIEW_SECONDS) // the globe pool loops at the shared window
  assert.ok(PREVIEW_SECONDS > 0 && DETAIL_MAX_SECONDS > PREVIEW_SECONDS)
  // the pool: the caller's pin first, the clip last (VideoSlotPool.streamUrl)
  assert.equal(muxStream('abc', GLOBE_PREVIEW_SECONDS, STREAM_PARAMS), `https://stream.mux.com/abc.m3u8?${STREAM_PARAMS}&asset_end_time=${PREVIEW_SECONDS}`)
  // a bare surface: the clip alone (MediaSlot, NextProjectBand, MediaCard)
  assert.equal(muxStream('abc', DETAIL_MAX_SECONDS), `https://stream.mux.com/abc.m3u8?asset_end_time=${DETAIL_MAX_SECONDS}`)
  const q = new URL(muxStream('abc', PREVIEW_SECONDS, STREAM_PARAMS)).searchParams
  assert.deepEqual(q.getAll('asset_end_time'), [String(PREVIEW_SECONDS)])
  assert.equal([...q.keys()].at(-1), 'asset_end_time')
  // each surface's owed clip; the directory has no rule while it redirects
  const W = { preview: PREVIEW_SECONDS, detail: DETAIL_MAX_SECONDS }
  assert.equal(owedClip('/', true, W), PREVIEW_SECONDS)
  assert.equal(owedClip('/work', true, W), PREVIEW_SECONDS) // the World Near tier
  assert.equal(owedClip('/lab/globe', true, W), PREVIEW_SECONDS)
  assert.equal(owedClip('/work/some-project', false, W), DETAIL_MAX_SECONDS)
  assert.equal(owedClip('/work/some-project/', false, W), DETAIL_MAX_SECONDS)
  assert.equal(owedClip('/work/directory', false, W), null)
  assert.equal(owedClip('/', false, W), null)
  // Mux keeps every segment that starts before the clip
  assert.deepEqual(cover([5, 5, 5, 5, 5, 5], 15), { needed: 3, end: 15 })
  assert.deepEqual(cover([4, 4, 4, 4, 0.708], 15), { needed: 4, end: 16 }) // a 4 s-segment asset's clip ends at 16
  assert.deepEqual(cover([5, 5, 0.083], 15), { needed: 3, end: 10.083 }) // shorter than the cap: the whole asset
  assert.deepEqual(cover([5, 5, 5], 5), { needed: 1, end: 5 })
  assert.deepEqual(cover([4, 4, 4], 5), { needed: 2, end: 8 })
  // the strict cap (Nathan, 10-09): a detail player wraps at DETAIL_MAX_SECONDS whatever its clip's end
  const wrapAt = (t) => {
    const v = { currentTime: t }
    wrapAtDetailCap({ currentTarget: v })
    return v.currentTime
  }
  assert.equal(wrapAt(DETAIL_MAX_SECONDS + 0.1), 0)
  assert.equal(wrapAt(DETAIL_MAX_SECONDS), 0)
  assert.equal(wrapAt(DETAIL_MAX_SECONDS - 0.1), DETAIL_MAX_SECONDS - 0.1)
})

test('video diet: every master owes its surface a clip, no muted surface fetches audio, and the gates fail for real without them (P0, P0v)', () => {
  const W = { preview: PREVIEW_SECONDS, detail: DETAIL_MAX_SECONDS }
  const rend = (r) => `https://manifest-x.mux.com/${r}/rendition.m3u8?sig=1`
  const chunk = (r, i) => `https://chunk-x.mux.com/v1/chunk/${r}/${i}.m4s`
  // a master listing one video rendition r and, as a Mux master of an asset with sound does, its audio rendition
  // `${r}-audio`; `sent` is what reached Mux (`asked` unless --noclip stripped it)
  const master = (route, asked, r, sent = asked) => ({
    route, bucket: 'mux-master', asked, sent, bytes: 400,
    body: `#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="${rend(`${r}-audio`)}"\n#EXT-X-STREAM-INF:BANDWIDTH=1122000,RESOLUTION=854x480,AUDIO="audio"\n${rend(r)}`,
  })
  // r's playlist: n segments of `seg` seconds (Mux cuts most assets at 5 s, a few at 4 s)
  const playlist = (route, r, n, seg = 5) => ({
    route, bucket: 'mux-playlist', asked: rend(r), sent: rend(r), bytes: 300,
    body: ['#EXTM3U', `#EXT-X-MAP:URI="${chunk(r, 'init')}"`, ...Array.from({ length: n }, (_, i) => `#EXTINF:${seg}.0,\n${chunk(r, i)}`), '#EXT-X-ENDLIST'].join('\n'),
  })
  const get = (route, r, i) => ({ route, bucket: 'mux-segment', asked: chunk(r, i), sent: chunk(r, i), bytes: 1000 })
  const gets = (route, r, n) => [get(route, r, 'init'), ...Array.from({ length: n }, (_, i) => get(route, r, i))]
  const run = (bodies, fetched, sessions, opts = {}) =>
    netReport([...bodies.map(({ body, ...e }) => e), ...fetched], bodies, sessions, { ...W, ...opts })
  // a session that played to maxT and jumped back from there once
  const play = (id, route, pooled, maxT, more = {}) => ({ id, pooled, route, n: 40, maxT, jumps: [maxT], ended: 0, maxStillMs: 0, dur: maxT, ...more })
  const pv = Math.ceil(PREVIEW_SECONDS / 5) // what each clip keeps of a 5 s-segment asset
  const dv = Math.ceil(DETAIL_MAX_SECONDS / 5)
  const slotUrl = muxStream('slot', PREVIEW_SECONDS, STREAM_PARAMS) // a home globe slot (pinned)
  const heroUrl = muxStream('hero', DETAIL_MAX_SECONDS) // a detail page's MediaSlot (bare)
  const ok = run(
    [master('/', slotUrl, 'p'), playlist('/', 'p', pv), master('/work/x', heroUrl, 'h'), playlist('/work/x', 'h', dv)],
    [...gets('/', 'p', pv), ...gets('/work/x', 'h', dv)],
    [play('slot', '/', true, PREVIEW_SECONDS), play('hero', '/work/x', false, DETAIL_MAX_SECONDS + TICK_S / 2)],
  )
  assert.deepEqual(ok.pass, { streamClip: true, segmentsPerRendition: true, loops: true, audio: true })
  assert.equal(ok.net.detail.streamClip.n, 2) // both surfaces judged, each against its own clip
  assert.equal(ok.net.detail.segmentsPerRendition.n, 2)
  assert.equal(ok.net.detail.loops.wraps, 2)
  assert.equal(ok.net.byRoute['/work/x']['mux-segment'].n, dv + 1) // the init + the clip
  assert.equal(ok.net.detail.segmentsPerRendition.conflicts, 0)
  assert.deepEqual(ok.net.refetch, { chunks: pv + 1 + dv + 1, dupPaths: 0 })
  // a 4 s-segment asset: the preview clip runs on to the next boundary, and the pool's guard loops it at the window
  const four = run([master('/', slotUrl, 'p'), playlist('/', 'p', 2, 4)], gets('/', 'p', 2), [play('slot', '/', true, PREVIEW_SECONDS + 0.2)])
  assert.deepEqual(four.pass, { streamClip: true, segmentsPerRendition: true, loops: true, audio: true })
  assert.equal(four.net.renditions[0].clipEnd, 8)

  // NC: --noclip. The page asked for the clips; Mux was sent none, so it listed whole assets, the
  // slot fetched past its window and the hero played past its cap: all three clip and loop gates fail
  // non-vacuously. The client's audio strip is not the clip's, so audio still passes.
  const bare = (u) => u.replace(/[?&]asset_end_time=[\d.]+/, '')
  const nc = run(
    [master('/', slotUrl, 'p', bare(slotUrl)), playlist('/', 'p', 8), master('/work/x', heroUrl, 'h', bare(heroUrl)), playlist('/work/x', 'h', 40)],
    [...gets('/', 'p', pv + 2), ...gets('/work/x', 'h', dv + 5)],
    [play('slot', '/', true, PREVIEW_SECONDS), play('hero', '/work/x', false, 2 * DETAIL_MAX_SECONDS)],
  )
  assert.deepEqual(nc.pass, { streamClip: false, segmentsPerRendition: false, loops: false, audio: true })
  for (const g of ['streamClip', 'segmentsPerRendition', 'loops']) assert.equal(nc.net.detail[g].vacuous, false)
  assert.equal(nc.net.detail.streamClip.worst, 2)
  assert.equal(nc.net.detail.segmentsPerRendition.worst, 5) // the hero's segments past its cap
  assert.equal(nc.net.detail.loops.bad[0].why, 'played past its clip')
  // NC: a bare master off a detail page has no rule (the directory's case today)
  assert.equal(run([master('/work/directory', heroUrl, 'h'), playlist('/work/directory', 'h', dv)], gets('/work/directory', 'h', dv), []).pass.streamClip, false)
  // NC: a chunk no playlist lists fails segmentsPerRendition
  assert.equal(run([master('/', slotUrl, 'p'), playlist('/', 'p', pv)], [...gets('/', 'p', pv), get('/', 'q', 0)], [play('slot', '/', true, 1)]).pass.segmentsPerRendition, false)
  // the loop: within LOOP_END_S of its loop point passes (a guard a tick late included); past it,
  // `ended`, frozen on the end frame, no clip end to judge against, or a run that never wraps at its
  // loop point each fail
  const loops = (s) => run([master('/', slotUrl, 'p'), playlist('/', 'p', pv)], gets('/', 'p', pv), s).pass.loops
  assert.equal(loops([play('slot', '/', true, PREVIEW_SECONDS + TICK_S / 2)]), true)
  assert.equal(loops([play('slot', '/', true, PREVIEW_SECONDS + TICK_S + 0.01)]), true) // the pool's guard, a tick late
  assert.equal(loops([play('slot', '/', true, PREVIEW_SECONDS + LOOP_END_S + TICK_S)]), false)
  assert.equal(loops([play('slot', '/', true, PREVIEW_SECONDS, { ended: 1 })]), false)
  assert.equal(loops([play('slot', '/', true, PREVIEW_SECONDS, { maxStillMs: STALL_MS })]), false)
  assert.equal(loops([play('other', '/', true, 1)]), false)
  assert.equal(loops([play('slot', '/', true, 1, { jumps: [] })]), false)
  assert.equal(loops([play('slot', '/', true, PREVIEW_SECONDS / 2)]), false) // a rewind mid-clip (a detach) is no wrap
  // vacuity: nothing logged is a failure, never a pass; under reduced motion the floor is 0
  const empty = run([], [], [])
  assert.deepEqual(empty.pass, { streamClip: false, segmentsPerRendition: false, loops: false, audio: false })
  assert.equal(empty.net.detail.streamClip.vacuous, true)
  assert.deepEqual(run([], [], [], { rm: true }).pass, { streamClip: true, segmentsPerRendition: true, loops: true, audio: true })
  // the loop point is the window or the clip's end, whichever comes first: a 4 s-segment slot (clip
  // end 8) that plays on to its clip's end fails; a 4 s-segment detail hero (clip end 16) passes when
  // it wraps at the cap and fails when it plays to its clip's end
  assert.equal(run([master('/', slotUrl, 'p'), playlist('/', 'p', 2, 4)], gets('/', 'p', 2), [play('slot', '/', true, 8)]).pass.loops, false)
  const hero4 = (maxT) => run([master('/work/x', heroUrl, 'h'), playlist('/work/x', 'h', 4, 4)], gets('/work/x', 'h', 4), [play('hero', '/work/x', false, maxT)])
  assert.equal(hero4(DETAIL_MAX_SECONDS + TICK_S).pass.loops, true)
  assert.equal(hero4(16).pass.loops, false)
  assert.equal(hero4(16).net.detail.loops.bad[0].why, 'played past its clip')
  // NC: a segment path two playlists list is an ambiguous attribution, so segmentsPerRendition fails
  const twinUrl = muxStream('twin', PREVIEW_SECONDS, STREAM_PARAMS)
  const twin = run(
    [master('/', slotUrl, 'p'), playlist('/', 'p', pv), master('/', twinUrl, 'q'), { ...playlist('/', 'q', pv), body: playlist('/', 'p', pv).body }],
    gets('/', 'p', pv),
    [play('slot', '/', true, PREVIEW_SECONDS)],
  )
  assert.equal(twin.pass.segmentsPerRendition, false)
  assert.equal(twin.net.detail.segmentsPerRendition.conflicts, pv) // each segment; the shared init is none
  assert.equal(twin.pass.streamClip, true)
  // two clips of one asset (a globe slot's preview, a detail page's cap) share the track's init chunk
  // and never a segment: Mux serves one init to every clip, so a shared init alone is no conflict
  const sharedInit = (b) => ({ ...b, body: b.body.replace(chunk('h', 'init'), chunk('p', 'init')) })
  const clips = run(
    [master('/', slotUrl, 'p'), playlist('/', 'p', pv), master('/work/x', heroUrl, 'h'), sharedInit(playlist('/work/x', 'h', dv))],
    [...gets('/', 'p', pv), get('/work/x', 'p', 'init'), ...gets('/work/x', 'h', dv).slice(1)],
    [play('slot', '/', true, PREVIEW_SECONDS), play('hero', '/work/x', false, DETAIL_MAX_SECONDS)],
  )
  assert.equal(clips.net.detail.segmentsPerRendition.conflicts, 0)
  // ...and the first claim stands: both routes' fetches of the shared init credit the slot's playlist,
  // the first to list it, so the hero's rendition holds its own segments only
  assert.deepEqual(clips.net.renditions.map((r) => [r.id, r.init, r.fetched]), [['slot', true, pv], ['hero', false, dv]])
  assert.deepEqual(clips.pass, { streamClip: true, segmentsPerRendition: true, loops: true, audio: true })
  // refetch is listed, never gated: one chunk fetched twice
  const again = run([master('/', slotUrl, 'p'), playlist('/', 'p', pv)], [...gets('/', 'p', pv), get('/', 'p', 0)], [play('slot', '/', true, PREVIEW_SECONDS)])
  assert.deepEqual(again.net.refetch, { chunks: pv + 2, dupPaths: 1 })
  assert.deepEqual(again.pass, { streamClip: true, segmentsPerRendition: true, loops: true, audio: true })

  // P0v, the audio gate. Every master above lists its audio rendition (n counts them) and none was
  // fetched, so audio passed.
  const audio = (r) => (({ n, vacuous, worst, playlists, chunks }) => ({ n, vacuous, worst, playlists, chunks }))(r.net.detail.audio)
  assert.deepEqual(audio(ok), { n: 2, vacuous: false, worst: 0, playlists: 0, chunks: 0 })
  // NC: an audio playlist, its init and a segment fetched fail it, non-vacuously, and nothing else
  const slot = [master('/', slotUrl, 'p'), playlist('/', 'p', pv)]
  const heard = run([...slot, playlist('/', 'p-audio', pv)], [...gets('/', 'p', pv), ...gets('/', 'p-audio', 1)], [play('slot', '/', true, PREVIEW_SECONDS)])
  assert.deepEqual(heard.pass, { streamClip: true, segmentsPerRendition: true, loops: true, audio: false })
  assert.deepEqual(audio(heard), { n: 1, vacuous: false, worst: 3, playlists: 1, chunks: 2 })
  // one audio request alone fails it: the bound is 0, not 1
  const once = run([...slot, playlist('/', 'p-audio', pv)], gets('/', 'p', pv), [play('slot', '/', true, PREVIEW_SECONDS)])
  assert.deepEqual(audio(once), { n: 1, vacuous: false, worst: 1, playlists: 1, chunks: 0 })
  assert.equal(once.pass.audio, false)
  // NC: --noclip strips the clip from what Mux is sent, never from what the page asked, so a muted
  // master is never taken for the Lightbox's
  const ncSlot = [master('/', slotUrl, 'p', bare(slotUrl)), playlist('/', 'p', pv)]
  const ncHeard = run([...ncSlot, playlist('/', 'p-audio', pv)], [...gets('/', 'p', pv), get('/', 'p-audio', 0)], [play('slot', '/', true, PREVIEW_SECONDS)])
  assert.equal(ncHeard.pass.audio, false)
  // judged, not exempted: a master taken for the Lightbox's would leave the gate vacuous (n 0) and fail it anyway
  assert.deepEqual(audio(ncHeard), { n: 1, vacuous: false, worst: 2, playlists: 1, chunks: 1 })
  // the Lightbox plays with sound: its master, the one that asks for no clip, is neither offered nor judged
  const lightbox = run(
    [...slot, master('/work/directory', 'https://stream.mux.com/lb.m3u8', 'l'), playlist('/work/directory', 'l-audio', 3)],
    [...gets('/', 'p', pv), ...gets('/work/directory', 'l-audio', 3)],
    [play('slot', '/', true, PREVIEW_SECONDS)],
  )
  assert.equal(lightbox.pass.audio, true)
  assert.deepEqual(audio(lightbox), { n: 1, vacuous: false, worst: 0, playlists: 0, chunks: 0 })
  // vacuity: no master listing audio is a failure, never a pass (the floor is 0 under reduced motion, above)
  const silent = (m) => ({ ...m, body: m.body.replace(/^#EXT-X-MEDIA:.*\n/m, '').replace(',AUDIO="audio"', '') })
  assert.ok(slot[0].body.includes('TYPE=AUDIO') && !silent(slot[0]).body.includes('AUDIO'))
  const mute = run([silent(slot[0]), slot[1]], gets('/', 'p', pv), [play('slot', '/', true, PREVIEW_SECONDS)])
  assert.deepEqual(mute.pass, { streamClip: true, segmentsPerRendition: true, loops: true, audio: false })
  assert.equal(mute.net.detail.audio.vacuous, true)
})

/* — P0v: muted surfaces fetch no audio (Nathan, 10-09: "disable the audio download anywhere other
   than the lightbox") — */
test('video diet: a muted surface strips its master of the audio rendition and nothing else (P0v)', () => {
  const AUDIO = '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Default",CHANNELS="2",AUTOSELECT=YES,DEFAULT=YES,URI="https://manifest-x.mux.com/a/rendition.m3u8?sig=1"'
  const variant = (codecs, audio = ',AUDIO="audio"') =>
    `#EXT-X-STREAM-INF:BANDWIDTH=1122000,RESOLUTION=854x480,CODECS="${codecs}"${audio}\nhttps://manifest-x.mux.com/v/rendition.m3u8`
  const m3u8 = (...lines) => ['#EXTM3U', '#EXT-X-VERSION:5', ...lines, ''].join('\n')
  // Mux's shape: an audio group with a URI, and a variant that points at it
  const mux = m3u8(AUDIO, variant('avc1.640028,mp4a.40.2'))
  const out = stripAudioFromMaster(mux)
  assert.ok(!out.includes('TYPE=AUDIO') && !out.includes('AUDIO='))
  assert.ok(out.includes('CODECS="avc1.640028"'))
  assert.equal(out, m3u8(variant('avc1.640028', '')))
  // no audio: the very same string
  const none = m3u8(variant('avc1.640028', ''))
  assert.equal(stripAudioFromMaster(none), none)
  // an audio-only asset would be left with no codec: the master stays as it is
  const audioOnly = m3u8(AUDIO, variant('mp4a.40.2'))
  assert.equal(stripAudioFromMaster(audioOnly), audioOnly)
  // CRLF line endings are kept
  assert.equal(stripAudioFromMaster(mux.replace(/\n/g, '\r\n')), out.replace(/\n/g, '\r\n'))
  // an audio rendition with no URI is muxed into the variants: dropping its codec would mis-declare the
  // SourceBuffer, so the master stays as it is
  const muxed = mux.replace(/,URI="[^"]*"/, '')
  assert.ok(muxed.includes('TYPE=AUDIO') && !muxed.includes('URI='))
  assert.equal(stripAudioFromMaster(muxed), muxed)
  // every audio codec family leaves CODECS; every video one stays
  const video = ['avc1.640028', 'hvc1.2.4.L123.B0', 'av01.0.08M.08', 'vp09.00.40.08']
  for (const a of ['mha2.0x0D', 'mhm2.0x0D', 'mlpa', 'enca', 'dts+', 'dtsx', 'ec-3', 'Opus', 'fLaC']) {
    assert.ok(AUDIO_CODEC.test(a), a)
    for (const v of video) assert.equal(stripAudioFromMaster(m3u8(AUDIO, variant(`${a},${v}`))), m3u8(variant(v, '')), `${a},${v}`)
  }
  for (const v of video) assert.equal(AUDIO_CODEC.test(v), false, v)
  // a family name must end the codec or meet its first dot: a longer name is no match
  for (const x of ['mp4ax.40.2', 'opusx', 'flacy', 'ec-3x']) assert.equal(AUDIO_CODEC.test(x), false, x)
  // a variant with no AUDIO= keeps its CODECS: an mp4a there is muxed into its own segments
  const mixed = m3u8(AUDIO, variant('avc1.640028,mp4a.40.2'), variant('avc1.4d401e,mp4a.40.2', ''))
  assert.equal(stripAudioFromMaster(mixed), m3u8(variant('avc1.640028', ''), variant('avc1.4d401e,mp4a.40.2', '')))
})

test('video diet: the videoOnly playlist loader rewrites the master alone, and hands every other load through as it came (P0v)', () => {
  // a stub hls.js: its default loader records what each load() was handed
  const calls = []
  class Base {
    load(context, config, callbacks) {
      calls.push({ context, config, callbacks })
    }
  }
  const Loader = videoOnlyLoader({ DefaultConfig: { loader: Base } })
  assert.ok(new Loader() instanceof Base)
  const master = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="a.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1122000,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"\nv.m3u8\n'
  const callbacks = () => {
    const got = []
    const cb = { onSuccess: (...a) => got.push(a), onError() {}, onTimeout() {}, onAbort() {}, onProgress() {} }
    return { cb, got }
  }
  const config = { timeout: 1 }
  // the master: onSuccess gets the stripped text, with the same response, stats, context and details
  const m = callbacks()
  const manifest = { type: 'manifest', url: 'https://stream.mux.com/x.m3u8' }
  new Loader().load(manifest, config, m.cb)
  const sent = calls.at(-1)
  assert.equal(sent.context, manifest)
  assert.equal(sent.config, config)
  assert.notEqual(sent.callbacks, m.cb)
  for (const k of ['onError', 'onTimeout', 'onAbort', 'onProgress']) assert.equal(sent.callbacks[k], m.cb[k], k)
  const response = { url: manifest.url, data: master }
  const stats = {}
  const details = {}
  sent.callbacks.onSuccess(response, stats, manifest, details)
  assert.equal(m.got.length, 1)
  assert.equal(m.got[0][0], response)
  assert.equal(response.data, stripAudioFromMaster(master))
  assert.ok(!response.data.includes('AUDIO'))
  assert.equal(m.got[0][1], stats)
  assert.equal(m.got[0][2], manifest)
  assert.equal(m.got[0][3], details)
  // a master that arrives as bytes is left alone
  const bytes = { data: new ArrayBuffer(8) }
  new Loader().load(manifest, config, callbacks().cb)
  const before = bytes.data
  calls.at(-1).callbacks.onSuccess(bytes, stats, manifest, details)
  assert.equal(bytes.data, before)
  // every other playlist (a level, the audio track, subtitles) keeps the caller's own callbacks
  for (const type of ['level', 'audioTrack', 'subtitleTrack']) {
    const o = callbacks()
    const context = { type, url: 'https://manifest-x.mux.com/r/rendition.m3u8' }
    new Loader().load(context, config, o.cb)
    assert.equal(calls.at(-1).callbacks, o.cb, type)
    assert.equal(calls.at(-1).context, context, type)
  }
  // one class, built on first use
  assert.equal(videoOnlyLoader({ DefaultConfig: { loader: Base } }), Loader)
})

/* — Media spans (docs/globe-worlds-plan.md § Media spans): the gate module, and the texture ledger — */
test('spans: the gate module — vacuity, expect-fail, request classes, baselines, payload', () => {
  assert.deepEqual(LEVELS, ['off', 'tex', 'h', 'vq', 'live', 'tier'])
  const clip = `&asset_end_time=${GLOBE_PREVIEW_SECONDS}` // P0: VideoSlotPool.streamUrl's clip (muxStream: exactly the window, P0-ORDERS §1.2)
  const mux = (id, t1 = 512) => `https://image.mux.com/${id}/thumbnail.webp?width=${t1}&height=${t1}&fit_mode=smartcrop`
  assert.equal(classifyRequest(mux('abc'), 512).kind, 'legacy')
  assert.equal(classifyRequest('https://cdn.sanity.io/images/p/d/x-1500x1000.jpg?w=512&h=512&fit=crop&crop=entropy&auto=format', 512).kind, 'legacy')
  assert.equal(classifyRequest(`https://stream.mux.com/abc.m3u8?min_resolution=480p&max_resolution=480p${clip}`, 512).id, 'abc')
  const other = classifyRequest('https://image.mux.com/LongPlaybackId0123456789/animated.gif?width=64', 512)
  assert.equal(other.kind, 'other')
  assert.equal(other.shape, 'image.mux.com/*/animated.gif?width=#') // id-free: one allow-list entry for every id
  assert.equal(classifyRequest(mux('abc'), 384).kind, 'other') // NC: the legacy query at the wrong T1 is not legacy

  // A units-off run: 12 legacy ids, one stream, six quiet hold samples across one change.
  const sample = (t) => ({ t, phase: 'hold', step: t < 4 ? 0 : 1, staleLanded: 0, units: null, tex: { mib: 40, peak: 50, refDrift: 0 }, layout: { adj: 0, unitAdj: 0, minPool: 8 } })
  const report = {
    requests: [...Array.from({ length: 12 }, (_, i) => mux(`id${i}`)), `https://stream.mux.com/id0.m3u8?min_resolution=480p&max_resolution=480p${clip}`],
    samples: [1, 2, 3, 4, 5, 6].map(sample),
  }
  const ctx = { key: 'off-desktop', seed: '42', units: null, level: 'off', mode: 'tides', rm: false, t1: 512, texmb: 96, texpeak: null, record: true, baselines: {} }
  const rec = unitGates(report, ctx)
  assert.ok(Object.values(rec.pass).every(Boolean), JSON.stringify(rec.detail))
  assert.equal('texPeak' in rec.pass || 'legacyParity' in rec.pass, false) // skipped while recording

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-gates-'))
  try {
    const file = path.join(dir, 'baselines', 'globe-units.json')
    assert.deepEqual(readBaselines(file), {})
    writeBaseline(file, 'off-desktop', baselineOf(report, ctx))
    const baselines = readBaselines(file)
    assert.equal(baselines['off-desktop'].peakMax, 50)
    assert.equal(Object.keys(baselines['off-desktop'].idQuery).length, 12)
    assert.deepEqual(baselines['off-desktop'].streamQueries, [`min_resolution=480p&max_resolution=480p${clip}`])

    const plain = unitGates(report, { ...ctx, record: false, baselines })
    assert.ok(Object.values(plain.pass).every(Boolean), JSON.stringify(plain.detail))
    assert.equal(plain.detail.texPeak.bound, 50 * 1.15)
    assert.equal(plain.detail.legacyParity.n, 12)
    // NC: each P0b gate fails non-vacuously on its own violation, and each floor holds.
    const judge = (r, over = {}) => unitGates(r, { ...ctx, record: false, baselines, ...over })
    const each = (patch) => ({ ...report, samples: report.samples.map((s) => ({ ...s, ...patch })) })
    const gif = { ...report, requests: [...report.requests, 'https://image.mux.com/id0/animated.gif?width=64'] }
    assert.deepEqual([judge(gif).pass.texReqShape, judge(gif).detail.texReqShape.vacuous], [false, false]) // an unlisted 'other' shape
    assert.equal(unitGates(gif, ctx).pass.texReqShape, true) // ...which a recording accepts, as the allow-list
    assert.equal(judge(each({ staleLanded: 1 })).pass.staleLanded, false)
    assert.equal(judge(each({ tex: { mib: 40, peak: 50, refDrift: 1 } })).pass.texBudget, false) // a drifting ledger
    assert.equal(judge(each({ units: { clock: 'running' } })).pass.unitsVacuous, false) // units at level off
    assert.equal(judge({ ...report, samples: report.samples.slice(0, 2) }).detail.texBudget.vacuous, true) // 2 quiet samples < 3
    assert.equal(judge(each({ step: 0 })).detail.texPeak.vacuous, true) // no step change: nothing to bound
    assert.equal(judge(report, { key: 'nope' }).detail.legacyParity.vacuous, true) // no record under the key
    assert.equal(judge({ ...report, requests: report.requests.slice(3) }).detail.legacyParity.vacuous, true) // 9 shared ids < 10

    // NC: a stream pin that sneaks in while units are off fails legacyParity, non-vacuously.
    const pinned = { ...report, requests: [...report.requests, `https://stream.mux.com/id1.m3u8?min_resolution=720p&max_resolution=720p${clip}`] }
    const bad = unitGates(pinned, { ...ctx, record: false, baselines })
    const asReport = (g) => ({ pass: g.pass, spans: { detail: g.detail } })
    assert.equal(bad.pass.legacyParity, false)
    assert.equal(bad.detail.legacyParity.vacuous, false)
    assert.ok(expectFail(asReport(bad), ['legacyParity']).ok)
    // NC: a stream that lost P0's clip (today's URL) is a stream-query mismatch against a post-P0 baseline.
    const unclipped = { ...report, requests: [...report.requests.slice(0, -1), 'https://stream.mux.com/id0.m3u8?min_resolution=480p&max_resolution=480p'] }
    assert.equal(unitGates(unclipped, { ...ctx, record: false, baselines }).pass.legacyParity, false)
    // NC: expectFail refuses a gate that passed, a failure that is only vacuous, an absent gate, a fatal run.
    assert.equal(expectFail(asReport(plain), ['legacyParity']).ok, false)
    const empty = unitGates({ requests: [], samples: [] }, { ...ctx, record: false, baselines })
    assert.equal(empty.pass.texReqShape, false)
    assert.equal(empty.detail.texReqShape.vacuous, true)
    assert.equal(expectFail(asReport(empty), ['texReqShape']).ok, false)
    assert.equal(expectFail(asReport(bad), ['unitSeam']).ok, false)
    assert.equal(expectFail({ ...asReport(bad), fatal: 'Error: boom' }, ['legacyParity']).ok, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }

  // The island payload: lean assets, and u only where it belongs.
  const island = (assets) => {
    const v = (x) => [0, x]
    const props = { globeWorlds: [1, [[0, { slug: v('a'), assets: [1, assets.map((a) => [0, Object.fromEntries(Object.entries(a).map(([k, x]) => [k, v(x)]))])] }]]] }
    return `<astro-island uid="x" component-url="/l.js" props="${JSON.stringify(props).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></astro-island>`
  }
  const A = { kind: 'video', playbackId: 'p1', videoAspectRatio: '16:9' }
  assert.ok(checkPayload(island([A]), { unitsAbsent: true }).ok)
  const withU = checkPayload(island([{ ...A, u: 'h' }, A]))
  assert.ok(withU.ok, withU.reasons.join('; '))
  assert.equal(withU.uBytes, 32)
  // NC: u before P2, no u after it, a stray key, a foreign class.
  assert.equal(checkPayload(island([{ ...A, u: 'h' }]), { unitsAbsent: true }).ok, false)
  assert.equal(checkPayload(island([A])).ok, false)
  assert.equal(checkPayload(island([{ ...A, id: 'x' }]), { unitsAbsent: true }).ok, false)
  assert.equal(checkPayload(island([{ ...A, u: 'x' }])).ok, false)
  // s (P2, M2): a video's source short side, only below TOP_RUNG; 0 = Mux holds no track size.
  const withS = checkPayload(island([{ ...A, u: 'h', s: 720 }, { ...A, playbackId: 'p2', s: 0 }, A]))
  assert.ok(withS.ok, withS.reasons.join('; '))
  assert.equal(withS.withS, 2)
  assert.equal(withS.sBytes, 22 + 20)
  // NC: s on a still, a fractional s, s before P2.
  const still = { kind: 'still', imageUrl: 'https://cdn.sanity.io/images/p/d/x-800x600.jpg' }
  assert.equal(checkPayload(island([{ ...A, u: 'h' }, { ...still, s: 600 }])).ok, false)
  assert.equal(checkPayload(island([{ ...A, u: 'h', s: 1.5 }])).ok, false)
  assert.equal(checkPayload(island([{ ...A, s: 720 }]), { unitsAbsent: true }).ok, false)

  // — P3 — class requests (T1 512: h 1043×512, q 1043²; clamped to the source on both CDNs).
  assert.deepEqual(classSizes(512), { h: [1043, 512], v: [512, 1043], q: [1043, 1043] })
  assert.deepEqual(classSizes(384), { h: [783, 384], v: [384, 783], q: [783, 783] })
  assert.equal(classifyRequest('https://image.mux.com/abc/thumbnail.webp?width=1043&height=512&fit_mode=crop&time=0', 512).shape, 'h')
  assert.equal(classifyRequest('https://image.mux.com/abc/thumbnail.webp?width=853&height=419&fit_mode=crop&time=0', 512).shape, 'h') // M2: an s 480 source, clamped
  assert.equal(classifyRequest('https://cdn.sanity.io/images/p/d/x-800x600.jpg?w=800&h=393&fit=crop&auto=format', 512).shape, 'h')
  assert.equal(classifyRequest('https://cdn.sanity.io/images/p/d/x-600x900.jpg?w=442&h=900&fit=crop&auto=format', 512).shape, 'v')
  // NC: an upscaled Sanity crop, and a Mux crop off the class size, are not class requests.
  assert.equal(classifyRequest('https://cdn.sanity.io/images/p/d/x-800x600.jpg?w=1100&h=540&fit=crop&auto=format', 512).kind, 'other')
  assert.equal(classifyRequest('https://image.mux.com/abc/thumbnail.webp?width=1040&height=512&fit_mode=crop&time=0', 512).kind, 'other')
  // — P3 — one variant per id, now that an id can be asked two ways (P0b's leftover, M17): one query per id
  // passes; the same id as a legacy crop AND a class crop is two variants, which fails non-vacuously, worst 2.
  const classQ = 'https://image.mux.com/id0/thumbnail.webp?width=1043&height=512&fit_mode=crop&time=0'
  const texCtx = { ...ctx, units: 1, level: 'tex', record: false, baselines: {} }
  const oneWay = unitGates({ requests: [classQ, mux('id1')], samples: [] }, texCtx)
  assert.deepEqual([oneWay.pass.thumbVariants, oneWay.detail.thumbVariants.n, oneWay.detail.thumbVariants.worst], [true, 2, 1])
  const twoWays = unitGates({ requests: [mux('id0'), classQ, mux('id1')], samples: [] }, texCtx)
  assert.deepEqual([twoWays.pass.thumbVariants, twoWays.detail.thumbVariants.vacuous, twoWays.detail.thumbVariants.worst], [false, false, 2])
  assert.ok(expectFail({ pass: twoWays.pass, spans: { detail: twoWays.detail } }, ['thumbVariants']).ok)
  // — P3 — the class shapes are exact: Mux's needs fit_mode=crop and time=0, Sanity's fit=crop and auto=format,
  // and neither takes another parameter.
  for (const url of [
    'https://image.mux.com/abc/thumbnail.webp?width=1043&height=512&fit_mode=crop&time=1',
    'https://image.mux.com/abc/thumbnail.webp?width=1043&height=512&fit_mode=smartcrop&time=0',
    'https://image.mux.com/abc/thumbnail.webp?width=1043&height=512&fit_mode=crop&time=0&x=1',
    'https://cdn.sanity.io/images/p/d/x-800x600.jpg?w=800&h=393&fit=crop&auto=webp',
    'https://cdn.sanity.io/images/p/d/x-800x600.jpg?w=800&h=393&fit=max&auto=format',
    'https://cdn.sanity.io/images/p/d/x-800x600.jpg?w=800&h=393&fit=crop&auto=format&q=80',
  ])
    assert.equal(classifyRequest(url, 512).kind, 'other', url)
  // — P3 — at level tex a run must ask for a class texture (texReqShape); liveReg sums the live class tiles over
  // the samples (n), bounds the worst register at 1e-3, and is skipped under RM.
  const legacyOnly = unitGates({ requests: [mux('id1')], samples: [] }, texCtx)
  assert.deepEqual([legacyOnly.pass.texReqShape, legacyOnly.detail.texReqShape.vacuous, legacyOnly.detail.texReqShape.classN], [false, false, 0])
  const registers = (...regs) => ({ requests: [classQ], samples: regs.map((liveReg) => ({ phase: 'hold', step: 0, units: { texClass: { h: 1, v: 0, q: 0, legacy: 0 }, liveReg } })) })
  const held = unitGates(registers({ n: 2, worst: 4e-4 }, { n: 1, worst: 0 }), texCtx)
  assert.deepEqual([held.pass.liveReg, held.detail.liveReg.n, held.detail.liveReg.worst], [true, 3, 4e-4])
  const misregistered = unitGates(registers({ n: 1, worst: 2e-3 }), texCtx)
  assert.deepEqual([misregistered.pass.liveReg, misregistered.detail.liveReg.vacuous, misregistered.detail.liveReg.worst], [false, false, 2e-3])
  assert.equal(unitGates(registers({ n: 0, worst: 0 }, { n: 0, worst: 0 }), texCtx).detail.liveReg.vacuous, true) // samples, no live class tile
  assert.equal('liveReg' in unitGates(registers({ n: 1, worst: 2e-3 }), { ...texCtx, rm: true }).pass, false)

  // — P4a — level h: unitWhole over the running holds (n = the units judged), bornWhole in tide (n = births),
  // unitRepeats over the holds against ?popunitmax, memberStills in tile mode (n = members), and the neighbour
  // rule against its key's units-off reference (adjMax), judged only on holds with minPool ≥ 6.
  const hCtx = { ...texCtx, key: 'u-desktop', level: 'h', unitMax: 1, baselines: { 'off-desktop': { adjMax: 0 }, 'off-mobile': { adjMax: 2 } } }
  const uS = (units = {}, { phase = 'hold', adj = 0, minPool = 8 } = {}) => ({
    phase,
    step: 0,
    units: { texClass: { h: 1, v: 0, q: 0, legacy: 0 }, whole: { n: 2, torn: 0 }, bornH: 0, members: 4, liveMembers: 0, repeats: 1, clock: 'running', ...units },
    layout: { adj, unitAdj: 0, minPool },
  })
  const judgeH = (samples, over = {}) => unitGates({ requests: [classQ], samples }, { ...hCtx, ...over })
  const failsAlone = (g, name) => g.pass[name] === false && g.detail[name].vacuous === false && expectFail({ pass: g.pass, spans: { detail: g.detail } }, [name]).ok
  const plainH = judgeH([uS(), uS({ whole: { n: 3, torn: 0 } })])
  assert.deepEqual([plainH.pass.unitWhole, plainH.detail.unitWhole.n, plainH.detail.unitWhole.worst], [true, 5, 0])
  assert.deepEqual([plainH.pass.unitRepeats, plainH.detail.unitRepeats.n, plainH.detail.unitRepeats.bound], [true, 2, 1])
  assert.deepEqual([plainH.pass.neighbourRule, plainH.detail.neighbourRule.n, plainH.detail.neighbourRule.bound], [true, 2, 0])
  assert.deepEqual(['bornWhole' in plainH.detail, 'memberStills' in plainH.detail], [false, false]) // tide only, tile mode only
  assert.ok(failsAlone(judgeH([uS({ whole: { n: 2, torn: 1 } })]), 'unitWhole'))
  // a torn unit in a stopped hold or outside a hold is not judged
  const quietTorn = judgeH([uS(), uS({ whole: { n: 2, torn: 1 }, clock: 'stopped' }), uS({ whole: { n: 2, torn: 1 } }, { phase: 'change' })])
  assert.deepEqual([quietTorn.pass.unitWhole, quietTorn.detail.unitWhole.n], [true, 2])
  const tideH = judgeH([uS({ bornH: 3 }), uS({ bornH: 5 })], { tide: true })
  assert.deepEqual([tideH.pass.bornWhole, tideH.detail.bornWhole.n], [true, 5])
  assert.ok(failsAlone(judgeH([uS({ bornH: 5, whole: { n: 2, torn: 1 } })], { tide: true }), 'bornWhole'))
  assert.equal(judgeH([uS()], { tide: true }).detail.bornWhole.vacuous, true) // no birth: nothing to judge
  assert.ok(failsAlone(judgeH([uS({ repeats: 2 })]), 'unitRepeats'))
  assert.equal(judgeH([uS({ repeats: 2 })], { unitMax: 2 }).pass.unitRepeats, true)
  assert.equal(judgeH([uS(), uS({ repeats: 3 }, { phase: 'change' })]).pass.unitRepeats, true) // holds only
  const tileH = judgeH([uS({ members: 4 }), uS({ members: 6 })], { tile: true })
  assert.deepEqual([tileH.pass.memberStills, tileH.detail.memberStills.n], [true, 6])
  assert.ok(failsAlone(judgeH([uS({ liveMembers: 1 })], { tile: true }), 'memberStills'))
  assert.ok(failsAlone(judgeH([uS({}, { adj: 1 })]), 'neighbourRule'))
  assert.deepEqual([judgeH([uS({}, { adj: 1, minPool: 5 }), uS()]).pass.neighbourRule, judgeH([uS({}, { adj: 1, minPool: 5 }), uS()]).detail.neighbourRule.n], [true, 1])
  // each key reads its own reference: u-mobile → off-mobile; a key outside the map → off-mobile or off-desktop
  assert.deepEqual([judgeH([uS({}, { adj: 1 })], { key: 'u-mobile' }).pass.neighbourRule, judgeH([uS({}, { adj: 1 })], { key: 'u-mobile' }).detail.neighbourRule.bound], [true, 2])
  assert.deepEqual([judgeH([uS({}, { adj: 1 })], { key: 'u-tile', mobile: true }).pass.neighbourRule, judgeH([uS({}, { adj: 1 })], { key: 'u-tile' }).pass.neighbourRule], [true, false])
  // report-only (never in pass): no reference, ?popequiv, and absent while recording
  for (const over of [{ baselines: {} }, { equiv: 2 }]) {
    const g = judgeH([uS({}, { adj: 1 })], over)
    assert.deepEqual(['neighbourRule' in g.pass, g.detail.neighbourRule.reportOnly, g.detail.neighbourRule.worst], [false, true, 1], JSON.stringify(over))
  }
  assert.equal('neighbourRule' in judgeH([uS()], { record: true }).detail, false)

  // — P4b — level h: what the units render. unitSeam and unitRegister sum n over the samples (floor 20 each)
  // and bound the worst: 1e-4 of a member's rendered width, 5e-6 of texture uv. snaps (n = the units samples,
  // floor 1) and skew (n = the most skewChecks a sample saw, floor 20) read the director's cumulative counters.
  const drawn = (units = {}) => uS({ seam: { n: 12, worst: 2e-5 }, register: { n: 24, worst: 1e-6 }, snaps: 0, skewBad: 0, skewChecks: 30, ...units })
  const right = judgeH([drawn(), drawn({ seam: { n: 10, worst: 1e-4 }, register: { n: 20, worst: 5e-6 }, skewChecks: 60 })])
  const row = (g, name) => [g.pass[name], g.detail[name].n, g.detail[name].floor, g.detail[name].worst, g.detail[name].bound]
  assert.deepEqual(row(right, 'unitSeam'), [true, 22, 20, 1e-4, 1e-4]) // n sums the samples; a worst AT the bound passes
  assert.deepEqual(row(right, 'unitRegister'), [true, 44, 20, 5e-6, 5e-6])
  assert.deepEqual(row(right, 'snaps'), [true, 2, 1, 0, 0])
  assert.deepEqual(row(right, 'skew'), [true, 60, 20, 0, 0]) // a cumulative count: its latest, never a sum
  // each fails non-vacuously just past its bound, whichever sample saw it (a counter only grows: the later one)
  assert.ok(failsAlone(judgeH([drawn(), drawn({ seam: { n: 10, worst: 1.01e-4 } })]), 'unitSeam'))
  assert.ok(failsAlone(judgeH([drawn({ seam: { n: 10, worst: 1.01e-4 } }), drawn()]), 'unitSeam'))
  assert.ok(failsAlone(judgeH([drawn({ register: { n: 30, worst: 5.1e-6 } })]), 'unitRegister'))
  assert.ok(failsAlone(judgeH([drawn({ register: { n: 30, worst: 5.1e-6 } }), drawn()]), 'unitRegister'))
  assert.ok(failsAlone(judgeH([drawn(), drawn({ snaps: 1 })]), 'snaps'))
  assert.ok(failsAlone(judgeH([drawn(), drawn({ skewBad: 1 })]), 'skew'))
  // ...and whichever phase saw it: all four read every units sample, so a fault seen only in a change (or a tide),
  // with the clock stopped, fails them too. That is when windows move most.
  const moving = (units) => uS({ seam: { n: 12, worst: 2e-5 }, register: { n: 24, worst: 1e-6 }, snaps: 0, skewBad: 0, skewChecks: 30, clock: 'stopped', ...units }, { phase: 'change' })
  assert.ok(failsAlone(judgeH([drawn(), moving({ seam: { n: 10, worst: 1.01e-4 } })]), 'unitSeam'))
  assert.ok(failsAlone(judgeH([drawn(), moving({ register: { n: 20, worst: 5.1e-6 } })]), 'unitRegister'))
  assert.ok(failsAlone(judgeH([drawn(), moving({ snaps: 1 })]), 'snaps'))
  assert.ok(failsAlone(judgeH([drawn(), moving({ skewBad: 1 })]), 'skew'))
  // vacuous under the floors: 19 seams, 19 registers, 19 skew checks; snaps with no units sample at all
  const thin = judgeH([drawn({ seam: { n: 19, worst: 0 }, register: { n: 19, worst: 0 }, skewChecks: 19 })])
  for (const name of ['unitSeam', 'unitRegister', 'skew']) assert.deepEqual([thin.pass[name], thin.detail[name].vacuous], [false, true], name)
  const unitless = judgeH([{ ...drawn(), units: null }])
  assert.deepEqual([unitless.pass.snaps, unitless.detail.snaps.vacuous], [false, true])
  // below level h none of the four is evaluated
  const texOnly = unitGates({ requests: [classQ], samples: [drawn()] }, texCtx)
  assert.equal(['unitSeam', 'unitRegister', 'snaps', 'skew'].some((name) => name in texOnly.detail), false)

  // — P5 — level vq: unitColumns and unitRows sum n over every units sample (floor 3) and bound the worst at 1e-4;
  // unitWarp sums the running holds only (floor 3) against ln 1.15 + 0.002 (UNIT_EPS); initVQ wants no V/Q in the
  // initial layout and a null initThetaH on every sample (M4); unitShapes is vacuity only: min(h, v + q) placed,
  // from the last sample's cumulative counts.
  const WARP = Math.log(1 + UNIT_EPS) + 0.002
  const tall = (units = {}) =>
    drawn({ cols: { n: 2, worst: 1e-5 }, rows: { n: 2, worst: 1e-5 }, warp: { n: 4, worst: 0.1 }, initVQ: 0, initThetaH: null, placed: { h: 3, v: 1, q: 1 }, ...units })
  const atVQ = (samples, over = {}) => judgeH(samples, { level: 'vq', ...over })
  const vq = atVQ([tall(), tall({ cols: { n: 1, worst: 1e-4 }, rows: { n: 1, worst: 1e-4 }, warp: { n: 2, worst: WARP } })])
  assert.deepEqual(row(vq, 'unitColumns'), [true, 3, 3, 1e-4, 1e-4]) // a worst AT the bound passes
  assert.deepEqual(row(vq, 'unitRows'), [true, 3, 3, 1e-4, 1e-4])
  assert.deepEqual(row(vq, 'unitWarp'), [true, 6, 3, WARP, WARP])
  assert.deepEqual([...row(vq, 'initVQ'), vq.detail.initVQ.initPosed], [true, 2, 1, 0, 0, 0])
  assert.deepEqual([vq.pass.unitShapes, vq.detail.unitShapes.n, vq.detail.unitShapes.floor], [true, 2, 1]) // min(h 3, v + q 2)
  // each fails non-vacuously just past its bound, whichever sample saw it
  assert.ok(failsAlone(atVQ([tall(), tall({ cols: { n: 1, worst: 1.01e-4 } })]), 'unitColumns'))
  assert.ok(failsAlone(atVQ([tall({ rows: { n: 3, worst: 1.01e-4 } }), tall()]), 'unitRows'))
  assert.ok(failsAlone(atVQ([tall(), tall({ warp: { n: 4, worst: WARP + 1e-6 } })]), 'unitWarp'))
  assert.ok(failsAlone(atVQ([tall({ cols: { n: 1, worst: 1.01e-4 } }), tall()]), 'unitColumns')) // the first sample too
  assert.ok(failsAlone(atVQ([tall({ warp: { n: 4, worst: WARP + 1e-6 } }), tall()]), 'unitWarp'))
  // columns and rows read every units sample (a change, a stopped clock: when windows move most); the warp reads only
  // the running holds, where a unit sits inside its planned life (a change lays the next plan's units)
  const changing = (units) => uS({ ...tall().units, clock: 'stopped', ...units }, { phase: 'change' })
  assert.ok(failsAlone(atVQ([tall(), changing({ cols: { n: 2, worst: 2e-4 } })]), 'unitColumns'))
  assert.ok(failsAlone(atVQ([tall(), changing({ rows: { n: 2, worst: 2e-4 } })]), 'unitRows'))
  const quietWarp = atVQ([tall(), tall({ warp: { n: 4, worst: 0.5 }, clock: 'stopped' }), changing({ warp: { n: 4, worst: 0.5 }, clock: 'running' })])
  assert.deepEqual([quietWarp.pass.unitWarp, quietWarp.detail.unitWarp.n, quietWarp.detail.unitWarp.worst], [true, 4, 0.1])
  // initVQ: a V/Q in the initial layout, or an initial plan that saw a horizon (the posed latch failed), on any sample
  assert.ok(failsAlone(atVQ([tall(), tall({ initVQ: 1 })]), 'initVQ'))
  assert.ok(failsAlone(atVQ([tall({ initVQ: 1 }), tall()]), 'initVQ'))
  const posed = atVQ([tall({ initThetaH: 127.5 }), tall()])
  assert.ok(failsAlone(posed, 'initVQ'))
  assert.deepEqual([posed.detail.initVQ.worst, posed.detail.initVQ.initPosed], [0, 1])
  // vacuous under the floors: 2 columns, 2 rows, 2 warped members; unitShapes with no V/Q placed, or no H
  const thinVQ = atVQ([tall({ cols: { n: 2, worst: 0 }, rows: { n: 2, worst: 0 }, warp: { n: 2, worst: 0 } })])
  for (const name of ['unitColumns', 'unitRows', 'unitWarp']) assert.deepEqual([thinVQ.pass[name], thinVQ.detail[name].vacuous], [false, true], name)
  for (const placed of [{ h: 4, v: 0, q: 0 }, { h: 0, v: 2, q: 1 }]) {
    const g = atVQ([tall({ placed: { h: 9, v: 9, q: 9 } }), tall({ placed })])
    assert.deepEqual([g.pass.unitShapes, g.detail.unitShapes.vacuous], [false, true], JSON.stringify(placed))
  }
  // a units sample without the P5 fields (a report from before P5, judged at vq) adds nothing to the three sums
  const mixed = atVQ([drawn(), tall(), tall()])
  assert.deepEqual(['unitColumns', 'unitRows', 'unitWarp'].map((name) => [mixed.pass[name], mixed.detail[name].n]), [[true, 4], [true, 4], [true, 8]])
  // below level vq none of the five is evaluated
  const hOnly = judgeH([tall()])
  assert.equal(['unitColumns', 'unitRows', 'unitWarp', 'initVQ', 'unitShapes'].some((name) => name in hOnly.detail), false)

  // — P6a — level live: unitLiveSplit sums the lit units (n) and the split ones over every units sample, and allows
  // 2% of them split; chipsPerUnit bounds the most members announcing live in one unit at 1 (its n is the lit units);
  // unitRegisterB sums the measured live members (n) and bounds texB's worst register at 1e-3. Floors 1.
  const P6A = ['unitLiveSplit', 'chipsPerUnit', 'unitRegisterB']
  const lit = (units = {}) => tall({ liveSplit: { n: 50, split: 0 }, chipsPerUnit: 1, registerB: { n: 100, worst: 1e-6 }, ...units })
  const atLive = (samples, over = {}) => judgeH(samples, { level: 'live', ...over })
  const lv = atLive([lit(), lit({ liveSplit: { n: 50, split: 2 }, registerB: { n: 20, worst: 1e-3 } })])
  assert.deepEqual(row(lv, 'unitLiveSplit'), [true, 100, 1, 0.02, 0.02]) // 2 split of 100 lit: AT the bound passes
  assert.deepEqual(row(lv, 'chipsPerUnit'), [true, 100, 1, 1, 1])
  assert.deepEqual(row(lv, 'unitRegisterB'), [true, 120, 1, 1e-3, 1e-3])
  // each fails non-vacuously just past its bound, whichever sample saw it
  assert.ok(failsAlone(atLive([lit(), lit({ liveSplit: { n: 50, split: 3 } })]), 'unitLiveSplit')) // 3 of 100
  assert.ok(failsAlone(atLive([lit({ liveSplit: { n: 1, split: 1 } })]), 'unitLiveSplit')) // the one lit unit, split
  assert.ok(failsAlone(atLive([lit({ liveSplit: { n: 50, split: 1 } }), lit({ liveSplit: { n: 50, split: 2 } })]), 'unitLiveSplit')) // 1 + 2 of 100: the splits add up across samples
  assert.ok(failsAlone(atLive([lit({ chipsPerUnit: 2 }), lit()]), 'chipsPerUnit'))
  assert.ok(failsAlone(atLive([lit(), lit({ registerB: { n: 1, worst: 1.01e-3 } })]), 'unitRegisterB'))
  assert.ok(failsAlone(atLive([lit({ registerB: { n: 1, worst: 1.01e-3 } }), lit()]), 'unitRegisterB'))
  // vacuous with no lit unit (chipsPerUnit too: its n is the lit units) and no measured live member; the split
  // share is then 0, never NaN
  const dark = atLive([lit({ liveSplit: { n: 0, split: 0 }, chipsPerUnit: 0, registerB: { n: 0, worst: 0 } })])
  for (const name of P6A) assert.deepEqual([dark.pass[name], dark.detail[name].vacuous], [false, true], name)
  assert.equal(dark.detail.unitLiveSplit.worst, 0)
  // a units sample without the P6a fields (a report from before P6a, judged at live) adds nothing to the sums
  const before = atLive([tall(), lit()])
  assert.deepEqual(P6A.map((name) => [before.pass[name], before.detail[name].n]), [[true, 50], [true, 50], [true, 100]])
  // below level live none of the three is evaluated
  const vqOnly = atVQ([lit()])
  assert.equal(P6A.some((name) => name in vqOnly.detail), false)
})

test('spans: a load that rejects is failed, never pending, so the ref ledger still goes quiet (M3)', async () => {
  // names off: in node a real TextureManager rejects every name strip (nameTicker draws on a canvas)
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 42, group: 2, chaos: 0, names: 0 })
  const { panels } = fakeScene()
  const tm = new TextureManager()
  // A stub loader: every load settles a tick later, as on the network. The one key that rejects is
  // chosen once the layout has put it on a tile.
  let bad = null
  tm.loader = {
    load(url, onLoad, onProgress, onError) {
      setTimeout(() => {
        if (url.includes(`/${bad}/`)) onError(new Error(`404 ${url}`))
        else onLoad(Object.assign(new THREE.Texture(), { image: { width: 512, height: 512 } }))
      }, 0)
    },
  }
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager: tm,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(0.8, 0, 0),
    canAnimate: () => false,
  })
  const loads = director.initialLayout(director.byProminence())
  const victim = panels.find((p) => !p.parked)
  bad = assetKey(victim.asset)
  // an entry released before it decoded is never counted (account's cache check)
  tm.loadAsset({ kind: 'video', playbackId: 'released-early' }).catch(() => {})
  tm.release('released-early')
  assert.ok(director.warm.has(bad)) // the director holds a warm ref on it, beside the tile's
  assert.equal(director.texStats().refDrift, null) // loads in flight: not quiet yet
  await Promise.all(loads)
  await settleTicks()
  const s = tm.stats()
  assert.equal(s.failed, 1)
  assert.equal(s.pending, 0)
  assert.ok(s.peak >= s.mib && s.peak > 0) // the session peak is kept
  // every other entry decoded and counted once: 512² RGBA8, plus a third for the mips
  assert.equal(s.mib, Math.round((((s.entries - 1) * 512 * 512 * 4 * 4) / 3 / 1048576) * 10) / 10)
  // the tile's load bowed out (loadTile released its own +1); the director's warm ref keeps the entry
  assert.equal(victim.heldThumbId, null)
  assert.equal(tm.cache.get(bad).refs, 1)
  assert.equal(director.busy, false)
  assert.equal(director.texStats().refDrift, 0) // quiet: every ref is a tile's or the warm set's
  // upload and layout telemetry (report-only; the off-* records' adjMax rests on layout): an upload frame
  // is counted apart from the idle ones; a same-key pair counts right and up; a parked tile is out.
  director.noteRender(20, 1)
  director.noteRender(1, 0)
  assert.deepEqual(director.uploadStats(), { n: 1, msMax: 20, idleP95: 1 })
  const shown = panels.map((t) => [t, t.shownAsset])
  panels.forEach((t, i) => (t.shownAsset = { kind: 'still', imageUrl: `own-${i}` })) // every tile its own key
  assert.equal(director.layoutStats().adj, 0)
  const tileAt = (lon, tape) => panels.find((t) => !t.parked && t.lonIndex === lon && t.tapeS === tape)
  const pivot = panels.find((t) => !t.parked && tileAt(t.lonIndex, t.tapeS + 1) && tileAt((t.lonIndex + 1) % LON, t.tapeS))
  const above = tileAt(pivot.lonIndex, pivot.tapeS + 1)
  above.shownAsset = pivot.shownAsset
  assert.equal(director.layoutStats().adj, 1) // the up pair
  tileAt((pivot.lonIndex + 1) % LON, pivot.tapeS).shownAsset = pivot.shownAsset
  assert.equal(director.layoutStats().adj, 2) // and the right pair
  above.parked = true
  assert.equal(director.layoutStats().adj, 1) // a parked tile is out of the layout
  above.parked = false
  for (const [t, a] of shown) t.shownAsset = a
  // NC: the old rule (pending = no texture) holds the rejected entry in flight forever, so the ledger never reads.
  tm.stats = function () {
    return { ...TextureManager.prototype.stats.call(this), pending: [...this.cache.values()].filter((e) => !e.texture).length }
  }
  assert.equal(tm.stats().pending, 1)
  assert.equal(director.texStats().refDrift, null)
  await settleTicks(5)
  assert.equal(director.texStats().refDrift, null)
  delete tm.stats
  // ...and its refs still free it: the director's release evicts it, with every other warm-only entry.
  director.dispose()
  assert.equal(tm.cache.has(bad), false)
  assert.equal(tm.peek(bad), null)
  assert.equal(tm.stats().failed, 0)
  assert.equal(tm.stats().refs, panels.filter((p) => p.heldThumbId).length) // the tiles still own what they show
  // the bytes leave with the refs: what stays resident is the tiles' textures alone, mips counted
  assert.equal(tm.stats().mib, Math.round(((tm.cache.size * 512 * 512 * 4 * 4) / 3 / 1048576) * 10) / 10)
  tm.disposeAll()
  assert.equal(tm.stats().mib, 0) // teardown empties the ledger
})

/* — Media spans, P1: unitSpan's arithmetic and mediaClass's classes (T1–T10, T30). Both modules
   stay inert until P3 wires them in: these tests are their only importer. — */
const SPAN_L = latticeOf({ lon: 12, visibleRows: 6, gapDeg: 1.1, latGapDeg: 1.1 }) // the home globe: 12 meridians, 6 rows, 1.1° gaps
const rad = (d) => (d * Math.PI) / 180
const degOf = (r) => (r * 180) / Math.PI
/** The seam between a unit's two members, as a fraction of the unit: the gap G over 2P − G. */
const seamOf = (P, G) => G / (2 * P - G)
/** |a − b| ≤ tol, element by element, for a number or an array. */
const near = (a, b, tol, msg = '') => {
  const [xs, ys] = [[a].flat(), [b].flat()]
  assert.equal(xs.length, ys.length, msg)
  xs.forEach((x, i) => assert.ok(Math.abs(x - ys[i]) <= tol, `${msg} [${i}] ${x} vs ${ys[i]} (± ${tol})`))
}

test('spans: lattice() off a real scroll panel is latticeOf, and the unit aspects follow from it (T1)', () => {
  const panelsAt = (gapDeg) =>
    buildScrollingGlobeGeometry({ lonSegments: 12, rows: 8, gapDeg, latGapDeg: 1.1, pitchRad: Math.PI / 6, radius: 1 }).panels
  const panels = panelsAt(1.1)
  for (const p of [panels[0], panels[panels.length - 1]]) {
    const live = lattice(p, 12, 6)
    for (const k of ['Pphi', 'Gphi', 'Pth', 'Gth', 'phiLen', 'bandH']) near(live[k], SPAN_L[k], 1e-12, k)
  }
  // and with unequal gaps (2° meridians, 1.1° rows), so neither gap can stand in for the other
  const wide = lattice(panelsAt(2)[0], 12, 6)
  const wideOf = latticeOf({ lon: 12, visibleRows: 6, gapDeg: 2, latGapDeg: 1.1 })
  for (const k of ['Pphi', 'Gphi', 'Pth', 'Gth', 'phiLen', 'bandH']) near(wide[k], wideOf[k], 1e-12, `2° gaps: ${k}`)
  assert.deepEqual(UNIT_SHAPE, { h: { cols: 2, rows: 1 }, v: { cols: 1, rows: 2 }, q: { cols: 2, rows: 2 } })
  const S = (L, cls) => unitAspect(UNIT_SHAPE[cls].cols, UNIT_SHAPE[cls].rows, L)
  near(S(SPAN_L, 'h'), 2.038062, 1e-6, 'S_h')
  near(S(SPAN_L, 'v'), 0.490662, 1e-6, 'S_v')
  near(S(SPAN_L, 'q'), 1, 1e-6, 'S_q')
  // NC: a globe built with 2° meridian gaps gives S_h 2.00692, which the S assertion refuses
  const wideH = S(wide, 'h')
  near(wideH, 2.00692, 1e-5)
  assert.ok(Math.abs(wideH - 2.038062) > 1e-6)
})

test('spans: frac keeps the gap inside the unit, a seam of G/(2P − G) between its members (T2)', () => {
  const { Pphi, Gphi, phiLen, Pth, Gth, bandH } = SPAN_L
  const m0 = frac(0, 2, Pphi, Gphi, phiLen)
  const m1 = frac(1, 2, Pphi, Gphi, phiLen)
  near(m0, [0, 0.490662], 1e-6, 'kx 0')
  near(m1, [0.509338, 1], 1e-6, 'kx 1')
  near(m1[0] - m0[1], 0.018676, 1e-6, 'seam')
  near(m1[0] - m0[1], seamOf(Pphi, Gphi), 1e-12, 'seam = G/(2P − G)')
  near(m1[1] - m1[0], m0[1] - m0[0], 1e-12, 'equal members')
  // the rows split the same way (V, Q), and one row is the whole unit (H)
  const [r0, r1] = [0, 1].map((ky) => frac(ky, 2, Pth, Gth, bandH))
  near(r1[0] - r0[1], seamOf(Pth, Gth), 1e-12, 'row seam')
  near(frac(0, 1, Pth, Gth, bandH), [0, 1], 1e-12, 'one row')
  // NC: with G = 0 the members meet at 0.5: no seam
  const [n0, n1] = [0, 1].map((kx) => frac(kx, 2, Pphi, 0, Pphi))
  near([n0[1], n1[0]], [0.5, 0.5], 1e-12)
  assert.ok(Math.abs(n1[0] - n0[1] - 0.018676) > 1e-6)
})

test('spans: an H pair shows one picture: kx 0 and kx 1 meet exactly one seam apart, at any pinch (T3)', () => {
  const S = unitAspect(2, 1, SPAN_L)
  const place = { cols: 2, rows: 1, S, L: SPAN_L }
  const seam = seamOf(SPAN_L.Pphi, SPAN_L.Gphi)
  const [a0, b0] = frac(0, 2, SPAN_L.Pphi, SPAN_L.Gphi, SPAN_L.phiLen)
  for (const [aTex, legacyErr] of [[1043 / 512, '1.0385'], [16 / 9, '1.1845'], [1.5, '1.3968']]) {
    const C = coverWindow(aTex, S)
    const cu = computeCoverUv(aTex, S)
    assert.deepEqual(C, { s: cu.scale, o: cu.offset }) // TextureManager's cover crop, as a window
    for (const th of [30, 60, 90]) {
      const vK = Math.sin(rad(th))
      const [W0, W1] = [0, 1].map((kx) => compose(C, memberWindow({ cols: 2, rows: 1, kx, ky: 0 }, vK, vK, SPAN_L)))
      const r0 = spanRendered(W0.s[0], W0.o[0], vK)
      const r1 = spanRendered(W1.s[0], W1.o[0], vK)
      const want = C.s[0] * vK * seam
      assert.ok(Math.abs(r1[0] - r0[1] - want) <= 1e-12, `aTex ${aTex} at ${th}°: gap ${r1[0] - r0[1]} vs ${want}`)
      // the pair spans the whole cover crop, pinched about its centre like one tile
      near([r0[0], r1[1]], [C.o[0] + C.s[0] * (0.5 - vK / 2), C.o[0] + C.s[0] * (0.5 + vK / 2)], 1e-12, 'pair extent')
      // and each member shows the crop's full height: one row is the whole unit
      for (const Wk of [W0, W1]) near([Wk.o[1], Wk.o[1] + Wk.s[1]], [C.o[1], C.o[1] + C.s[1]], 1e-12, 'member height')
      // unitA builds the same windows from the member records
      assert.deepEqual(unitA({ place, kx: 0, ky: 0 }, vK, rad(th), aTex), W0)
      assert.deepEqual(unitA({ place, kx: 1, ky: 0 }, vK, rad(th), aTex), W1)
      // NC: today's per-tile cover (computeCoverUv(aTex, 1) on both members) renders one range
      // twice, so the seam misses by more than a member's width
      const leg = computeCoverUv(aTex, 1)
      const rl = spanRendered(leg.scale[0], leg.offset[0], vK)
      const err = Math.abs(rl[0] - rl[1] - want) / (C.s[0] * vK * (b0 - a0))
      assert.equal(err.toFixed(4), legacyErr, `legacy seam error, aTex ${aTex} at ${th}°`)
    }
  }
})

test('spans: a V pair keeps its columns straight across the row gap, inside the ε warp (T4)', () => {
  const S = unitAspect(1, 2, SPAN_L)
  const place = { cols: 1, rows: 2, S, L: SPAN_L }
  const { Pth } = SPAN_L
  const rowSeam = seamOf(Pth, SPAN_L.Gth)
  near(rowSeam, 0.018676, 1e-6, 'row seam')
  for (const [th, warpWant, jogWant] of [[47.61, '0.1397', '0.1191'], [60, '0.0719', '0.0670'], [79.5, '0.0211', '0.0203']]) {
    const t0 = rad(th)
    const t1 = t0 + Pth
    const v0 = Math.sin(t0)
    const v1 = Math.sin(t1)
    const q0 = kappaOwn(t0, 0, Pth, v0)
    const q1 = kappaOwn(t1, 1, Pth, v1)
    for (const aTex of [512 / 1043, S]) {
      const C = coverWindow(aTex, S)
      const T = unitA({ place, kx: 0, ky: 0 }, v0, t0, aTex)
      const B = unitA({ place, kx: 0, ky: 1 }, v1, t1, aTex)
      assert.deepEqual(T, compose(C, memberWindow({ cols: 1, rows: 2, kx: 0, ky: 0 }, v0, q0, SPAN_L)))
      assert.deepEqual(B, compose(C, memberWindow({ cols: 1, rows: 2, kx: 0, ky: 1 }, v1, q1, SPAN_L)))
      // the two rows render the same columns, each through its own pinch...
      near(spanRendered(T.s[0], T.o[0], v0), spanRendered(B.s[0], B.o[0], v1), 1e-12, `columns at ${th}°`)
      // ...and stack one row seam apart (texture v runs bottom-up: the top row sits above)
      near((T.o[1] - (B.o[1] + B.s[1])) / C.s[1], rowSeam, 1e-12, `row gap at ${th}°`)
      // and together span the crop's full height: the bottom row from its foot, the top row to its head
      near([B.o[1], T.o[1] + T.s[1]], [C.o[1], C.o[1] + C.s[1]], 1e-12, `pair height at ${th}°`)
    }
    const warp = [Math.abs(Math.log(v0 / q0)), Math.abs(Math.log(v1 / q1))]
    assert.equal(warp[0].toFixed(4), warpWant, `warp at ${th}°`)
    near(warp[1], warp[0], 1e-12, 'both rows warp alike')
    assert.ok(warp.every((w) => w <= Math.log(1.15)), `warp ${warp} at ${th}°`)
    // NC: q = each row's own vK jogs the columns at the gap
    const C = coverWindow(512 / 1043, S)
    const Tn = compose(C, memberWindow({ cols: 1, rows: 2, kx: 0, ky: 0 }, v0, v0, SPAN_L))
    const Bn = compose(C, memberWindow({ cols: 1, rows: 2, kx: 0, ky: 1 }, v1, v1, SPAN_L))
    const [rt, rb] = [spanRendered(Tn.s[0], Tn.o[0], v0), spanRendered(Bn.s[0], Bn.o[0], v1)]
    assert.equal((Math.max(Math.abs(rt[0] - rb[0]), Math.abs(rt[1] - rb[1])) / C.s[0]).toFixed(4), jogWant, `jog at ${th}°`)
  }
})

test('spans: every DELAY_ORDERS cascade over 8 rows lands inside T_ENTRANCE, at the jitter’s worst (T5)', () => {
  const panelsOf = (lon, rows) =>
    Array.from({ length: lon * rows }, (_, i) => ({
      lonIndex: Math.floor(i / rows),
      row: i % rows,
      mesh: { material: { uniforms: { uPower: { value: 1 } } } },
    }))
  const durationOf = (lon, rows, variant) => {
    const tl = buildCascadeTimeline(panelsOf(lon, rows), variant, rows)
    const d = tl.duration()
    tl.kill()
    return d
  }
  const real = Math.random
  Math.random = () => 0.999999
  try {
    const want = { sweep: 1.58, rows: 1.94, poles: 1.425, random: 1.75 }
    assert.deepEqual(DELAY_ORDERS, Object.keys(want))
    assert.equal(T_ENTRANCE, 2)
    for (const v of DELAY_ORDERS) {
      const d = durationOf(12, 8, v)
      near(d, want[v], 1e-4, v)
      assert.ok(d <= T_ENTRANCE, `${v}: ${d} s`)
    }
    // NC: a 12-row cascade overruns the landing
    const d12 = durationOf(12, 12, 'rows')
    near(d12, 2.58, 1e-4)
    assert.ok(d12 > T_ENTRANCE)
  } finally {
    Math.random = real
  }
})

test('spans: θN and θS from thetaBound are where the V warp reaches ln 1.15 (T6)', () => {
  assert.equal(UNIT_EPS, 0.15)
  const { Pth } = SPAN_L
  // a top member's signed warp ln(vK/κ), rising through 0 where its pair straddles the equator (lead 75°)
  const warp = (t) => Math.log(Math.sin(t) / kappaOwn(t, 0, Pth, Math.sin(t)))
  const solve = (target) => {
    let [lo, hi] = [1e-6, Math.PI - Pth - 1e-6]
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2
      if (warp(mid) < target) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const tN = thetaBound((1 + UNIT_EPS) ** -2, Pth)
  const tS = thetaBound((1 + UNIT_EPS) ** 2, Pth)
  assert.ok(Math.abs(tN - solve(-Math.log(1.15))) <= 1e-9, `θN ${tN}`)
  assert.ok(Math.abs(tS - solve(Math.log(1.15))) <= 1e-9, `θS ${tS}`)
  assert.equal(degOf(tN).toFixed(2), '47.61')
  assert.equal(degOf(tS).toFixed(2), '102.39')
  // NC: ε 0.10 moves θN to 55.47°
  const tN10 = thetaBound(1.1 ** -2, Pth)
  assert.equal(degOf(tN10).toFixed(2), '55.47')
  assert.ok(Math.abs(tN10 - tN) > 1e-9)
})

test('spans: texSpec sizes each class texture from T1, and never asks a CDN for more than the source holds (T7)', () => {
  // sourceShort: the island's s below the top rung (0 = unknown), else TOP_RUNG
  assert.equal(TOP_RUNG, 1080)
  assert.equal(sourceShort({ kind: 'video', playbackId: 'id' }), TOP_RUNG)
  assert.equal(sourceShort({ kind: 'video', playbackId: 'id', s: 720 }), 720)
  assert.equal(sourceShort({ kind: 'video', playbackId: 'id', s: 0 }), 0)
  const vid = (s, ratio = '16:9') => ({ kind: 'video', playbackId: 'id', videoAspectRatio: ratio, ...(s == null ? {} : { s }) })
  const still = (dims) => ({ kind: 'still', imageUrl: `https://cdn.sanity.io/images/p/d/x${dims ? `-${dims}` : ''}.jpg` })
  const size = (t) => `${t.w}x${t.h}`
  // a 1080 video and a still with no -WxH never clamp: the sizes come from T1 alone
  const sizes = { 512: { h: '1043x512', v: '512x1043', q: '1043x1043' }, 384: { h: '783x384', v: '384x783', q: '783x783' } }
  for (const T1 of [512, 384]) {
    for (const cls of ['h', 'v', 'q']) {
      for (const a of [vid(), still()]) {
        const t = texSpec(a, cls, T1, SPAN_L)
        assert.equal(size(t), sizes[T1][cls], `${a.kind} ${cls} at ${T1}`)
        assert.equal(t.cls, cls)
        assert.equal(t.aspect, t.w / t.h)
        assert.equal(t.key, `${a.playbackId || a.imageUrl}|${cls}${t.w}x${t.h}`)
      }
    }
  }
  const mh = texSpec(vid(), 'h', 512, SPAN_L)
  assert.equal(mh.key, 'id|h1043x512')
  assert.equal(mh.url, 'https://image.mux.com/id/thumbnail.webp?width=1043&height=512&fit_mode=crop&time=0')
  assert.equal(texSpec(still(), 'h', 512, SPAN_L).url, 'https://cdn.sanity.io/images/p/d/x.jpg?w=1043&h=512&fit=crop&auto=format')
  // the clamp table (T1 512), both CDNs
  const clamps = [
    [still('1500x1000'), 'h', '1043x512'],
    [still('800x600'), 'h', '800x393'],
    [still('1200x1500'), 'q', '1043x1043'],
    [still('600x900'), 'v', '442x900'],
    [vid(720), 'h', '1043x512'], // the 1280×720 source covers it
    [vid(480), 'h', '853x419'],
    [vid(0), 'h', '1043x512'], // no track dims: unknown, so unclamped
    [vid(720, '9:16'), 'v', '512x1043'], // a portrait source frame is (s, s/r): 720×1280 covers it
    [vid(480, '9:16'), 'v', '419x853'], // the s 480 h case, on its side
  ]
  for (const [a, cls, want] of clamps) assert.equal(size(texSpec(a, cls, 512, SPAN_L)), want, `${a.imageUrl || `s ${a.s}`} ${cls}`)
  const small = texSpec(still('800x600'), 'h', 512, SPAN_L)
  assert.equal(small.key, 'https://cdn.sanity.io/images/p/d/x-800x600.jpg|h800x393')
  assert.equal(small.url, 'https://cdn.sanity.io/images/p/d/x-800x600.jpg?w=800&h=393&fit=crop&auto=format')
  // a quad is elected only on a REAL source short side ≥ 0.9·TQ (938.7 at T1 512, 704.7 at 384): ≤ a 10% upscale
  const quad = (a) => ({ ...a, u: 'q' })
  for (const [T1, yes, no] of [[512, '939x1200', '938x1200'], [384, '705x900', '704x900']]) {
    assert.equal(quadEligible(quad(still(yes)), T1, SPAN_L), true, `${yes} at ${T1}`)
    assert.equal(quadEligible(quad(still(no)), T1, SPAN_L), false, `${no} at ${T1}`)
  }
  assert.equal(quadEligible(quad(vid()), 512, SPAN_L), true) // a 1080 video
  assert.equal(quadEligible(quad(vid(720)), 512, SPAN_L), false)
  assert.equal(quadEligible(quad(vid(720)), 384, SPAN_L), true)
  assert.equal(quadEligible(quad(vid(0)), 384, SPAN_L), false) // an unknown source is never elected
  assert.equal(quadEligible(quad(still()), 384, SPAN_L), false)
  assert.equal(quadEligible({ ...still('2000x2000'), u: 'h' }, 512, SPAN_L), false) // q candidates only
  // NC: without the clamp (the request an unknown source gets) an 800×600 still and a Mux s 480
  // both ask for 1043×512, wider than their sources: upscales
  for (const [a, src] of [[still('800x600'), { w: 800, h: 600 }], [vid(480), { w: (480 * 16) / 9, h: 480 }]]) {
    const unclamped = texSpec(a.playbackId ? { ...a, s: 0 } : still(), 'h', 512, SPAN_L)
    assert.equal(size(unclamped), '1043x512')
    assert.ok(unclamped.w > src.w)
    const clamped = texSpec(a, 'h', 512, SPAN_L)
    assert.ok(clamped.w <= src.w && clamped.h <= src.h, size(clamped))
  }
})

test('spans: classOf: the label proposes, the native ratio vetoes, over the class table (T8)', async () => {
  const still = (mediaType, w, h) => ({ mediaType, imageUrl: `https://cdn.sanity.io/images/p/d/x-${w}x${h}.jpg`, imageDimensions: { width: w, height: h } })
  const clip = (mediaType, ratio, videoStatus = 'ready') => ({ mediaType, playbackId: `pb-${ratio}`, videoAspectRatio: ratio, videoStatus })
  const rh8 = clip('motion_16x9', '9:16') // RH8CMzFM: labelled 16x9, natively 9:16
  const rows = (await query(FEATURED_WORLDS_QUERY))[0].assets
  const fixture = (id) => rows.find((r) => r._id === id)
  const table = [
    ['Cheetah Print still (16x9 label, 3:2)', still('static_16x9', 1500, 1000), 'h'],
    ['RH8CMzFM clip', rh8, 'v'],
    ['a banner (4.77)', still('static_16x9', 477, 100), null],
    ['Gallery Wall (2.4)', still('static_16x9', 2400, 1000), null],
    ['Rossi clip (ready)', clip('motion_3x4', '3:4'), 'q'],
    ['1.266 still', still('static_other', 1266, 1000), 'q'],
    ['4:3 clip', clip('motion_4x3', '4:3'), 'q'],
    ['16x9 label, 1:1 native', still('static_16x9', 1000, 1000), 'q'],
    ['a 2:1 static_other', still('static_other', 2000, 1000), null],
    ["Mux clip, 'preparing'", clip('motion_16x9', '16:9', 'preparing'), null],
    ['fixture hero (mux 16:9, ready)', fixture('hero'), 'h'],
    ['fixture cover (1200×1500)', fixture('cover'), 'q'],
    ['fixture still (800×1000)', fixture('still'), 'q'],
    ['fixture clip-a (mux 16:9)', fixture('clip-a'), 'h'],
  ]
  assert.equal(table.length, 14)
  for (const [name, row, want] of table) assert.equal(classOf(row), want, name)
  // NC: the label alone classes RH8CMzFM as h
  assert.equal(classOf(rh8, { source: 'label' }), 'h')
})

test('spans: eligibleVQ gives the lead windows on both devices; eligibleH is the grain alone (T9)', () => {
  const { Pth } = SPAN_L
  const thetaN = thetaBound((1 + UNIT_EPS) ** -2, Pth)
  const thetaS = thetaBound((1 + UNIT_EPS) ** 2, Pth)
  const W = (thetaH) => ({ thetaN, thetaS, Pth, thetaH: rad(thetaH) })
  const g = 0.67 // grainStart + grainRamp + grainStagger at the defaults (≈ 42.07°)
  // a window's two edges, by bisection: the predicate holds at 60° and fails at 0 and at π
  const windowOf = (ok) => {
    assert.ok(ok(rad(60)) && !ok(0) && !ok(Math.PI))
    const cut = (lo, hi) => {
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2
        if (ok(mid) === ok(lo)) lo = mid
        else hi = mid
      }
      return (lo + hi) / 2
    }
    return [cut(0, rad(60)), cut(rad(60), Math.PI)]
  }
  const vq = (D, thetaH, grain = g) => windowOf((t) => eligibleVQ(t, rad(D), W(thetaH), grain))
  const fmt = (w) => w.map((t) => degOf(t).toFixed(2))
  const paths = [
    ['advance', 18.0, ['47.61', '79.50'], ['47.61', '84.39']],
    ['relayout', 18.3, ['47.61', '79.20'], ['47.61', '84.09']],
    ['arrive', 20.2, ['47.61', '77.30'], ['47.61', '82.19']], // the function's window; no initial plan uses it (M4)
    ['reduced motion', 0, ['47.61', '97.50'], ['47.61', '102.39']],
  ]
  for (const [name, D, desktop, phone] of paths) {
    for (const grain of [g, 0]) {
      // the grain never binds a V/Q window at its defaults
      assert.deepEqual(fmt(vq(D, 127.5, grain)), desktop, `${name} desktop, g ${grain}`)
      assert.deepEqual(fmt(vq(D, 134.6, grain)), phone, `${name} phone, g ${grain}`)
    }
  }
  // the edges themselves: θN, the desktop horizon, the phone's θS
  near(vq(18, 127.5)[0], thetaN, 1e-12, 'θN')
  near(vq(18, 127.5)[1], rad(127.5) - Pth - rad(18), 1e-12, 'horizon-bound')
  near(vq(18, 134.6)[1], thetaS - rad(18), 1e-12, 'θS-bound')
  // replay and a single world (D ∞): no V/Q anywhere
  for (let t = 1; t < 180; t++) assert.equal(eligibleVQ(rad(t), Infinity, W(134.6), 0), false, `${t}°`)
  // H: no ε window and no horizon; with the grain on, sin ≥ g at both ends of the travel
  assert.deepEqual(fmt(windowOf((t) => eligibleH(t, rad(18), g))), ['42.07', '119.93'])
  for (const t of [1, 90, 179]) assert.equal(eligibleH(rad(t), Infinity, 0), true, `grain off, ${t}°`)
  assert.equal(eligibleH(rad(90), Infinity, g), false) // an endless travel always reaches the grain
  // NC: D without the landing (16.2°) lifts the desktop top to 81.3°
  assert.deepEqual(fmt(vq(16.2, 127.5)), ['47.61', '81.30'])
})

test('spans: frameOf / mp give the frame Mux serves at a rung, box-limited past 16:9 (T10)', () => {
  for (const [t, frame, want] of [[270, [480, 270], 0.1296], [480, [854, 480], 0.40992], [720, [1280, 720], 0.9216], [1080, [1920, 1080], 2.0736]]) {
    assert.deepEqual(frameOf(t, 16 / 9), frame, `${t}p`)
    assert.deepEqual(frameOf(t, 9 / 16), [frame[1], frame[0]], `${t}p portrait`)
    near(mp(t, 16 / 9), want, 1e-12, `${t}p`)
  }
  assert.deepEqual(frameOf(480, 4 / 3), [640, 480])
  assert.deepEqual(frameOf(480, 4), [854, 214]) // a 4:1 frame is box-limited: its short side shrinks below the rung
  // NC: the old t²·16/9 arithmetic misses the 854-wide frame Mux serves at 480: seven of them
  // decode 2.86944 MP, not 2.8672; and unboxed, a 4:1 frame at 480 would claim 1920×480
  const old = (t) => (t * t * 16) / 9 / 1e6
  near(7 * old(480), 2.8672, 1e-12)
  near(7 * mp(480, 16 / 9), 2.86944, 1e-12)
  assert.ok(7 * old(480) < 7 * mp(480, 16 / 9))
  assert.ok(mp(480, 4) < (1920 * 480) / 1e6)
})

test('spans: unitSkewBound covers every member’s window slope over the ε window, and rises with ε (T30)', () => {
  const L = SPAN_L
  const vKOf = (t) => Math.max(Math.sin(t), 1e-3) // poseTile's namePinch(centerDir.y)
  const S = (cls) => unitAspect(UNIT_SHAPE[cls].cols, UNIT_SHAPE[cls].rows, L)
  // each class: no crop (aTex = S, the widest window) and its texture's aspect at both T1s
  const aspects = (cls) => {
    const { cols, rows } = UNIT_SHAPE[cls]
    const tex = (T1) => Math.round((T1 * (cols * L.Pphi - L.Gphi)) / L.phiLen) / Math.round((T1 * (rows * L.Pth - L.Gth)) / L.bandH)
    return [S(cls), tex(512), tex(384)]
  }
  // |d window / dθ| of one member in its own θ, by central differences on unitA
  const slope = (cls, kx, ky, t, aTex) => {
    const { cols, rows } = UNIT_SHAPE[cls]
    const place = { cols, rows, S: S(cls), L }
    const w = (th) => unitA({ place, kx, ky }, vKOf(th), th, aTex)
    const h = 1e-6
    const [a, b] = [w(t - h), w(t + h)]
    return Math.max(...[0, 1].flatMap((i) => [Math.abs(b.s[i] - a.s[i]), Math.abs(b.o[i] - a.o[i])])) / (2 * h)
  }
  // H members anywhere in (0, π)
  let maxH = 0
  for (let t = 0.5; t < 179.5; t += 0.25) for (const a of aspects('h')) for (const kx of [0, 1]) maxH = Math.max(maxH, slope('h', kx, 0, rad(t), a))
  // V/Q members with the lead over the whole [θN, θS]
  const sampled = (eps) => {
    const tN = thetaBound((1 + eps) ** -2, L.Pth)
    const tS = thetaBound((1 + eps) ** 2, L.Pth)
    const leads = []
    for (let t = tN; t <= tS + 1e-12; t += rad(0.05)) leads.push(t)
    leads.push(tS)
    let max = maxH
    for (const lead of leads) {
      for (const cls of ['v', 'q']) {
        for (const a of aspects(cls)) {
          for (const ky of [0, 1]) for (const kx of cls === 'q' ? [0, 1] : [0]) max = Math.max(max, slope(cls, kx, ky, lead + ky * L.Pth, a))
        }
      }
    }
    return max
  }
  const at = {}
  let prev = -Infinity
  for (const eps of [0.1, 0.15, 0.16, 0.2]) {
    const bound = unitSkewBound(L, eps)
    at[eps] = sampled(eps)
    assert.ok(bound >= at[eps], `ε ${eps}: bound ${bound} < sampled ${at[eps]}`)
    assert.ok(bound > prev, `ε ${eps}: the bound must rise with ε`)
    prev = bound
  }
  // the default: 1.1 × the V top member's slope at θN, tied by its mirror, the bottom member with the lead at θS
  assert.equal(SKEW_MARGIN, 1.1)
  assert.equal(unitSkewBound(L), unitSkewBound(L, UNIT_EPS))
  near(unitSkewBound(L) / 1.1, 0.39858, 5e-6, 'default bound / 1.1')
  near(at[0.15], 0.39858, 5e-6, 'sampled max at the default')
  const tN = thetaBound(1.15 ** -2, L.Pth)
  const tS = thetaBound(1.15 ** 2, L.Pth)
  near(slope('v', 0, 0, tN, S('v')), unitSkewBound(L) / 1.1, 1e-8, 'V top member at θN')
  near(slope('v', 0, 1, tS + L.Pth, S('v')), unitSkewBound(L) / 1.1, 1e-8, 'V bottom member, lead at θS')
  // NC: at ε 0.16 the sampled slope is 0.4138, above the old fixed 0.4, which would have counted
  // skew failures on a correct window
  assert.equal(at[0.16].toFixed(4), '0.4138')
  assert.ok(at[0.16] > 0.4)
})

/* — Media spans, P3: ?popunits and class textures, one texture per asset at its measured aspect
   (T11, T12, T19, T21; T20's class requests are in the gate-module test above). — */
/** Worlds whose assets carry mediaClass's `u` (and P2's `s`): h clips (two from a 480 source, whose class
 *  crop is clamped to it), v stills (600×900: clamped too), q clips (1:1, no `s`: each world elects its first
 *  at ?popquads 1, P5), single-only stills, and one clip every world carries, classed h in the first world and
 *  v in the others. */
const classedWorlds = () =>
  ['Alpha', 'Beta', 'Gamma'].map((name, wi) => ({
    slug: name.toLowerCase(),
    clientName: name,
    title: null,
    services: [],
    assets: [
      ...Array.from({ length: 3 }, (_, i) => ({ kind: 'video', playbackId: `${name}-h${i}`, videoAspectRatio: '16:9', u: 'h' })),
      ...Array.from({ length: 2 }, (_, i) => ({ kind: 'video', playbackId: `${name}-hs${i}`, videoAspectRatio: '16:9', u: 'h', s: 480 })),
      ...Array.from({ length: 3 }, (_, i) => ({ kind: 'still', imageUrl: `https://cdn.sanity.io/images/p/d/${name}-v${i}-600x900.jpg`, u: 'v' })),
      ...Array.from({ length: 2 }, (_, i) => ({ kind: 'video', playbackId: `${name}-q${i}`, videoAspectRatio: '1:1', u: 'q' })),
      ...Array.from({ length: 2 }, (_, i) => ({ kind: 'still', imageUrl: `https://cdn.sanity.io/images/p/d/${name}-x${i}-800x800.jpg` })),
      { kind: 'video', playbackId: 'shared', videoAspectRatio: '16:9', u: wi === 0 ? 'h' : 'v' },
    ],
  }))
/** The pool records before P3: the constructor's spread, which decorate must return with units off. */
const todaysSpread = (worlds) => worlds.map((w, wi) => w.assets.map((a) => ({ ...a, clientName: w.clientName, services: w.services, world: wi })))
/** A director on fakeScrollScene (a live scroll lattice), ?popunits as given. */
function spanDirector(units, { worlds = classedWorlds(), scene = fakeScrollScene(), ...opts } = {}) {
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 42, chaos: 0, names: 0, units })
  const director = new PopulationDirector({
    panels: scene.panels,
    worlds,
    textureManager: scene.textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(),
    canAnimate: () => false,
    ...opts,
  })
  return { director, ...scene }
}

test('spans: decorate gives each h/v id ONE class texture, pooled across worlds; units off is today’s spread (T11)', () => {
  const worlds = classedWorlds()
  const { director: off } = spanDirector(0, { worlds })
  const { director: fixed } = spanDirector(1, { worlds, scene: fakeScene() }) // the fixed globe: no lattice
  const { director: on, panels } = spanDirector(1, { worlds })
  try {
    // Units off (or no lattice): today's records exactly; deepEqual would see a stray tex or unitCls key.
    assert.deepEqual(off.pools, todaysSpread(worlds))
    assert.equal(fixed.L, null)
    assert.deepEqual(fixed.pools, todaysSpread(worlds))
    // Units on: the lattice comes off the scroll panel, and each h/v record carries its class texture.
    assert.deepEqual(on.L, lattice(panels[0], LON, 6))
    const records = on.pools.flat()
    for (const r of records.filter((x) => x.playbackId !== 'shared')) {
      // h and v: every candidate; q: the one each world elects (?popquads 1: its first, a 1080 source, P5)
      const cls = r.u === 'h' || r.u === 'v' ? r.u : r.u === 'q' && r.playbackId.endsWith('-q0') ? 'q' : null
      if (cls) {
        assert.deepEqual(r.tex, texSpec(r, cls, THUMB_WIDTH, on.L), assetKey(r))
        assert.equal(r.unitCls, cls)
        assert.equal(assetKey(r), r.tex.key) // the variant is in the cache key
      } else assert.ok(!('tex' in r) && !('unitCls' in r), assetKey(r)) // an un-elected q and an unclassed asset stay single
    }
    // the source clamp reaches the records: a 480 clip and a 600×900 still ask for no more than they hold
    assert.ok(records.some((r) => r.tex?.url.endsWith('?width=853&height=419&fit_mode=crop&time=0')))
    assert.ok(records.some((r) => r.tex?.url.endsWith('-600x900.jpg?w=442&h=900&fit=crop&auto=format')))
    // the clip every world carries: h in world 0, v in worlds 1 and 2 → ONE key, h's, everywhere
    const shared = records.filter((r) => r.playbackId === 'shared')
    assert.equal(shared.length, 3)
    assert.deepEqual([...new Set(shared.map(assetKey))], [texSpec(shared[0], 'h', THUMB_WIDTH, on.L).key])
    assert.ok(shared.every((r) => r.unitCls === 'h'))
    // NC: per-record classing (texSpec(a, a.u, …), no pooling) gives the shared id two keys.
    const perRecord = worlds.flatMap((w) => w.assets.filter((a) => a.playbackId === 'shared')).map((a) => texSpec(a, a.u, THUMB_WIDTH, on.L).key)
    assert.equal(new Set(perRecord).size, 2)

    // ?popunits ships off and stores 0 | 1. Toggling it rebuilds the records (onTune → redecorate → relayout);
    // a tune that leaves the signature alone keeps them.
    assert.equal(POP_DEFAULTS.units, 0)
    // its own guide row (tunables-keys --check also counts the __swmPopStats row's mention of ?popunits)
    assert.match(fs.readFileSync(new URL('../../docs/tunables-guide.md', import.meta.url), 'utf8'), /^\| `\?popunits` \|.*\| `POP_DEFAULTS\.units` \|$/m)
    const relayouts = []
    off.relayout = (opts) => relayouts.push(opts)
    const kept = off.pools
    TUNING.units = 0
    off.onTune('*')
    assert.equal(off.pools, kept) // the same records, not a rebuild
    setPopTune('units', 5) // a hand-typed ?popunits=5
    assert.equal(TUNING.units, 1)
    off.onTune('units')
    assert.deepEqual(off.pools, on.pools)
    TUNING.units = 0
    off.onTune('*') // the bench's reset
    assert.deepEqual(off.pools, todaysSpread(worlds))
    assert.equal(relayouts.length, 3)
  } finally {
    for (const d of [off, fixed, on]) d.dispose()
    TUNING.units = 0
  }
})

test('spans: with units on, every tile and the warm set hold one ref each, on the class key the tile shows (T12)', async () => {
  const { director, panels, textureManager } = spanDirector(1)
  try {
    await Promise.all(director.initialLayout(director.byProminence()))
    assert.equal(textureManager.refs(), panels.length + director.warm.size)
    const classed = panels.filter((p) => p.asset.tex)
    assert.ok(classed.length >= 12, `${classed.length} classed tiles`)
    for (const p of classed) assert.equal(p.heldThumbId, p.asset.tex.key)
    // NC: one extra loadAsset without a release breaks the ledger.
    textureManager.loadAsset(classed[0].asset)
    assert.notEqual(textureManager.refs(), panels.length + director.warm.size)
    textureManager.release(assetKey(classed[0].asset))
    assert.equal(textureManager.refs(), panels.length + director.warm.size)
    // Each classed single's texA window covers its texture's measured aspect onto the panel (THE window rule;
    // this scene's loader stamps the requested aspect), not the square of a legacy thumbnail; a unit member's
    // is its own window inside the unit picture (P4b: windowA's member branch, unitWindowOf).
    let members = 0
    let singles = 0
    for (const p of classed) {
      const u = p.mesh.material.uniforms
      const got = [u.uvScaleA.value.x, u.uvScaleA.value.y, u.uvOffsetA.value.x, u.uvOffsetA.value.y]
      if (p.asset.place) {
        members += 1
        const w = unitWindowOf(p, p.asset, p.asset.tex.aspect)
        assert.deepEqual(got, [...w.s, ...w.o], p.asset.tex.key)
        continue
      }
      singles += 1
      const { scale, offset } = computeCoverUv(p.asset.tex.aspect, p.panelAspect)
      assert.deepEqual(got, [...scale, ...offset], p.asset.tex.key)
    }
    assert.ok(members >= 1 && singles >= 1, `${members} members, ${singles} singles checked`)
    // unitStats' census of the cache: each pool key once, by the class it was asked as; a key outside the
    // pools (a name strip's) is not a pool texture.
    const census = { h: 0, v: 0, q: 0, legacy: 0 }
    for (const k of textureManager.cache.keys()) census[/\|([hvq])\d+x\d+$/.exec(k)?.[1] ?? 'legacy'] += 1
    assert.ok(census.h > 0 && census.v > 0 && census.legacy > 0, JSON.stringify(census))
    textureManager.cache.set('strip', { refs: 1, texture: {} })
    assert.deepEqual(director.unitStats(0).texClass, census)
    textureManager.cache.delete('strip')
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})

test('spans: units off is today’s globe: records, texture URLs, random draws, both windows, the cascade (T19)', async () => {
  const random = Math.random
  const decorate = PopulationDirector.prototype.decorate
  // One layout + one change on a real TextureManager whose stub loader logs every URL it is asked for.
  const run = async (units, records = null) => {
    Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 42, chaos: 0, names: 0, transitions: ['blink'], units })
    const { panels } = fakeScrollScene()
    const tm = new TextureManager()
    const urls = []
    tm.loader = {
      load(url, onLoad) {
        urls.push(url)
        setTimeout(() => onLoad(Object.assign(new THREE.Texture(), { image: { width: 512, height: 512 } })), 0)
      },
    }
    let draws = 0
    let director = null
    if (records) PopulationDirector.prototype.decorate = records
    Math.random = () => {
      draws += 1
      return 0.5
    }
    try {
      director = new PopulationDirector({
        panels,
        worlds: classedWorlds(),
        textureManager: tm,
        getScheduler: () => null,
        getRotation: () => new THREE.Euler(),
        canAnimate: () => true,
      })
      await Promise.all(director.initialLayout(director.byProminence()))
      director.advance() // a blink: one Math.random delay per tile that changes
      await settleTicks(5)
      return { pools: director.pools, urls, draws, shown: panels.map((p) => assetKey(p.asset)), units: director.sample(new THREE.Euler()).units }
    } finally {
      Math.random = random
      PopulationDirector.prototype.decorate = decorate
      director?.dispose()
      TUNING.units = 0
    }
  }
  const legacy = (url) => classifyRequest(url, 512).kind === 'legacy'
  const off = await run(0)
  const before = await run(0, function () {
    return todaysSpread(this.worlds)
  })
  assert.deepEqual(off.pools, before.pools) // decorate as T11
  assert.ok(off.urls.length > 0 && off.urls.every(legacy), off.urls.find((u) => !legacy(u)))
  assert.deepEqual(off.urls, before.urls)
  assert.ok(off.draws > 0)
  assert.equal(off.draws, before.draws)
  assert.deepEqual(off.shown, before.shown)
  assert.equal(off.units, null) // the telemetry's span fields stay null
  // NC: with units on, the URL comparison fails: the h/v assets ask for class crops.
  const on = await run(1)
  assert.equal(on.urls.every(legacy), false)
  assert.ok(on.urls.some((u) => classifyRequest(u, 512).kind === 'class'))
  assert.ok(on.units?.texClass && on.units.liveReg, JSON.stringify(on.units))

  // liveWindow on a record without tex is today's cover of the clip's metadata aspect (bad ratio → 1).
  const sched = new LivePanelScheduler({ panels: [], assets: [], poolHandle: null, textureManager: null, cycleThumbnails: false })
  const frame = { videoWidth: 854, videoHeight: 480 }
  for (const [ratio, aspect] of [['16:9', 16 / 9], ['9:16', 9 / 16], ['bogus', 1], [undefined, 1]]) {
    const { scale, offset } = computeCoverUv(aspect, 1.3)
    const tile = { panelAspect: 1.3, asset: { kind: 'video', playbackId: 'x', videoAspectRatio: ratio, u: 'h' } }
    assert.deepEqual(sched.liveWindow(tile, frame), { s: scale, o: offset }, String(ratio))
  }
  // windowA on a legacy texture (no measured aspect) is cover(1), the window every texA writer used (m4).
  for (const tex of [new THREE.Texture(), {}, null]) {
    const { scale, offset } = computeCoverUv(1, 1.3)
    assert.deepEqual(windowA({ panelAspect: 1.3 }, { playbackId: 'x' }, tex), { s: scale, o: offset })
  }

  // The entrance cascade over panels without `place` (units off; every /process panel): panelDelay once per
  // panel, in panel order, so the draws and every tween's position are today's (m3).
  const { panels } = fakeScene()
  const counter = () => {
    let i = 0
    return () => ((i++ * 0.37) % 1)
  }
  try {
    for (const variant of DELAY_ORDERS) {
      let draws = 0
      const counted = (next) => () => ((draws += 1), next())
      Math.random = counted(counter())
      const tl = buildCascadeTimeline(panels, variant, ROWS)
      const built = draws
      draws = 0
      Math.random = counted(counter())
      const want = panels.map((p) => panelDelay(p, variant, ROWS))
      assert.equal(built, draws, variant) // today's draws: panelDelay once per panel
      // GSAP keeps a timeline's children sorted by start time, so each panel's flicker is found by its target.
      const startOf = new Map(tl.getChildren(false, true, false).filter((t) => t.vars.keyframes).map((t) => [t.targets()[0], t.startTime()]))
      const got = panels.map((p) => startOf.get(p.mesh.material.uniforms.uPower))
      tl.kill()
      near(got, want, 1e-7, variant)
      // NC: the same draws taken in another order put the tweens elsewhere.
      Math.random = counter()
      const reversed = [...panels].reverse().map((p) => panelDelay(p, variant, ROWS)).reverse()
      assert.ok(got.some((t, i) => Math.abs(t - reversed[i]) > 1e-3), variant)
    }
  } finally {
    Math.random = random
  }
})

test('spans: liveWindow registers texB with the bound class texture — Mux’s ratio, the decoded frame only as a fallback (T21)', async () => {
  const sched = new LivePanelScheduler({ panels: [], assets: [], poolHandle: null, textureManager: null, cycleThumbnails: false })
  const clip = { kind: 'video', playbackId: 'clip', videoAspectRatio: '16:9', u: 'h' }
  const tex = texSpec(clip, 'h', 512, SPAN_L) // 1043×512
  const aTex = tex.w / tex.h
  const panelAspect = SPAN_L.phiLen / SPAN_L.bandH
  /** A live tile showing `asset` on its class texture, texA's window A in the uniforms. */
  const tile = (asset, A) => ({
    asset,
    shownAsset: asset,
    panelAspect,
    mesh: {
      material: {
        uniforms: {
          texA: { value: { userData: { aspect: aTex } } },
          uvScaleA: { value: new THREE.Vector2(A.s[0], A.s[1]) },
          uvOffsetA: { value: new THREE.Vector2(A.o[0], A.o[1]) },
        },
      },
    },
  })
  const frame = { videoWidth: 854, videoHeight: 480 } // the 480p pin's 16:9 frame: 1.7792, not 16:9
  /** The liveReg measure: the largest of the four window components' differences. */
  const err = (B, W) => Math.max(...[0, 1].flatMap((i) => [Math.abs(B.s[i] - W.s[i]), Math.abs(B.o[i] - W.o[i])]))
  /** How far a tile corner's sampled frame point moves between two windows (the misregistration you'd see). */
  const shift = (B, W) => Math.max(...[0, 1].flatMap((i) => [Math.abs(B.o[i] - W.o[i]), Math.abs(B.o[i] + B.s[i] - W.o[i] - W.s[i])]))
  const record = { ...clip, tex, unitCls: 'h' }

  // A single on its class texture: A is windowA's cover of the crop's measured aspect.
  const A1 = windowA({ panelAspect }, record, { userData: { aspect: aTex } })
  const single = tile(record, A1)
  assert.equal(pictureAspect(record, frame), 16 / 9) // the metadata ratio, exactly
  assert.ok(err(sched.liveWindow(single, frame), liveB(16 / 9, aTex, A1)) <= 1e-12)
  // a ratio that won't parse falls back to the decoded frame (m6)
  const unparsed = tile({ ...record, videoAspectRatio: 'n/a' }, A1)
  assert.ok(err(sched.liveWindow(unparsed, frame), liveB(854 / 480, aTex, A1)) <= 1e-12)
  // An H member at 60°: texB follows whatever window A the tile holds (P4b writes the member's).
  const vK = Math.sin(Math.PI / 3)
  const Am = compose(coverWindow(aTex, unitAspect(2, 1, SPAN_L)), memberWindow({ cols: 2, rows: 1, kx: 0, ky: 0 }, vK, vK, SPAN_L))
  const member = tile(record, Am)
  assert.ok(err(sched.liveWindow(member, frame), liveB(16 / 9, aTex, Am)) <= 1e-12)

  // NC: registered on the decoded 854×480 frame, the picture lands 3.4e-4 off; today's B (the clip's cover
  // of the panel) misses by 0.1273 on a 16:9 single and by 0.1846 on an H member at 60°.
  near(shift(liveB(854 / 480, aTex, A1), sched.liveWindow(single, frame)), 3.409e-4, 1e-7, 'decoded frame')
  const today = (() => {
    const { scale, offset } = computeCoverUv(16 / 9, panelAspect)
    return { s: scale, o: offset }
  })()
  near(err(today, sched.liveWindow(single, frame)), 0.1273, 5e-5, "today's B, single")
  near(err(today, sched.liveWindow(member, frame)), 0.1846, 5e-5, "today's B, H member at 60°")

  // B = C ∘ A: a tile's uv goes through A into texA, then through texA's crop C = cover(V, aTex) of the frame.
  // The order shows only where C crops across the member's off-centre axis (centred windows commute, and a 16:9
  // frame is narrower than the H crop, so its C is whole in u): a 21:9 clip on the same crop.
  const wide = tile({ ...record, videoAspectRatio: '21:9' }, Am)
  const C = coverWindow(21 / 9, aTex)
  const CA = { s: [C.s[0] * Am.s[0], C.s[1] * Am.s[1]], o: [C.o[0] + C.s[0] * Am.o[0], C.o[1] + C.s[1] * Am.o[1]] }
  assert.ok(C.s[0] < 1 && Am.o[0] + Am.s[0] / 2 !== 0.5) // C crops in u; the member's window is off-centre in u
  assert.ok(err(sched.liveWindow(wide, frame), CA) <= 1e-12)
  // aTex is the bound texture's MEASURED aspect (the CDN rounds: 1043×511 here); the spec's only while texA has none.
  const rounded = tile(record, A1)
  rounded.mesh.material.uniforms.texA.value = { userData: { aspect: 1043 / 511 } }
  assert.ok(err(sched.liveWindow(rounded, frame), liveB(16 / 9, 1043 / 511, A1)) <= 1e-12)
  assert.ok(err(sched.liveWindow(rounded, frame), liveB(16 / 9, aTex, A1)) > 1e-4)
  const unbound = tile(record, A1)
  unbound.mesh.material.uniforms.texA.value = null
  assert.ok(err(sched.liveWindow(unbound, frame), liveB(16 / 9, tex.aspect, A1)) <= 1e-12)

  // TextureManager measures what decoded: an <img>'s natural size, else an ImageBitmap's size. A legacy
  // thumbnail gets no aspect (square: cover(1)).
  const tm = new TextureManager()
  const small = { ...clip, tex: texSpec(clip, 'h', 384, SPAN_L) } // 783×384
  const decoded = new Map([
    [tex.url, { naturalWidth: 1043, naturalHeight: 511 }],
    [small.tex.url, { width: 783, height: 384 }],
    [tm.thumbnailUrl('clip'), { naturalWidth: 512, naturalHeight: 512 }],
  ])
  tm.loader = { load: (url, onLoad) => setTimeout(() => onLoad(Object.assign(new THREE.Texture(), { image: decoded.get(url) })), 0) }
  const [measured, bitmap, legacyTex] = await Promise.all([tm.loadAsset(record), tm.loadAsset(small), tm.loadAsset(clip)])
  assert.deepEqual([measured.userData.aspect, bitmap.userData.aspect, 'aspect' in legacyTex.userData], [1043 / 511, 783 / 384, false])
  tm.disposeAll()

  // The scheduler writes liveWindow's B into a class tile (promote in tile mode, attach on a shared stream), and
  // never streams into a class tile whose texA still shows the asset it held before (B derives from the bound A).
  const liveTile = (shownAsset, z) => {
    const p = tile(record, A1)
    Object.assign(p.mesh.material.uniforms, { uMix: { value: 0 }, texB: { value: null }, uVideoB: { value: 0 }, uvScaleB: { value: new THREE.Vector2() }, uvOffsetB: { value: new THREE.Vector2() } })
    return Object.assign(p, { shownAsset, parked: false, liveState: null, centerDir: new THREE.Vector3(0, Math.sqrt(1 - z * z), z) })
  }
  const bound = liveTile(record, 0.8)
  const stale = liveTile({ ...clip, playbackId: 'before' }, 1) // the more prominent: it would win the slot first
  const B = (p) => {
    const u = p.mesh.material.uniforms
    return { s: [u.uvScaleB.value.x, u.uvScaleB.value.y], o: [u.uvOffsetB.value.x, u.uvOffsetB.value.y] }
  }
  const pool = { assign: () => Promise.resolve(frame), releaseSlot() {} }
  // — P4a — a unit member stays a still in tile mode (the most prominent here). — P6a — on a shared stream its whole
  // unit joins, through the lead: both members, each with B written on its own A.
  const place = { uid: 'h:0:0:clip', key: assetKey(record), cls: 'h', cols: 2, rows: 1, n: 2, S: unitAspect(2, 1, SPAN_L), L: SPAN_L, members: [] }
  const memberOf = (kx) => {
    const rec = { ...record, place, kx, ky: 0 }
    return Object.assign(liveTile(rec, 1), { asset: rec })
  }
  const unitTile = memberOf(0)
  const partner = memberOf(1)
  place.members.push(unitTile, partner)
  const live = new LivePanelScheduler({ panels: [unitTile, partner, stale, bound], assets: [clip], poolHandle: pool, textureManager: null, cycleThumbnails: false })
  try {
    assert.deepEqual([live.canJoin(bound), live.canJoin(stale), live.canJoin(unitTile), live.canJoin(partner)], [true, false, true, true])
    live.update(new THREE.Euler(), 10, null)
    await settleTicks()
    assert.deepEqual([bound.liveState, stale.liveState, unitTile.liveState, partner.liveState], ['live', null, null, null])
    assert.ok(err(B(bound), liveB(16 / 9, aTex, A1)) <= 1e-12)
    live.setShared(true)
    bound.mesh.material.uniforms.uvScaleB.value.set(0, 0) // attach must write it again
    live.update(new THREE.Euler(), 20, null)
    await settleTicks()
    assert.deepEqual([bound.liveState, stale.liveState, unitTile.liveState, partner.liveState], ['live', null, 'live', 'live'])
    for (const p of [bound, unitTile, partner]) assert.ok(err(B(p), liveB(16 / 9, aTex, A1)) <= 1e-12)
  } finally {
    live.dispose()
  }

  // The probe's register (unitStats.liveReg): liveWindow's measure on every live or demoting class tile still
  // showing its asset with a decoded frame; a legacy, stale, idle or undecoded tile is skipped, and so is every
  // tile before the scheduler exists.
  const Wb = { s: [0.5, 0.6], o: [0.1, 0.2] }
  let probeSched = { liveWindow: () => Wb }
  const { director } = spanDirector(1, { getScheduler: () => probeSched })
  try {
    const legacyClip = { kind: 'video', playbackId: 'legacy', videoAspectRatio: '16:9' }
    const cases = [
      [record, record, 'live', { liveVideo: frame }, 0], // counted, on register
      [record, record, 'demoting', { liveStream: { video: frame } }, 2e-3], // counted: a demoting tile still shows B
      [legacyClip, legacyClip, 'live', { liveVideo: frame }, 0.1], // a legacy tile keeps today's B
      [record, legacyClip, 'live', { liveVideo: frame }, 0.1], // texA still shows another asset
      [record, record, null, { liveVideo: frame }, 0.1], // not live
      [record, record, 'live', { liveVideo: { videoWidth: 0, videoHeight: 0 } }, 0.1], // no frame decoded yet
    ]
    cases.forEach(([asset, shownAsset, liveState, video, off], i) => {
      const p = director.panels[i]
      Object.assign(p, { asset, shownAsset, liveState, liveStream: null, liveVideo: null }, video)
      p.mesh.material.uniforms.uvScaleB.value.set(Wb.s[0], Wb.s[1])
      p.mesh.material.uniforms.uvOffsetB.value.set(Wb.o[0] + off, Wb.o[1])
    })
    assert.deepEqual(director.unitStats(0).liveReg, { n: 2, worst: 2e-3 })
    probeSched = null
    assert.deepEqual(director.unitStats(0).liveReg, { n: 0, worst: 0 })
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})

/* — Media spans, P4a: H pairs planned as whole units (T13, T14, T15, T17, T29's H half, T31). — */
/** A units-on director on fakeScrollScene, with tunings over spanDirector's (seed 42, chaos 0, no names). No
 *  horizon unless one is passed, as useGlobeScene's before its first pose: a plan then forms H pairs only (M4),
 *  which the H boards below are about. P5's V/Q tests pass `getHorizon`. */
function unitDirector(tune = {}, { worlds = classedWorlds(), scene = fakeScrollScene(), ...opts } = {}) {
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 42, chaos: 0, names: 0, units: 1 }, tune)
  const director = new PopulationDirector({
    panels: scene.panels,
    worlds,
    textureManager: scene.textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(),
    canAnimate: () => false,
    getHorizon: () => null,
    ...opts,
  })
  return { director, ...scene }
}
/** The units the tiles are laid with (`asset`, the plan's side): Place → its tiles. */
function placesOf(panels) {
  const out = new Map()
  for (const p of panels) if (p.asset?.place) out.set(p.asset.place, [...(out.get(p.asset.place) ?? []), p])
  return out
}
/** assertNeighboursDiffer, span-aware: a unit's own members share its key by design; every other right or
 *  up pair differs, so every outer neighbour of a unit does. */
function assertSpanNeighboursDiffer(panels) {
  const at = new Map(panels.map((p) => [`${p.lonIndex}:${p.tapeS}`, p]))
  for (const p of panels) {
    for (const q of [at.get(`${(p.lonIndex + 1) % LON}:${p.tapeS}`), at.get(`${p.lonIndex}:${p.tapeS + 1}`)]) {
      if (!q || (p.asset.place && q.asset.place === p.asset.place)) continue
      assert.notEqual(assetKey(q.asset), assetKey(p.asset), `L${p.lonIndex} s${p.tapeS} vs L${q.lonIndex} s${q.tapeS}`)
    }
  }
}
/** Every unit on the board is whole, of a class in `classes` (H pairs only by default: unitDirector's boards
 *  plan with no horizon, M4): its tiles are exactly its members, member k at kx = k % cols along the row and
 *  ky = ⌊k / cols⌋ rows south (tapeS − ky), each showing the unit's key on a fresh record, all in the lead's
 *  owner region. Returns units per key. */
function assertWholeUnits(director, panels, classes = ['h']) {
  const owner = (p) => director.grouping.pattern.owner(p.lonIndex, p.tapeS)
  const perKey = new Map()
  for (const [P, tiles] of placesOf(panels)) {
    assert.ok(classes.includes(P.cls), P.uid)
    assert.equal(tiles.length, P.members.length, P.uid)
    const [lead] = P.members
    const { cols, rows } = UNIT_SHAPE[P.cls]
    // the record: its slot in the uid, the unit's shape, its aspect on the live lattice
    const shape = [`${P.cls}:${lead.lonIndex}:${lead.tapeS}:${P.key}`, cols, rows, cols * rows, unitAspect(cols, rows, director.L), director.L]
    assert.deepEqual([P.uid, P.cols, P.rows, P.n, P.S, P.L], shape, P.uid)
    P.members.forEach((m, k) => {
      const [kx, ky] = [k % cols, Math.floor(k / cols)]
      assert.ok(tiles.includes(m), P.uid)
      if (!P.born) assert.ok(!m.parked, `${P.uid}: a plan never claims a parked tile`) // a born row is born parked, north of the pole
      assert.equal(m.asset.place, P)
      assert.equal(assetKey(m.asset), P.key)
      assert.deepEqual([m.asset.kx, m.asset.ky, m.tapeS, m.lonIndex], [kx, ky, lead.tapeS - ky, (lead.lonIndex + kx) % LON], P.uid)
      assert.equal(owner(m), owner(lead), `${P.uid}: one owner region`)
    })
    if (P.born) assert.equal(P.members[1].lonIndex, lead.lonIndex + 1, `${P.uid}: a born pair never wraps`)
    perKey.set(P.key, (perKey.get(P.key) ?? 0) + 1)
  }
  // The pool records stay untouched: a member's record is its own object.
  for (const r of [...director.pools.flat(), ...director.grouping.pools.flat()]) assert.ok(!('place' in r), assetKey(r))
  return perKey
}

test('spans: planUnits forms whole H pairs in one region, clear of their own key, at most ?popunitmax per key; a kept unit takes the new world (T13)', async () => {
  assert.deepEqual([...UNIT_CLASSES], ['h', 'v', 'q']) // P5 adds v and q; these boards have no horizon, so H pairs only (M4)
  // ?popunitmax: 1 by default, an integer 1–6, and its own guide row.
  assert.equal(POP_DEFAULTS.unitMax, 1)
  for (const [typed, want] of [[0, 1], [2.4, 2], [9, 6]]) {
    setPopTune('unitMax', typed)
    assert.equal(TUNING.unitMax, want)
  }
  assert.match(fs.readFileSync(new URL('../../docs/tunables-guide.md', import.meta.url), 'utf8'), /^\| `\?popunitmax` \|.*\| `POP_DEFAULTS\.unitMax` \|$/m)
  const directors = []
  try {
    // Two worlds at once (two owner regions), one unit per key.
    const { director, panels } = unitDirector({ group: 2 })
    directors.push(director)
    director.initialLayout(director.byProminence())
    let perKey = assertWholeUnits(director, panels)
    assert.ok([...placesOf(panels).keys()].every((P) => P.born === false)) // planned, not born
    assert.ok(perKey.size >= 6, `${perKey.size} units`)
    assert.deepEqual([...new Set(perKey.values())], [1])
    const planned = director.placed.h
    assert.equal(planned, perKey.size)
    assertSpanNeighboursDiffer(panels)
    // NC: the plain neighbour rule flags a unit's own members as same-key neighbours.
    assert.throws(() => assertNeighboursDiffer(panels), assert.AssertionError)
    // Births (MeridianScroll.recycle → assignRow): H pairs inside the born row, whole, never across the
    // seam, clear of their key, within ?popunitmax on the board.
    const rows = new Map()
    for (const p of panels) rows.set(p.row, [...(rows.get(p.row) ?? []), p])
    let next = Math.max(...panels.map((p) => p.tapeS)) + 1
    for (let k = 0; k < 24; k++) {
      const oldest = [...rows.values()].sort((a, b) => a[0].tapeS - b[0].tapeS)[0]
      for (const p of oldest) p.tapeS = next
      next += 1
      const picks = director.assignRow(oldest)
      oldest.forEach((p, i) => loadTile(director, p, picks[i]))
      perKey = assertWholeUnits(director, panels)
      assert.ok(Math.max(...perKey.values()) <= 1)
      assertSpanNeighboursDiffer(panels)
    }
    assert.ok(director.bornH >= 3, `${director.bornH} born pairs`)
    assert.equal(director.placed.h, planned + director.bornH) // placed counts every unit formed, births included
    assert.ok([...placesOf(panels).keys()].some((P) => P.born))
    assert.deepEqual([director.unitStats(0).bornH, director.unitStats(0).placed], [director.bornH, director.placed]) // the probe reads both

    // ?popunitmax 2: the cap is what bounds a key.
    const { director: two, panels: board } = unitDirector({ unitMax: 2 })
    directors.push(two)
    two.initialLayout(two.byProminence())
    const twice = assertWholeUnits(two, board)
    assert.equal(Math.max(...twice.values()), 2)
    assertSpanNeighboursDiffer(board)

    // Keep-first (m10): a world change whose pool still holds a unit's key keeps the unit, on its own records
    // (zero flips), refreshed to the new world. `shared` is h in every world (decorate pools its class). Each
    // world names its own services here, so the refresh is seen on all three fields.
    const { director: one, panels: tiles } = unitDirector({}, { worlds: classedWorlds().map((w) => ({ ...w, services: [`${w.slug}-svc`] })) })
    directors.push(one)
    one.initialLayout(one.byProminence())
    const kept = [...placesOf(tiles).keys()].find((P) => P.key.startsWith('shared|'))
    assert.ok(kept, 'the shared clip formed a unit')
    const records = kept.members.map((m) => m.asset)
    const stale = { ...records[0] } // the lead's record as it stands: what a keep without the refresh would show
    one.step += 1
    one.grouping = one.upcoming
    one.lead = one.grouping.members[0]
    const plan = one.planAll(one.byProminence())
    const world = one.worlds[one.lead]
    kept.members.forEach((m, k) => {
      assert.equal(plan.get(m), records[k]) // kept: the unit's own record objects
      assert.equal(plan.get(m).world, one.lead)
      assert.equal(plan.get(m).clientName, world.clientName)
      assert.deepEqual(plan.get(m).services, world.services)
    })
    assert.equal(applyPlan(one, new Map(kept.members.map((m) => [m, plan.get(m)])), { animate: false }).flips, 0)
    // NC: without the refresh, the kept unit's lead still names the old world.
    assert.notEqual(stale.world, one.lead)
    assert.notEqual(stale.clientName, world.clientName)
    assert.notDeepEqual(stale.services, world.services)
  } finally {
    for (const d of directors) d.dispose()
    TUNING.units = 0
    TUNING.unitMax = 1
  }
})

const GRID = 64 // PopulationDirector's tape grid stride: a cell is s·GRID + lon
/** MeridianScroll.recycle, n times: the oldest row is re-born (a new tapeS) and takes assignRow's picks. */
function recycleRows(director, panels, n) {
  const rows = new Map()
  for (const p of panels) rows.set(p.row, [...(rows.get(p.row) ?? []), p])
  let next = Math.max(...panels.map((p) => p.tapeS)) + 1
  for (let k = 0; k < n; k++) {
    const oldest = [...rows.values()].sort((a, b) => a[0].tapeS - b[0].tapeS)[0]
    for (const p of oldest) p.tapeS = next
    next += 1
    const picks = director.assignRow(oldest)
    oldest.forEach((p, i) => loadTile(director, p, picks[i]))
  }
}

test('spans: planUnits and birthPairs on crafted boards — the seam, outer neighbours, the walk and its cursors; the births’ guards and the board count (T13)', () => {
  const { director, panels } = unitDirector() // one world: one region owns every tile
  try {
    const g = director.grouping
    const pool = g.pools[0]
    const classed = pool.flatMap((a, i) => (a.unitCls === 'h' ? [i] : []))
    assert.ok(classed.length >= 3, JSON.stringify(classed))
    const key = (i) => assetKey(pool[i])
    const at = (lon, row) => panels.find((p) => p.lonIndex === lon && p.row === row)
    /** One lead through planUnits (still rows: D 0, no grain); the unit walk starts at `from`, singles' cursor at `cursor`. */
    const unitAt = (lead, { grid = new Map(), from = classed[0], cursor = 0 } = {}) => {
      g.ucursor = [from]
      g.cursor = [cursor]
      director.namePlan = new Map()
      const plan = new Map()
      director.planUnits([lead], grid, plan, 0, false)
      return plan.get(lead)?.place ?? null
    }
    // A lead on the last meridian wraps the seam (a planned unit may; a born pair never does).
    const seam = unitAt(at(LON - 1, 3), { cursor: classed[0] })
    assert.deepEqual([seam?.members.map((m) => m.lonIndex), seam?.key], [[LON - 1, 0], key(classed[0])])
    // The cursors: the region's next unit walks on from the asset after this one, and singles don't open on it.
    assert.deepEqual([g.ucursor[0], g.cursor[0]], [classed[0] + 1, classed[0] + 1])
    // The walk starts at the unit cursor (not the singles' cursor, nor the pool's head).
    assert.equal(unitAt(at(4, 3), { from: classed[1] })?.key, key(classed[1]))
    // A key just right of the seam (lon 0) is an outer neighbour of a unit on lon L−2, L−1: that key is ruled
    // out, and the walk goes on to the next classed asset.
    const lead = at(LON - 2, 3)
    const ruled = unitAt(lead, { grid: new Map([[lead.tapeS * GRID + 0, key(classed[0])]]) })
    assert.deepEqual([ruled?.members.map((m) => m.lonIndex), ruled?.key], [[LON - 2, LON - 1], key(classed[1])])

    // birthPairs on crafted picks (one born row, lon order): two h picks, no name strip, the key clear of both
    // lon neighbours (across the seam too) and of rows s ± 1 over both members, under ?popunitmax with the
    // row's own pairs counted.
    const row = panels.filter((p) => p.row === 3).sort((a, b) => a.lonIndex - b.lonIndex)
    const s = row[0].tapeS
    const h = (id, unitCls = 'h') => ({ kind: 'video', playbackId: id, unitCls })
    const born = (spec, grid = new Map()) => {
      const picks = row.map((p) => spec[p.lonIndex] ?? { kind: 'video', playbackId: `x${p.lonIndex}` })
      director.birthPairs(row, picks, grid)
      return picks.flatMap((a, lon) => (a.place && a.kx === 0 ? [`${lon}:${a.place.key}`] : []))
    }
    assert.deepEqual(born({ 4: h('K'), 5: h('K') }), ['4:K'])
    assert.deepEqual(born({ 1: h('K'), 2: h('K'), 3: h('K') }), []) // a third K on either side of a pair
    assert.deepEqual(born({ 0: h('K'), 1: h('K'), [LON - 1]: h('K') }), []) // the left neighbour across the seam
    assert.deepEqual(born({ 4: h('K'), 5: h('K') }, new Map([[(s + 1) * GRID + 5, 'K']])), []) // K one row up from the second member
    assert.deepEqual(born({ 4: h('K'), 5: h('K') }, new Map([[(s - 1) * GRID + 4, 'K']])), []) // K one row down from the first
    assert.deepEqual(born({ 1: h('K'), 2: h('K'), 6: h('K'), 7: h('K') }), ['1:K']) // ?popunitmax 1: the row's first pair counts
    assert.deepEqual(born({ 4: h('V', 'v'), 5: h('V', 'v') }), []) // only an h pick pairs
    assert.deepEqual(born({ 4: h('K'), 5: { kind: 'name', nameKey: 'K-strip' } }), []) // a name strip never joins

    // The births' cap reads the board: units planned or in flight (a swap's target leads what texA shows), each
    // unit once however many members it has.
    const U = (k) => ({ uid: `h:0:0:${k}`, key: k })
    const [P1, P2, P3] = [U('k1'), U('k2'), U('k2')]
    const rec = (k, place) => ({ kind: 'video', playbackId: k, ...(place ? { place } : {}) })
    Object.assign(panels[0], { asset: rec('k1', P1), shownAsset: rec('k1', P1) })
    Object.assign(panels[1], { asset: rec('k1', P1), shownAsset: rec('k1', P1) }) // the same unit's second member
    Object.assign(panels[2], { asset: rec('a'), shownAsset: rec('a'), swapAsset: rec('k2', P2) }) // swapping into a unit
    Object.assign(panels[3], { asset: rec('k2', P3), shownAsset: rec('b') }) // planned, its load still in flight
    assert.deepEqual(Object.fromEntries(director.unitCountByKey()), { k1: 1, k2: 2 })
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})

test('spans: keep-first keeps only an intact unit — every member showing it, none loading or swapping, one region, under the cap, outer neighbours clear; under the grain every lead is admissible (T13, m10)', () => {
  const directors = []
  const make = (tune, opts) => {
    const out = unitDirector(tune, opts)
    directors.push(out.director)
    out.director.initialLayout(out.director.byProminence())
    return out
  }
  try {
    const { director, panels } = make({ group: 2 }) // two owner regions
    const units = [...placesOf(panels).keys()]
    const replan = (grid = new Map()) => {
      director.namePlan = new Map()
      const plan = new Map()
      director.planUnits(director.byProminence(), grid, plan, 0, false)
      return plan
    }
    const kept = (plan, P) => P.members.every((m) => plan.get(m) === m.asset)
    const untouched = replan()
    assert.ok(units.length >= 6 && units.every((P) => kept(untouched, P)), `${units.length} units`) // an unchanged board keeps every unit
    const P = units[0]
    const [m0, m1] = P.members
    const was = { asset: m1.asset, shown: m1.shownAsset }
    const broken = (why, apply, undo) => {
      apply()
      try {
        assert.equal(kept(replan(), P), false, why)
      } finally {
        undo()
      }
      assert.equal(kept(replan(), P), true, `${why}: restored`)
    }
    broken('a member mid-load', () => (m1.asset = { ...was.asset }), () => (m1.asset = was.asset))
    const staleRec = { ...was.asset, place: { ...P } } // bound and showing, but another unit's record
    broken('a stale record', () => Object.assign(m1, { asset: staleRec, shownAsset: staleRec }), () => Object.assign(m1, { asset: was.asset, shownAsset: was.shown }))
    broken('a member swapping', () => (m1.swapAsset = { ...was.asset }), () => (m1.swapAsset = null))
    const pattern = director.grouping.pattern
    const owner = pattern.owner
    const other = 1 - owner(m0.lonIndex, m0.tapeS)
    broken('members in two regions', () => (pattern.owner = (lon, s) => (lon === m1.lonIndex && s === m1.tapeS ? other : owner(lon, s))), () => (pattern.owner = owner))
    const left = m0.tapeS * GRID + ((m0.lonIndex + LON - 1) % LON)
    assert.equal(kept(replan(new Map([[left, P.key]])), P), false, 'its key on an outer neighbour')

    // The cap: a board laid at ?popunitmax 2 and re-planned at 1 keeps one unit per key.
    const { director: two, panels: board } = make({ unitMax: 2 })
    const twice = assertWholeUnits(two, board)
    assert.equal(Math.max(...twice.values()), 2)
    TUNING.unitMax = 1
    const capped = new Map()
    for (const Q of new Set([...two.planAll(two.byProminence()).values()].map((a) => a.place).filter(Boolean))) capped.set(Q.key, (capped.get(Q.key) ?? 0) + 1)
    assert.deepEqual([...new Set(capped.values())], [1])
    // …and a unit is judged at its LEAD's place in the order: with A's second member ahead of B's lead, and B's
    // lead ahead of A's, B keeps the key.
    const K2 = [...twice].find(([, n]) => n === 2)[0]
    const [A, B] = [...placesOf(board).keys()].filter((Q) => Q.key === K2)
    const tie = new Map()
    two.namePlan = new Map()
    two.planUnits([A.members[1], B.members[0], A.members[0], B.members[1]], new Map(), tie, 0, false)
    assert.deepEqual([kept(tie, B), kept(tie, A)], [true, false])
    // A V pair (drawn by hand on a column a V could hold) is kept only by a plan with a horizon: keep-first
    // re-checks admissibility, and a V/Q is admissible only once the globe is posed (M4).
    const vRec = two.grouping.pools[0].find((a) => a.unitCls === 'v')
    const thetaV = (p) => Math.acos(Math.min(Math.max(p.centerDir.y, -1), 1))
    const top = board.find((p) => !p.parked && !p.asset.place && eligibleVQ(thetaV(p), 0, { ...two.W, thetaH: Math.PI }, 0))
    const bottom = board.find((p) => p.lonIndex === top.lonIndex && p.tapeS === top.tapeS - 1)
    const V = { uid: `v:${top.lonIndex}:${top.tapeS}:${assetKey(vRec)}`, key: assetKey(vRec), cls: 'v', cols: 1, rows: 2, n: 2, members: [top, bottom], born: false }
    for (const [k, m] of [top, bottom].entries()) m.asset = m.shownAsset = { ...vRec, place: V, kx: 0, ky: k }
    const vPlan = (horizon) => {
      two.getHorizon = () => horizon
      const plan = new Map()
      two.namePlan = new Map()
      two.planUnits([top, bottom], new Map(), plan, 0, false)
      return plan
    }
    assert.ok(vRec && !bottom.parked && !kept(vPlan(null), V))
    assert.ok(kept(vPlan(Math.PI), V))
    two.getHorizon = () => null

    // The grain (gT = grainStart + grainRamp + grainStagger): a unit, kept or new, needs an admissible lead
    // (eligibleH over the travel D). A board laid without it and re-planned with it drops the units the grain
    // would reach, keeps the rest, and forms no new one where the grain reaches.
    const { director: wide, panels: wb } = make({ unitMax: 6 }, { getPace: () => 2, revealHeld: true })
    const laid = [...placesOf(wb).keys()]
    TUNING.grainAmt = 1
    const gT = TUNING.grainStart + TUNING.grainRamp + TUNING.grainStagger
    const grained = wide.planAll(wide.byProminence(), { land: 0.9 })
    const D = wide.lastD
    near(degOf(D), 18, 1e-9)
    const thetaOf = (p) => Math.acos(Math.min(Math.max(p.centerDir.y, -1), 1))
    const leads = [...new Set([...grained.values()].map((a) => a.place).filter(Boolean))].map((Q) => Q.members[0])
    assert.ok(leads.length >= 1)
    for (const lead of leads) assert.ok(eligibleH(thetaOf(lead), D, gT), `lead at ${degOf(thetaOf(lead)).toFixed(1)}°`)
    assert.ok(laid.some((Q) => !eligibleH(thetaOf(Q.members[0]), D, gT))) // the laid board had leads the grain rules out…
    assert.ok(laid.some((Q) => kept(grained, Q))) // …and the re-plan kept the others
    // A born row under the grain forms no pair; the same births without it do.
    recycleRows(wide, wb, 12)
    assert.equal(wide.bornH, 0)
    TUNING.grainAmt = 0
    const { director: twin, panels: tb } = make({ unitMax: 6 })
    recycleRows(twin, tb, 12)
    assert.ok(twin.bornH >= 1, `${twin.bornH} births without the grain`)
  } finally {
    for (const d of directors) d.dispose()
    TUNING.units = 0
    TUNING.unitMax = 1
    TUNING.grainAmt = 0
  }
})

test('spans: unitStats — members and units on unparked tiles, a torn unit and its orphans (front ones apart), live members, repeats per key (T13)', () => {
  const { director, panels } = unitDirector()
  try {
    director.initialLayout(director.byProminence())
    const laid = [...placesOf(panels).keys()]
    const stats = () => {
      const u = director.unitStats(0)
      return [u.members, u.whole.n, u.whole.torn, u.orphans, u.orphansFront, u.repeats, u.liveMembers]
    }
    assert.ok(laid.length >= 3, `${laid.length} units`)
    assert.deepEqual(stats(), [2 * laid.length, laid.length, 0, 0, 0, 1, 0])
    const P = laid.find((Q) => Q.members[0].centerDir.z > 0.05) // a unit facing the camera (FACING)
    const [m0, m1] = P.members
    m0.parked = m1.parked = true // past the pole: neither its members nor the unit count
    assert.deepEqual(stats().slice(0, 2), [2 * laid.length - 2, laid.length - 1])
    m0.parked = m1.parked = false
    m0.liveState = 'live'
    assert.equal(stats()[6], 1)
    m0.liveState = null
    const shown = m1.shownAsset
    loadTile(director, m1, { kind: 'video', playbackId: 'a-single' }) // m1 leaves the unit: torn, m0 its orphan
    assert.deepEqual(stats(), [2 * laid.length - 1, laid.length, 1, 1, 1, 1, 0])
    director.getRotation = () => new THREE.Euler(0, Math.PI, 0) // turned away: the orphan is behind
    assert.equal(stats()[4], 0)
    director.getRotation = () => new THREE.Euler()
    m0.swapAsset = { ...shown } // mid-change (a swap in flight): not torn yet
    assert.deepEqual(stats().slice(2, 5), [0, 0, 0])
    m0.swapAsset = null
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})

test('spans: the rules hold on any board — no lattice forms no unit, ?popunitmax 6 claims no parked tile and keeps outer neighbours clear, a name strip is never a member (T13)', () => {
  const directors = []
  try {
    // The fixed globe (no lattice): ?popunits 1 never runs planUnits.
    const { director: fixed, panels: fb } = unitDirector({}, { scene: fakeScene() })
    directors.push(fixed)
    fixed.initialLayout(fixed.byProminence())
    assert.deepEqual([fixed.L, placesOf(fb).size, fixed.placed.h], [null, 0, 0])
    // ?popunitmax 6: a crowded board, still whole units on unparked tiles with clear outer neighbours.
    const { director: six, panels: board } = unitDirector({ unitMax: 6 })
    directors.push(six)
    six.initialLayout(six.byProminence())
    const perKey = assertWholeUnits(six, board)
    assert.ok(Math.max(...perKey.values()) >= 3, JSON.stringify([...perKey]))
    assertSpanNeighboursDiffer(board)
    // Names on: planNames places the strips first, and a strip tile keeps its strip.
    const { director: named, panels: nb } = unitDirector({ names: 1 })
    directors.push(named)
    let strips = null
    const planNames = named.planNames.bind(named)
    named.planNames = () => {
      const m = planNames()
      strips ??= new Map(m) // the initial layout's (pick consumes the map)
      return m
    }
    named.initialLayout(named.byProminence())
    assert.ok(strips.size >= 1 && placesOf(nb).size >= 1)
    for (const [p, strip] of strips) assert.equal(p.asset, strip, `L${p.lonIndex} r${p.row}`)
  } finally {
    for (const d of directors) d.dispose()
    TUNING.units = 0
    TUNING.unitMax = 1
  }
})

test('spans: sharedDelays draws one delay per connected group of old ∪ new units; singles keep their own (T14)', () => {
  const random = Math.random
  const { panels, textureManager } = fakeScene()
  const owner = { textureManager, disposed: false }
  const rec = (id, uid = null, kx = 0) => ({ kind: 'video', playbackId: id, ...(uid ? { place: { uid }, kx, ky: 0 } : {}) })
  const [a, b, c, d, e, f, g, h, i] = panels
  // What the tiles show: U1 on a and b, U3 on e and f, i mid-swap into U2; the rest singles.
  a.asset = rec('u1', 'U1', 0)
  b.asset = rec('u1', 'U1', 1)
  e.asset = rec('u3', 'U3', 0)
  f.asset = rec('u3', 'U3', 1)
  for (const p of [c, d, g, h, i]) p.asset = rec(`was-${p.lonIndex}-${p.row}`)
  i.swapAsset = rec('u2', 'U2', 1)
  // The plan: b and c form U2 (b breaks U1, a goes single), d stays single, e goes single (it breaks U3; f is
  // not in the plan), g and h form U4, i goes single (it was swapping into U2).
  const plan = new Map([
    [a, rec('x')],
    [b, rec('u2', 'U2', 0)],
    [c, rec('u2', 'U2', 1)],
    [d, rec('y')],
    [e, rec('z')],
    [g, rec('u4', 'U4', 0)],
    [h, rec('u4', 'U4', 1)],
    [i, rec('w')],
  ])
  let draws = 0
  Math.random = () => ++draws / 10
  try {
    const delays = sharedDelays(plan, 0.6)
    // the groups, in plan order: {a, b, c, i} (U1 ∪ U2 ∪ i's swap target), {d}, {e} (U3), {g, h} (U4)
    assert.equal(draws, 4)
    assert.equal(delays.size, plan.size)
    assert.equal(delays.has(f), false)
    for (const [p, r] of [[a, 0.1], [b, 0.1], [c, 0.1], [i, 0.1], [d, 0.2], [e, 0.3], [g, 0.4], [h, 0.4]]) {
      near(delays.get(p), r * 0.6, 1e-12, `L${p.lonIndex} r${p.row}`)
    }
    // applyPlan takes them: each swap starts at its group's delay, and the span ends with the last landing.
    const { flips, span } = applyPlan(owner, plan, { animate: true, style: 'blink', spread: 0.6, dur: 0.45, delays })
    assert.equal(flips, plan.size)
    for (const [p] of plan) near(p.swapTl.delay(), delays.get(p), 1e-12)
    near(span, 0.4 * 0.6 + 0.45, 1e-12)
    assert.equal(draws, 4) // no per-tile draw on top
    // NC: today's per-tile draw gives a unit's members different delays.
    const perTile = new Map([...plan.keys()].map((p) => [p, Math.random() * 0.6]))
    assert.notEqual(perTile.get(b), perTile.get(c))
    assert.notEqual(perTile.get(g), perTile.get(h))
  } finally {
    Math.random = random
    for (const p of panels) cancelSwap(p)
  }
})

test('spans: layIn hands applyPlan one delay per unit; units off keeps one draw per flipped tile, as today (T14, m3)', async () => {
  const random = Math.random
  const directors = []
  try {
    // Units on: a relayout on a new seed lays new units, and each one's members start their swaps together.
    const { director, panels } = unitDirector({}, { canAnimate: () => true })
    directors.push(director)
    director.initialLayout(director.byProminence())
    TUNING.seed = 7
    director.relayout({ reseed: true })
    await settleTicks()
    const laid = new Map()
    for (const p of panels) if (p.swapTl && p.swapAsset?.place) laid.set(p.swapAsset.place, [...(laid.get(p.swapAsset.place) ?? []), p])
    const whole = [...laid].filter(([P, tiles]) => tiles.length === P.members.length)
    assert.ok(whole.length >= 1, `${whole.length} units laid`)
    for (const [P] of whole) for (const m of P.members) assert.equal(m.swapTl.delay(), P.members[0].swapTl.delay(), P.uid)
    // Units off: a relayout (same seed) over a board where every third tile shows a stray, so the rest skip: one
    // Math.random() per flipped tile, in plan order.
    const { director: off } = unitDirector({ units: 0 }, { canAnimate: () => true })
    directors.push(off)
    off.initialLayout(off.byProminence())
    const order = off.byProminence()
    order.forEach((p, i) => i % 3 === 1 && loadTile(off, p, { kind: 'video', playbackId: `stray${i}` }))
    const warm = off.warmGrouping.bind(off)
    let n = 0
    off.warmGrouping = () => warm().then(() => (Math.random = () => (n += 1) / 1000)) // counts the draws that lay the plan
    off.relayout()
    await settleTicks()
    Math.random = random
    const flipped = order.filter((p) => p.swapTl)
    assert.equal(flipped.length, order.filter((p, i) => i % 3 === 1).length)
    const d1 = flipped[0].swapTl.delay()
    flipped.forEach((p, k) => near(p.swapTl.delay(), d1 * (k + 1), 1e-9, `flip ${k}`))
    assert.equal(n, flipped.length)
  } finally {
    Math.random = random
    for (const d of directors) {
      for (const p of d.panels) cancelSwap(p)
      d.dispose()
    }
    TUNING.units = 0
    TUNING.seed = 42
  }
})

test('spans: placeKey keys the texture AND the unit slot: single ↔ member swaps, an unchanged place skips (T15)', () => {
  const { panels, textureManager } = fakeScene()
  const owner = { textureManager, disposed: false }
  const a = { kind: 'video', playbackId: 'clip', u: 'h' }
  // Whole Places (P4b: a bound member takes its own window from its place, windowA's member branch)
  const unit = (uid) => ({ uid, key: 'clip', cls: 'h', cols: 2, rows: 1, n: 2, S: unitAspect(2, 1, SPAN_L), L: SPAN_L, members: [], born: false })
  const P = unit('h:2:5:clip')
  const Q = unit('h:6:5:clip')
  const member = (place, kx) => ({ ...a, place, kx, ky: 0 })
  assert.equal(placeKey(a), 'clip|-') // units off: the texture key and '|-'
  assert.equal(placeKey(member(P, 1)), 'clip|h:2:5:clip:1:0')
  const flips = (i, from, to) => {
    loadTile(owner, panels[i], from)
    return applyPlan(owner, new Map([[panels[i], to]]), { animate: false }).flips
  }
  assert.equal(flips(0, a, member(P, 0)), 1) // single → member: the tile swaps, so its window changes under the dip
  assert.equal(panels[0].shownAsset.place, P)
  assert.equal(flips(1, member(P, 1), a), 1) // member → single
  assert.equal(flips(2, member(P, 0), member(Q, 0)), 1) // one unit → another of the same asset
  assert.equal(flips(3, member(P, 0), member(P, 1)), 1) // the other slot of the same unit
  assert.equal(flips(4, member(P, 0), member(P, 0)), 0) // an unchanged place skips (a fresh record, the same slot)
  assert.equal(flips(5, a, { ...a }), 0) // units off: the same asset skips, as today
  assert.equal(flips(6, a, { kind: 'video', playbackId: 'other' }), 1)
  // NC: keyed on assetKey alone, the single → member change reads as unchanged, so the window would never change.
  assert.equal(assetKey(a), assetKey(member(P, 0)))
})

test('spans: travelBudget is the landing, the longest hold and the next change at the rows’ pace (T17)', async () => {
  const pace = ((180 / 6) * 2) / 30 // °/s: 6 rows × cascadeSpeed 2 / SCROLL_PACE_SCALE (the desktop pace)
  assert.deepEqual([POP_DEFAULTS.hold, POP_DEFAULTS.holdJit, POP_DEFAULTS.trans], [6, 0.2, 0.9])
  const directors = []
  const make = (opts, tune = {}) => {
    const { director } = unitDirector(tune, opts)
    directors.push(director)
    return director
  }
  try {
    const still = make({ getPace: () => 0, revealHeld: true })
    assert.equal(still.travelBudget(0.9, false), 0) // reduced motion: the rows never move
    assert.equal(still.travelBudget(0, true), 0)
    assert.equal(still.unitStats(0).clock, 'static')
    const replay = make({ getPace: () => pace, canAnimate: () => true })
    assert.equal(replay.travelBudget(0, true), Infinity) // replay: the first hold's start is unbounded…
    near(degOf(replay.travelBudget(0.9, false)), 18.0, 1e-9, 'replay advance') // …every later plan is bounded
    assert.equal(replay.unitStats(0).clock, 'running')
    assert.equal(make({ getPace: () => pace, worlds: classedWorlds().slice(0, 1) }).travelBudget(0.9, false), Infinity) // one world: no clock
    const director = make({ getPace: () => pace, revealHeld: true })
    near(degOf(director.travelBudget(0.9, false)), 18.0, 1e-9, 'advance')
    near(degOf(director.travelBudget(1.05, false)), 18.3, 1e-9, 'relayout')
    near(degOf(director.travelBudget(0, true)), 20.2, 1e-9, 'arrive')
    // Each path hands it its own landing: the held entrance, a change (spread + dur = ?poptrans), a bench relayout.
    const lands = []
    const budget = director.travelBudget
    director.travelBudget = function (land, initial) {
      lands.push([land, initial])
      return budget.call(this, land, initial)
    }
    director.initialLayout(director.byProminence())
    assert.equal(director.sample(new THREE.Euler()).units.D, 20.2)
    assert.equal(director.sample(new THREE.Euler()).units.clock, 'stopped') // the screens aren't free to animate
    director.advance() // the screens aren't free to animate: a cut
    await settleTicks()
    assert.equal(director.sample(new THREE.Euler()).units.D, 18)
    director.relayout()
    await settleTicks()
    assert.equal(director.sample(new THREE.Euler()).units.D, 18.3)
    assert.deepEqual(lands.map(([, initial]) => initial), [true, false, false])
    near(lands.map(([land]) => land), [0, 0.9, 1.05], 1e-12, 'landings')
    // NC: without the landing term, advance gives 16.2°.
    near(degOf(director.travelBudget(0, false)), 16.2, 1e-9)
  } finally {
    for (const d of directors) d.dispose()
    TUNING.units = 0
  }
})

test('spans: the initial layout is planned before the first pose — no horizon, so H pairs only; the first change, posed, places V/Q (T29, M4)', async () => {
  let horizon = null // useGlobeScene's getHorizon until the tick has posed the globe (the `posed` latch)
  const { director, panels } = unitDirector({}, { getPace: () => 2, revealHeld: true, getHorizon: () => horizon })
  try {
    // classedWorlds: every world holds v candidates and an elected q (P5), so only the missing horizon keeps them out
    assert.ok(director.pools.every((pool) => pool.some((a) => a.unitCls === 'v') && pool.some((a) => a.unitCls === 'q')))
    director.initialLayout(director.byProminence())
    let units = director.sample(new THREE.Euler()).units
    assert.ok(units.placed.h >= 1, JSON.stringify(units.placed)) // an H pair needs no horizon
    assert.deepEqual([units.placed.v, units.placed.q, units.initVQ], [0, 0, 0])
    assert.equal(units.thetaH, null)
    assert.equal(units.initThetaH, null)
    assert.equal(units.D, 20.2) // arrive: the held entrance + the longest hold + the next change
    // Posed: the first change (⏭; a cut, the screens aren't free to animate) reads the live horizon and places
    // V/Q, each lead admissible over the travel its plan used; the initial layout's horizon and count stay null and 0.
    horizon = rad(127.5)
    director.advance()
    await settleTicks()
    units = director.sample(new THREE.Euler()).units
    assert.ok(units.placed.v + units.placed.q >= 1, JSON.stringify(units.placed))
    assert.deepEqual([units.thetaH, units.D, units.initThetaH, units.initVQ], [127.5, 18, null, 0])
    const leadOf = (P) => Math.acos(Math.min(Math.max(P.members[0].centerDir.y, -1), 1))
    const tall = [...placesOf(panels).keys()].filter((P) => P.rows === 2)
    assert.ok(tall.length >= 1)
    for (const P of tall) assert.ok(eligibleVQ(leadOf(P), director.lastD, director.W, 0), `${P.uid} at ${degOf(leadOf(P)).toFixed(2)}°`)
    // NC: the pre-tick initialRotation horizon (≈ 133°) admits a V/Q lead whose bottom row travels to 132.4°,
    // past the posed limb at 127.5°.
    const D = rad(20.2)
    const lead = rad(82.19) // the arrive window's θS edge (θS − D)
    assert.equal(eligibleVQ(lead, D, { ...director.W, thetaH: rad(133) }, 0), true)
    near(degOf(lead + director.W.Pth + D), 132.39, 1e-9)
    assert.equal(eligibleVQ(lead, D, { ...director.W, thetaH: rad(127.5) }, 0), false)
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})

test('spans: a unit powers on and fills blue as one picture: every member takes its lead’s delay (T31, m3)', () => {
  const random = Math.random
  const { panels } = fakeScene()
  const at = (lon, row) => panels.find((p) => p.lonIndex === lon && p.row === row)
  panels.forEach((p, i) => (p.asset = { kind: 'video', playbackId: `single${i}` }))
  // An H, a V and a Q unit (kx along lon, ky one row south), as planUnits lays their records.
  const unit = (cls, lon, row) => {
    const { cols, rows } = UNIT_SHAPE[cls]
    const members = []
    for (let ky = 0; ky < rows; ky++) for (let kx = 0; kx < cols; kx++) members.push(at(lon + kx, row + ky))
    const P = { uid: `${cls}:${lon}:${members[0].tapeS}:${cls}clip`, cls, cols, rows, members }
    members.forEach((m, k) => (m.asset = { kind: 'video', playbackId: `${cls}clip`, place: P, kx: k % cols, ky: Math.floor(k / cols) }))
    return P
  }
  const units = [unit('h', 2, 3), unit('v', 5, 2), unit('q', 8, 1)]
  const members = units.flatMap((P) => P.members)
  // The blue fill's lookup: every member → its lead; a panel outside a unit owns itself.
  for (const P of units) for (const m of P.members) assert.equal(delayOwner(m), P.members[0])
  for (const p of panels.filter((x) => !members.includes(x))) assert.equal(delayOwner(p), p)
  const owners = panels.length - members.length + units.length
  try {
    for (const variant of DELAY_ORDERS) {
      let calls = 0
      Math.random = () => ((calls += 1), (calls * 0.37) % 1)
      const tl = buildCascadeTimeline(panels, variant, ROWS)
      // panelDelay draws once per owner (jitter; 'random' draws its slot too): one delay per unit
      assert.equal(calls, owners * (variant === 'random' ? 2 : 1), variant)
      const startOf = new Map(tl.getChildren(false, true, false).filter((t) => t.vars.keyframes).map((t) => [t.targets()[0], t.startTime()]))
      tl.kill()
      for (const P of units) {
        const lead = startOf.get(P.members[0].mesh.material.uniforms.uPower)
        for (const m of P.members) assert.equal(startOf.get(m.mesh.material.uniforms.uPower), lead, `${variant} ${P.uid}`)
      }
      assert.equal(startOf.size, panels.length, variant) // every screen still powers on
    }
    // The unit's delay is its lead's own, whichever member the cascade meets first (here the panels reversed).
    Math.random = () => 0
    for (const variant of DELAY_ORDERS.filter((v) => v !== 'random')) {
      const tl = buildCascadeTimeline([...panels].reverse(), variant, ROWS)
      const startOf = new Map(tl.getChildren(false, true, false).filter((t) => t.vars.keyframes).map((t) => [t.targets()[0], t.startTime()]))
      tl.kill()
      for (const P of units) for (const m of P.members) near(startOf.get(m.mesh.material.uniforms.uPower), panelDelay(P.members[0], variant, ROWS), 1e-9, `${variant} ${P.uid}`)
    }
    // NC: per-panel panelDelay (the old path) starts an H pair's halves ≥ 0.02 s apart under sweep (0.07 s per
    // lon step, minus at most 0.05 s of jitter): here the worst case, the lead drawing the most jitter.
    const [h0, h1] = units[0].members
    Math.random = () => 0.999999
    const d0 = panelDelay(h0, 'sweep', ROWS)
    Math.random = () => 0
    const d1 = panelDelay(h1, 'sweep', ROWS)
    assert.ok(d1 - d0 >= 0.02, `${d1 - d0}`)
  } finally {
    Math.random = random
  }
})

/* — Media spans, P4b: per-frame unit windows. loadTile's bind hook writes a member's own window on its first
   bound frame; director.place() rewrites it from the live pose after every frame's scroll (T18, and T20's
   — P4b — block above). — */
/** Every uniform of every panel, by value: vectors as arrays, textures as the objects bound. */
const uniformSnapshot = (panels) =>
  panels.map((p) => Object.fromEntries(Object.entries(p.mesh.material.uniforms).map(([k, u]) => [k, u.value?.isVector2 ? [u.value.x, u.value.y] : u.value])))
/** A tile's A window as its uniforms hold it. */
const windowOf = (p) => {
  const u = p.mesh.material.uniforms
  return [u.uvScaleA.value.x, u.uvScaleA.value.y, u.uvOffsetA.value.x, u.uvOffsetA.value.y]
}
/** The A window a member owes at its live pose: THE rule both writers use, on the texture it shows. */
const owed = (p) => {
  const w = unitWindowOf(p, p.shownAsset, p.mesh.material.uniforms.texA.value.userData.aspect)
  return [...w.s, ...w.o]
}
const thetaOf = (p) => Math.acos(Math.min(Math.max(p.centerDir.y, -1), 1))
/** Move every row by d from its scroll-0 pose (MeridianScroll's own pose writer). */
const shiftRows = (panels, d) => {
  for (const p of panels) poseTile(p, scrollZeroTheta(p.row, ROWS) + d)
}

test('spans: with units off, place() changes nothing: every uniform of every panel, name strips included (T18)', () => {
  const directors = []
  try {
    // Units off on the scroll lattice, names on: today's board. Every bind stamps _bound; nothing else is written.
    const { director: off, panels } = unitDirector({ units: 0, names: 1 }, { getRotation: TILT })
    directors.push(off)
    off.initialLayout(off.byProminence())
    assert.ok(strips(panels).length >= 2, `${strips(panels).length} strip tiles`) // the snapshot holds name strips
    assert.ok(panels.every((p) => !p.shownAsset.place && p._bound === p.shownAsset && p._skewTheta === undefined))
    const today = uniformSnapshot(panels)
    for (let i = 0; i < 3; i++) off.place()
    assert.deepEqual(uniformSnapshot(panels), today)
    for (const [i, p] of panels.entries()) for (const k of ['texA', 'texB']) assert.equal(p.mesh.material.uniforms[k].value, today[i][k]) // the very texture bound, not a lookalike
    assert.deepEqual([off.unitSnaps, off.skewChecks, off.skewBad], [0, 0, 0])
    // ?popunits flipped off on the bench while units still show (until the relayout lands): place() still returns
    // at once, though every member's window is stale (the rows have moved on under them).
    const { director: on, panels: board } = unitDirector({ names: 1 }, { getRotation: TILT })
    directors.push(on)
    on.initialLayout(on.byProminence())
    const members = board.filter((p) => p.shownAsset.place && !p.parked)
    assert.ok(members.length >= 6 && strips(board).length >= 2, `${members.length} members, ${strips(board).length} strip tiles`)
    shiftRows(board, 0.05)
    TUNING.units = 0
    const stale = uniformSnapshot(board)
    on.place()
    assert.deepEqual(uniformSnapshot(board), stale)
    assert.deepEqual([on.unitSnaps, on.skewChecks, on.skewBad], [0, 0, 0])
    // NC: units on, place() writes a member's A: the window it owes at the moved pose.
    TUNING.units = 1
    on.place()
    assert.notDeepEqual(uniformSnapshot(board), stale)
    for (const p of members.filter((m) => !m.parked)) assert.deepEqual(windowOf(p), owed(p))
  } finally {
    for (const d of directors) d.dispose()
    TUNING.units = 0
  }
})

test('spans: a unit member is right on its first bound frame: windowA’s member branch, loadTile’s bind hook (P4b)', async () => {
  const { director, panels } = unitDirector()
  try {
    director.initialLayout(director.byProminence())
    const units = [...placesOf(panels).keys()]
    assert.ok(units.length >= 4, `${units.length} units`)
    for (const p of panels) {
      assert.equal(p._bound, p.shownAsset) // every bind stamps what it bound
      if (!p.shownAsset.place) {
        assert.equal(p._skewTheta, undefined)
        continue
      }
      assert.equal(p._skewTheta, thetaOf(p)) // the pose its first window was written for
      assert.deepEqual(windowOf(p), owed(p))
    }
    // windowA: a member's own window on its texture's measured aspect, else its requested one, else square. A
    // single, and every member under the probe's kill switch (true, or 'bind'), takes the cover window.
    const m = units[0].members[1]
    const rec = m.shownAsset
    const tex = m.mesh.material.uniforms.texA.value
    const cover = (t) => {
      const { scale, offset } = computeCoverUv(t, m.panelAspect)
      return { s: scale, o: offset }
    }
    assert.deepEqual(windowA(m, rec, tex), unitWindowOf(m, rec, tex.userData.aspect))
    assert.deepEqual(windowA(m, rec, {}), unitWindowOf(m, rec, rec.tex.aspect))
    assert.deepEqual(windowA(m, { ...rec, tex: undefined }, null), unitWindowOf(m, rec, 1))
    // The measured aspect wins over the one the record asked for: a texture that measures 1.8 is windowed for 1.8.
    // NC: the two windows differ.
    assert.deepEqual(windowA(m, rec, { userData: { aspect: 1.8 } }), unitWindowOf(m, rec, 1.8))
    assert.notDeepEqual(unitWindowOf(m, rec, 1.8), unitWindowOf(m, rec, rec.tex.aspect))
    // θ is the colatitude, acos of the clamped y, as place() and the register take it. An H member's window does not
    // read θ; a V member's does (P5's class), so a hand-made V record pins it. NC: asin's θ gives another window.
    const V = { ...rec.place, uid: 'v:0:0:test', cls: 'v', cols: 1, rows: 2, S: unitAspect(1, 2, rec.place.L) }
    const vRec = { ...rec, place: V, kx: 0, ky: 0 }
    const y = m.centerDir.y
    assert.deepEqual(windowA(m, vRec, tex), unitA(vRec, namePinch(y), thetaOf(m), tex.userData.aspect))
    assert.notDeepEqual(unitA(vRec, namePinch(y), Math.asin(y), tex.userData.aspect), windowA(m, vRec, tex))
    assert.deepEqual(windowA(m, { kind: 'video', playbackId: 'single' }, tex), cover(tex.userData.aspect))
    for (const v of [true, 'bind']) {
      globalThis.__swmNoUnitWindows = v
      assert.deepEqual(windowA(m, rec, tex), cover(tex.userData.aspect), String(v))
    }
    delete globalThis.__swmNoUnitWindows
    // The kill switch's guide row (the debug globals) names both values.
    assert.match(fs.readFileSync(new URL('../../docs/tunables-guide.md', import.meta.url), 'utf8'), /^\| `globalThis\.__swmNoUnitWindows` \| .*`true`.*`'bind'`.*\|$/m)
    // NC: the member window is neither the cover window nor its partner's: the pair shows two halves of one picture.
    assert.notDeepEqual(windowA(m, rec, tex), cover(tex.userData.aspect))
    assert.notDeepEqual(windowOf(units[0].members[0]), windowOf(m))
    // The hook writes the bind's pose whoever binds: a re-bind after the rows moved stamps the new θ and window.
    shiftRows(panels, 0.03)
    loadTile(director, m, rec)
    assert.deepEqual([m._bound, m._skewTheta], [rec, thetaOf(m)])
    assert.deepEqual(windowOf(m), owed(m))
    // _bound is the record loadTile last BOUND: a load superseded while in flight settles late, releases its own
    // ref and stamps nothing, so _bound stays what the tile shows (else place() would freeze it as a snap).
    const tm = director.textureManager
    const [peek, loadAsset] = [tm.peek, tm.loadAsset]
    let settle = null
    tm.peek = () => null
    tm.loadAsset = () => new Promise((resolve) => (settle = resolve))
    const late = loadTile(director, m, { kind: 'video', playbackId: 'late' })
    Object.assign(tm, { peek, loadAsset })
    loadTile(director, m, rec) // warm: binds at once
    settle({ userData: { aspect: 1 } })
    await late
    assert.deepEqual([m._bound, m.shownAsset], [rec, rec])
  } finally {
    delete globalThis.__swmNoUnitWindows
    director.dispose()
    TUNING.units = 0
  }
})

test('spans: director.place() rewrites each member from its live pose: dead-band, snaps, parked, skew, the kill switch (P4b)', () => {
  const { director, panels } = unitDirector()
  try {
    director.initialLayout(director.byProminence())
    assert.equal(director.skewMax, unitSkewBound(director.L)) // m7: from UNIT_EPS and the lattice
    /** Members place() judges for skew this frame: bound, unparked, in a whole unit. */
    const judged = () => panels.filter((p) => p.shownAsset?.place && p._bound === p.shownAsset && !p.parked && director.wholeUnit(p.shownAsset.place)).length
    const units = [...placesOf(panels).keys()].filter((P) => director.wholeUnit(P))
    assert.ok(units.length >= 4, `${units.length} whole units`)
    const members = units.flatMap((P) => P.members)
    // One frame of a tide (the rows move 0.01 rad): every member's window follows its pose; each judged member is
    // one skew check, and none is skewed (the pose change bounds the write).
    shiftRows(panels, 0.01)
    const stale = members.map(windowOf)
    const checks = judged()
    director.place()
    for (const p of members) if (!p.parked) assert.deepEqual([windowOf(p), p._skewTheta], [owed(p), thetaOf(p)])
    assert.ok(members.some((p, i) => Math.abs(windowOf(p)[2] - stale[i][2]) > 1e-4)) // the pose change moved them
    assert.deepEqual([director.skewChecks, director.skewBad, director.unitSnaps], [checks, 0, 0])
    // A pose change too small to move any window past the dead-band still moves every pose stamp, so the next
    // frame's allowance runs from this frame's pose. NC: the stamps did move.
    shiftRows(panels, 0.01 + 1e-10)
    const [kept, stamps] = [members.map(windowOf), members.map((p) => p._skewTheta)]
    director.place()
    for (const [i, p] of members.entries()) if (!p.parked) assert.deepEqual([windowOf(p), p._skewTheta], [kept[i], thetaOf(p)])
    assert.ok(members.some((p, i) => !p.parked && p._skewTheta !== stamps[i]))

    const p0 = units.find((P) => P.members.every((m) => !m.parked)).members[0]
    const u = p0.mesh.material.uniforms
    // Dead-band: a window within 1e-9 of the one owed stays as it is (and the 1e-6 slack keeps it from skew).
    const w0 = owed(p0)
    u.uvOffsetA.value.x = w0[2] + 5e-10
    director.place()
    assert.equal(u.uvOffsetA.value.x, w0[2] + 5e-10)
    u.uvOffsetA.value.x = w0[2] + 2e-9
    director.place()
    assert.equal(u.uvOffsetA.value.x, w0[2])
    // off is the largest of the four components: a scale, or a y term, 2e-9 off on its own is rewritten too.
    for (const [k, c] of [['uvScaleA', 'x'], ['uvScaleA', 'y'], ['uvOffsetA', 'y']]) {
      u[k].value[c] += 2e-9
      assert.notDeepEqual(windowOf(p0), owed(p0), `${k}.${c} planted`)
      director.place()
      assert.deepEqual(windowOf(p0), owed(p0), `${k}.${c}`)
    }
    assert.equal(director.skewBad, 0)
    // Skew: a write larger than the pose change allows (skewMax · |Δθ| + 1e-6) is counted; one inside it is not.
    const plant = (e, dTheta) => {
      director.place()
      p0._skewTheta = thetaOf(p0) - dTheta
      u.uvOffsetA.value.x = owed(p0)[2] + e
      const bad = director.skewBad
      director.place()
      return director.skewBad - bad
    }
    assert.deepEqual([plant(0.9 * director.skewMax * 0.01, 0.01), plant(1.1 * director.skewMax * 0.01, 0.01)], [0, 1])
    assert.deepEqual([plant(5e-7, 0), plant(2e-6, 0)], [0, 1])
    // A member with no pose stamp gets no pose allowance, only the 1e-6 slack; place() stamps it.
    director.place()
    delete p0._skewTheta
    u.uvOffsetA.value.x = owed(p0)[2] + 2e-6
    const unstamped = director.skewBad
    director.place()
    assert.deepEqual([director.skewBad - unstamped, p0._skewTheta], [1, thetaOf(p0)])
    // Mid-swap (a blink or a surge dip: swapping, swapAsset set) a member still shows its unit, so place() still
    // follows its pose; only a parked tile is skipped. NC: the move left its window behind.
    p0.swapping = true
    p0.swapAsset = { kind: 'video', playbackId: 'next' }
    shiftRows(panels, 0.02)
    assert.notDeepEqual(windowOf(p0), owed(p0))
    director.place()
    assert.deepEqual(windowOf(p0), owed(p0))
    p0.swapping = false
    p0.swapAsset = null
    director.place()
    // Snaps: a unit record shown without loadTile's bind is counted and never written; bound, it is placed again.
    p0.shownAsset = { ...p0.shownAsset }
    u.uvOffsetA.value.x += 1e-3
    const held = windowOf(p0)
    director.place()
    assert.deepEqual([director.unitSnaps, windowOf(p0)], [1, held])
    loadTile(director, p0, p0.shownAsset)
    u.uvOffsetA.value.x += 1e-3
    director.place()
    assert.deepEqual([director.unitSnaps, windowOf(p0)], [1, owed(p0)])
    // Parked: skipped (no write, no snap, its pose stamp kept); its unit is not whole, so its partner is not judged,
    // though it is still placed.
    const q = units.find((P) => P !== p0.shownAsset.place && P.members.every((m) => !m.parked))
    const [q0, q1] = q.members
    const full = judged()
    q0.parked = true
    q0.mesh.material.uniforms.uvOffsetA.value.x += 1e-3
    q1.mesh.material.uniforms.uvOffsetA.value.x += 1e-3
    q0._skewTheta = -1
    q1._skewTheta = -1
    const parked = windowOf(q0)
    const [snaps, before] = [director.unitSnaps, director.skewChecks]
    director.place()
    assert.deepEqual([windowOf(q0), q0._skewTheta, director.unitSnaps], [parked, -1, snaps])
    assert.deepEqual([director.wholeUnit(q), director.skewChecks - before], [false, full - 2]) // neither member of q is judged
    assert.deepEqual([windowOf(q1), q1._skewTheta], [owed(q1), thetaOf(q1)]) // judged or not, a placed member's stamp moves
    q0.parked = false
    director.place()
    // The measured aspect wins: a texture that now measures 1.8, not what its record asked for, moves the unit's
    // members to their 1.8 windows. NC: those are not the windows for the record's aspect.
    const texes = [...new Set(p0.shownAsset.place.members.map((m) => m.mesh.material.uniforms.texA.value))]
    const measured = texes.map((t) => t.userData.aspect)
    for (const t of texes) t.userData.aspect = 1.8
    director.place()
    for (const m of p0.shownAsset.place.members) {
      const w = unitWindowOf(m, m.shownAsset, m.shownAsset.tex.aspect)
      assert.deepEqual(windowOf(m), owed(m))
      assert.notDeepEqual(windowOf(m), [...w.s, ...w.o])
    }
    texes.forEach((t, i) => (t.userData.aspect = measured[i]))
    director.place()
    // The kill switch: true stops place() (the probe's --negctl); 'bind' leaves it on (--negctl=bind), and its
    // correction, made with no pose change, is skew: what the bind control's gate sees.
    u.uvOffsetA.value.x += 1e-3
    const off = windowOf(p0)
    const tally = [director.unitSnaps, director.skewChecks, director.skewBad]
    globalThis.__swmNoUnitWindows = true
    director.place()
    assert.deepEqual([windowOf(p0), director.unitSnaps, director.skewChecks, director.skewBad], [off, ...tally])
    globalThis.__swmNoUnitWindows = 'bind'
    director.place()
    assert.deepEqual([windowOf(p0), director.skewBad], [owed(p0), tally[2] + 1])
    delete globalThis.__swmNoUnitWindows
    // The scene's tick calls it after the scroll and before the render, so a frame shows the pose it was placed for.
    // Each call is one whole code line, found once: a commented-out copy or a guarded variant does not count.
    const tick = fs.readFileSync(new URL('../../src/components/globe/useGlobeScene.js', import.meta.url), 'utf8').split('\n').map((l) => l.trim())
    const at = ['if (director) director.update(step);', 'if (scroller) scroller.update(step);', 'if (director) director.place();', 'renderer.render(scene, camera);'].map((s) => {
      const lines = tick.flatMap((l, i) => (l === s ? [i] : []))
      assert.equal(lines.length, 1, s)
      return lines[0]
    })
    assert.ok(at[0] < at[1] && at[1] < at[2] && at[2] < at[3], JSON.stringify(at))
  } finally {
    delete globalThis.__swmNoUnitWindows
    director.dispose()
    TUNING.units = 0
  }
  // No lattice (the fixed globe): place() never runs, units on or not.
  const { director: fixed, panels: flat } = spanDirector(1, { scene: fakeScene() })
  try {
    assert.deepEqual([fixed.L, fixed.skewMax], [null, 0])
    const P = { uid: 'h:0:0:clip', key: 'clip', cls: 'h', cols: 2, rows: 1, n: 2, S: unitAspect(2, 1, SPAN_L), L: SPAN_L, members: [flat[1], flat[ROWS + 1]] }
    P.members.forEach((m, kx) => {
      const rec = { kind: 'video', playbackId: 'clip', place: P, kx, ky: 0 }
      Object.assign(m, { shownAsset: rec, _bound: rec })
      m.mesh.material.uniforms.uvOffsetA.value.x = 0.5
    })
    fixed.place()
    assert.deepEqual(P.members.map((m) => m.mesh.material.uniforms.uvOffsetA.value.x), [0.5, 0.5])
    assert.deepEqual([fixed.unitSnaps, fixed.skewChecks], [0, 0])
  } finally {
    fixed.dispose()
    TUNING.units = 0
  }
})

test('spans: unitStats measures what whole units render: the seam and the register off the uniforms and the pose (P4b)', () => {
  const { director, panels } = unitDirector()
  try {
    director.initialLayout(director.byProminence())
    const units = [...placesOf(panels).keys()].filter((P) => director.wholeUnit(P))
    assert.ok(units.length >= 4, `${units.length} whole units`)
    const stats = () => director.unitStats(0)
    assert.deepEqual([stats().seam, stats().register], [{ n: units.length, worst: 0 }, { n: 2 * units.length, worst: 0 }])
    assert.deepEqual([stats().snaps, stats().skewBad, stats().skewChecks], [0, 0, 0])
    // One pair by hand, through the shader's mUv: the halves render equally wide, a lattice gap apart (Gφ over a
    // member's φ length, in rendered width), so the one picture runs on across the seam.
    const [left, right] = units[0].members
    const ren = (p) => spanRendered(p.mesh.material.uniforms.uvScaleA.value.x, p.mesh.material.uniforms.uvOffsetA.value.x, namePinch(p.centerDir.y))
    const [[l0, r0], [l1, r1]] = [ren(left), ren(right)]
    near((l1 - r0) / (r0 - l0), director.L.Gphi / director.L.phiLen, 1e-12, 'the gap')
    near(r1 - l1, r0 - l0, 1e-12, 'the widths')
    // NC: one member's offset 1e-3 off: the register sees exactly that, the seam that over the left member's width.
    right.mesh.material.uniforms.uvOffsetA.value.x += 1e-3
    near([stats().register.worst, stats().seam.worst], [1e-3, 1e-3 / (r0 - l0)], 1e-8)
    right.mesh.material.uniforms.uvOffsetA.value.x -= 1e-3
    // NC: the right member rendered wider from the same left edge: only the width term sees it (vK · 1e-3 over the
    // left member's rendered width).
    const uR = right.mesh.material.uniforms
    const [sx, ox] = [uR.uvScaleA.value.x, uR.uvOffsetA.value.x]
    const vK = namePinch(right.centerDir.y)
    uR.uvScaleA.value.x = sx + 1e-3
    uR.uvOffsetA.value.x = ox - (0.5 - 0.5 * vK) * 1e-3
    near(ren(right)[0], l1, 1e-12, 'the same left edge')
    near([stats().register.worst, stats().seam.worst], [1e-3, (vK * 1e-3) / (r0 - l0)], 1e-8)
    // Reported to 1e-9 (r9): a member 4e-10 off reads 0.
    uR.uvScaleA.value.x = sx
    uR.uvOffsetA.value.x = ox + 4e-10
    assert.equal(stats().register.worst, 0)
    uR.uvOffsetA.value.x = ox
    // Only whole units are judged: one torn (a member showing a single) and one with a member parked are not.
    loadTile(director, units[1].members[1], { kind: 'video', playbackId: 'stray' })
    units[2].members[0].parked = true
    assert.deepEqual([units[1], units[2], units[3]].map((P) => director.wholeUnit(P)), [false, false, true])
    assert.deepEqual([stats().seam.n, stats().register.n], [units.length - 2, 2 * (units.length - 2)])
    units[2].members[0].parked = false
    // Whole by what the tiles SHOW, not what they plan: a member whose next asset is still loading shows the unit.
    const [lead] = units[3].members
    const planned = lead.asset
    lead.asset = { kind: 'video', playbackId: 'next' }
    assert.equal(director.wholeUnit(units[3]), true)
    lead.asset = planned
    // The register reads the measured aspect: re-measured at 1.8, a unit's members are off until place() moves
    // them, then right again.
    const texes = [...new Set(units[0].members.map((m) => m.mesh.material.uniforms.texA.value))]
    const measured = texes.map((t) => t.userData.aspect)
    for (const t of texes) t.userData.aspect = 1.8
    assert.ok(stats().register.worst > 1e-3, JSON.stringify(stats().register))
    director.place()
    assert.equal(stats().register.worst, 0)
    texes.forEach((t, i) => (t.userData.aspect = measured[i]))
    director.place()
    // NC (--negctl's board): members bound with no unit window each cover the whole picture; both measures break.
    globalThis.__swmNoUnitWindows = true
    for (const m of units[3].members) loadTile(director, m, m.shownAsset)
    delete globalThis.__swmNoUnitWindows
    assert.ok(stats().seam.worst > 0.5 && stats().register.worst > 0.1, JSON.stringify([stats().seam, stats().register]))
    // the director's counters read through
    Object.assign(director, { unitSnaps: 2, skewBad: 3, skewChecks: 40 })
    assert.deepEqual([stats().snaps, stats().skewBad, stats().skewChecks], [2, 3, 40])
  } finally {
    delete globalThis.__swmNoUnitWindows
    director.dispose()
    TUNING.units = 0
  }
})

test('spans: through a tide’s travel, place() after each frame’s scroll keeps whole units registered and seamless, born pairs from their first frame (P4b)', () => {
  /** 640 frames of 0.03 rad (the 8-row tape ≈ 4.6 times over), place() after each scroll; unitStats every 8th. */
  const travel = (kill) => {
    if (kill) globalThis.__swmNoUnitWindows = kill
    const { director, panels, textureManager } = unitDirector()
    try {
      director.initialLayout(director.byProminence())
      const planned = panels.filter((p) => p.shownAsset.place).length // the initial layout's members, all on unparked rows
      const scroller = new MeridianScroll({ panels, assets: [], textureManager, cascadeSpeed: 0, scheduler: null, assignRow: (tiles) => director.assignRow(tiles) })
      const out = { planned, seamN: 0, seamW: 0, regN: 0, regW: 0 }
      for (let f = 1; f <= 640; f++) {
        scroller.advance(0.03)
        scroller.update(0)
        director.place()
        if (f % 8) continue
        const { seam, register } = director.unitStats(0)
        Object.assign(out, { seamN: out.seamN + seam.n, regN: out.regN + register.n, seamW: Math.max(out.seamW, seam.worst), regW: Math.max(out.regW, register.worst) })
      }
      return { ...out, bornH: director.bornH, snaps: director.unitSnaps, skewBad: director.skewBad, skewChecks: director.skewChecks }
    } finally {
      director.dispose()
      delete globalThis.__swmNoUnitWindows
      TUNING.units = 0
    }
  }
  const run = travel(null)
  assert.ok(run.bornH >= 3 && run.seamN >= 200, JSON.stringify(run)) // born pairs bind parked at their pre-wrap pose (past the south pole), then roll in from the north
  assert.equal(run.regN, 2 * run.seamN) // H pairs: two members, one seam
  assert.ok(run.seamW <= 1e-6 && run.regW <= 1e-9, JSON.stringify(run)) // orders inside the gates' 1e-4 and 5e-6
  assert.deepEqual([run.snaps, run.skewBad], [0, 0])
  assert.ok(run.skewChecks >= 640, JSON.stringify(run))
  // NC (--negctl=bind): each bind writes the cover window and place() puts it right that same frame, so what
  // renders stays right; only the skew check sees the jump, on every planned member. Not on a born one: a born
  // pair binds parked at its row's pre-wrap pose (recycle runs before poseTile: past the south pole), where a
  // member's window and the cover window meet (vK → 0: both show the picture's centre slice), and its pose stamp
  // is π, so its first unparked frame's allowance (skewMax·|θ − π|) dwarfs any bind error.
  const bind = travel('bind')
  assert.ok(bind.planned >= 8 && bind.skewBad === bind.planned, JSON.stringify(bind))
  assert.ok(bind.seamW <= 1e-6 && bind.regW <= 1e-9, JSON.stringify(bind))
  // The geometry behind it: at either pole (vK clamped to 1e-3) a member's window is the cover window to within
  // vK; NC: at the equator they are a quarter of the picture apart.
  const P = { cols: 2, rows: 1, S: unitAspect(2, 1, SPAN_L), L: SPAN_L }
  const cover = coverWindow(P.S, SPAN_L.phiLen / SPAN_L.bandH)
  const memberAt = (y) => unitA({ place: P, kx: 0, ky: 0 }, namePinch(y), Math.acos(y), P.S)
  for (const y of [1, -1]) near([...memberAt(y).s, ...memberAt(y).o], [...cover.s, ...cover.o], 1e-3, `the pole at y ${y}`)
  assert.ok(Math.abs(memberAt(0).o[0] - cover.o[0]) > 0.2, `${memberAt(0).o[0]} vs ${cover.o[0]}`)
  // NC (--negctl): no unit windows at all: the seams and the register break, and place() checks nothing.
  const none = travel(true)
  assert.ok(none.seamW > 0.5 && none.regW > 0.1, JSON.stringify(none))
  assert.deepEqual([none.skewChecks, none.skewBad, none.snaps], [0, 0, 0])
})

/* — Media spans, P5: vertical pairs and elected 2×2 quads inside the ε window. T11's quad election (M1), the V/Q
   boards, §7's cols, rows and warp, and place()'s lead clause; T29's V/Q half is above, and T20's — P5 — block is
   in the gate-module test. — */
test('spans: each world elects its ?popquads quads over the pool it places from, keyed by world; the q texture stays pooled by id (T11, M1)', () => {
  // ?popquads: 1 by default, an integer 0–2 (rounded: 1.6 is 2, which a floor or a trunc would make 1), and its own
  // guide row, with that default and range.
  assert.equal(POP_DEFAULTS.quads, 1)
  for (const [typed, want] of [[-1, 0], [1.4, 1], [1.6, 2], [9, 2]]) {
    setPopTune('quads', typed)
    assert.equal(TUNING.quads, want)
  }
  assert.match(fs.readFileSync(new URL('../../docs/tunables-guide.md', import.meta.url), 'utf8'), /^\| `\?popquads` \|.*\| `1` \| 0–2 \(clamped\) \| `POP_DEFAULTS\.quads` \|$/m)
  // electQuads: the first n 'q' candidates in editorial order whose REAL source short side reaches 0.9 × the quad
  // texture side (classSizes' q, the 2×2 crop at T1), as ids. A 1:1 clip with no `s` is a 1080 source; an s 480
  // clip, an 800² still, an unknown source (s 0) and an 'h' asset are not candidates.
  const TQ = classSizes(THUMB_WIDTH).q[1]
  assert.ok(0.9 * TQ > 800 && 0.9 * TQ < 1080, `${TQ}`)
  const q = (id, extra = {}) => ({ kind: 'video', playbackId: id, videoAspectRatio: '1:1', u: 'q', ...extra })
  const qStill = (id, side) => ({ kind: 'still', imageUrl: `https://cdn.sanity.io/images/p/d/${id}-${side}x${side}.jpg`, u: 'q' })
  const pool = [q('low', { s: 480 }), qStill('small', 800), { kind: 'video', playbackId: 'wide', videoAspectRatio: '16:9', u: 'h' }, q('unknown', { s: 0 }), q('A'), qStill('B', 1200), q('C')]
  assert.deepEqual([0, 1, 2, 3].map((n) => [...electQuads(pool, n, THUMB_WIDTH, SPAN_L)]), [[], ['A'], ['A', pool[5].imageUrl], ['A', pool[5].imageUrl, 'C']])

  // The cap case: world 0 is 12 stills, then an eligible 'q' still X, then an eligible 'q' clip Y. At ?popcap 13
  // selectPool's round-robin over kinds keeps the 12 stills and Y, so Y is world 0's quad and X is nobody's. World
  // 1 carries Y too, behind its own first candidate Z, and opens with Zs, an 800² 'q' still too small to elect.
  const stills = (name, n) => Array.from({ length: n }, (_, i) => ({ kind: 'still', imageUrl: `https://cdn.sanity.io/images/p/d/${name}-s${i}-800x600.jpg` }))
  const X = qStill('X', 1200)
  const [Y, Z] = [q('Y'), q('Z')]
  const Zs = qStill('Zs', 800)
  const world = (name, assets) => ({ slug: name, clientName: name, title: null, services: [], assets })
  const worlds = [world('zero', [...stills('zero', 12), X, Y]), world('one', [Zs, Z, ...stills('one', 4), Y])]
  const { director } = unitDirector({}, { worlds })
  try {
    const idOf = (a) => a.playbackId || a.imageUrl
    const recOf = (wi, a) => director.pools[wi].find((r) => idOf(r) === idOf(a))
    const sel0 = director.selectFor(worlds[0].assets)
    assert.equal(TUNING.cap, 13)
    assert.deepEqual([sel0.length, sel0.includes(X), sel0.includes(Y)], [13, false, true])
    // selectPool reads only `kind` and keeps the list's order: the raw assets and the decorated records select alike
    assert.deepEqual(director.selectFor(director.pools[0]).map(idOf), sel0.map(idOf))
    const qTex = texSpec(Y, 'q', THUMB_WIDTH, director.L)
    assert.deepEqual([recOf(0, Y).tex, recOf(0, Y).unitCls], [qTex, 'q'])
    assert.ok(!('tex' in recOf(0, X)) && !('unitCls' in recOf(0, X))) // past the cap: a legacy single
    assert.deepEqual([recOf(1, Z).tex, recOf(1, Z).unitCls], [texSpec(Z, 'q', THUMB_WIDTH, director.L), 'q']) // world 1's own first
    assert.ok(!('tex' in recOf(1, Zs)) && !('unitCls' in recOf(1, Zs))) // short side 800 < 0.9 × TQ at THUMB_WIDTH: a legacy single
    // Y in world 1, which elected Z: the q texture (pooled by id: ONE key, world 0's), but no unitCls, so a single there
    assert.deepEqual([recOf(1, Y).tex, assetKey(recOf(1, Y)), 'unitCls' in recOf(1, Y)], [qTex, assetKey(recOf(0, Y)), false])
    // makeGrouping places from the same selection: world 0's region pool holds Y as a quad, and never X
    const g0 = director.makeGrouping({ lead: 0 })
    assert.deepEqual(g0.pools[0].map(idOf), sel0.map(idOf))
    assert.equal(g0.pools[0].find((r) => idOf(r) === 'Y').unitCls, 'q')
    // NC: electing over w.assets (before the selection, the old wording) elects X, which the cap leaves out: world 0
    // would form no quad at all.
    const raw = electQuads(worlds[0].assets, 1, THUMB_WIDTH, director.L)
    assert.deepEqual([...raw], [X.imageUrl])
    assert.equal(sel0.some((a) => raw.has(idOf(a))), false)
    // NC: a class texture only where the id is elected (no pooling by id) gives Y two keys: the q crop, the legacy one.
    assert.notEqual(qTex.key, assetKey(Y))

    // ?popquads, ?popcap and ?popmedia are in the signature (the election reads the selection): each re-decorates,
    // then re-lays. `elected` = each world's records that may form a quad; `textured` = the ids on a q texture.
    let relayouts = 0
    director.relayout = () => (relayouts += 1)
    const sig = director.decorSig
    const elected = () => director.pools.map((p) => p.filter((r) => r.unitCls === 'q').map(idOf))
    const textured = () => [...new Set(director.pools.flat().filter((r) => r.tex?.cls === 'q').map(idOf))]
    assert.deepEqual([elected(), textured()], [[['Y'], ['Z']], ['Y', 'Z']])
    const tune = (key, value) => {
      TUNING[key] = value
      director.onTune(key)
      return [elected(), textured()]
    }
    // Each step moves ONE knob from the last decorate's values, so each knob alone must re-decorate.
    assert.deepEqual(tune('quads', 0), [[[], []], []])
    assert.deepEqual(tune('quads', 2), [[['Y'], ['Z', 'Y']], ['Y', 'Z']]) // world 0's selection holds one candidate
    assert.deepEqual(tune('quads', 1), [[['Y'], ['Z']], ['Y', 'Z']])
    assert.deepEqual(tune('cap', 14), [[[X.imageUrl], ['Z']], [X.imageUrl, 'Z']]) // X now selected, ahead of Y
    assert.deepEqual(tune('cap', 13), [[['Y'], ['Z']], ['Y', 'Z']])
    assert.deepEqual(tune('media', 'still'), [[[X.imageUrl], []], [X.imageUrl]]) // world 1's stills hold no candidate
    assert.deepEqual(tune('media', 'all'), [[['Y'], ['Z']], ['Y', 'Z']])
    assert.deepEqual([director.decorSig, relayouts], [sig, 7])
    // Units off: the signature is constant, so these knobs never rebuild today's records (they still re-lay).
    TUNING.units = 0
    director.onTune('units')
    assert.deepEqual(director.pools, todaysSpread(worlds))
    const today = director.pools
    for (const [key, value] of [['quads', 2], ['cap', 14], ['media', 'still']]) {
      tune(key, value)
      assert.equal(director.pools, today, key)
    }
    assert.equal(relayouts, 11)
  } finally {
    director.dispose()
    Object.assign(TUNING, POP_DEFAULTS, { units: 0 })
  }
})

test('spans: with a horizon, V pairs and quads form whole inside the ε window — one region, the bottom row one pitch south, clear of their own key, a quad only where its world elected it (T13, M1)', () => {
  // Two worlds (two owner regions), posed (θh π: no limb in the way), still rows (D 0). A stub, so this initial
  // layout sees a horizon; useGlobeScene's never does (M4, T29), which is what the initVQ counters report.
  const { director, panels } = unitDirector({ group: 2 }, { getHorizon: () => Math.PI })
  try {
    director.initialLayout(director.byProminence())
    const perKey = assertWholeUnits(director, panels, ['h', 'v', 'q'])
    const units = [...placesOf(panels).keys()]
    assert.ok(director.placed.v >= 1 && director.placed.q >= 1, JSON.stringify(director.placed))
    assert.deepEqual(['h', 'v', 'q'].map((c) => director.placed[c]), ['h', 'v', 'q'].map((c) => units.filter((P) => P.cls === c).length))
    assert.deepEqual([director.initVQ, director.unitStats(0).initThetaH], [director.placed.v + director.placed.q, 180])
    assert.deepEqual([...new Set(perKey.values())], [1]) // ?popunitmax 1
    assertSpanNeighboursDiffer(panels)
    const thetaAt = (p) => Math.acos(Math.min(Math.max(p.centerDir.y, -1), 1))
    const tall = units.filter((P) => P.rows === 2)
    for (const P of tall) {
      const [lead] = P.members
      assert.ok(eligibleVQ(thetaAt(lead), 0, director.W, 0), `${P.uid} at ${degOf(thetaAt(lead)).toFixed(2)}°`)
      for (let kx = 0; kx < P.cols; kx++) near(thetaAt(P.members[P.cols + kx]) - thetaAt(P.members[kx]), director.L.Pth, 1e-12, P.uid) // one pitch south
      if (P.cls !== 'q') continue
      // a quad only where its world elected it: that world's election, recomputed over its selection
      const id = lead.asset.playbackId || lead.asset.imageUrl
      assert.ok(electQuads(director.selectFor(director.worlds[lead.asset.world].assets), TUNING.quads, THUMB_WIDTH, director.L).has(id), P.uid)
    }
    // NC: the shape check reads ky: one V with its rows swapped fails it; and the H-only check rejects this board.
    const [a, b] = tall.find((P) => P.cls === 'v').members.map((m) => m.asset)
    a.ky = 1
    b.ky = 0
    assert.throws(() => assertWholeUnits(director, panels, ['h', 'v', 'q']), assert.AssertionError)
    a.ky = 0
    b.ky = 1
    assertWholeUnits(director, panels, ['h', 'v', 'q'])
    assert.throws(() => assertWholeUnits(director, panels), assert.AssertionError)
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})

test('spans: unitStats measures V/Q as they render (columns, mullions, warp), and place() judges a V/Q member for skew only while its lead is inside [θN, θS] (P5, §7)', () => {
  const { director, panels } = unitDirector({}, { getHorizon: () => Math.PI })
  try {
    director.initialLayout(director.byProminence())
    const thetaAt = (p) => Math.acos(Math.min(Math.max(p.centerDir.y, -1), 1))
    const units = [...placesOf(panels).keys()]
    const tall = units.filter((P) => P.rows === 2)
    assert.ok(tall.some((P) => P.cls === 'v') && tall.some((P) => P.cls === 'q') && units.some((P) => P.rows === 1), JSON.stringify(director.placed))
    assert.ok(units.every((P) => director.wholeUnit(P)))
    const stats = () => director.unitStats(0)
    const cols = tall.reduce((n, P) => n + P.cols, 0) // one per column: top member over bottom
    const members = tall.reduce((n, P) => n + P.n, 0)
    // The warp is |ln(vK / q)|: a member's own pinch against the scale its pair shares (kappaOwn), read back here from
    // the pose alone.
    const warpOf = (m) => {
      const vK = namePinch(m.centerDir.y)
      return Math.abs(Math.log(vK / kappaOwn(thetaAt(m), m.shownAsset.ky, director.L.Pth, vK)))
    }
    const warpAll = () => Math.max(...tall.flatMap((P) => P.members.map(warpOf)))
    // At rest every column lines up across the row seam and every mullion is the lattice's own: exact. H pairs are
    // not measured here (one row: no column, no mullion).
    assert.deepEqual([stats().cols, stats().rows, stats().warp.n], [{ n: cols, worst: 0 }, { n: cols, worst: 0 }, members])
    near(stats().warp.worst, warpAll(), 1e-9)
    const w9 = stats().warp.worst
    assert.equal(w9, Math.round(w9 * 1e9) / 1e9) // reported to 1e-9, as the columns and rows are

    // NC: one V's bottom member 1e-3 off in x: its column is off by that over the top's rendered width; the mullion
    // is untouched.
    const ren = (p) => spanRendered(p.mesh.material.uniforms.uvScaleA.value.x, p.mesh.material.uniforms.uvOffsetA.value.x, namePinch(p.centerDir.y))
    const V = tall.find((P) => P.cls === 'v')
    const Q = tall.find((P) => P.cls === 'q')
    const nudge = (p, k, c, by, read) => {
      const u = p.mesh.material.uniforms[k].value
      const was = u[c]
      u[c] = by(was)
      try {
        return read()
      } finally {
        u[c] = was
      }
    }
    const [lt, rt] = ren(V.members[0])
    near(nudge(V.members[1], 'uvOffsetA', 'x', (x) => x + 1e-3, () => [stats().cols.worst, stats().rows.worst]), [1e-3 / (rt - lt), 0], 1e-8)
    // Each edge on its own: the bottom's left edge 1e-3 in with its right edge held, then its right edge 1e-3 out
    // with its left edge held (scale and offset moved together, through rendered()'s own formula).
    const edge = (p, side, d, read) => {
      const u = p.mesh.material.uniforms
      const [s, o] = [u.uvScaleA.value.x, u.uvOffsetA.value.x]
      const vK = namePinch(p.centerDir.y)
      u.uvScaleA.value.x = side === 'left' ? s - d / vK : s + d / vK
      u.uvOffsetA.value.x = side === 'left' ? o + ((0.5 + 0.5 * vK) * d) / vK : o - ((0.5 - 0.5 * vK) * d) / vK
      try {
        return read()
      } finally {
        u.uvScaleA.value.x = s
        u.uvOffsetA.value.x = o
      }
    }
    const [lb, rb] = ren(V.members[1])
    for (const side of ['left', 'right']) {
      const [moved, worst] = edge(V.members[1], side, 1e-3, () => [ren(V.members[1]), stats().cols.worst])
      near(moved, side === 'left' ? [lb + 1e-3, rb] : [lb, rb + 1e-3], 1e-12, side)
      near(worst, 1e-3 / (rt - lt), 1e-8, side)
    }
    // …and a quad's second column: the bottom-right member (k = cols + 1) is judged against the top-right (k = 1).
    const [l1, r1] = ren(Q.members[1])
    near(nudge(Q.members[3], 'uvOffsetA', 'x', (x) => x + 1e-3, () => stats().cols.worst), 1e-3 / (r1 - l1), 1e-8)
    // NC: the top member 1e-3 lower in the picture (offset y), or 1e-3 taller (scale y): the mullion is off by that.
    for (const k of ['uvOffsetA', 'uvScaleA']) near(nudge(V.members[0], k, 'y', (y) => y + 1e-3, () => stats().rows.worst), 1e-3, 1e-9, k)
    // …and the mullion is judged against the BOTTOM member's height (§7: |gap − hB·Gth/bandH|): the top 1e-3 lower
    // with the bottom 1e-4 taller reads 0.9e-3 − 1e-4·Gth/bandH (the height term is 1e-4), where the top's height
    // would read 0.9e-3.
    const mullionOfHB = (1e-4 * V.L.Gth) / V.L.bandH
    assert.ok(mullionOfHB > 1e-6, `${mullionOfHB}`) // far past the 1e-9 the read is held to
    near(nudge(V.members[0], 'uvOffsetA', 'y', (y) => y + 1e-3, () => nudge(V.members[1], 'uvScaleA', 'y', (y) => y + 1e-4, () => stats().rows.worst)), 0.9e-3 - mullionOfHB, 1e-9)
    // NC: a member drawn 1.2× wide: warped past ε (ln 1.2 against ln 1.15).
    assert.ok(nudge(Q.members[2], 'uvScaleA', 'x', (x) => 1.2 * x, () => stats().warp.worst) > Math.log(1 + UNIT_EPS))
    assert.deepEqual([stats().cols.worst, stats().rows.worst], [0, 0])
    // Only whole V/Q are measured: a torn V (its bottom showing a single) and a quad with a member parked drop out.
    const vBottom = V.members[1].shownAsset
    loadTile(director, V.members[1], { kind: 'video', playbackId: 'stray' })
    Q.members[3].parked = true
    assert.deepEqual([stats().cols.n, stats().rows.n, stats().warp.n], [cols - V.cols - Q.cols, cols - V.cols - Q.cols, members - V.n - Q.n])
    Q.members[3].parked = false
    loadTile(director, V.members[1], vBottom)
    assert.deepEqual([stats().cols.n, stats().warp.n], [cols, members])

    // The tape travels, 0.01 rad a frame with place() after each: south until every V/Q lead is past θS, then north
    // until each is past θN. While a lead is inside [θN, θS] its members are judged for skew and none is skewed
    // (unitSkewBound holds for V and Q, both edges), the columns and mullions stay exact, and the warp stays inside
    // ε. Outside, its members drop out of the skew check while H pairs are judged anywhere (place()'s lead clause),
    // and the warp leaves ε: the window IS the ε bound.
    const { thetaN, thetaS } = director.W
    const inside = (P) => thetaAt(P.members[0]) >= thetaN && thetaAt(P.members[0]) <= thetaS
    const judged = (rule) =>
      panels.filter((p) => {
        const P = p.shownAsset?.place
        if (!P || p._bound !== p.shownAsset || p.parked || !director.wholeUnit(P)) return false
        return !rule || P.rows === 1 || inside(P)
      }).length
    const seen = { inside: 0, south: 0, north: 0 }
    const frame = (d) => {
      shiftRows(panels, d)
      const [rule, anywhere, checks] = [judged(true), judged(false), director.skewChecks]
      director.place()
      assert.equal(director.skewChecks - checks, rule, `d ${d}`)
      const s = stats()
      assert.deepEqual([s.cols.worst, s.rows.worst, s.cols.n, s.warp.n], [0, 0, cols, members], `d ${d}`)
      near(s.warp.worst, warpAll(), 1e-9, `d ${d}`)
      if (tall.every(inside)) {
        seen.inside += 1
        assert.equal(rule, anywhere, `d ${d}`)
        assert.ok(s.warp.worst <= Math.log(1 + UNIT_EPS) + 1e-12, `d ${d}: ${s.warp.worst}`)
      } else if (!tall.some(inside)) {
        seen[thetaAt(tall[0].members[0]) > thetaS ? 'south' : 'north'] += 1
        assert.ok(rule < anywhere && rule > 0, `d ${d}: ${rule} of ${anywhere}`)
        assert.ok(s.warp.worst > Math.log(1 + UNIT_EPS), `d ${d}: ${s.warp.worst}`)
      }
    }
    for (let f = 1; f <= 50; f++) frame(0.01 * f)
    for (let f = 49; f >= -50; f--) frame(0.01 * f)
    assert.deepEqual([director.skewBad, director.unitSnaps], [0, 0])
    assert.ok(seen.inside >= 80 && seen.south >= 1 && seen.north >= 1, JSON.stringify(seen))
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})

/* — Media spans, P6a: a unit joins and leaves its video stream as one, and shows one chip, at its centre (T24, T25;
   T21's and T20's — P6a — lines are above). — */
/** A class tile on the equator at z (vK 1, score z: centerDir (√(1 − z²), 0, z)) showing `asset`, its A window the
 *  whole texture. A scroll tile (canonTop), so the grain gate applies to it. */
function streamTile(asset, z) {
  const v2 = (x, y) => ({ value: new THREE.Vector2(x, y) })
  return {
    asset,
    shownAsset: asset,
    panelAspect: SPAN_L.phiLen / SPAN_L.bandH,
    parked: false,
    swapping: false,
    liveState: null,
    canonTop: 0,
    centerDir: new THREE.Vector3(Math.sqrt(1 - z * z), 0, z),
    mesh: {
      material: {
        uniforms: {
          texA: { value: { userData: { aspect: asset.tex?.aspect ?? 1 } } },
          uvScaleA: v2(1, 1),
          uvOffsetA: v2(0, 0),
          uMix: { value: 0 },
          texB: { value: null },
          uVideoB: { value: 0 },
          uvScaleB: v2(0, 0),
          uvOffsetB: v2(0, 0),
        },
      },
    },
  }
}
/** A unit of class `cls` on `rec` (a classed clip), every member at z: each member its own record (as planUnits
 *  makes them) and its own share of the picture in A, so each member's B is written on its own window. */
function streamUnit(cls, rec, z, lon = 0) {
  const { cols, rows } = UNIT_SHAPE[cls]
  const key = assetKey(rec)
  const P = { uid: `${cls}:${lon}:0:${key}`, key, cls, cols, rows, n: cols * rows, S: unitAspect(cols, rows, SPAN_L), L: SPAN_L, members: [] }
  for (let k = 0; k < P.n; k++) {
    const [kx, ky] = [k % cols, Math.floor(k / cols)]
    const m = streamTile({ ...rec, place: P, kx, ky }, z)
    m.mesh.material.uniforms.uvScaleA.value.set(1 / cols, 1 / rows)
    m.mesh.material.uniforms.uvOffsetA.value.set(kx / cols, ky / rows)
    P.members.push(m)
  }
  return P
}
/** A clip with its class texture (P3's decorate), as the pools carry it. */
const classedClip = (playbackId, videoAspectRatio, u) => {
  const a = { kind: 'video', playbackId, videoAspectRatio }
  return { ...a, u, tex: texSpec(a, u, 512, SPAN_L) }
}
/** Every crossfade on these tiles runs to its end now, so its onComplete fires (the 'live' announce). */
const finishFades = (panels) => {
  for (const p of panels) for (const t of gsap.getTweensOf(p.mesh.material.uniforms.uMix)) t.progress(1)
}
/** A shared-mode scheduler over `panels`. The pool resolves every clip to one 854×480 frame and logs the order the
 *  clips won slots in; `events` logs the label events as `${panel index}:${state}`; beat() is one update a quarter
 *  second on, at the identity pose (a tile's score is its z), then the pool's resolves. */
function sharedOver(panels) {
  const frame = { videoWidth: 854, videoHeight: 480 }
  const pool = {
    assigned: [],
    assign(slot, id) {
      this.assigned.push(id)
      return Promise.resolve(frame)
    },
    releaseSlot() {},
  }
  const events = []
  const sched = new LivePanelScheduler({
    panels,
    assets: [{ playbackId: 'any' }],
    poolHandle: pool,
    textureManager: null,
    onLiveChange: (p, state) => events.push(`${panels.indexOf(p)}:${state}`),
    cycleThumbnails: false,
  })
  sched.setShared(true)
  let now = 10
  const beat = async () => {
    sched.update(new THREE.Euler(), (now += 0.25), null)
    await settleTicks()
  }
  return { sched, pool, events, frame, beat }
}
/** The probe's context for a live-level run (u-desktop's), and the units gates over one hold sample. */
const LIVE_CTX = { key: 'u-desktop', seed: '42', units: 1, level: 'live', mode: 'tides', rm: false, t1: 512, texmb: 96, texpeak: null, record: false, baselines: {}, unitMax: 1 }
const judgeLive = (units) => unitGates({ requests: [], samples: [{ phase: 'hold', step: 0, units }] }, LIVE_CTX)
/** The gate fails for real: false, non-vacuous, and --expect-fail accepts it. */
const failsFor = (g, name) => g.pass[name] === false && g.detail[name].vacuous === false && expectFail({ pass: g.pass, spans: { detail: g.detail } }, [name]).ok

test('spans: joinGroup joins a whole unit or none of it, through its lead; a joint detach by uid frees it together; only the lead announces (T24)', async () => {
  Object.assign(TUNING, POP_DEFAULTS)
  gsap.globalTimeline.pause() // a crossfade ends when finishFades says so, never on the wall clock
  const boards = []
  let director = null
  try {
    const clip = classedClip('clip', '16:9', 'h')
    const quad = classedClip('quad', '1:1', 'q')
    const poleward = new THREE.Vector3(0, 0.95, Math.sqrt(1 - 0.95 ** 2)) // namePinch 0.31: under grainStart 0.45
    const st = (p) => [p.liveState, p.liveStream?.id ?? null, p.liveUid]
    const B = (p) => {
      const u = p.mesh.material.uniforms
      return { s: [u.uvScaleB.value.x, u.uvScaleB.value.y], o: [u.uvOffsetB.value.x, u.uvOffsetB.value.y] }
    }
    const err = (b, w) => Math.max(...[0, 1].flatMap((i) => [Math.abs(b.s[i] - w.s[i]), Math.abs(b.o[i] - w.o[i])]))

    // — A — an H pair on the clip and a quad on another, each clip with a single copy too.
    const H = streamUnit('h', clip, 0.7)
    const Q = streamUnit('q', quad, 0.6, 4)
    const single = streamTile(clip, 0.9)
    const qSingle = streamTile(quad, 0.5)
    const [h0, h1] = H.members
    const [q0, q1, q2, q3] = Q.members
    const panels = [h0, h1, q0, q1, q2, q3, single, qSingle]
    const A = sharedOver(panels)
    boards.push(A)
    const { sched } = A
    // A single joins alone; a unit joins through its lead, all its members; a member alone joins nothing, though
    // it could join on its own.
    assert.deepEqual(sched.joinGroup(single), [single])
    assert.equal(sched.joinGroup(h0), H.members)
    assert.equal(sched.joinGroup(q0), Q.members)
    for (const m of [h1, q1, q2, q3]) assert.deepEqual([sched.canJoin(m), sched.joinGroup(m)], [true, null])
    // One member that can't join keeps its whole unit off (all or none); undone, the unit joins again.
    Object.assign(TUNING, { grainLive: 1, grainAmt: 0.5 })
    const faults = {
      parked: (p) => ((p.parked = true), () => (p.parked = false)),
      'mid-swap': (p) => ((p.swapping = true), () => (p.swapping = false)),
      'on a stream': (p) => ((p.liveState = 'pending'), () => (p.liveState = null)),
      'under the grain': (p) => {
        const was = p.centerDir.clone()
        p.centerDir.copy(poleward)
        return () => p.centerDir.copy(was)
      },
      'bound to another unit': (p) => {
        const was = p.asset
        p.asset = p.shownAsset = { ...was, place: { ...was.place, uid: `q:7:0:${Q.key}` } }
        return () => (p.asset = p.shownAsset = was)
      },
      'bound to a single': (p) => {
        const was = p.asset
        p.asset = p.shownAsset = quad
        return () => (p.asset = p.shownAsset = was)
      },
      'texA on the asset before': (p) => {
        const was = p.shownAsset
        p.shownAsset = quad
        return () => (p.shownAsset = was)
      },
    }
    for (const [name, fault] of Object.entries(faults)) {
      const undo = fault(q3)
      assert.equal(sched.joinGroup(q0), null, name)
      undo()
      assert.equal(sched.joinGroup(q0), Q.members, `${name}, undone`)
    }
    // …on the lead it keeps the unit off too, and on a single, the single.
    for (const name of ['parked', 'mid-swap', 'on a stream', 'under the grain']) {
      for (const p of [q0, single]) {
        const undo = faults[name](p)
        assert.equal(sched.joinGroup(p), null, `${name}: tile ${panels.indexOf(p)}`)
        undo()
      }
    }

    // The first beat: a clip scores its tiles' scores, a unit's once per member (the stream lights them all), so
    // the quad (4 × 0.6 + 0.5 = 2.9) wins its slot before the clip (2 × 0.7 + 0.9 = 2.3); scored once per unit,
    // the clip (1.6) would win first. Every tile joins, each unit under its uid, and each B is liveWindow's, on
    // the tile's own A.
    await A.beat()
    assert.deepEqual(A.pool.assigned, ['quad', 'clip'])
    assert.deepEqual(panels.map(st), [
      ['live', 'clip', H.uid],
      ['live', 'clip', H.uid],
      ...Array(4).fill(['live', 'quad', Q.uid]),
      ['live', 'clip', null],
      ['live', 'quad', null],
    ])
    const clipS = sched.streams.get('clip')
    const ix = (s) => [...s.panels].map((p) => panels.indexOf(p)).sort()
    assert.deepEqual([ix(clipS), ix(sched.streams.get('quad'))], [[0, 1, 6], [2, 3, 4, 5, 7]])
    for (const p of panels) assert.ok(err(B(p), sched.liveWindow(p, A.frame)) <= 1e-12, `tile ${panels.indexOf(p)}`)
    assert.ok(err(B(h0), B(h1)) > 0.1 && err(B(q0), B(q3)) > 0.1) // each member on its own share of the picture
    // One chip per unit: only the lead announces, once its crossfade completes; the singles keep theirs.
    assert.deepEqual(A.events, [])
    finishFades(panels)
    assert.deepEqual([...A.events].sort(), ['0:live', '2:live', '6:live', '7:live'])
    assert.deepEqual(
      panels.map((p) => !!p.liveAnnounced),
      [true, false, true, false, false, false, true, true]
    )

    // A member that leaves takes its unit with it, whichever member and whichever way (detach; dropLive: a
    // swap's dip; notifyContentChange: a recycle). The stream plays on for the single, and the next beat rejoins
    // the unit whole.
    A.events.length = 0
    for (const leave of ['detach', 'dropLive', 'notifyContentChange']) {
      for (const who of [h1, h0]) {
        const at = `${leave}(${panels.indexOf(who)})`
        sched[leave](who)
        for (const m of H.members) {
          assert.deepEqual(st(m), [null, null, null], at)
          assert.deepEqual([m.mesh.material.uniforms.uMix.value, m.mesh.material.uniforms.uVideoB.value], [0, 0], at)
        }
        assert.deepEqual([...clipS.panels], [single], at)
        await A.beat()
        assert.deepEqual(H.members.map(st), [['live', 'clip', H.uid], ['live', 'clip', H.uid]], `${at}: rejoined`)
      }
    }
    // Parked (collapsed past a pole), a member leaves at the next update (updateShared) and takes its unit with it;
    // the unit stays off while that member is parked, and unparked it rejoins whole.
    for (const who of [h1, h0]) {
      const at = `parked(${panels.indexOf(who)})`
      who.parked = true
      await A.beat()
      for (const m of H.members) assert.deepEqual(st(m), [null, null, null], at)
      assert.deepEqual([...clipS.panels], [single], at)
      who.parked = false
      await A.beat()
      assert.deepEqual(H.members.map(st), [['live', 'clip', H.uid], ['live', 'clip', H.uid]], `${at}: rejoined`)
    }
    assert.deepEqual(A.events, ['0:off']) // the unit's one chip went off once (the rejoined unit's fade never ended)
    // A single leaves alone.
    sched.detach(single)
    assert.deepEqual([st(single), st(h0), st(h1)], [[null, null, null], ['live', 'clip', H.uid], ['live', 'clip', H.uid]])
    assert.deepEqual(A.events, ['0:off', '6:off'])
    await A.beat()
    assert.deepEqual(st(single), ['live', 'clip', null])

    // A replan re-binds a member: its unit leaves the stream as one. Bound into another unit (led by a tile off this
    // board), the member never joins through it, and its old partner can't join without it.
    const stranger = streamTile(clip, 0.1)
    const other = { ...H, uid: `h:9:0:${H.key}`, members: [stranger, h1] }
    const rebind = (p, asset) => {
      const was = p.asset
      p.asset = p.shownAsset = asset
      return was
    }
    const h1Rec = rebind(h1, { ...clip, place: other, kx: 1, ky: 0 })
    await A.beat()
    assert.deepEqual([st(h0), st(h1), st(single)], [[null, null, null], [null, null, null], ['live', 'clip', null]])
    rebind(h1, h1Rec)
    await A.beat()
    assert.deepEqual(H.members.map(st), [['live', 'clip', H.uid], ['live', 'clip', H.uid]])
    // Bound to the clip as a single, it leaves its unit and joins alone; bound back, it leaves alone and its unit
    // rejoins whole.
    rebind(h1, clip)
    await A.beat()
    assert.deepEqual([st(h0), st(h1)], [[null, null, null], ['live', 'clip', null]])
    rebind(h1, h1Rec)
    await A.beat()
    assert.deepEqual(H.members.map(st), [['live', 'clip', H.uid], ['live', 'clip', H.uid]])
    // A load in flight re-binds the asset first (texA still shows the record): the unit leaves all the same, at the
    // next update, and its partner can't join without it. The load undone, the unit rejoins whole.
    h1.asset = { ...clip, place: other, kx: 1, ky: 0 }
    await A.beat()
    assert.deepEqual([st(h0), st(h1)], [[null, null, null], [null, null, null]])
    h1.asset = h1Rec
    await A.beat()
    assert.deepEqual(H.members.map(st), [['live', 'clip', H.uid], ['live', 'clip', H.uid]])
    // A single bound into a unit leaves; bound back, it rejoins as a single.
    const sRec = rebind(single, { ...clip, place: { ...other, uid: `h:10:0:${H.key}`, members: [stranger, single] }, kx: 1, ky: 0 })
    await A.beat()
    assert.deepEqual(st(single), [null, null, null])
    rebind(single, sRec)
    await A.beat()
    assert.deepEqual(st(single), ['live', 'clip', null])
    // A single on a clip with no class texture may join while its tile still shows the record it held before (canJoin
    // lets it): it joins as what it is bound to — a single, liveUid null, with its own chip — even when that shown
    // record was a unit member's.
    sched.detach(single)
    const sHeld = rebind(single, { ...clip, place: H, kx: 0, ky: 0 })
    single.asset = { kind: 'video', playbackId: 'clip', videoAspectRatio: '16:9' }
    A.events.length = 0
    await A.beat()
    assert.deepEqual(st(single), ['live', 'clip', null])
    finishFades([single])
    assert.deepEqual(A.events, ['6:live'])
    rebind(single, sHeld)
    // The member count is a factor of the promote score: with the quad's tiles low (4 × 0.2 + 0.2 = 1.0), the clip
    // (2.3) wins its slot first. Added instead (score + members), the quad (4.2 + 1.2 = 5.4) would beat the clip
    // (2.7 + 1.9 = 4.6).
    const Hw = streamUnit('h', clip, 0.7)
    const Qw = streamUnit('q', quad, 0.2, 4)
    const Wb = sharedOver([...Hw.members, ...Qw.members, streamTile(clip, 0.9), streamTile(quad, 0.2)])
    boards.push(Wb)
    await Wb.beat()
    assert.deepEqual(Wb.pool.assigned, ['clip', 'quad'])

    // — B — a quad with one member under the grain stays a still, whole: it neither scores nor joins, while its
    // clip's single plays. Scored per member it would win the first slot (3 × 0.8 + 0.3 = 2.7 against 2.3);
    // joined per member it would play three quarters of its picture.
    const Hb = streamUnit('h', clip, 0.7)
    const Qb = streamUnit('q', quad, 0.8, 4)
    const sB = streamTile(clip, 0.9)
    const qsB = streamTile(quad, 0.3)
    Qb.members[3].centerDir.copy(poleward)
    const b = sharedOver([...Hb.members, ...Qb.members, sB, qsB])
    boards.push(b)
    await b.beat()
    assert.deepEqual(b.pool.assigned, ['clip', 'quad']) // the clip 2 × 0.7 + 0.9 = 2.3; the quad's single alone, 0.3
    await b.beat()
    assert.deepEqual([...Hb.members, ...Qb.members, sB, qsB].map((p) => p.liveState), ['live', 'live', null, null, null, null, 'live', 'live'])
    // NC: joined per member (each member that can, alone), the quad splits: three members play, one stays a still.
    const split = (P) => P.members.some((m) => m.liveStream) && !P.members.every((m) => m.liveStream === P.members[0].liveStream && m.liveUid === P.uid)
    for (const m of Qb.members) if (b.sched.canJoin(m)) b.sched.attach(m, b.sched.streams.get('quad'))
    assert.deepEqual(Qb.members.map((m) => m.liveState), ['live', 'live', 'live', null])
    assert.deepEqual([split(Qb), split(Hb)], [true, false])

    // — C — on the director's board (H pairs; no horizon), every lit unit plays whole on one stream under its uid,
    // with one chip and texB registered, and the live gates pass; each split, they fail.
    const box = {}
    director = unitDirector({}, { getScheduler: () => box.sched }).director
    const tiles = director.panels
    director.initialLayout(director.byProminence())
    const c = sharedOver(tiles)
    boards.push(c)
    box.sched = c.sched
    for (let i = 0; i < 4; i++) await c.beat()
    const units = [...placesOf(tiles).keys()].filter((P) => director.wholeUnit(P))
    const lit = units.filter((P) => P.members.some((m) => m.liveStream))
    assert.ok(lit.length >= 2 && lit.length < 50, `${lit.length} lit of ${units.length}`) // one split unit is over 2%
    for (const P of lit) assert.ok(P.members.every((m) => m.liveState === 'live' && m.liveStream === P.members[0].liveStream && m.liveUid === P.uid), P.uid)
    const litMembers = lit.reduce((n, P) => n + P.n, 0)
    const stats = () => director.unitStats(0)
    assert.deepEqual([stats().liveSplit, stats().registerB, stats().chipsPerUnit], [{ n: lit.length, split: 0 }, { n: litMembers, worst: 0 }, 0])
    finishFades(tiles)
    assert.equal(stats().chipsPerUnit, 1)
    const g = judgeLive(stats())
    assert.deepEqual(
      ['unitLiveSplit', 'chipsPerUnit', 'unitRegisterB'].map((name) => [g.pass[name], g.detail[name].n]),
      [[true, lit.length], [true, lit.length], [true, litMembers]]
    )
    const [P, T] = lit
    const [lead, m1] = P.members
    // NC: a member announcing too: two chips on one unit.
    c.sched.announceLive(m1)
    assert.equal(stats().chipsPerUnit, 2)
    assert.ok(failsFor(judgeLive(stats()), 'chipsPerUnit'))
    c.sched.announceOff(m1)
    // NC: a member joined under no unit or another unit's uid, or on another stream under the unit's uid: the unit is
    // split.
    m1.liveUid = null
    assert.deepEqual(stats().liveSplit, { n: lit.length, split: 1 })
    m1.liveUid = `h:99:0:${P.key}`
    assert.deepEqual(stats().liveSplit, { n: lit.length, split: 1 })
    m1.liveUid = P.uid
    const s0 = lead.liveStream
    m1.liveStream = [...c.sched.streams.values()].find((s) => s !== s0)
    assert.deepEqual(stats().liveSplit, { n: lit.length, split: 1 })
    m1.liveStream = s0
    assert.deepEqual(stats().liveSplit, { n: lit.length, split: 0 })
    // A torn unit (a member re-bound to a single) is not judged: it drops out of every count.
    const tRec = T.members[1].shownAsset
    loadTile(director, T.members[1], { kind: 'video', playbackId: 'stray' })
    assert.deepEqual([stats().liveSplit, stats().registerB.n], [{ n: lit.length - 1, split: 0 }, litMembers - T.n])
    loadTile(director, T.members[1], tRec)
    assert.deepEqual([stats().liveSplit, stats().registerB.n], [{ n: lit.length, split: 0 }, litMembers])
    // NC (T24's): one member mid-swap and the unit joined per member: the unit splits, and unitLiveSplit fails for
    // real. joinGroup refuses the same unit whole.
    c.sched.detach(lead)
    assert.ok(P.members.every((m) => !m.liveStream))
    m1.swapping = true
    assert.equal(c.sched.joinGroup(lead), null)
    for (const m of P.members) if (c.sched.canJoin(m)) c.sched.attach(m, s0)
    assert.deepEqual(stats().liveSplit, { n: lit.length, split: 1 })
    assert.ok(failsFor(judgeLive(stats()), 'unitLiveSplit'), JSON.stringify(judgeLive(stats()).detail.unitLiveSplit))
  } finally {
    for (const { sched } of boards) sched.dispose()
    director?.dispose()
    gsap.globalTimeline.resume()
    Object.assign(TUNING, POP_DEFAULTS)
  }
})

test('spans: the lead carries its unit’s centre for the chip; place() re-derives a live member’s B from this frame’s A, every frame (T25)', () => {
  // Units off: no tile carries a centre, so every chip anchors at its own tile's, as today.
  const { director: plain } = spanDirector(0)
  try {
    plain.initialLayout(plain.byProminence())
    plain.place()
    assert.ok(plain.panels.every((p) => p.unitCentre == null))
  } finally {
    plain.dispose()
  }

  const { director, panels } = unitDirector({}, { getHorizon: () => Math.PI })
  try {
    director.initialLayout(director.byProminence())
    director.place()
    const units = [...placesOf(panels).keys()]
    assert.ok(units.every((P) => director.wholeUnit(P)) && units.some((P) => P.cls === 'h') && units.some((P) => P.cls === 'q'), JSON.stringify(director.placed))
    const sumDir = (P) => P.members.reduce((v, m) => v.add(m.centerDir), new THREE.Vector3()).normalize()
    const centred = (P, msg = P.uid) => near(P.members[0].unitCentre.toArray(), sumDir(P).toArray(), 1e-12, msg)
    // The lead carries unitCentre: the normalized sum of its members' centres, in a vector it keeps (none is
    // allocated per frame). No other tile has one, so its chip anchors at its own centre (HeroLabels.dirOf).
    for (const P of units) {
      centred(P)
      assert.equal(P.members[0].unitCentre, P.members[0]._uc, P.uid)
      // NC: the lead's own centre is not the unit's: it sits half a pitch or more away.
      assert.ok(P.members[0].centerDir.angleTo(P.members[0].unitCentre) > 0.05, P.uid)
    }
    const leads = new Set(units.map((P) => P.members[0]))
    assert.ok(panels.every((p) => leads.has(p) || p.unitCentre == null))
    // An H pair's centre is the bisector: as far from one member as from the other.
    for (const P of units.filter((P) => P.cls === 'h')) {
      const [a, b] = P.members.map((m) => m.centerDir.angleTo(P.members[0].unitCentre))
      near(a, b, 1e-12, P.uid)
    }
    // It follows the rows, frame after frame, in the same vector.
    const kept = units.map((P) => P.members[0]._uc)
    shiftRows(panels, 0.05)
    director.place()
    const whole = units.filter((P) => director.wholeUnit(P))
    assert.ok(whole.length >= units.length - 2, `${whole.length} of ${units.length}`)
    for (const P of whole) centred(P, `${P.uid} after the scroll`)
    units.forEach((P, i) => assert.equal(P.members[0]._uc, kept[i], P.uid))
    // A torn unit has none (its lead's chip falls back to the lead's own centre), nor has one with a member parked;
    // whole again, the next frame gives it back.
    const [P0] = whole
    const [lead0, mem1] = P0.members
    const rec1 = mem1.shownAsset
    loadTile(director, mem1, { kind: 'video', playbackId: 'stray' })
    director.place()
    assert.equal(lead0.unitCentre, null)
    loadTile(director, mem1, rec1)
    director.place()
    centred(P0)
    mem1.parked = true
    director.place()
    assert.equal(lead0.unitCentre, null)
    mem1.parked = false
    director.place()
    centred(P0)
    // A fresh bind clears it (loadTile); the next frame's place() derives it again.
    loadTile(director, lead0, lead0.shownAsset)
    assert.equal(lead0.unitCentre, null)
    director.place()
    centred(P0)
    // Re-bound to a single, the lead keeps none: place() visits only unit records, so the bind alone clears it.
    const rec0 = lead0.shownAsset
    loadTile(director, lead0, { kind: 'video', playbackId: 'stray' })
    director.place()
    assert.equal(lead0.unitCentre, null)
    loadTile(director, lead0, rec0)
    director.place()
    centred(P0)

    // HeroLabels anchors every chip through dirOf (the unit's centre when the tile has one, else its own) at all
    // three reads: the facing test, the pick-time projection and the per-frame anchor. Each read is one whole code
    // line, found once; no code line reads panel.centerDir any more.
    const labels = fs.readFileSync(new URL('../../src/components/hero/HeroLabels.jsx', import.meta.url), 'utf8').split('\n').map((l) => l.trim())
    const once = (match, what) => assert.equal(labels.filter(match).length, 1, what)
    once((l) => l.startsWith('const dirOf = (p) => p.unitCentre || p.centerDir;'), 'dirOf')
    for (const s of [
      'vNormal.copy(dirOf(panel)).transformDirection(f.globeGroup.matrixWorld);',
      'vProj.copy(dirOf(panel)).multiplyScalar(RADIUS);',
      'vAnchor.copy(dirOf(panel)).multiplyScalar(RADIUS);',
    ])
      once((l) => l === s, s)
    assert.deepEqual(labels.filter((l) => l.includes('panel.centerDir') && !l.startsWith('*') && !l.startsWith('//')), [])

    // texB rides texA: on a live or demoting member, place() writes B = liveB(V, aTex, A) from the A it has just
    // written, V the clip's metadata ratio (the decoded frame only when that won't parse), every frame.
    shiftRows(panels, 0)
    director.place()
    const Hc = units.find((P) => P.cls === 'h' && P.key.includes('-h') && director.wholeUnit(P))
    const Qc = units.find((P) => P.cls === 'q' && director.wholeUnit(P))
    assert.ok(Hc && Qc && Hc.members[0].shownAsset.videoAspectRatio === '16:9' && Qc.members[0].shownAsset.videoAspectRatio === '1:1')
    const frames = new Map([
      [Hc, { videoWidth: 854, videoHeight: 480 }],
      [Qc, { videoWidth: 480, videoHeight: 480 }],
    ])
    const lightUp = (P, liveState) => {
      const stream = { video: frames.get(P) } // one stream per unit, as the scheduler's
      for (const m of P.members) Object.assign(m, { liveStream: stream, liveUid: P.uid, liveState })
    }
    lightUp(Hc, 'live')
    lightUp(Qc, 'demoting')
    const litM = [...Hc.members, ...Qc.members]
    const Bof = (p) => {
      const u = p.mesh.material.uniforms
      return [u.uvScaleB.value.x, u.uvScaleB.value.y, u.uvOffsetB.value.x, u.uvOffsetB.value.y]
    }
    const setB = (p, v) => {
      const u = p.mesh.material.uniforms
      u.uvScaleB.value.set(v[0], v[1])
      u.uvOffsetB.value.set(v[2], v[3])
    }
    /** The B a member owes: liveB over the A and the texture aspect its uniforms hold. */
    const owedB = (p, V = pictureAspect(p.shownAsset, p.liveStream.video), aTex = p.mesh.material.uniforms.texA.value.userData.aspect) => {
      const u = p.mesh.material.uniforms
      const b = liveB(V, aTex, { s: [u.uvScaleA.value.x, u.uvScaleA.value.y], o: [u.uvOffsetA.value.x, u.uvOffsetA.value.y] })
      return [...b.s, ...b.o]
    }
    const gap = (x, y) => Math.max(...x.map((v, i) => Math.abs(v - y[i])))
    const SENT = [0.123, 0.456, 0.789, 0.012]
    for (const m of litM) setB(m, SENT)
    director.place()
    for (const m of litM) assert.deepEqual(Bof(m), owedB(m), `${m.shownAsset.place.uid} ${m.liveState}`)
    // Mux's ratio, not the decoded frame: on 854×480 instead of 16:9 the H pair's B would be off by over 1e-5.
    assert.ok(Math.max(...Hc.members.map((m) => gap(Bof(m), owedB(m, 854 / 480)))) > 1e-5)
    assert.deepEqual([director.unitStats(0).liveSplit, director.unitStats(0).registerB], [{ n: 2, split: 0 }, { n: litM.length, worst: 0 }])
    // The rows move: place() re-derives each B from the new A. NC: the B of the frame before misregisters by more
    // than 1e-3, and unitRegisterB fails on it for real; the next place() puts it right.
    const before = new Map(litM.map((m) => [m, Bof(m)]))
    shiftRows(panels, 0.1)
    director.place()
    assert.ok(director.wholeUnit(Hc) && director.wholeUnit(Qc))
    for (const m of litM) assert.deepEqual(Bof(m), owedB(m), `${m.shownAsset.place.uid} after the scroll`)
    const stale = Math.max(...litM.map((m) => gap(before.get(m), owedB(m))))
    assert.ok(stale > 1e-3, `${stale}`)
    for (const m of litM) setB(m, before.get(m))
    const staleB = director.unitStats(0).registerB
    assert.ok(staleB.n === litM.length && staleB.worst > 1e-3, JSON.stringify(staleB))
    assert.ok(failsFor(judgeLive(director.unitStats(0)), 'unitRegisterB'))
    director.place()
    assert.deepEqual(director.unitStats(0).registerB, { n: litM.length, worst: 0 })
    // A 1e-9 dead-band, as A's: B 5e-10 off on one component is left alone; 2e-9 off on any one is rewritten.
    const [hm] = Hc.members
    const owedNow = owedB(hm)
    for (let i = 0; i < 4; i++) {
      for (const [d, kept] of [
        [5e-10, true],
        [2e-9, false],
      ]) {
        const v = [...owedNow]
        v[i] += d
        setB(hm, v)
        director.place()
        assert.deepEqual(Bof(hm), kept ? v : owedNow, `component ${i}, ${d} off`)
      }
    }
    // Only a live or demoting member with a stream that has its <video> is written: a pending one, an idle one, one
    // whose stream has no video yet, one with no stream, a parked one, and a single on a stream keep their B.
    const single = panels.find((p) => !p.shownAsset?.place && p.shownAsset?.playbackId && !p.parked)
    const guards = [
      ['pending', hm, (p) => (p.liveState = 'pending')],
      ['idle', hm, (p) => (p.liveState = null)],
      ['no video yet', hm, (p) => (p.liveStream = { video: null })],
      ['no stream', hm, (p) => (p.liveStream = null)],
      ['parked', hm, (p) => (p.parked = true)],
      ['a single', single, (p) => Object.assign(p, { liveStream: { video: frames.get(Hc) }, liveState: 'live' })],
    ]
    for (const [name, p, fault] of guards) {
      shiftRows(panels, 0.12) // a pose that owes a new B (it re-poses parked too, so the fault comes after it)
      const was = { liveState: p.liveState, liveStream: p.liveStream, parked: p.parked }
      fault(p)
      setB(p, SENT)
      director.place()
      assert.deepEqual(Bof(p), SENT, name)
      Object.assign(p, was)
      shiftRows(panels, 0.1)
      director.place()
    }
    // B reads the bound texture's MEASURED aspect, as A does. Re-measured at 1.8, place() moves A, and B = C ∘ A
    // stays on the picture (texA's crop C = cover(V, aTex) and A's cover(aTex, S) both crop v here, so they compose
    // to cover(V, S) whatever aTex is: B holds to float error, inside its dead-band) and the register reads 0. NC:
    // C on the record's aspect over the new A would be off by more than 1e-4.
    const tex = hm.mesh.material.uniforms.texA.value
    const measured = tex.userData.aspect
    const A0 = windowOf(hm)
    tex.userData.aspect = 1.8
    director.place()
    assert.ok(gap(windowOf(hm), A0) > 1e-3, `A ${windowOf(hm)} vs ${A0}`)
    for (const m of Hc.members) near(Bof(m), owedB(m), 1e-12, 'at 1.8')
    assert.ok(gap(Bof(hm), owedB(hm, undefined, hm.shownAsset.tex.aspect)) > 1e-4)
    assert.deepEqual(director.unitStats(0).registerB, { n: litM.length, worst: 0 })
    tex.userData.aspect = measured
    director.place()

    // unitStats.registerB: over the live members of whole units, |B − liveB(V, aTex, A)| off the uniforms, to 1e-9.
    // A member whose stream has decoded no frame yet is skipped; so is a torn unit; a member 4e-10 off reads 0.
    const qm = Qc.members[3]
    const qs = qm.liveStream
    qm.liveStream = { video: { videoWidth: 0, videoHeight: 0 } }
    assert.equal(director.unitStats(0).registerB.n, litM.length - 1)
    qm.liveStream = qs
    const qRec = Qc.members[1].shownAsset
    loadTile(director, Qc.members[1], { kind: 'video', playbackId: 'stray' })
    assert.deepEqual([director.unitStats(0).liveSplit, director.unitStats(0).registerB], [{ n: 1, split: 0 }, { n: Hc.n, worst: 0 }])
    loadTile(director, Qc.members[1], qRec)
    assert.deepEqual(director.unitStats(0).registerB, { n: litM.length, worst: 0 })
    const v = owedB(hm)
    v[2] += 4e-10
    setB(hm, v)
    assert.equal(director.unitStats(0).registerB.worst, 0)
    v[2] += 2e-9
    setB(hm, v)
    assert.equal(director.unitStats(0).registerB.worst, 2e-9)

    // A member re-dealt to a clip with no class texture may join that clip's stream before its load lands (canJoin
    // lets a single-only asset join while texA still shows the record): it joins as a single, liveUid null, on
    // attach's single cover. place() leaves that B alone while the tile still shows the unit's record, and after the
    // bind; registerB skips it, and the unit counts as split. A copy under another unit's uid is left alone too.
    // NC: the unit's B for that tile (the record's picture through its member window) is another crop, over 0.1 off.
    gsap.globalTimeline.pause() // attach's crossfade never completes here
    const box = {}
    const { director: d } = unitDirector({}, { getScheduler: () => box.sched })
    const c = sharedOver(d.panels)
    box.sched = c.sched
    try {
      d.initialLayout(d.byProminence())
      d.place()
      const Pm = [...placesOf(d.panels).keys()].find((Q) => d.wholeUnit(Q))
      const m = Pm.members[1]
      const video = { videoWidth: 640, videoHeight: 800 }
      const stream = { id: 'bare', slot: 0, state: 'live', texture: { isTexture: true, dispose() {} }, video, panels: new Set(), since: 0, maxDwell: 99 }
      c.sched.streams.set('bare', stream)
      const bare = { kind: 'video', playbackId: 'bare', videoAspectRatio: '4:5' }
      m.asset = bare // loadTile's first step; texA still shows the record while the texture loads
      m.swapping = false // the swap envelope ended before the load did (or the change was a cut)
      assert.deepEqual(c.sched.joinGroup(m), [m])
      c.sched.attach(m, stream)
      const lw = c.sched.liveWindow(m, video)
      const cover = [...lw.s, ...lw.o]
      assert.deepEqual([m.liveUid, Bof(m)], [null, cover])
      d.place()
      assert.deepEqual(Bof(m), cover)
      assert.ok(gap(owedB(m), cover) > 0.1, `${owedB(m)} vs ${cover}`)
      assert.deepEqual([d.unitStats(0).liveSplit, d.unitStats(0).registerB.n], [{ n: 1, split: 1 }, 0])
      m.liveUid = `h:99:0:${Pm.key}` // joined as another unit, its bind landed before the update that frees it
      setB(m, SENT)
      d.place()
      assert.deepEqual(Bof(m), SENT)
      assert.equal(d.unitStats(0).registerB.n, 0)
      m.liveUid = null
      setB(m, cover)
      // The load lands: the tile is a single, place() no longer visits it, and its B is still the single's cover.
      loadTile(d, m, bare)
      d.place()
      assert.deepEqual(Bof(m), cover)
    } finally {
      c.sched.dispose()
      d.dispose()
      gsap.globalTimeline.resume()
    }
  } finally {
    director.dispose()
    TUNING.units = 0
  }
})
