#!/usr/bin/env node
// Retired: whole-library ingestion is intentionally unavailable, with any flags.
import { retiredCmsEntrypoint } from './lib/legacy-cms-guard.mjs'
process.exitCode = retiredCmsEntrypoint('ingest-all.mjs')
