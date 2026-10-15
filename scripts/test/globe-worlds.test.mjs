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
import { parse, evaluate } from 'groq-js'
import { FEATURED_WORLDS_QUERY } from '../../src/lib/queries.js'
import { buildContentFlow } from '../../src/components/work/detail/buildContentFlow.js'
import buildWorldPools, { selectPool, WORLD_POOL_CAP } from '../../src/components/globe/buildWorldPools.js'
import { makePattern, makeField, PATTERNS } from '../../src/components/globe/worldPatterns.js'
import MeridianScroll, { initialBirth, poseTile, scrollZeroTheta } from '../../src/components/globe/MeridianScroll.js'
import TextureManager, { assetKey, computeCoverUv } from '../../src/components/globe/TextureManager.js'
import { loadTile } from '../../src/components/globe/tileSwap.js'
import PopulationDirector from '../../src/components/globe/PopulationDirector.js'
import LivePanelScheduler from '../../src/components/globe/LivePanelScheduler.js'
import { TUNING, POP_DEFAULTS } from '../../src/components/globe/popConfig.js'
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
import { GLOBE_PREVIEW_SECONDS, STREAM_PARAMS } from '../../src/components/globe/globeConfig.js'
import { PREVIEW_SECONDS, DETAIL_MAX_SECONDS, muxStream, wrapAtDetailCap } from '../../src/components/work/imageConfig.js'
import { netReport, owedClip, cover, TICK_S, LOOP_END_S, STALL_MS } from '../lib/netReport.mjs'
import { LEVELS, unitGates, baselineOf, readBaselines, writeBaseline, classifyRequest, expectFail, checkPayload } from '../lib/unitGates.mjs'
import { stripAudioFromMaster, AUDIO_CODEC } from '../../src/components/work/hlsVideoOnly.js'
import { videoOnlyLoader } from '../../src/components/work/useHls.js'
import buildCascadeTimeline, { DELAY_ORDERS } from '../../src/components/globe/cascade.js'
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
  eligibleH,
  eligibleVQ,
} from '../../src/components/globe/unitSpan.js'
import { classOf } from '../../src/components/globe/mediaClass.js'

/* — buildWorldPools over the real query — */
const ref = (_ref) => ({ _type: 'reference', _ref })
const image = { _type: 'image', asset: ref('image-page') }
const video = (id) => ({ _type: 'mux.video', asset: ref(id) })
const base = { _type: 'mediaAsset', client: ref('client-fixture'), project: ref('project-fixture'), sourceManifest: 'Branding' }
const media = (id, rank, fields) => ({ ...base, _id: id, orderRank: rank, title: id, ...fields })
const mux = (id, status = 'ready') => ({ _id: id, _type: 'mux.videoAsset', playbackId: `pb-${id}`, data: { status, aspect_ratio: '16:9' } })
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
  assert.deepEqual(Object.keys(world.assets[0]), ['kind', 'playbackId', 'videoAspectRatio']) // lean props: no ids, no nulls
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
