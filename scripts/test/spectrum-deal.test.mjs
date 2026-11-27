// The build-time spectrum deal (US-7, SQ-89): src/lib/spectrumDeal.js hands every featured
// project one palette key by its POSITION in the /featured-projects order (colorScheme.spectrumKeyAt),
// and buildWorldPools carries it onto the home globe's worlds. Pure parts only: the Sanity
// read is the same featuredRoutes list /featured-projects/[slug] builds its pages from.
//   node --test scripts/test/spectrum-deal.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { dealForRoutes } from '../../src/lib/spectrumDeal.js'
import { spectrumKeyAt, SPECTRUM } from '../../src/lib/colorScheme.js'
import { featuredRoutes } from '../../src/lib/projectSlug.js'
import buildWorldPools from '../../src/components/globe/buildWorldPools.js'

const rows = (...slugs) => slugs.map((slug) => ({ slug }))
const SLUGS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']

test('the deal over a stubbed ordered list follows spectrumKeyAt by position', () => {
  const deal = dealForRoutes(rows(...SLUGS))
  SLUGS.forEach((slug, i) => assert.equal(deal[slug], spectrumKeyAt(i), `${slug} at ${i}`))
  assert.ok(Object.values(deal).every((k) => Object.hasOwn(SPECTRUM, k)), 'every key is a palette key')
})

test('a list change at the end does not move the earlier keys', () => {
  const before = dealForRoutes(rows(...SLUGS))
  const longer = dealForRoutes(rows(...SLUGS, 'm', 'n'))
  const shorter = dealForRoutes(rows(...SLUGS.slice(0, 8)))
  for (const slug of SLUGS.slice(0, 8)) {
    assert.equal(longer[slug], before[slug])
    assert.equal(shorter[slug], before[slug])
  }
  assert.equal(longer.n, spectrumKeyAt(13))
})

test('a row with no slug is skipped and takes no position', () => {
  const deal = dealForRoutes([{ slug: 'a' }, { slug: '' }, {}, null, { slug: 'b' }])
  assert.deepEqual(Object.keys(deal), ['a', 'b'])
  assert.equal(deal.a, spectrumKeyAt(0))
  assert.equal(deal.b, spectrumKeyAt(1), 'b is second, not fifth')
  assert.deepEqual(dealForRoutes(undefined), {})
})

test('a repeated slug keeps its first position, and the real list is featuredRoutes', () => {
  const deal = dealForRoutes([{ slug: 'a' }, { slug: 'b' }, { slug: 'a' }, { slug: 'c' }])
  assert.equal(deal.a, spectrumKeyAt(0))
  assert.equal(deal.c, spectrumKeyAt(2))
  // the real list: client + collection filter, derived slug, repeated slug dropped
  const routes = featuredRoutes([
    { slug: 'one', clientSlug: 'x', collection: 'C' },
    { slug: null, clientSlug: 'coco', collection: 'COCO Branding 2026' },
    { slug: 'skip', clientSlug: 'y' }, // no collection: no route, no position
    { slug: 'one', clientSlug: 'x', collection: 'C' },
  ])
  assert.deepEqual(Object.keys(dealForRoutes(routes)), ['one', 'coco-branding-2026'])
})

test('buildWorldPools stamps each world with its key (null when undealt), and works with no deal', () => {
  const project = (slug, clientSlug) => ({
    slug,
    clientSlug,
    collection: 'C',
    clientName: clientSlug,
    projectColor: '#B63947',
    assets: [{ _id: 'a1', mediaType: 'image', imageUrl: 'https://cdn.sanity.io/images/x/y/a-100x100.jpg', imageDimensions: { width: 100, height: 100 } }],
  })
  const worlds = buildWorldPools([project('p1', 'x'), project('p2', 'y')], { p1: 'red' })
  assert.equal(worlds.length, 2)
  assert.equal(worlds[0].spectrum, 'red')
  assert.equal(worlds[1].spectrum, null)
  assert.equal(worlds[0].projectColor, '#B63947', 'projectColor is untouched')
  assert.equal(buildWorldPools([project('p1', 'x')])[0].spectrum, null)
})
