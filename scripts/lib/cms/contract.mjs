import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import lexo from 'lexorank'

export const VERSION = 1
// Deliberately fail closed on schema edits, including changes made BEFORE preview.
// Review this allowlist/validation contract, then refresh the fingerprint with schemaHash().
export const SUPPORTED_SCHEMA_HASH = '40a66d7d407bdea0992b7a3d34ce6bf4dca5c28d0231a37d33e88bb12a927283'
export const PUBLICATION = 'Published documents only; affected drafts block. No site deployment.'
export const NO_EDIT_WINDOW = 'Keep the affected Studio collection closed to edits during apply. Draft/member absence cannot be locked atomically; immediate rechecks and verification are not cross-editor atomicity.'
export const MEDIA_TYPES = ['album-art', 'logo', 'featured-project-reel', 'brand-deck', 'carousel-slide', ...['1x1','3x4','4x5','9x16','16x9','other'].map(x => `static_${x}`), ...['1x1','3x4','4x3','4x5','9x16','16x9','other'].map(x => `motion_${x}`)]
export const isVideoType = type => type?.startsWith('motion_') || type === 'featured-project-reel'
export const clean = x => JSON.parse(JSON.stringify(x))
export function invariant(condition, message) { if (!condition) throw new Error(message) }
export function object(value, label = 'object') { invariant(value && typeof value === 'object' && !Array.isArray(value), `Invalid ${label}`) }
export function keys(value, allowed, label) { object(value, label); for (const k of Object.keys(value)) invariant(allowed.includes(k), `Rejected ${label} field: ${k}`) }
export function canonical(value) { return JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v) }
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex')
export const same = (a, b) => canonical(a ?? null) === canonical(b ?? null)
export function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(id) && !id.startsWith('drafts.') && !id.startsWith('versions.') }
export function targetOf(target) { keys(target, ['projectId', 'dataset'], 'target'); invariant(/^[a-z0-9]+$/.test(target.projectId || '') && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(target.dataset || ''), 'Explicit projectId and dataset required'); return clean(target) }
export function validRank(value) { try { return typeof value === 'string' && /^[012]\|[0-9a-z]+:[0-9a-z]*$/.test(value) && lexo.LexoRank.parse(value).toString() === value } catch { return false } }
export function appendRanks(docs, count) {
  for (const d of docs) invariant(validRank(d.orderRank), `Missing/invalid orderRank on ${d._id}; request explicit curation first`)
  const ranks = docs.map(d => d.orderRank).sort()
  invariant(new Set(ranks).size === ranks.length, 'Duplicate orderRanks; request explicit curation first')
  let last = ranks.at(-1), result = []
  for (let i = 0; i < count; i++) { const next = last ? lexo.LexoRank.parse(last).genNext().toString() : lexo.LexoRank.middle().toString(); invariant(!last || next > last, 'Cannot append rank; explicit curation needed'); result.push(next); last = next }
  return result
}
const common = ['slug','yearStart','yearEnd','isOngoing','services']
export const FIELDS = {
  mediaAsset: ['title',...common,'mediaType','client','project','releaseInfo','brandDeckOrder','contentRole','displayGroup','orderRank'],
  project: ['title',...common,'client','description','isFeatured','projectColor','projectColorSecondary','orderRank'],
  client: ['name','slug','clientType','city','country','affiliations','links'],
}
const required = { mediaAsset: ['title','slug','mediaType','client'], project: ['slug','client'], client: ['name','slug'] }
const text = (v, label) => invariant(typeof v === 'string' && v.trim().length > 0, `Invalid ${label}`)
const number = (v, label) => invariant(typeof v === 'number' && Number.isFinite(v), `Invalid ${label}`)
const enumValue = (v, values, label) => invariant(values.includes(v), `Invalid ${label}: ${v}`)
function url(v) { text(v, 'URL'); let parsed; try { parsed = new URL(v) } catch {} invariant(parsed && ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password, 'URL must be http(s) without credentials') }
function array(v, label) { invariant(Array.isArray(v), `Invalid ${label}`); const seen = new Set(); for (const item of v) { object(item, label); text(item._key, `${label}._key`); invariant(!seen.has(item._key), `Duplicate ${label} key`); seen.add(item._key) } }
export function reference(v, arrayItem = false) { keys(v, arrayItem ? ['_type','_ref','_key'] : ['_type','_ref'], 'reference'); invariant(v._type === 'reference' && validId(v._ref), 'Invalid published reference') }
function links(v, platforms) { array(v, 'links'); for (const item of v) { keys(item, ['_key','_type','platform','url'], 'link'); if (item._type !== undefined) invariant(item._type === 'object', 'Invalid link type'); if (item.platform !== undefined) enumValue(item.platform, platforms, 'platform'); url(item.url) } }
export function validateField(field, v) {
  invariant(v !== null && v !== undefined, `Use unset to clear ${field}, not null`)
  if (['title','name','description','city','country','displayGroup'].includes(field)) { text(v, field); return }
  if (['projectColor','projectColorSecondary'].includes(field)) { invariant(/^#[0-9a-f]{6}$/i.test(v), `Invalid ${field}`); return }
  if (field === 'slug') { keys(v, ['_type','current'], 'slug'); invariant(v._type === 'slug' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.current), 'Invalid slug'); return }
  if (['yearStart','yearEnd'].includes(field)) { number(v, field); invariant(Number.isInteger(v) && v >= 2015 && v <= 2030, `Invalid ${field}`); return }
  if (field === 'brandDeckOrder') { number(v, field); invariant(Number.isInteger(v) && v >= 1, 'Invalid brandDeckOrder'); return }
  if (['isOngoing','isFeatured'].includes(field)) { invariant(typeof v === 'boolean', `Invalid ${field}`); return }
  if (field === 'mediaType') return enumValue(v, MEDIA_TYPES, field)
  if (field === 'contentRole') return enumValue(v, ['process','supporting'], field)
  if (field === 'clientType') return enumValue(v, ['artist','label','management','promoter-event'], field)
  if (field === 'orderRank') { invariant(validRank(v), 'Invalid orderRank'); return }
  if (['client','project'].includes(field)) return reference(v)
  if (field === 'services') { array(v, field); for (const r of v) reference(r, true); invariant(new Set(v.map(r => r._ref)).size === v.length, 'Duplicate service reference'); return }
  if (field === 'links') return links(v, ['Website','Instagram','Spotify','SoundCloud','Apple Music','Beatport','Bandcamp','YouTube','Facebook','TikTok','Resident Advisor','Other'])
  if (field === 'affiliations') { array(v, field); for (const a of v) { keys(a, ['_key','_type','entity','relationship'], 'affiliation'); if (a._type !== undefined) invariant(a._type === 'object', 'Invalid affiliation type'); reference(a.entity); if (a.relationship !== undefined) enumValue(a.relationship, ['signed-to','label-of','managed-by'], 'relationship') } return }
  if (field === 'releaseInfo') {
    keys(v, ['_type','releaseArtist','releaseTitle','catalogNumber','releaseDate','streamLinks'], field)
    if (v._type !== undefined) invariant(v._type === 'object', 'Invalid releaseInfo type')
    for (const k of ['releaseArtist','releaseTitle','catalogNumber']) if (v[k] !== undefined) text(v[k], k)
    if (v.releaseDate !== undefined) invariant(/^\d{4}-\d{2}-\d{2}$/.test(v.releaseDate) && new Date(v.releaseDate).toISOString().slice(0,10) === v.releaseDate, 'Invalid releaseDate')
    if (v.streamLinks !== undefined) links(v.streamLinks, ['Spotify','Apple Music','Beatport','SoundCloud','Bandcamp','YouTube Music','Other'])
    return
  }
  throw new Error(`Unsupported schema field ${field}`)
}
export function validatePatch(type, set = {}, unset = []) {
  invariant(FIELDS[type], `Unsupported document type ${type}`); keys(set, FIELDS[type], 'set')
  invariant(Array.isArray(unset) && new Set(unset).size === unset.length, 'Invalid unset')
  for (const k of unset) invariant(FIELDS[type].includes(k) && !required[type].includes(k) && !Object.hasOwn(set, k), `Rejected unset field ${k}`)
  for (const [k, v] of Object.entries(set)) validateField(k, v)
}
export function patched(before, set, unset) { const result = clean(before); Object.assign(result, clean(set)); for (const k of unset) delete result[k]; return result }
export function validateDocument(doc, { creation = false } = {}) {
  invariant(validId(doc._id) && FIELDS[doc._type], 'Invalid document identity/type')
  if (creation) keys(doc, ['_id','_type',...FIELDS[doc._type], ...(doc._type === 'mediaAsset' ? ['sourceFolder','sourceManifest','image','video'] : [])], 'document')
  for (const k of required[doc._type]) { invariant(doc[k] !== undefined, `Required ${k} on ${doc._id}`); validateField(k, doc[k]) }
  if (doc.yearStart != null && doc.yearEnd != null) invariant(doc.yearEnd >= doc.yearStart, 'yearEnd precedes yearStart')
  if (creation) for (const k of FIELDS[doc._type]) if (doc[k] !== undefined) validateField(k, doc[k])
  if (doc._type === 'mediaAsset') {
    if (doc.mediaType === 'brand-deck') invariant(Number.isInteger(doc.brandDeckOrder) && doc.brandDeckOrder > 0 && !!doc.displayGroup, 'Deck pages require displayGroup and positive brandDeckOrder')
    if (doc.mediaType === 'carousel-slide') invariant(!!doc.displayGroup, 'Carousel slides require displayGroup')
  }
}
export function references(doc) {
  const refs = []
  for (const field of ['client','project']) if (doc[field]) refs.push({ id: doc[field]._ref, type: field })
  for (const r of doc.services || []) refs.push({ id: r._ref, type: 'serviceTag' })
  for (const r of doc.affiliations || []) refs.push({ id: r.entity?._ref, type: 'client' })
  return refs
}
export function withoutSystem(doc) { return Object.fromEntries(Object.entries(doc || {}).filter(([k]) => !['_rev','_createdAt','_updatedAt'].includes(k))) }
export async function schemaHash(checkout) { return digest(await Promise.all(['mediaAsset','project','client','serviceTag'].map(async name => [name, await readFile(path.join(checkout, 'src/schemas', `${name}.ts`), 'utf8')])) ) }
export function closestType(width, height, kind) {
  const ratios = { '1x1': 1, '3x4': 3/4, '4x5': 4/5, '9x16': 9/16, '16x9': 16/9, ...(kind === 'video' ? { '4x3': 4/3 } : {}) }
  const ratio = width / height
  return `${kind === 'video' ? 'motion' : 'static'}_${Object.keys(ratios).sort((a,b) => Math.abs(ratios[a]-ratio) - Math.abs(ratios[b]-ratio))[0]}`
}
