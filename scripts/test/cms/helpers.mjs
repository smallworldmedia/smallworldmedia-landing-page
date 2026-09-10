import { mkdtemp, mkdir, writeFile, rm, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { clean, patched } from '../../lib/cms/contract.mjs'
import { RunStore } from '../../lib/cms/state.mjs'
import { planChanges, applyPlan } from '../../lib/cms/runner.mjs'

export const checkout = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/,'')
export const target = { projectId: 'offline123', dataset: 'test' }
export const clientDoc = { _id: 'client-example', _type: 'client', _rev: 'r-client', name: 'Example', slug: { _type: 'slug', current: 'example' } }
export const tagDoc = { _id: 'serviceTag-branding', _type: 'serviceTag', _rev: 'r-tag', name: 'Branding', slug: { _type: 'slug', current: 'branding' } }
export const reference = id => ({ _type: 'reference', _ref: id })
export function existingMedia(id, fields = {}) { return { _id: id, _type: 'mediaAsset', _rev: 'r-old', title: 'Old title', slug: { _type: 'slug', current: 'old-route' }, mediaType: 'static_1x1', client: reference(clientDoc._id), services: [{ ...reference(tagDoc._id), _key: 'branding' }], sourceFolder: '/historic/dropbox/Collection', sourceManifest: 'Collection', orderRank: '0|hzzzzz:', image: { _type: 'image', asset: reference('image-existing') }, releaseInfo: { releaseArtist: 'Keep me' }, ...fields } }
export async function harness(t, { docs = [], videoStatus = 'ready' } = {}) {
  // macOS os.tmpdir() lives under /var (a symlink); the state guard rejects symlinked paths, so resolve first.
  const base = path.join(await realpath(process.env.CMS_TEST_TMP || os.tmpdir()), 'swm-cms-offline-tests')
  await mkdir(base, { recursive: true })
  const root = await mkdtemp(path.join(base, 'runner-')), media = path.join(root,'Collection')
  await mkdir(media)
  const localCheckout = path.join(root, 'checkout')
  await mkdir(path.join(localCheckout, 'src/schemas'), { recursive: true })
  await mkdir(path.join(localCheckout, '.git'))
  for (const name of ['mediaAsset','project','client','serviceTag']) await writeFile(path.join(localCheckout, 'src/schemas', `${name}.ts`), await readFile(path.join(checkout, 'src/schemas', `${name}.ts`)))
  t.after(() => rm(root, { recursive: true, force: true }))
  const db = new Map([clientDoc, tagDoc, { _id: 'image-existing', _type: 'sanity.imageAsset', metadata: { dimensions: { width: 100, height: 100 } } }, ...docs].map(d => [d._id, clean(d)]))
  const stats = { commits: 0, images: 0, uploads: 0, puts: 0, reads: 0 }, uploads = new Map(), assets = new Map()
  let revision = 0
  const sanity = {
    target,
    async getDocuments(ids) { stats.reads++; return clean(ids.map(id => db.get(id)).filter(Boolean)) },
    async findClients(slug) { return clean([...db.values()].filter(d => d._type === 'client' && d.slug?.current === slug)) },
    async findTags(slugs) { return clean([...db.values()].filter(d => d._type === 'serviceTag' && slugs.includes(d.slug?.current))) },
    async findProjects({clientId,slug}) { return clean([...db.values()].filter(d => d._type === 'project' && d.client?._ref === clientId && d.slug?.current === slug)) },
    async findProjectOrder() { return clean([...db.values()].filter(d => d._type === 'project')) },
    async findCollection({clientId,sourceManifest,projectId}) { return clean([...db.values()].filter(d => d._type === 'mediaAsset' && (projectId ? d.project?._ref === projectId : d.client?._ref === clientId && d.sourceManifest === sourceManifest))) },
    async uploadImage({path: file}) { stats.images++; await readFile(file); const asset = { _id: `image-upload-${stats.images}`, _type: 'sanity.imageAsset', metadata: { dimensions: { width: 100, height: 100 } } }; db.set(asset._id, asset); return clean(asset) },
    async commit(mutations) {
      const next = new Map([...db].map(([id,d]) => [id,clean(d)]))
      for (const mutation of mutations) {
        if (mutation.create) { if (next.has(mutation.create._id)) throw new Error('Create conflict'); next.set(mutation.create._id, { ...clean(mutation.create), _rev: `r-${++revision}` }) }
        else { const p = mutation.patch, d = next.get(p.id); if (d?._rev !== p.ifRevisionID) throw new Error('Revision conflict'); next.set(p.id, { ...patched(d, p.set || {}, p.unset || []), _rev: `r-${++revision}` }) }
      }
      db.clear(); for (const [id,d] of next) db.set(id,d); stats.commits++; return { transactionId: `txn-${stats.commits}` }
    },
  }
  const mux = {
    async createUpload({operationId}) { const id = `upload-${++stats.uploads}`; uploads.set(id, { id, operationId, status: 'waiting', url: 'https://upload.invalid/signed-secret' }); return { id, url: 'https://upload.invalid/signed-secret' } },
    async getUpload(id) { return clean(uploads.get(id)) },
    async findUpload(id) { return clean([...uploads.values()].find(u => u.operationId === id) || null) },
    async putUpload({url,path: file,size}) { if (!url || (await readFile(file)).length !== size) throw new Error('Invalid PUT'); stats.puts++; const u = [...uploads.values()].find(u => !u.asset_id); u.asset_id = `asset-${u.id}`; u.status = 'asset_created'; assets.set(u.asset_id, { id: u.asset_id, status: videoStatus, playback_ids: [{ id: `play-${u.id}`, policy: 'public' }], aspect_ratio: '1:1', duration: 5 }) },
    async getAsset(id) { return clean(assets.get(id)) },
  }
  const probe = async () => ({ width: 100, height: 100, aspectRatio: 1 })
  const store = new RunStore(path.join(root,'private-state'))
  const manifest = async (rows, header = 'client: Example\nservices: branding') => { const file = path.join(media,'_manifest.md'); await writeFile(file, `# Collection\n${header}\n\n| file | mediaType | title | sanityId | contentRole | displayGroup | brandDeckOrder |\n|---|---|---|---|---|---|---|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`); return file }
  const file = async (relative, data = 'offline bytes') => { const p = path.join(media,relative); await mkdir(path.dirname(p), { recursive: true }); await writeFile(p,data); return p }
  const changes = async request => { const p = path.join(media,'changes.json'); await writeFile(p, JSON.stringify({ version: 1, ...request })); return p }
  const plan = async input => { const p = await planChanges({ checkout: localCheckout, target, sanity, probe, ...input }); await store.savePlan(p); return p }
  const apply = (p, extra = {}) => applyPlan({ plan: p, confirm: p.id, checkout: localCheckout, store, sanity, mux, pollAttempts: 1, ...extra })
  return { root, checkout: localCheckout, media, db, stats, sanity, mux, probe, store, manifest, file, changes, plan, apply, uploads, assets }
}
