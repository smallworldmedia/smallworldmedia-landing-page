import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFile, writeFile, symlink, chmod } from 'node:fs/promises'
import { harness, existingMedia, reference, clientDoc, checkout, target } from './helpers.mjs'
import { parseManifest, boundManifest } from '../../lib/cms/manifest.mjs'
import { appendRanks, validatePatch, validateDocument, digest, clean } from '../../lib/cms/contract.mjs'
import { validatePlan, verifyRun } from '../../lib/cms/runner.mjs'
import { main } from '../../cms.mjs'

const row = (file, type = 'static_1x1', title = 'New', id = '', role = '', group = '', page = '') => [file,type,title,id,role,group,page]
test('parser preserves empty middle cells, nested paths and both modes', () => {
  const raw = '# Title\nclient: Example\n| file | mediaType | serviceType | title | contentRole | displayGroup | sortOrder | isHero |\n|---|---|---|---|---|---|---|---|\n| pages/01.jpg | brand-deck | branding | | | deck-one | 1 | false |\n'
  const parsed = parseManifest(raw)
  assert.equal(parsed.mode,2); assert.equal(parsed.assets[0].title,''); assert.equal(parsed.assets[0].displaygroup,'deck-one')
  const bound = boundManifest(raw, {'pages/01.jpg':'mediaAsset-stable'})
  assert.equal(parseManifest(bound).assets[0].sanityid,'mediaAsset-stable')
  assert.equal(parseManifest(raw.replace('client: Example','client: Example\nservices: branding')).mode,1)
})
test('parser rejects placeholders, duplicate rows/columns, unsupported fields and malformed cells', () => {
  const raw = '# Title\nclient: Example\nservices: branding\n| file | mediaType |\n|---|---|\n| x.jpg | static_1x1 |\n'
  for (const bad of [raw.replace('static_1x1','TBD'), raw + '| x.jpg | static_1x1 |\n', raw.replace('mediaType |','mediaType | file |'), raw.replace('mediaType |','unknown |'),raw.replace('| x.jpg |','| x.jpg | extra |')]) assert.throws(() => parseManifest(bad))
})
test('schema allowlist rejects retired fields, dotted patches, invalid values and explicit null', () => {
  for (const set of [{isHero:true},{sortOrder:1},{'releaseInfo.releaseTitle':'x'},{caption:'not a field'},{title:null},{mediaType:'motion_2x3'},{yearStart:2031},{services:[{_ref:'missing'}]}]) assert.throws(() => validatePatch('mediaAsset',set,[]))
  assert.throws(() => validatePatch('mediaAsset',{},['title']))
  assert.throws(() => validatePatch('project',{description:'x'},['description']))
  // project.services left the schema 11-26 (a project's tags are its media's, queries.js PROJECT_SERVICES); media keep theirs.
  const tags = [{ ...reference('serviceTag-branding'), _key: 'branding' }]
  assert.throws(() => validatePatch('project',{services:tags},[])); assert.throws(() => validatePatch('project',{},['services']),/Rejected unset field services/)
  assert.doesNotThrow(() => validatePatch('mediaAsset',{services:tags},[]))
  validatePatch('mediaAsset',{title:'New',releaseInfo:{releaseTitle:'Whole explicit object'}},[])
})
test('ranks append using Studio LexoRank, above a tie too; reject missing/invalid ranks', () => {
  assert.ok(appendRanks([{_id:'a',orderRank:'0|hzzzzz:'}],2).every(r => r > '0|hzzzzz:'))
  // A tie is Studio's to show (Nathan 11-25): it never blocks an append.
  assert.ok(appendRanks([{_id:'a',orderRank:'0|hzzzzz:'},{_id:'b',orderRank:'0|hzzzzz:'}],1)[0] > '0|hzzzzz:')
  for (const docs of [[{_id:'a'}],[{_id:'a',orderRank:'junk'}]]) assert.throws(() => appendRanks(docs,1))
})
test('CLI help and malformed scope do not construct adapters or write', async () => {
  let calls = 0
  const options = { log() {}, adaptersFactory() { calls++; throw Error('unexpected adapter') } }
  assert.equal(await main([],options),0)
  await assert.rejects(main(['plan','--project-id','offline123','--dataset','test'],options),/scope/)
  await assert.rejects(main(['apply'],options),/requires/)
  assert.equal(calls,0)
})
test('preview has zero writes; append applies, verifies, binds IDs; identical second run is no-op', async t => {
  const h = await harness(t); await h.file('new.jpg')
  const manifest = await h.manifest([row('new.jpg')]), p = await h.plan({manifest})
  assert.deepEqual([h.stats.commits,h.stats.images,h.stats.uploads],[0,0,0])
  const result = await h.apply(p); assert.equal(result.created,1); assert.equal(result.failed,0)
  const parsed = parseManifest(await readFile(manifest,'utf8')); assert.equal(parsed.assets[0].sanityid,p.operations[0].id)
  const counts = {...h.stats}; await h.apply(p); assert.equal(h.stats.commits,counts.commits); assert.equal(h.stats.images,counts.images)
  const p2 = await h.plan({manifest}); assert.equal(p2.operations[0].action,'unchanged'); await h.apply(p2)
  assert.equal(h.stats.commits,counts.commits); assert.equal(h.stats.images,counts.images)
  const st = await import('node:fs/promises'); assert.equal((await st.stat(path.join(h.store.dir(p.id),'journal.json'))).mode & 0o777,0o600)
})
test('bound title rename preserves identity slug links release metadata and order; explicit patch preserves unrelated fields', async t => {
  const old = existingMedia('mediaAsset-stable'), h = await harness(t,{docs:[old]})
  await h.file('renamed.jpg')
  const p = await h.plan({manifest:await h.manifest([row('renamed.jpg','static_1x1','Renamed',old._id)])})
  assert.equal(p.operations[0].action,'unchanged'); await h.apply(p); assert.deepEqual(h.db.get(old._id),old)
  const changes = await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{title:'Approved new title'},unset:[]}]})
  const p2 = await h.plan({changes}); const result = await h.apply(p2)
  assert.equal(result.updated,1); const actual = h.db.get(old._id)
  assert.equal(actual.title,'Approved new title'); for (const k of ['slug','image','releaseInfo','orderRank','sourceFolder']) assert.deepEqual(actual[k],old[k])
})
test('new media preserves historic grouping and appends across every project member without changing hero', async t => {
  const project = {_id:'project-example',_type:'project',_rev:'r-project',slug:{_type:'slug',current:'example-collection'},client:reference(clientDoc._id)}
  const old = existingMedia('mediaAsset-stable',{project:reference(project._id)})
  const elsewhere = existingMedia('mediaAsset-elsewhere',{project:reference(project._id),sourceFolder:'/elsewhere',sourceManifest:'Elsewhere',orderRank:'0|i00007:'})
  const h = await harness(t,{docs:[project,old,elsewhere]}); await h.file('old.jpg'); await h.file('new.jpg')
  const p = await h.plan({manifest:await h.manifest([row('old.jpg','static_1x1','Old',old._id),row('new.jpg')])})
  const added = p.operations.find(o => o.action==='create'); assert.equal(added.after.sourceFolder,old.sourceFolder); assert.ok(added.after.orderRank > elsewhere.orderRank)
  await h.apply(p); assert.deepEqual(h.db.get(old._id),old); assert.deepEqual(h.db.get(elsewhere._id),elsewhere)
})
test('a rank shared across two collections, or tied inside one, never blocks an intake: the new row appends above them all', async t => {
  const project = {_id:'project-example',_type:'project',_rev:'r-project',slug:{_type:'slug',current:'example-collection'},client:reference(clientDoc._id)}
  const old = existingMedia('mediaAsset-stable',{project:reference(project._id),orderRank:'0|000001:'})
  const loose = existingMedia('mediaAsset-loose',{orderRank:'0|000002:'})
  const elsewhere = existingMedia('mediaAsset-elsewhere',{project:reference(project._id),sourceFolder:'/elsewhere',sourceManifest:'Elsewhere',orderRank:'0|000002:'})
  const h = await harness(t,{docs:[project,old,loose,elsewhere]}); await h.file('old.jpg'); await h.file('loose.jpg'); await h.file('new.jpg')
  const rows = [row('old.jpg','static_1x1','Old',old._id),row('loose.jpg','static_1x1','Loose',loose._id),row('new.jpg')]
  const p = await h.plan({manifest:await h.manifest(rows)})
  const added = p.operations.find(o => o.action==='create'); assert.equal(added.after.project._ref,project._id); assert.ok(added.after.orderRank > '0|000002:')
  await h.apply(p); assert.equal(h.db.get(elsewhere._id).orderRank,'0|000002:')
  const twin = existingMedia('mediaAsset-twin',{orderRank:'0|000002:'})
  const h2 = await harness(t,{docs:[project,old,loose,twin]}); for (const f of ['old.jpg','loose.jpg','twin.jpg','new.jpg']) await h2.file(f)
  // Cheetah Print, 11-25: a tie from a Studio drag refused the next intake. A tie is Studio's to show (Nathan 11-25), so the intake appends above it and leaves it alone.
  const p2 = await h2.plan({manifest:await h2.manifest([...rows.slice(0,2),row('twin.jpg','static_1x1','Twin',twin._id),row('new.jpg')])})
  assert.ok(p2.operations.find(o => o.action==='create').after.orderRank > '0|000002:')
  await h2.apply(p2); assert.equal(h2.db.get(twin._id).orderRank,'0|000002:'); assert.equal(h2.db.get(loose._id).orderRank,'0|000002:')
})
test('unique legacy match binds only matching client and collection; renamed ambiguous legacy rows block', async t => {
  const old = existingMedia('mediaAsset-example-old'), h = await harness(t,{docs:[old]}); await h.file('old.jpg')
  const p = await h.plan({manifest:await h.manifest([row('old.jpg','static_1x1','Old')])}); assert.equal(p.operations[0].id,old._id)
  await assert.rejects(h.plan({manifest:await h.manifest([row('old.jpg','static_1x1','Renamed')])}),/Unbound new\/renamed/)
})
test('same title belonging to another client is never reused', async t => {
  const other = existingMedia('mediaAsset-other-new',{client:reference('client-other')})
  const h = await harness(t,{docs:[other]}); await h.file('new.jpg')
  const p = await h.plan({manifest:await h.manifest([row('new.jpg')])})
  assert.notEqual(p.operations[0].id,other._id); assert.equal(p.operations[0].action,'create')
})
test('missing source, unsupported PDF, path escapes and external symlinks block before writes', async t => {
  const h = await harness(t); await h.file('x.pdf'); const outside = path.join(h.root,'outside.jpg'); await writeFile(outside,'outside'); await symlink(outside,path.join(h.media,'link.jpg'))
  for (const file of ['missing.jpg','x.pdf','../outside.jpg','link.jpg']) await assert.rejects(h.plan({manifest:await h.manifest([row(file)])}))
  assert.equal(h.stats.images,0); assert.equal(h.stats.commits,0)
})
test('missing service reference blocks without silently dropping tag', async t => {
  const h = await harness(t); await h.file('new.jpg'); h.db.delete('serviceTag-branding')
  await assert.rejects(h.plan({manifest:await h.manifest([row('new.jpg')])}),/Service.*not found/)
  assert.equal(h.stats.images,0)
})
test('a Mode 1 header naming several services cannot stamp them onto a new row: the row needs its own serviceType', async t => {
  const h = await harness(t); await h.file('new.jpg')
  await assert.rejects(h.plan({manifest:await h.manifest([row('new.jpg')],'client: Example\nservices: branding, album art')}),/own serviceType/)
  assert.equal(h.stats.images,0)
  await h.plan({manifest:await h.manifest([row('new.jpg')])}) // one service in the header still stamps
})
test('a Mode 2 manifest (no header services) plans a new row from its own serviceType', async t => {
  const h = await harness(t); await h.file('new.jpg')
  const manifest = await h.manifest([row('new.jpg')])
  await writeFile(manifest, '# Collection\nclient: Example\n\n| file | mediaType | serviceType | title |\n|---|---|---|---|\n| new.jpg | static_1x1 | branding | New |\n')
  const p = await h.plan({manifest})
  assert.equal(p.operations.filter(o => o.action === 'create').length, 1)
})
test('a tag renamed in Studio keeps its slug: a row names it by either, once, and a misspelling is still refused', async t => {
  // Nathan 11-13 renamed 2D Animation to 2D Motion; the slug 2d-animation stays because filters and URLs key on it.
  const motion = { _id: 'serviceTag-2d-animation', _type: 'serviceTag', _rev: 'r-motion', name: '2D Motion', slug: { _type: 'slug', current: '2d-animation' } }
  const h = await harness(t, {docs: [motion]}); await h.file('new.jpg')
  const manifest = await h.manifest([row('new.jpg')])
  const write = cell => writeFile(manifest, `# Collection\nclient: Example\n\n| file | mediaType | serviceType | title |\n|---|---|---|---|\n| new.jpg | static_1x1 | ${cell} | New |\n`)
  for (const cell of ['2D Motion', '2D Animation', '2D Motion, 2D Animation']) {
    await write(cell); const p = await h.plan({manifest})
    assert.deepEqual(p.operations.find(o => o.action === 'create').after.services.map(s => [s._ref, s._key]), [['serviceTag-2d-animation', '2d-animation']], cell)
  }
  await write('2D Moton'); await assert.rejects(h.plan({manifest}), /Service 2d-moton: not found/)
})
for (const conflict of ['source','manifest','revision','draft','member','target','schema']) test(`${conflict} drift blocks apply before upload`, async t => {
  const old = existingMedia('mediaAsset-old'), h = await harness(t,{docs:[old]}); await h.file('old.jpg'); await h.file('new.jpg')
  const manifest = await h.manifest([row('old.jpg','static_1x1','Old',old._id),row('new.jpg')]), p = await h.plan({manifest})
  if (conflict==='source') await h.file('new.jpg','changed')
  if (conflict==='manifest') await writeFile(manifest,(await readFile(manifest,'utf8'))+'changed\n')
  if (conflict==='revision') h.db.get(old._id)._rev='someone-else'
  if (conflict==='draft') h.db.set(`drafts.${old._id}`,{...old,_id:`drafts.${old._id}`})
  if (conflict==='member') h.db.set('mediaAsset-added',existingMedia('mediaAsset-added',{orderRank:'0|i00007:'}))
  if (conflict==='target') h.sanity.target={...target,dataset:'other'}
  if (conflict==='schema') { p.schemaHash='0'.repeat(64); const {id,...rest}=p; p.id=digest(rest); await h.store.savePlan(p) }
  await assert.rejects(h.apply(p)); assert.equal(h.stats.images,0); assert.equal(h.stats.commits,0)
})
test('exact approval and saved-plan matching; tampered patch/plan rejected', async t => {
  const h = await harness(t); await h.file('new.jpg'); const p = await h.plan({manifest:await h.manifest([row('new.jpg')])})
  await assert.rejects(h.apply(p,{confirm:'yes'}),/confirmation/)
  const changed = clean(p); changed.operations[0].set.isHero=true; const {id,...rest}=changed; changed.id=digest(rest)
  assert.throws(() => validatePlan(changed),/Rejected/)
  const extra = {...p,token:'not-a-token'}; assert.throws(() => validatePlan(extra),/Rejected/)
  assert.equal(h.stats.images,0)
})
test('ready images videos reels deck pages and carousel slides scoped to selected files', async t => {
  // A deck page and a carousel slide land on their sets: with no project, the client's own (mediaSet-<client slug>-<key>).
  const clientSet = (key, groupType) => ({ _id: `mediaSet-example-${key}`, _type: 'mediaSet', _rev: `r-${key}`, title: key, slug: { _type: 'slug', current: key }, groupType, allowAsHero: false })
  const h = await harness(t, { docs: [clientSet('deck-one', 'deck'), clientSet('carousel', 'carousel')] })
  for (const file of ['still.jpg','video.mp4','reel.mov','pages/01.jpg','slides/01.jpg','outside-scope.jpg']) await h.file(file)
  const p = await h.plan({manifest:await h.manifest([row('still.jpg'),row('video.mp4','motion_1x1','Video'),row('reel.mov','featured-project-reel','Reel'),row('pages/01.jpg','brand-deck','Page','','','deck-one','1'),row('slides/01.jpg','carousel-slide','Slide','','','carousel')])})
  const result = await h.apply(p); assert.equal(result.created,5); assert.equal(result.failed,0); assert.equal(h.stats.images,3); assert.equal(h.stats.uploads,2)
  assert.equal(p.operations.length,5)
  assert.deepEqual(p.operations.filter(o => o.set.set).map(o => [o.after.title, o.set.set._ref]), [['Page','mediaSet-example-deck-one'],['Slide','mediaSet-example-carousel']])
  const journal = await readFile(path.join(h.store.dir(p.id),'journal.json'),'utf8'); assert.ok(!journal.includes('signed-secret')); assert.ok(!journal.includes('https://'))
})
test('preparing remains pending; resume attaches final ready aspect without a second upload', async t => {
  const h = await harness(t,{videoStatus:'preparing'}); await h.file('video.mp4')
  const p = await h.plan({manifest:await h.manifest([row('video.mp4','motion_1x1')])})
  const result = await h.apply(p); assert.equal(result.pending,1); assert.equal(result.created,0); assert.equal(h.stats.commits,0); assert.equal(h.stats.uploads,1)
  for (const a of h.assets.values()) a.status='ready'
  const resumed = await h.apply(p); assert.equal(resumed.created,1); assert.equal(h.stats.uploads,1); assert.equal(h.stats.puts,1)
})
for (const stage of ['created-upload','uploaded','committed','done']) test(`interruption after ${stage} resumes without duplicate uploads or commits`, async t => {
  const h = await harness(t); await h.file('video.mp4'); const p = await h.plan({manifest:await h.manifest([row('video.mp4','motion_1x1')])})
  await assert.rejects(h.apply(p,{onStage(s){if(s===stage) throw new Error('simulated interruption')}}),/stopped/)
  const report = await h.apply(p); assert.equal(report.created,1); assert.equal(report.failed,0); assert.equal(h.stats.uploads,1); assert.equal(h.stats.commits,1)
})
test('lost upload-creation response reconciles by operation identity; absent result never retries create', async t => {
  const h = await harness(t); await h.file('video.mp4'); const p = await h.plan({manifest:await h.manifest([row('video.mp4','motion_1x1')])})
  const create = h.mux.createUpload; h.mux.createUpload = async args => { await create(args); throw Error('response lost') }
  await assert.rejects(h.apply(p)); h.mux.createUpload=create
  const r = await h.apply(p); assert.equal(r.created,1); assert.equal(h.stats.uploads,1)
  const h2 = await harness(t); await h2.file('video.mp4'); const p2=await h2.plan({manifest:await h2.manifest([row('video.mp4','motion_1x1')])}); h2.mux.createUpload=async()=>{h2.stats.uploads++; throw Error('uncertain')}
  await assert.rejects(h2.apply(p2)); await assert.rejects(h2.apply(p2),/never blindly duplicate/); assert.equal(h2.stats.uploads,1)
})
test('video replacement keeps prior link until ready and writes Mux+link atomically', async t => {
  const old = existingMedia('mediaAsset-video',{mediaType:'motion_1x1',video:{_type:'mux.video',asset:reference('muxAsset-old')}}), h=await harness(t,{docs:[old],videoStatus:'preparing'})
  await h.file('replacement.mp4'); const p=await h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',upload:{file:'replacement.mp4'}}]})})
  const first=await h.apply(p); assert.equal(first.pending,1); assert.deepEqual(h.db.get(old._id).video,old.video)
  for(const a of h.assets.values()) a.status='ready'
  const second=await h.apply(p); assert.equal(second.updated,1); assert.notDeepEqual(h.db.get(old._id).video,old.video); assert.equal(h.stats.commits,1)
})
test('new draft after upload blocks final publication with upload retained', async t => {
  const h=await harness(t); await h.file('video.mp4'); const p=await h.plan({manifest:await h.manifest([row('video.mp4','motion_1x1')])})
  await assert.rejects(h.apply(p,{onStage(stage,op){if(stage==='uploaded')h.db.set(`drafts.${op.id}`,{...op.after,_id:`drafts.${op.id}`,_rev:'draft'})}}),/Draft conflict/)
  assert.equal(h.stats.commits,0); assert.equal(h.stats.uploads,1)
})
test('batch interruption preserves completed first document and resumes remaining', async t => {
  const h=await harness(t); await h.file('one.jpg'); await h.file('two.jpg'); const p=await h.plan({manifest:await h.manifest([row('one.jpg','static_1x1','One'),row('two.jpg','static_1x1','Two')])})
  await assert.rejects(h.apply(p,{onStage(stage){if(stage==='done')throw Error('stop batch')}})); assert.equal(h.stats.commits,1)
  const r=await h.apply(p); assert.equal(r.created,2); assert.equal(h.stats.images,2); assert.equal(h.stats.commits,2)
})
test('uncertain image upload stops safely instead of blindly uploading again', async t => {
  const h=await harness(t); await h.file('new.jpg'); const p=await h.plan({manifest:await h.manifest([row('new.jpg')])}); const upload=h.sanity.uploadImage
  h.sanity.uploadImage=async args=>{await upload(args);throw Error('lost image response')}
  await assert.rejects(h.apply(p)); h.sanity.uploadImage=upload
  await assert.rejects(h.apply(p),/uncertain/); assert.equal(h.stats.images,1)
})
test('verification is read-only and detects final Mux aspect/readiness corruption', async t => {
  const h=await harness(t); await h.file('video.mp4'); const p=await h.plan({manifest:await h.manifest([row('video.mp4','motion_1x1')])}); await h.apply(p)
  const counts={...h.stats}; for(const a of h.assets.values())a.status='preparing'
  const r=await verifyRun({plan:p,journal:await h.store.journal(p.id),sanity:h.sanity,mux:h.mux}); assert.equal(r.failed,1); assert.equal(h.stats.commits,counts.commits); assert.equal(h.stats.uploads,counts.uploads)
})
test('state symlinks/insecure permissions and concurrent run locks are refused', async t => {
  const h=await harness(t); await h.file('new.jpg'); const p=await h.plan({manifest:await h.manifest([row('new.jpg')])})
  await h.store.locked(p.id,async()=>assert.rejects(h.apply(p),/Run locked/))
  const planFile=path.join(h.store.dir(p.id),'plan.json'); await chmod(planFile,0o644); await assert.rejects(h.apply(p),/0600/)
})

