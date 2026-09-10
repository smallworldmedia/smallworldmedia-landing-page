import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFile, writeFile, symlink, chmod } from 'node:fs/promises'
import { harness, existingMedia, reference, clientDoc, checkout, target } from './helpers.mjs'
import { parseManifest, boundManifest } from '../../lib/cms/manifest.mjs'
import { appendRanks, validatePatch, digest, clean } from '../../lib/cms/contract.mjs'
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
  for (const set of [{isHero:true},{sortOrder:1},{'releaseInfo.releaseTitle':'x'},{description:'not media'},{title:null},{mediaType:'motion_2x3'},{yearStart:2031},{services:[{_ref:'missing'}]}]) assert.throws(() => validatePatch('mediaAsset',set,[]))
  assert.throws(() => validatePatch('mediaAsset',{},['title']))
  assert.throws(() => validatePatch('project',{description:'x'},['description']))
  validatePatch('mediaAsset',{title:'New',releaseInfo:{releaseTitle:'Whole explicit object'}},[])
})
test('ranks append using Studio LexoRank, reject missing/duplicate/invalid ranks', () => {
  assert.ok(appendRanks([{_id:'a',orderRank:'0|hzzzzz:'}],2).every(r => r > '0|hzzzzz:'))
  for (const docs of [[{_id:'a'}],[{_id:'a',orderRank:'junk'}],[{_id:'a',orderRank:'0|hzzzzz:'},{_id:'b',orderRank:'0|hzzzzz:'}]]) assert.throws(() => appendRanks(docs,1))
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
  const h = await harness(t)
  for (const file of ['still.jpg','video.mp4','reel.mov','pages/01.jpg','slides/01.jpg','outside-scope.jpg']) await h.file(file)
  const p = await h.plan({manifest:await h.manifest([row('still.jpg'),row('video.mp4','motion_1x1','Video'),row('reel.mov','featured-project-reel','Reel'),row('pages/01.jpg','brand-deck','Page','','','deck-one','1'),row('slides/01.jpg','carousel-slide','Slide','','','carousel')])})
  const result = await h.apply(p); assert.equal(result.created,5); assert.equal(result.failed,0); assert.equal(h.stats.images,3); assert.equal(h.stats.uploads,2)
  assert.equal(p.operations.length,5)
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
