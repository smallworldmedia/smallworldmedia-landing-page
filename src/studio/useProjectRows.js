// One project's pieces and sets as the rows the Studio list draws (src/studio/setRows.js), kept
// live, with the one write every move makes: a single transaction that patches each piece's
// published doc and its draft twin, as @sanity/orderable-document-list does.
//
// Shared by the project list pane and the Set page, so both read the same order.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from 'sanity'
import { useToast } from '@sanity/ui'
import { applyPlan, buildRows, expandPatches, mergeVersions } from './setRows.js'

const API_VERSION = '2025-06-27'
const NOT_A_VERSION = '!(_id in path("versions.**"))'

const PIECES_QUERY = `*[_type == "mediaAsset" && project._ref == $projectId && ${NOT_A_VERSION}]{
  _id, title, mediaType, orderRank, hideFromSite, contentRole,
  "set": set._ref,
  "thumb": image.asset->url,
  "playbackId": video.asset->playbackId
}`
const SETS_QUERY = `*[_type == "mediaSet" && project._ref == $projectId && ${NOT_A_VERSION}]{
  _id, title, groupType, allowAsHero
}`
const LISTEN_QUERY = `*[_type in ["mediaAsset", "mediaSet"] && project._ref == $projectId]`

export function useProjectRows(projectId) {
  // 'raw' so the draft twins come back with the published docs; the API's default perspective
  // for this version is published-only.
  const baseClient = useClient({ apiVersion: API_VERSION })
  const client = useMemo(() => baseClient.withConfig({ perspective: 'raw', useCdn: false }), [baseClient])
  const toast = useToast()
  const [data, setData] = useState(null) // { pieces, sets } once loaded
  const [error, setError] = useState(null)
  const latest = useRef(null)
  latest.current = data

  const load = useCallback(async () => {
    try {
      const [pieces, sets] = await Promise.all([
        client.fetch(PIECES_QUERY, { projectId }),
        client.fetch(SETS_QUERY, { projectId }),
      ])
      setData({ pieces: mergeVersions(pieces), sets: mergeVersions(sets) })
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [client, projectId])

  useEffect(() => {
    if (!projectId) return undefined
    load()
    let timer
    const subscription = client
      .listen(LISTEN_QUERY, { projectId }, { includeResult: false, visibility: 'query' })
      .subscribe({
        next: () => {
          clearTimeout(timer)
          timer = setTimeout(load, 150)
        },
        error: setError,
      })
    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [client, projectId, load])

  const rows = useMemo(() => (data ? buildRows(data.pieces, data.sets) : []), [data])

  /** Write a plan from setRows.js: show it at once, then one transaction; a failure reloads the truth. */
  const commit = useCallback(
    async (plan) => {
      const current = latest.current
      if (!plan.length || !current) return
      setData({ ...current, pieces: applyPlan(current.pieces, plan) })
      const transaction = client.transaction()
      for (const [docId, ops] of expandPatches(plan, current.pieces)) transaction.patch(docId, ops)
      try {
        await transaction.commit({ visibility: 'sync', tag: 'project-assets.reorder' })
      } catch (err) {
        toast.push({ status: 'error', title: 'Reordering failed', description: err?.message })
        load()
      }
    },
    [client, load, toast]
  )

  return { loading: !data && !error, error, rows, pieces: data?.pieces || [], commit }
}