test('media descriptors: alt and description patch within their caps; a project blurb stays uncapped', async t => {
  validatePatch('mediaAsset',{alt:'a'.repeat(150),description:'d'.repeat(300)},[])
  validatePatch('project',{description:'b'.repeat(400)},[])
  for (const set of [{alt:'a'.repeat(151)},{description:'d'.repeat(301)},{alt:''},{alt:'  '},{alt:null}]) assert.throws(() => validatePatch('mediaAsset',set,[]))
  const old = existingMedia('mediaAsset-described'), h = await harness(t,{docs:[old]})
  const p = await h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{alt:'Reviewed alt',description:'Reviewed description'},unset:[]}]})})
  assert.deepEqual(p.operations[0].diff.map(d => d.field),['alt','description'])
  const result = await h.apply(p); assert.equal(result.updated,1); assert.equal(result.failed,0)
  const actual = h.db.get(old._id); assert.equal(actual.alt,'Reviewed alt'); assert.equal(actual.description,'Reviewed description'); assert.deepEqual(actual.image,old.image)
})

test('a new service tag and the media tagged with it plan and apply as one change; a malformed tag is refused', async t => {
  const tag = { _id: 'serviceTag-release-packs', _type: 'serviceTag', name: 'Release Packs', slug: { _type: 'slug', current: 'release-packs' }, sortOrder: 45 }
  const services = [{ ...reference(tag._id), _key: 'release-packs' }]
  const old = existingMedia('mediaAsset-tagged'), h = await harness(t,{docs:[old]})
  const p = await h.plan({changes:await h.changes({creates:[tag],patches:[{id:old._id,type:'mediaAsset',set:{services},unset:[]}]})})
  assert.deepEqual(p.operations.map(o => [o.id,o.action]),[[tag._id,'create'],[old._id,'patch']])
  const result = await h.apply(p); assert.equal(result.created,1); assert.equal(result.updated,1); assert.equal(result.failed,0)
  assert.equal(h.db.get(tag._id).name,'Release Packs'); assert.deepEqual(h.db.get(old._id).services,services)
  for (const bad of [{...tag,sortOrder:4.5},{...tag,sortOrder:-1},{...tag,description:'x'},{...tag,name:undefined}]) await assert.rejects(h.plan({changes:await h.changes({creates:[bad]})}))
  await assert.rejects(h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{services:[{...reference('serviceTag-missing'),_key:'missing'}]},unset:[]}]})}),/Unresolved\/wrong-type serviceTag reference/)
})
const muxDoc = (id, fields = {}) => ({ _id: id, _type: 'mux.videoAsset', _rev: 'r-' + id, assetId: 'asset-' + id, playbackId: 'play-' + id, status: 'ready', data: { aspect_ratio: '16:9' }, ...fields })
const muxAsset = (id, status = 'ready') => ({ id: 'asset-' + id, status, playback_ids: [{ id: 'play-' + id, policy: 'public' }], aspect_ratio: '16:9' })
const videoRef = id => ({ _type: 'mux.video', asset: { _type: 'reference', _ref: id, _weak: true } })
const videoMedia = id => existingMedia(id, { mediaType: 'motion_16x9', image: undefined, video: videoRef('mux-wrong') })
test('video rebind points an asset at an existing ready Mux document: guarded, no upload, verified', async t => {
  const old = videoMedia('mediaAsset-rebind'), h = await harness(t,{docs:[old,muxDoc('mux-wrong'),muxDoc('mux-right')]})
  h.assets.set('asset-mux-wrong',muxAsset('mux-wrong')); h.assets.set('asset-mux-right',muxAsset('mux-right'))
  const p = await h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{video:videoRef('mux-right')},unset:[]}]})})
  assert.ok(p.guards.some(g => g.id === 'mux-right' && g.type === 'mux.videoAsset' && g.rev === 'r-mux-right'))
  const result = await h.apply(p); assert.equal(result.updated,1); assert.equal(result.failed,0)
  assert.deepEqual([h.stats.uploads,h.stats.puts,h.stats.images],[0,0,0])
  assert.equal(h.db.get(old._id).video.asset._ref,'mux-right'); assert.ok(h.db.has('mux-wrong'))
})
test('video rebind refuses an unready or wrong-type target, an image asset, an unset, and a Mux asset that stopped being ready', async t => {
  const old = videoMedia('mediaAsset-rebind'), image = existingMedia('mediaAsset-still')
  const h = await harness(t,{docs:[old,image,muxDoc('mux-wrong'),muxDoc('mux-right'),muxDoc('mux-preparing',{status:'preparing'})]})
  const plan = (id, set, unset = []) => h.changes({patches:[{id,type:'mediaAsset',set,unset}]}).then(changes => h.plan({changes}))
  await assert.rejects(plan(old._id,{video:videoRef('mux-preparing')}),/readiness/)
  await assert.rejects(plan(old._id,{video:videoRef(clientDoc._id)}),/readiness/)
  await assert.rejects(plan(image._id,{video:videoRef('mux-right')}),/video mediaType/)
  await assert.rejects(plan(old._id,{},['video']),/unset/)
  assert.throws(() => validatePatch('mediaAsset',{video:{_type:'muxVideo',asset:reference('mux-right')}},[]))
  const p = await plan(old._id,{video:videoRef('mux-right')})
  h.assets.set('asset-mux-right',muxAsset('mux-right','preparing'))
  await assert.rejects(h.apply(p),/Mux readiness/)
  assert.equal(h.db.get(old._id).video.asset._ref,'mux-wrong'); assert.equal(h.stats.commits,0)
})

