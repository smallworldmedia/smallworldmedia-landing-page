#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { realpath } from 'node:fs/promises'
import { createAdapters } from './lib/cms/adapters.mjs'
import { planChanges, applyPlan, verifyRun, preview, validatePlan } from './lib/cms/runner.mjs'
import { RunStore, defaultStateRoot, secureRead } from './lib/cms/state.mjs'
import { invariant, same, targetOf } from './lib/cms/contract.mjs'

const HELP = `SWM CMS — preview first, scoped, no implicit production target.
  node scripts/cms.mjs plan --manifest PATH --project-id ID --dataset NAME
  node scripts/cms.mjs plan --changes PATH --project-id ID --dataset NAME
  node scripts/cms.mjs apply --plan PATH --confirm PLAN_ID
  node scripts/cms.mjs verify --run PLAN_ID
Optional: --checkout PATH, --state-dir PATH (owner-only local storage outside synced media).
Changes JSON: {"version":1,"patches":[{"id":"project-example","type":"project","set":{"description":"Reviewed copy"},"unset":[]}],"creates":[],"inspect":[]}
Replacement/repair: add "upload":{"file":"relative/file.mp4"} to a mediaAsset patch.
Sources must stay inside the manifest/request directory. Plans bind target, checkout,
source hashes, schema, revisions and ordering. Approval publishes affected documents
only when no draft exists; never discards drafts or deploys the website.
Credentials: SANITY_READ_TOKEN (or SANITY_WRITE_TOKEN) for authenticated preview;
SANITY_WRITE_TOKEN for apply. MUX_TOKEN_ID/MUX_TOKEN_SECRET only for Mux operations.
Environment variables are read from this process; no hidden target/env-file fallback.
`
const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`
function resumeCommand(plan, checkout, store) {
  return `node ${shellQuote(path.join(checkout, 'scripts/cms.mjs'))} apply --plan ${shellQuote(path.join(store.dir(plan.id), 'plan.json'))} --confirm ${plan.id} --checkout ${shellQuote(checkout)} --state-dir ${shellQuote(store.root)}`
}
function parse(argv) {
  if (!argv.length || ['help','--help','-h'].includes(argv[0])) return { command: 'help', flags: {} }
  const [command, ...args] = argv
  invariant(['plan','apply','verify'].includes(command), 'Unknown operation; use --help')
  const allowed = { plan: ['manifest','changes','project-id','dataset','checkout','state-dir'], apply: ['plan','confirm','checkout','state-dir','project-id','dataset'], verify: ['run','checkout','state-dir','project-id','dataset'] }[command]
  const flags = {}
  for (let i = 0; i < args.length; i += 2) { const key = args[i]?.replace(/^--/, ''); invariant(args[i]?.startsWith('--') && allowed.includes(key) && !Object.hasOwn(flags,key) && args[i+1] && !args[i+1].startsWith('--'), `Invalid/duplicate argument ${args[i]}`); flags[key] = args[i+1] }
  return { command, flags }
}
export async function main(argv = process.argv.slice(2), { env = process.env, log = console.log, adaptersFactory = createAdapters } = {}) {
  const { command, flags } = parse(argv)
  if (command === 'help') { log(HELP); return 0 }
  const checkout = await realpath(path.resolve(flags.checkout || path.join(path.dirname(fileURLToPath(import.meta.url)), '..')))
  const store = new RunStore(flags['state-dir'] || defaultStateRoot(checkout))
  if (command === 'plan') {
    const target = targetOf({ projectId: flags['project-id'], dataset: flags.dataset })
    invariant(Boolean(flags.manifest) !== Boolean(flags.changes), 'Exactly one --manifest or --changes scope required')
    const adapters = await adaptersFactory({ target, env, write: false })
    const plan = await planChanges({ checkout, target, manifest: flags.manifest, changes: flags.changes, ...adapters })
    const file = await store.savePlan(plan)
    log(preview(plan)); log(`Saved plan: ${file}`)
    log(`Apply only after explicit approval: ${resumeCommand(plan, checkout, store)}`)
    return 0
  }
  let plan
  if (command === 'apply') { invariant(flags.plan && flags.confirm, 'apply requires --plan and --confirm'); plan = validatePlan(await secureRead(path.resolve(flags.plan))) }
  else { invariant(flags.run, 'verify requires --run'); plan = validatePlan(await store.readPlan(flags.run)) }
  invariant(checkout === plan.checkout, 'Checkout differs from saved plan')
  invariant(!(flags['project-id'] || flags.dataset) || same(targetOf({ projectId: flags['project-id'], dataset: flags.dataset }), plan.target), 'Target override differs from saved plan')
  if (command === 'apply') invariant(flags.confirm === plan.id, 'Exact saved-plan confirmation required')
  const adapters = await adaptersFactory({ target: plan.target, env, write: command === 'apply' })
  let report
  try {
    report = command === 'apply'
      ? await applyPlan({ plan, confirm: flags.confirm, checkout, store, ...adapters })
      : await verifyRun({ plan, journal: await store.journal(plan.id), ...adapters })
  } catch (error) {
    if (error.report) error.report.resume = resumeCommand(plan, checkout, store)
    throw error
  }
  report.resume = resumeCommand(plan, checkout, store)
  log(JSON.stringify(report, null, 2))
  return report.failed || report.pending ? 1 : 0
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code }).catch(error => { if (error.report) console.error(JSON.stringify(error.report, null, 2)); console.error(`CMS stopped: ${error.message?.includes('https://') ? 'Provider error (details suppressed).' : error.message}`); process.exitCode = 1 })
}
