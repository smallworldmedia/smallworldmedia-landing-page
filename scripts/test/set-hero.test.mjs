import test from 'node:test'
import assert from 'node:assert/strict'
import { HERO_SET_TYPES, setCanLead, leadsAsSet } from '../../src/lib/setHero.js'

test('a set leads only with its toggle on and a type the hero box holds; album art always leads', () => {
  for (const groupType of HERO_SET_TYPES) {
    const always = groupType === 'album-art' // Nathan 11-24: covers lead as the whole set
    assert.equal(setCanLead({ groupType, allowAsHero: true }), true, groupType)
    assert.equal(setCanLead({ groupType, allowAsHero: false }), always, groupType)
    assert.equal(setCanLead({ groupType }), always, `${groupType} with the toggle unset`)
  }
  for (const groupType of ['banner', 'live-footage', undefined, null, 'nonsense']) assert.equal(setCanLead({ groupType, allowAsHero: true }), false, String(groupType))
  assert.equal(setCanLead(null), false)
})

test('a first piece with a Set document follows the toggle; one without keeps the deck-only rule', () => {
  assert.equal(leadsAsSet({ setId: 'mediaSet-a', groupType: 'admat', setAllowsHero: true }), true)
  assert.equal(leadsAsSet({ setId: 'mediaSet-a', groupType: 'admat', setAllowsHero: false }), false)
  assert.equal(leadsAsSet({ setId: 'mediaSet-d', groupType: 'deck', setAllowsHero: false }), false, 'a deck set switched off leads as its first page')
  assert.equal(leadsAsSet({ setId: 'mediaSet-b', groupType: 'banner', setAllowsHero: true }), false)
  // Before the migration: no setId. Only a deck leads, as on the site today; the caller's type wins.
  assert.equal(leadsAsSet({ groupType: 'deck' }), true)
  assert.equal(leadsAsSet({ mediaType: 'brand-deck' }, 'deck'), true, 'an inferred deck type counts')
  assert.equal(leadsAsSet({ groupType: 'admat', setAllowsHero: true }), false, 'no Set document, no toggle')
  assert.equal(leadsAsSet(undefined), false)
})

test('album art leads as its whole set with the toggle off, with or without a Set document (11-24)', () => {
  // COCO Branding 2024-2025: the first piece is a cover whose Set has "Can be the hero" off
  assert.equal(leadsAsSet({ setId: 'mediaSet-coco-art', groupType: 'album-art', setAllowsHero: false }), true)
  assert.equal(leadsAsSet({ setId: 'mediaSet-coco-art', groupType: 'album-art' }), true, 'toggle unset')
  assert.equal(leadsAsSet({ groupType: 'album-art' }), true, 'no Set document yet')
  assert.equal(leadsAsSet({ mediaType: 'album-art' }, 'album-art'), true, 'an inferred album-art type counts')
  // NC: the other types still follow the toggle
  assert.equal(leadsAsSet({ setId: 'mediaSet-m', groupType: 'mockups', setAllowsHero: false }), false)
})