test('groupType: one of the ten set types on a Set; a piece has no displayGroup / groupType since they left the schema (11-25)', async t => {
  const types = ['album-art','deck','banner','admat','carousel','merch','visuals','live-footage','mockups','flyer-progression']
  for (const groupType of types) validatePatch('mediaSet',{groupType},[])
  for (const set of [{groupType:'sequence'},{groupType:'Album Art'},{groupType:null},{groupType:1},{groupType:'live footage'},{groupType:'mockup'},{groupType:'flyer progression'}]) assert.throws(() => validatePatch('mediaSet',set,[]))
  // On a piece both are unknown fields now: no write, valid value or not, and no unset (nothing holds them).
  for (const groupType of types) assert.throws(() => validatePatch('mediaAsset',{groupType},[]),/Rejected set field: groupType/)
  assert.throws(() => validatePatch('mediaAsset',{displayGroup:'tour-admats'},[]),/Rejected set field: displayGroup/)
  for (const k of ['groupType','displayGroup']) assert.throws(() => validatePatch('mediaAsset',{},[k]),new RegExp(`Rejected unset field ${k}`))
  validatePatch('mediaAsset',{set:reference('mediaSet-example-tour-admats')},[])
  const { _rev, ...created } = existingMedia('mediaAsset-new',{set:reference('mediaSet-x')})
  validateDocument(created,{creation:true})
  assert.throws(() => validateDocument({...created,groupType:'admat'},{creation:true}),/Rejected document field: groupType/)
  assert.throws(() => validateDocument({...created,displayGroup:'tour-admats'},{creation:true}),/Rejected document field: displayGroup/)
  assert.throws(() => validatePatch('project',{groupType:'deck'},[]))
  validateDocument(existingMedia('mediaAsset-cover',{mediaType:'album-art'}))
})

