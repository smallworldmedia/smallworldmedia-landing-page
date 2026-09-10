/** Pure early gates: do not import clients, load environment files, or inspect media here. */
export function retiredCmsEntrypoint(script, args = process.argv.slice(2)) {
  console.error(`${script} is retired. No files were inspected and no CMS operations were performed.
Use /swm:cms or the scoped runner instead:
  node scripts/cms.mjs plan --manifest <selected/_manifest.md> --project-id <id> --dataset <dataset>
  node scripts/cms.mjs plan --changes <explicit-changes.json> --project-id <id> --dataset <dataset>
Review the saved plan and obtain approval for its dataset, changes, uploads and publication impact before:
  node scripts/cms.mjs apply --plan <saved-plan.json> --confirm <plan-id>
  node scripts/cms.mjs verify --run <run-id>
Video finalization and project references belong to that scoped plan, not separate backfills.
Whole-library ingestion is removed. Legacy arguments are never forwarded.`)
  return args.length === 0 || args.includes('--dry-run') || args.includes('--help') ? 0 : 1
}

/** A separate acknowledgement, never a substitute for editorial approval or a safe CMS plan. */
export function legacyMaintenanceGate(script, args = process.argv.slice(2), {
  writeFlag = '--apply',
  allowedFlags = [],
} = {}) {
  const acknowledgement = `--acknowledge-legacy=${script}:b60h4u7o/production`
  const allowed = new Set(['--legacy-maintenance', acknowledgement, writeFlag, ...allowedFlags])
  const preview = args.includes('--dry-run') || args.includes('--help')
  const permitted = !preview && args.includes('--legacy-maintenance') &&
    args.includes(acknowledgement) && args.includes(writeFlag) &&
    args.every(arg => allowed.has(arg)) && new Set(args).size === args.length
  if (permitted) return { allowed: true, exitCode: 0 }
  console.error(`${script} is maintenance-only historical code, not the CMS workflow.
Stopped before loading credentials, clients or media. No CMS operations were performed.
Use /swm:cms or node scripts/cms.mjs plan --changes <explicit-changes.json> for reviewed, scoped changes.
Historical execution can overwrite published content and does not provide the new runner's conflict or resume safeguards.
Only after separate approval and source review, historical execution requires all of:
  --legacy-maintenance ${acknowledgement} ${writeFlag}
--dry-run and --help always stop here; this is guidance, not a content preview.`)
  return { allowed: false, exitCode: args.length === 0 || preview ? 0 : 1 }
}
