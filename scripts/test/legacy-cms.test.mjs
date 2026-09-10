import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { legacyMaintenanceGate } from '../lib/legacy-cms-guard.mjs'

const scripts = fileURLToPath(new URL('../', import.meta.url))
const retired = ['ingest.mjs', 'ingest-videos.mjs', 'ingest-all.mjs', 'backfill-project-refs.mjs']
const historical = ['seed.mjs', 'patch-project-data.mjs', 'phase2-setup.mjs',
  'upload-missing-videos.mjs', 'migrate-year-fields.mjs', 'backfill-order-rank.mjs', 'sync-hero-to-rank.mjs']
const writeFlag = script => script === 'sync-hero-to-rank.mjs' ? '--commit' : '--apply'
const ack = script => `--acknowledge-legacy=${script}:b60h4u7o/production`
const approved = script => ['--legacy-maintenance', ack(script), writeFlag(script)]

// Copies have no SDKs, environment file or media. A loader additionally refuses
// EVERY dependency other than the pure guard, including builtins and the CMS runner.
// Thus these smoke tests cannot contact services even if a regression adds imports.
const loader = `import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL && !specifier.endsWith('/lib/legacy-cms-guard.mjs')) {
    console.error('FORBIDDEN_DEPENDENCY', specifier);
    throw new Error('Dependency loaded before legacy early exit');
  }
  return nextResolve(specifier, context);
}});`

function isolatedRun(script, args) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cms-legacy-test-'))
  try {
    mkdirSync(path.join(dir, 'lib'))
    copyFileSync(path.join(scripts, script), path.join(dir, script))
    copyFileSync(path.join(scripts, 'lib/legacy-cms-guard.mjs'), path.join(dir, 'lib/legacy-cms-guard.mjs'))
    const result = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(loader)}`, path.join(dir, script), ...args,
    ], { cwd: dir, encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH || '' } })
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    assert.doesNotMatch(result.stderr, /FORBIDDEN_DEPENDENCY|ERR_MODULE_NOT_FOUND|Missing .*TOKEN/)
    assert.match(result.stderr, /No CMS operations were performed|no CMS operations were performed/)
    assert.match(result.stderr, /scripts\/cms\.mjs/)
    return result
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

for (const script of retired) {
  test(`${script}: guidance-only for no args, preview, help and old write/bulk arguments`, () => {
    for (const args of [[], ['--dry-run'], ['--help'], ['media/Client/_manifest.md', '--dry-run'],
      ['--apply'], ['--skip-upload'], ['--manifest', 'media/Client/_manifest.md'], ['--all'], approved(script)]) {
      const result = isolatedRun(script, args)
      const guidance = args.length === 0 || args.includes('--dry-run') || args.includes('--help')
      assert.equal(result.status, guidance ? 0 : 1, `${script} ${args.join(' ')}`)
      assert.match(result.stderr, /Whole-library ingestion is removed/)
      assert.match(result.stderr, /Legacy arguments are never forwarded/)
    }
  })
}

for (const script of historical) {
  test(`${script}: early maintenance gate blocks defaults, incomplete consent and dry-run conflicts`, () => {
    for (const args of [[], ['--help'], ['--dry-run'], [writeFlag(script)],
      ['--legacy-maintenance', writeFlag(script)], [ack(script), writeFlag(script)],
      ['--legacy-maintenance', ack(script)],
      [...approved(script), '--dry-run'], [...approved(script), '--help'],
      [...approved(script), '--unknown'], [...approved(script), '--dataset', 'staging']]) {
      const result = isolatedRun(script, args)
      const guidance = args.length === 0 || args.includes('--dry-run') || args.includes('--help')
      assert.equal(result.status, guidance ? 0 : 1, `${script} ${args.join(' ')}`)
      assert.match(result.stderr, /maintenance-only historical code/)
      assert.match(result.stderr, /not a content preview/)
    }
  })
}

test('maintenance acknowledgement is script/target-specific and requires a write flag', t => {
  t.mock.method(console, 'error', () => {})
  for (const script of historical) {
    const options = { writeFlag: writeFlag(script) }
    assert.deepEqual(legacyMaintenanceGate(script, approved(script), options), { allowed: true, exitCode: 0 })
    for (const args of [
      ['--legacy-maintenance', ack('another-script.mjs'), writeFlag(script)],
      ['--legacy-maintenance', ack(script).replace('/production', '/staging'), writeFlag(script)],
      [...approved(script), writeFlag(script)],
      [...approved(script), '--dry-run'],
    ]) assert.equal(legacyMaintenanceGate(script, args, options).allowed, false)
  }
  assert.equal(legacyMaintenanceGate('seed.mjs', [...approved('seed.mjs'), '--tags-only'], {
    allowedFlags: ['--tags-only', '--clients-only'],
  }).allowed, true)
})

test('retirement pointers expose no competing legacy pipeline or classifier mandate', () => {
  for (const name of ['add', 'import', 'curate']) {
    const text = readFileSync(path.join(scripts, '../.agent/workflows', `media-${name}.md`), 'utf8')
    assert.match(text, /\/swm:cms/)
    assert.match(text, /retirement pointer/)
    assert.doesNotMatch(text, /turbo-all|mcp_proxima|provider: gemini|node scripts\/(?:ingest|seed|backfill)/i)
  }
})