test('a manifest groupType column types a new row\'s set; a bad value, or a type with no set to land on, refuses', async t => {
  const table = rows => `# Collection\nclient: Example\nservices: branding\n\n| file | mediaType | title | displayGroup | groupType | sanityId |\n|---|---|---|---|---|---|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`
  assert.throws(() => parseManifest(table([['a.jpg','static_1x1','A','set-mockups','mockup','']])),/Invalid groupType/)
  const loose = await harness(t); await loose.file('a.jpg')
  await writeFile(path.join(loose.media,'_manifest.md'), table([['a.jpg','static_1x1','A','','admat','']]))
  await assert.rejects(loose.plan({manifest:path.join(loose.media,'_manifest.md')}),/a\.jpg: groupType admat has no set to land on; name its set in displayGroup/)
  assert.equal(loose.stats.commits,0)
  const h = await harness(t); await h.file('a.jpg'); await h.file('b.jpg')
  const manifest = path.join(h.media,'_manifest.md')
  await writeFile(manifest, table([['a.jpg','static_1x1','A','tour-mockups','mockups',''],['b.jpg','static_1x1','B','','','']]))
  const p = await h.plan({manifest})
  // No project: the row's set is the client's, created first with no project; the piece carries only `set`.
  assert.deepEqual(p.operations.map(o => [o.action,o.type,o.id.startsWith('mediaSet-') ? o.id : o.after.title]),[['create','mediaSet','mediaSet-example-tour-mockups'],['create','mediaAsset','A'],['create','mediaAsset','B']])
  assert.deepEqual([p.operations[0].after.groupType, 'project' in p.operations[0].after], ['mockups', false])
  const result = await h.apply(p); assert.equal(result.created,3); assert.equal(result.failed,0)
  const a = h.db.get(p.operations[1].id), b = h.db.get(p.operations[2].id)
  assert.deepEqual([a.set?._ref, a.displayGroup, a.groupType], ['mediaSet-example-tour-mockups', undefined, undefined])
  assert.deepEqual([b.set, b.groupType], [undefined, undefined])
})

