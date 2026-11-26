import { mkdir, lstat, realpath, open, readFile, rename, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { invariant, digest, canonical } from './contract.mjs'

async function noSymlinkAncestors(directory) {
  let current = path.resolve(directory)
  while (true) {
    try { const st = await lstat(current); invariant(!st.isSymbolicLink(), `State path cannot contain symlinks: ${current}`) } catch (e) { if (e.code !== 'ENOENT') throw e }
    const parent = path.dirname(current); if (parent === current) break; current = parent
  }
}
export function defaultStateRoot(checkout) { return path.join(os.homedir(), '.local/state/swm-cms', digest(path.resolve(checkout)).slice(0,20), 'runs') }
export async function secureDirectory(directory) {
  await noSymlinkAncestors(directory)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const st = await lstat(directory)
  invariant(st.isDirectory() && !st.isSymbolicLink() && (st.mode & 0o077) === 0 && (process.getuid === undefined || st.uid === process.getuid()), `Insecure state directory: ${directory}; require owner-only 0700`)
  return realpath(directory)
}
export async function secureRead(file) {
  await noSymlinkAncestors(path.dirname(file))
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try { const st = await handle.stat(); invariant(st.isFile() && st.nlink === 1 && (st.mode & 0o077) === 0 && (process.getuid === undefined || st.uid === process.getuid()), 'State file requires owner-only 0600 and no hardlinks'); invariant(st.size < 20 * 1024 * 1024, 'State file too large'); return JSON.parse(await handle.readFile('utf8')) } finally { await handle.close() }
}
async function writeAtomic(file, data, exclusive = false) {
  const directory = await secureDirectory(path.dirname(file)), temp = path.join(directory, `.${randomUUID()}.tmp`)
  if (exclusive) {
    const handle = await open(file, 'wx', 0o600)
    try { await handle.writeFile(`${canonical(data)}\n`); await handle.sync() } finally { await handle.close() }
    return
  }
  try { const st = await lstat(file); invariant(st.isFile() && !st.isSymbolicLink() && st.nlink === 1 && (st.mode & 0o077) === 0, 'Insecure journal file') } catch (e) { if (e.code !== 'ENOENT') throw e }
  const handle = await open(temp, 'wx', 0o600)
  try { await handle.writeFile(`${canonical(data)}\n`); await handle.sync() } finally { await handle.close() }
  await rename(temp, file)
  const dir = await open(directory, 'r'); try { await dir.sync() } finally { await dir.close() }
}
export async function checkoutLocked(checkout, fn) {
  // A canonical repository mutex, independent of run ID AND --state-dir. All local
  // worktrees share commondir, so two approved plans cannot concurrently publish
  // distinct random IDs for the same unbound source. Not a cross-machine lock.
  let gitDirectory = path.join(await realpath(checkout), '.git')
  const info = await lstat(gitDirectory)
  invariant(!info.isSymbolicLink(), 'Git state path cannot be a symlink')
  if (info.isFile()) {
    const marker = await readFile(gitDirectory, 'utf8'), match = marker.match(/^gitdir: (.+)\s*$/)
    invariant(match, 'Invalid worktree gitdir marker')
    gitDirectory = await realpath(path.resolve(checkout, match[1].trim()))
    try { gitDirectory = await realpath(path.resolve(gitDirectory, (await readFile(path.join(gitDirectory, 'commondir'), 'utf8')).trim())) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const lockRoot = await secureDirectory(path.join(gitDirectory, 'swm-cms-local'))
  const lock = path.join(lockRoot, 'apply.lock')
  let handle
  try { handle = await open(lock, 'wx', 0o600) } catch (error) { if (error.code === 'EEXIST') throw new Error(`Checkout CMS apply locked; confirm no runner is active before manually removing ${lock}`); throw error }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() })); await handle.sync(); return await fn() } finally { await handle.close(); await unlink(lock) }
}
export class RunStore {
  constructor(root) { this.root = path.resolve(root) }
  dir(id) { invariant(/^[a-f0-9]{64}$/.test(id), 'Invalid run ID'); return path.join(this.root, id) }
  async savePlan(plan) {
    await secureDirectory(this.root); await secureDirectory(this.dir(plan.id))
    const file = path.join(this.dir(plan.id), 'plan.json')
    await writeAtomic(file, plan, true)
    return file
  }
  async readPlan(id) { return secureRead(path.join(this.dir(id), 'plan.json')) }
  async journal(id) { try { return await secureRead(path.join(this.dir(id), 'journal.json')) } catch (e) { if (e.code !== 'ENOENT') throw e; return null } }
  async saveJournal(id, journal) { await writeAtomic(path.join(this.dir(id), 'journal.json'), journal) }
  async locked(id, fn) {
    await secureDirectory(this.root); await secureDirectory(this.dir(id))
    const lockPath = path.join(this.dir(id), 'lock.json')
    let handle
    try { handle = await open(lockPath, 'wx', 0o600) } catch (e) { if (e.code === 'EEXIST') throw new Error(`Run locked; confirm no runner is active before manually removing ${lockPath}`); throw e }
    try { await handle.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() })); await handle.sync(); return await fn() } finally { await handle.close(); await unlink(lockPath) }
  }
}
