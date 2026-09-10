import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { generateManifest, processClient, main } from '../generate-manifests.mjs'
import { parseManifest } from '../lib/cms/manifest.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-generator-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const client = path.join(root, 'Example')
  fs.mkdirSync(client)
  const put = (relative, text = 'fixture') => { const file = path.join(client, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file }
  return { root, client, put }
}

test('scaffolds use current columns, optional blank identities and review placeholders', () => {
  const raw = generateManifest('Example', null, ['clip.mp4'])
  assert.match(raw, /motion_4x3/)
  assert.doesNotMatch(raw, /\| (?:isHero|sortOrder|orderRank) \|/)
  assert.throws(() => parseManifest(raw), /classification/)
  const parsed = parseManifest(raw.replace('| clip.mp4 | TBD | TBD |', '| clip.mp4 | motion_4x3 | promo video |'))
  assert.equal(parsed.mode, 2)
  assert.equal(parsed.assets[0].sanityid, '')
  assert.equal(parsed.assets[0].contentrole, '')
  assert.equal(parsed.assets[0].branddeckorder, '')
})

test('reviewed collection scaffold parses with nested deck fields and no invented rank or ID', () => {
  const raw = generateManifest('Example', 'Branding', ['Deck/page_01.jpg'])
    .replace('services: TBD', 'services: branding')
    .replace('| Deck/page_01.jpg | TBD | page 01 |  |  |  |  |', '| Deck/page_01.jpg | brand-deck | page 01 |  | brand-guidelines | 1 |  |')
  const parsed = parseManifest(raw)
  assert.equal(parsed.assets[0].file, 'Deck/page_01.jpg')
  assert.equal(parsed.assets[0].branddeckorder, '1')
  assert.equal(parsed.assets[0].sanityid, '')
  assert.equal(parsed.assets[0].displaygroup, 'brand-guidelines')
})

test('artwork uses Mode 1, but non-image files still require classification', () => {
  const parsed = parseManifest(generateManifest('Example', 'Artwork', ['cover.jpg']))
  assert.equal(parsed.mode, 1)
  assert.equal(parsed.assets[0].mediatype, 'album-art')
  assert.deepEqual(parsed.header.services, ['album art'])
  assert.throws(() => parseManifest(generateManifest('Example', 'Artwork', ['clip.mp4'])), /classification/)
})

test('nested pages remain relative, numerically ordered, and separately owned collections stay separate', t => {
  const { root, put } = fixture(t)
  put('root.jpg'); put('Branding/Pages/page_10.jpg'); put('Branding/Pages/page_2.jpg')
  put('Branding/source.pdf'); put('Branding/source.psd')
  put('Branding/Owned/_manifest.md', 'preserve nested collection'); put('Branding/Owned/owned.jpg')
  const result = processClient('Example', { mediaDir: root, dryRun: true })
  assert.equal(result.created.length, 2)
  const collection = result.created.find(r => r.path.includes('/Branding/'))
  assert.match(collection.preview, /Pages\/page_2.jpg/)
  assert.ok(collection.preview.indexOf('Pages/page_2.jpg') < collection.preview.indexOf('Pages/page_10.jpg'))
  assert.doesNotMatch(collection.preview, /owned.jpg|source.pdf|source.psd|root.jpg/)
  assert.equal(fs.existsSync(collection.path), false)
})

test('existing bindings remain byte-identical; force is rejected and reruns preserve files', t => {
  const { root, put } = fixture(t)
  const manifest = put('_manifest.md', 'stable sanityId binding\n')
  put('image.jpg'); put('Artwork/cover.jpg')
  const result = processClient('Example', { mediaDir: root })
  assert.equal(result.skipped.length, 1)
  assert.equal(result.created.length, 1)
  assert.equal(fs.readFileSync(manifest, 'utf8'), 'stable sanityId binding\n')
  assert.equal(processClient('Example', { mediaDir: root }).created.length, 0)
  assert.throws(() => processClient('Example', { mediaDir: root, force: true }), /never be overwritten/)
  assert.throws(() => main(['Example', '--force']), /retired/)
})

test('generator rejects path scopes, unsafe markdown names and symlink clients', t => {
  const { root, client, put } = fixture(t)
  assert.throws(() => processClient('../Example', { mediaDir: root }), /one client/)
  assert.throws(() => main(['Example', 'Other']), /exactly one/)
  assert.throws(() => generateManifest('Example', null, ['bad|file.jpg']), /pipes/)
  const outside = put('real.jpg')
  fs.symlinkSync(outside, path.join(client, 'linked.jpg'))
  assert.equal(processClient('Example', { mediaDir: root, dryRun: true }).created[0].files, 1)
  fs.symlinkSync(client, path.join(root, 'Alias'))
  assert.throws(() => processClient('Alias', { mediaDir: root }), /symlink/)
})