test('splitIntoThirds: a boolean flag on video assets only; null and non-booleans are rejected', async t => {
  validatePatch('mediaAsset',{splitIntoThirds:true},[]); validatePatch('mediaAsset',{},['splitIntoThirds'])
  for (const set of [{splitIntoThirds:'yes'},{splitIntoThirds:1},{splitIntoThirds:null}]) assert.throws(() => validatePatch('mediaAsset',set,[]))
  assert.throws(() => validatePatch('project',{splitIntoThirds:true},[]))
  validateDocument(existingMedia('mediaAsset-motion',{mediaType:'motion_16x9',splitIntoThirds:true}))
  assert.throws(() => validateDocument(existingMedia('mediaAsset-still',{splitIntoThirds:true})),/video media only/)
  validateDocument(existingMedia('mediaAsset-still-off',{splitIntoThirds:false}))
})

test('collaborators on a mediaAsset: client refs plan and apply, and the host client stays the piece\'s own', async t => {
  const guest = { _id: 'client-guest', _type: 'client', _rev: 'r-guest', name: 'Guest', slug: { _type: 'slug', current: 'guest' } }
  const old = existingMedia('mediaAsset-feature'), h = await harness(t, { docs: [guest, old] })
  const collaborators = [{ ...reference(guest._id), _key: 'guest' }]
  const p = await h.plan({ changes: await h.changes({ patches: [{ id: old._id, type: 'mediaAsset', set: { collaborators }, unset: [] }] }) })
  assert.ok(p.guards.some(g => g.id === guest._id))
  const result = await h.apply(p); assert.equal(result.updated, 1); assert.equal(result.failed, 0)
  assert.deepEqual(h.db.get(old._id).collaborators, collaborators); assert.equal(h.db.get(old._id).client._ref, clientDoc._id)
  // Unset clears it; the field is optional.
  const cleared = await h.plan({ changes: await h.changes({ patches: [{ id: old._id, type: 'mediaAsset', set: {}, unset: ['collaborators'] }] }) })
  await h.apply(cleared); assert.equal(h.db.get(old._id).collaborators, undefined)
})
test('collaborators refuses a service tag, a missing id, a duplicate key or ref, null, a keyless item, and a non-media owner', async t => {
  const old = existingMedia('mediaAsset-feature'), h = await harness(t, { docs: [old] })
  const planWith = async collaborators => h.plan({ changes: await h.changes({ patches: [{ id: old._id, type: 'mediaAsset', set: { collaborators }, unset: [] }] }) })
  await assert.rejects(planWith([{ ...reference('serviceTag-branding'), _key: 'tag' }]), /Unresolved\/wrong-type client reference/)
  await assert.rejects(planWith([{ ...reference('client-missing'), _key: 'missing' }]), /Unresolved\/wrong-type client reference/)
  assert.throws(() => validatePatch('mediaAsset', { collaborators: [{ ...reference(clientDoc._id), _key: 'a' }, { ...reference('client-other'), _key: 'a' }] }, []), /Duplicate collaborators key/)
  assert.throws(() => validatePatch('mediaAsset', { collaborators: [{ ...reference(clientDoc._id), _key: 'a' }, { ...reference(clientDoc._id), _key: 'b' }] }, []), /Duplicate collaborator reference/)
  assert.throws(() => validatePatch('mediaAsset', { collaborators: null }, []), /Use unset to clear collaborators/)
  assert.throws(() => validatePatch('mediaAsset', { collaborators: [{ ...reference(clientDoc._id) }] }, []), /collaborators\._key/)
  assert.throws(() => validatePatch('project', { collaborators: [] }, []), /Rejected set field: collaborators/)
})

