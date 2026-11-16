import test from 'node:test'
import assert from 'node:assert/strict'
import { HERO_SET_TYPES, setCanLead, leadsAsSet } from '../../src/lib/setHero.js'

test('a set leads only with its toggle on and a type the hero box holds', () => {
  for (const groupType of HERO_SET_TYPES) {
    assert.equal(setCanLead({ groupType, allowAsHero: true }), true, groupType)
    assert.equal(setCanLead({ groupType, allowAsHero: false }), false, groupType)
    assert.equal(setCanLead({ groupType }), false, `${groupType} with the toggle unset`)
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
