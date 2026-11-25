// SQ-143: a Set page's member link (an edit intent for a mediaAsset) must open with the mediaAsset
// form, not under "Featured Projects (drag to order)" with the Project form.
//   node --test scripts/test/studio-intent-routing.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { typeOnlyIntent, intentSchemaType, narrowListItemIntents } from '../../src/studio/intentRouting.js'

// The root items in sanity.config.ts order that can claim an intent. A documentTypeListItem
// claims its own type (Sanity's defaultIntentChecker); the orderable list ships () => true.
const claimsAll = () => true
const structure = (orderableChecker) => [
  { schemaType: 'project', canHandleIntent: orderableChecker }, // Featured Projects (drag to order)
  { schemaType: 'project', canHandleIntent: typeOnlyIntent('project') }, // All Projects
  { schemaType: 'mediaAsset', canHandleIntent: typeOnlyIntent('mediaAsset') }, // Media Assets
  { schemaType: 'mediaSet', canHandleIntent: typeOnlyIntent('mediaSet') }, // Sets
]

const member = { id: 'mediaAsset-coco-visuals-1', type: 'mediaAsset' } // a Set page's IntentLink params
const project = { id: 'project-coco-pre-2026', type: 'project' }
const set = { id: 'mediaSet-coco-visuals-2024-live', type: 'mediaSet' }

test('before the fix the shipped orderable checker routes a set member to the Project form', () => {
  assert.equal(intentSchemaType(structure(claimsAll), 'edit', member), 'project')
})

test('narrowed orderable list: member -> mediaAsset, project -> project, set -> mediaSet', () => {
  const panes = structure(typeOnlyIntent('project'))
  assert.equal(intentSchemaType(panes, 'edit', member), 'mediaAsset')
  assert.equal(intentSchemaType(panes, 'edit', project), 'project')
  assert.equal(intentSchemaType(panes, 'edit', set), 'mediaSet')
})

test('typeOnlyIntent keeps the list\'s "Create new Project" and ignores other intents', () => {
  const check = typeOnlyIntent('project')
  assert.equal(check('create', { type: 'project' }), true)
  assert.equal(check('create', { type: 'mediaAsset' }), false)
  assert.equal(check('inspect', { type: 'project' }), false)
})

test('no claiming pane falls back to the intent\'s own type', () => {
  assert.equal(intentSchemaType([], 'edit', member), 'mediaAsset')
})

// What orderableDocumentListDeskItem (@sanity/orderable-document-list 2.0.4) returns: a list item
// ALREADY serialized, so a plain object with no builder methods; its child is a serialized
// documentTypeList re-typed as a component pane. The first SQ-143 cut called .child()/.getChild()
// on it and the structure tool crashed on load (11-24).
const OrderableDocumentList = () => null
const serializedOrderableItem = () => ({
  type: 'listItem',
  id: 'orderable-project',
  title: 'Featured Projects (drag to order)',
  schemaType: 'project',
  child: {
    type: 'component',
    id: 'project',
    schemaTypeName: 'project',
    canHandleIntent: claimsAll,
    __preserveInstance: true,
    key: 'orderable-project',
    component: OrderableDocumentList,
    options: { type: 'project', filter: 'isFeatured == true' },
    menuItems: [{ title: 'Create new Project' }, { title: 'Reset Order' }],
  },
})

test('narrowListItemIntents takes the plugin\'s plain serialized item (no builder methods)', () => {
  const item = serializedOrderableItem()
  assert.equal(typeof item.child, 'object')
  assert.equal(item.getChild, undefined)
  const narrowed = narrowListItemIntents(item, 'project')
  assert.equal(narrowed.child.canHandleIntent('edit', member), false)
  assert.equal(narrowed.child.canHandleIntent('edit', project), true)
  assert.equal(narrowed.child.canHandleIntent('create', { type: 'project' }), true)
})

test('narrowListItemIntents keeps every other field of the item and its pane, and copies', () => {
  const item = serializedOrderableItem()
  const narrowed = narrowListItemIntents(item, 'project')
  const { canHandleIntent: _a, ...childRest } = narrowed.child
  const { canHandleIntent: _b, ...origRest } = item.child
  assert.deepEqual(childRest, origRest)
  assert.deepEqual({ ...narrowed, child: null }, { ...item, child: null })
  assert.equal(item.child.canHandleIntent, claimsAll) // the input is not mutated
})