// Nathan 11-24: a type change between an image type and a video type is allowed only as the repair
// that matches the one file the document already carries; every real conversion still stops.
test('a media type may cross image/video only to match the file the document carries', async t => {
  const mux = { _id: 'muxAsset-old', _type: 'mux.videoAsset', assetId: 'asset-old', playbackId: 'play-old', status: 'ready', data: { aspect_ratio: '3:1' } }
  const sting = existingMedia('mediaAsset-sting', { mediaType: 'logo', image: undefined, video: { _type: 'mux.video', asset: reference('muxAsset-old') } })
  const still = existingMedia('mediaAsset-still', { mediaType: 'motion_1x1' })
  const photo = existingMedia('mediaAsset-photo')
  const both = existingMedia('mediaAsset-both', { video: { _type: 'mux.video', asset: reference('muxAsset-old') } })
  const h = await harness(t, { docs: [mux, sting, still, photo, both] })
  const patch = (id, set, extra = {}) => h.changes({ patches: [{ id, type: 'mediaAsset', set, ...extra }] })

  // The repair, both ways: a video typed `logo` back to a motion type, an image typed motion back to static.
  const toVideo = await h.plan({ changes: await patch(sting._id, { mediaType: 'motion_other' }) })
  assert.equal(toVideo.operations[0].after.mediaType, 'motion_other')
  const toImage = await h.plan({ changes: await patch(still._id, { mediaType: 'static_1x1' }) })
  await h.apply(toImage)
  assert.equal(h.db.get(still._id).mediaType, 'static_1x1')

  // Still refused: a type the file can't play, a document with both files, and a change that also touches a file.
  const refused = /kind conversion requires editorial migration/
  await assert.rejects(h.plan({ changes: await patch(photo._id, { mediaType: 'motion_1x1' }) }), refused)
  await assert.rejects(h.plan({ changes: await patch(both._id, { mediaType: 'motion_1x1' }) }), refused)
  await assert.rejects(h.plan({ changes: await patch(sting._id, { mediaType: 'motion_other', video: { _type: 'mux.video', asset: { ...reference('muxAsset-old'), _weak: true } } }) }), refused)
  await h.file('new.mp4')
  await assert.rejects(h.plan({ changes: await patch(photo._id, { mediaType: 'motion_1x1' }, { upload: { file: 'new.mp4' } }) }), refused)
})
