#!/usr/bin/env node
// audit-gate.mjs — the deploy build's CMS gate (netlify.toml [build] command, Nathan 11-23).
// Runs the read-only `cms audit` against production before `astro build` and stops the build on any
// error finding, so a Studio publish that would break a page never replaces the site: Netlify only
// publishes a build that succeeds, and the last good deploy stays live. Nathan publishes text edits in
// Studio, then presses Netlify's Trigger deploy; sessions push as before. Prints the summary and each
// error's check and items (ids, fields, problems), never the full report.
// Needs SANITY_READ_TOKEN (a Viewer token) in the build environment. Mux credentials stay out of it on
// purpose: uploads are verified in session, so the Mux checks run from Sanity's stored statuses here.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { main } from './cms.mjs'

const ARGS = ['audit', '--project-id', 'b60h4u7o', '--dataset', 'production']
const MAX_ITEMS = 10 // per check: enough to find the documents in Studio

export async function gate({ run = main, out = console.log, err = console.error } = {}) {
  let report = null
  let code
  try {
    code = await run(ARGS, { log: (text) => { report = JSON.parse(text) } })
  } catch (error) {
    // The CLI's own rule: a provider message can carry a URL, so it is never echoed.
    err(`CMS audit gate: the audit could not run (${error.message?.includes('https://') ? 'provider error, details suppressed' : error.message}).`)
    code = 1
  }
  if (report) {
    const { errors, warnings, infos } = report.summary
    out(`CMS audit gate: ${errors} errors, ${warnings} warnings, ${infos} info.`)
    for (const f of report.findings.filter((x) => x.severity === 'error')) {
      out(`  ${f.check} (${f.count}): ${f.meaning}`)
      for (const item of f.items.slice(0, MAX_ITEMS)) out(`    ${JSON.stringify(item)}`)
    }
  }
  if (code) err('CMS audit gate: deploy stopped. The site keeps its last good build; fix the error in Studio (or a session) and deploy again.')
  return code
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  gate().then((code) => { process.exitCode = code })
}
