import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFile, writeFile, symlink, mkdir } from 'node:fs/promises'
import { harness, existingMedia, reference, clientDoc } from './helpers.mjs'
import { digest, clean, VERSION } from '../../lib/cms/contract.mjs'
import { validatePlan, preview } from '../../lib/cms/runner.mjs'
import { RunStore } from '../../lib/cms/state.mjs'
import { main } from '../../cms.mjs'
import { parseManifest } from '../../lib/cms/manifest.mjs'

const row = (file,type='static_1x1') => [file,type,'New','','','','']
const rehash = plan => { const {id,...body}=plan; return {...body,id:digest(body)} }
for (const kind of ['image','video']) test(`malformed ${kind} ready journal cannot bypass upload`, async t => {
  const h=await harness(t), file=kind==='image'?'new.jpg':'new.mp4'; await h.file(file)
  const p=await h.plan({manifest:await h.manifest([row(file,kind==='image'?'static_1x1':'motion_1x1')])}), id=p.operations[0].id
  await h.store.saveJournal(p.id,{version:VERSION,planId:p.id,target:p.target,operations:{[id]:{stage:'ready'}}})
  await assert.rejects(h.apply(p),/journal|Journal/)
  assert.equal(h.stats.commits,0); assert.equal(h.stats.images,0); assert.equal(h.stats.uploads,0)
})
test('omitted ordering snapshot and concealed/fabricated preview diff are invalid saved plans', async t => {
  const old=existingMedia('mediaAsset-old'),h=await harness(t,{docs:[old]})
  const p=await h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{orderRank:'0|i00007:',title:'Approved title'}}]})})
  const omitted=rehash({...clean(p),collections:[]}); assert.throws(()=>validatePlan(omitted),/Missing required ordering snapshot/)
  for (const diff of [[],[{field:'title',before:'wrong',after:'looks unchanged'}]]) {
    const bad=clean(p);bad.operations[0].diff=diff;assert.throws(()=>preview(rehash(bad)),/Displayed diff/)
  }
  assert.equal(h.stats.commits,0)
})
for (const corruption of ['errored','deleted','playback','aspect']) test(`cached ready replacement rechecks ${corruption} before resumed commit`, async t => {
  const old=existingMedia('mediaAsset-video',{mediaType:'motion_1x1',video:{_type:'mux.video',asset:reference('muxAsset-old')}}),h=await harness(t,{docs:[old]})
  await h.file('new.mp4');const p=await h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',upload:{file:'new.mp4'}}]})})
  const commit=h.sanity.commit;h.sanity.commit=async()=>{throw Error('commit failed before mutation')}
  await assert.rejects(h.apply(p));h.sanity.commit=commit
  const [assetId,asset]=[...h.assets.entries()][0]
  if(corruption==='errored')asset.status='errored'
  if(corruption==='deleted')h.assets.delete(assetId)
  if(corruption==='playback')asset.playback_ids=[]
  if(corruption==='aspect')asset.aspect_ratio='16:9'
  await assert.rejects(h.apply(p))
  assert.equal(h.stats.commits,0);assert.equal(h.stats.uploads,1);assert.deepEqual(h.db.get(old._id).video,old.video)
})
test('project/client mismatch is rejected before planning and destination client grouping is guarded', async t => {
  const old=existingMedia('mediaAsset-old'),other={...clientDoc,_id:'client-other',_rev:'r-other',slug:{_type:'slug',current:'other'}},project={_id:'project-other',_type:'project',_rev:'r-project',slug:{_type:'slug',current:'other-collection'},client:reference(other._id)}
  const h=await harness(t,{docs:[old,other,project]})
  await assert.rejects(h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{project:reference(project._id)}}]})}),/Project\/client mismatch/)
  const p=await h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{client:reference(other._id)}}]})})
  assert.ok(p.collections.some(c=>c.selector.clientId===other._id))
  h.db.set('mediaAsset-destination',existingMedia('mediaAsset-destination',{client:reference(other._id)}))
  await assert.rejects(h.apply(p),/Ordering\/member/);assert.equal(h.stats.commits,0)
})
test('distinct plans and alternate journal roots share one checkout apply mutex', async t => {
  const h=await harness(t);await h.file('new.jpg');const manifest=await h.manifest([row('new.jpg')])
  const first=await h.plan({manifest}),second=await h.plan({manifest});assert.notEqual(first.id,second.id)
  const alternate=new RunStore(path.join(h.root,'another-state'));await alternate.savePlan(second)
  let release, entered
  const gate=new Promise(resolve=>{release=resolve}),atCommit=new Promise(resolve=>{entered=resolve})
  const commit=h.sanity.commit;h.sanity.commit=async mutations=>{entered();await gate;return commit(mutations)}
  const running=h.apply(first)
  await atCommit
  await assert.rejects(h.apply(second,{store:alternate}),/Checkout CMS apply locked/)
  release();assert.equal((await running).created,1)
  await assert.rejects(h.apply(second,{store:alternate}),/Manifest hash changed/)
  assert.equal(h.stats.images,1);assert.equal(h.stats.commits,1)
})
test('schema changes before preview fail closed without reads or uploads', async t => {
  const h=await harness(t);await h.file('new.jpg');const schema=path.join(h.checkout,'src/schemas/mediaAsset.ts')
  await writeFile(schema,(await readFile(schema,'utf8'))+'\n// schema changed\n')
  await assert.rejects(h.plan({manifest:await h.manifest([row('new.jpg')])}),/Schema drift/)
  assert.equal(h.stats.reads,0);assert.equal(h.stats.images,0)
})
test('legacy aspectRatio accepted as informational without trusting dimensions',()=>{
  const raw='# Collection\nclient: Example\nservices: branding\n| file | mediaType | aspectRatio |\n|---|---|---|\n| new.jpg | static_1x1 | 16:9 |\n'
  assert.equal(parseManifest(raw).assets[0].aspectratio,'16:9')
})
test('mid-batch failure exposes accurate completed/failed/pending report and recovery IDs',async t=>{
  const h=await harness(t);await h.file('one.jpg');await h.file('two.jpg');await h.file('three.jpg')
  const p=await h.plan({manifest:await h.manifest([row('one.jpg'),row('two.jpg'),row('three.jpg')])})
  const upload=h.sanity.uploadImage;h.sanity.uploadImage=async args=>{if(h.stats.images===1)throw Error('second upload interrupted');return upload(args)}
  await assert.rejects(h.apply(p),error=>{
    assert.equal(error.report.created,1);assert.equal(error.report.failed,1);assert.equal(error.report.pending,1);assert.equal(error.report.updated,0);return true
  })
})
test('explicit curation rejects duplicate final ranks; content-only patches preserve invalid legacy ranks',async t=>{
  const old=existingMedia('mediaAsset-old'),other=existingMedia('mediaAsset-other',{orderRank:'0|i00007:'}),h=await harness(t,{docs:[old,other]})
  await assert.rejects(h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{orderRank:other.orderRank}}]})}),/Duplicate orderRanks/)
  h.db.get(old._id).orderRank='legacy-invalid'
  const p=await h.plan({changes:await h.changes({patches:[{id:old._id,type:'mediaAsset',set:{title:'Copy only'}}]})})
  const r=await h.apply(p);assert.equal(r.updated,1);assert.equal(h.db.get(old._id).orderRank,'legacy-invalid')
})
test('CLI success and failure reports include exact safe resume command with checkout and custom journal root',async t=>{
  const h=await harness(t);await h.file('new.jpg');const p=await h.plan({manifest:await h.manifest([row('new.jpg')])})
  const args=['apply','--plan',path.join(h.store.dir(p.id),'plan.json'),'--confirm',p.id,'--checkout',h.checkout,'--state-dir',h.store.root],outputs=[]
  const options={adaptersFactory:async()=>({sanity:h.sanity,mux:h.mux,probe:h.probe}),log:text=>outputs.push(text)}
  const upload=h.sanity.uploadImage;h.sanity.uploadImage=async()=>{throw Error('offline interruption')}
  await assert.rejects(main(args,options),error=>{assert.ok(error.report,error.message);assert.ok(!error.report.resume.includes('<saved-plan-path>'));assert.ok(error.report.resume.includes(`--state-dir '${h.store.root}'`));assert.ok(error.report.resume.includes(`--checkout '${h.checkout}'`));return true})
  // A separate request tests success; uncertain image upload must remain stopped.
  const h2=await harness(t);await h2.file('new.jpg');const p2=await h2.plan({manifest:await h2.manifest([row('new.jpg')])})
  assert.equal(await main(['apply','--plan',path.join(h2.store.dir(p2.id),'plan.json'),'--confirm',p2.id,'--checkout',h2.checkout,'--state-dir',h2.store.root],{adaptersFactory:async()=>({sanity:h2.sanity,mux:h2.mux,probe:h2.probe}),log:text=>outputs.push(text)}),0)
  const r=JSON.parse(outputs.at(-1));assert.ok(r.resume.includes(path.join(h2.store.dir(p2.id),'plan.json')));assert.ok(r.resume.includes(`--state-dir '${h2.store.root}'`))
})
test('state directory symlinks are refused even with secure target permissions',async t=>{
  const h=await harness(t);await h.file('new.jpg');const p=await h.plan({manifest:await h.manifest([row('new.jpg')])})
  const link=path.join(h.root,'state-link');await symlink(h.store.root,link)
  await assert.rejects(new RunStore(link).readPlan(p.id),/symlink/)
})
