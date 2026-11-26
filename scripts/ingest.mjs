#!/usr/bin/env node
// Retired: use a reviewed, scoped CMS plan. Never forward legacy arguments.
import { retiredCmsEntrypoint } from './lib/legacy-cms-guard.mjs'
process.exitCode = retiredCmsEntrypoint('ingest.mjs')
