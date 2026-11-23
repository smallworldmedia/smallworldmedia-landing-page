import test from 'node:test'
import assert from 'node:assert/strict'
import { gate } from '../audit-gate.mjs'

// A stand-in for cms.mjs main: logs a report the way `cms audit` does and returns its exit code.
const runWith = (report) => async (argv, { log }) => {
  assert.deepEqual(argv, ['audit', '--project-id', 'b60h4u7o', '--dataset', 'production'])
  log(JSON.stringify(report, null, 2))
  return report.summary.errors ? 1 : 0
}
const capture = () => {
  const lines = { out: [], err: [] }
  return { lines, out: (s) => lines.out.push(s), err: (s) => lines.err.push(s) }
}

test('a clean audit lets the build run and prints only the summary', async () => {
  const c = capture()
  const report = { summary: { errors: 0, warnings: 26, infos: 462 }, findings: [{ check: 'alt-missing', severity: 'warning', meaning: 'm', count: 12, items: [{ id: 'a' }] }] }
  assert.equal(await gate({ run: runWith(report), out: c.out, err: c.err }), 0)
  assert.deepEqual(c.lines.out, ['CMS audit gate: 0 errors, 26 warnings, 462 info.'])
  assert.deepEqual(c.lines.err, [])
})

test('an error finding stops the build and names the documents (capped at 10)', async () => {
  const c = capture()
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, field: 'projectColor', problem: 'Invalid projectColor' }))
  const report = { summary: { errors: 12, warnings: 0, infos: 0 }, findings: [{ check: 'invalid-value', severity: 'error', meaning: 'A field fails the runner contract.', count: 12, items }] }
  assert.equal(await gate({ run: runWith(report), out: c.out, err: c.err }), 1)
  assert.equal(c.lines.out[1], '  invalid-value (12): A field fails the runner contract.')
  assert.equal(c.lines.out.length, 2 + 10)
  assert.match(c.lines.err.at(-1), /deploy stopped/)
})

test('an audit that cannot run (no token) stops the build; a provider URL is never echoed', async () => {
  const c = capture()
  const noToken = async () => { throw new Error('Invalid SANITY_READ_TOKEN or SANITY_WRITE_TOKEN') }
  assert.equal(await gate({ run: noToken, out: c.out, err: c.err }), 1)
  assert.match(c.lines.err[0], /SANITY_READ_TOKEN/)
  const c2 = capture()
  const provider = async () => { throw new Error('401 at https://b60h4u7o.api.sanity.io/v1/data/query?token=secret') }
  assert.equal(await gate({ run: provider, out: c2.out, err: c2.err }), 1)
  assert.ok(!c2.lines.err.join('\n').includes('https://'))
})
