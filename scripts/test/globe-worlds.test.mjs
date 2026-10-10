// Globe-worlds population modes (docs/globe-worlds-plan.md) — the pure
// pieces: buildWorldPools over the real FEATURED_WORLDS_QUERY (groq-js, the
// cms-frontend fixture idiom), worldPatterns' tape layouts, the
// PopulationDirector's assignment, texture ownership and change clock on
// fake panels, and the scheduler's shared streams on a fake video pool.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { parse, evaluate } from 'groq-js'
import { FEATURED_WORLDS_QUERY } from '../../src/lib/queries.js'
import { buildContentFlow } from '../../src/components/work/detail/buildContentFlow.js'
import buildWorldPools, { selectPool, WORLD_POOL_CAP } from '../../src/components/globe/buildWorldPools.js'
import { makePattern, makeField, PATTERNS } from '../../src/components/globe/worldPatterns.js'
import { initialBirth, poseTile, scrollZeroTheta } from '../../src/components/globe/MeridianScroll.js'
import { assetKey } from '../../src/components/globe/TextureManager.js'
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
import { stripAudioFromMaster, AUDIO_CODEC } from '../../src/components/work/hlsVideoOnly.js'
import { videoOnlyLoader } from '../../src/components/work/useHls.js'

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
