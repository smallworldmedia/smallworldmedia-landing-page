#!/usr/bin/env node
// Retired: videos are finalized within the same scoped CMS run as other media.
import { retiredCmsEntrypoint } from './lib/legacy-cms-guard.mjs'
process.exitCode = retiredCmsEntrypoint('ingest-videos.mjs')
