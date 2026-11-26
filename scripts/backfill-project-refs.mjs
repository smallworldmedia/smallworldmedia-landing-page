#!/usr/bin/env node
// Retired: project references are explicit changes in a scoped CMS plan.
import { retiredCmsEntrypoint } from './lib/legacy-cms-guard.mjs'
process.exitCode = retiredCmsEntrypoint('backfill-project-refs.mjs')
