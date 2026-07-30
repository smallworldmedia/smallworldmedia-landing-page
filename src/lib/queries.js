/**
 * queries.js — Centralized GROQ queries for the Project Directory.
 *
 * Terminology follows CONTEXT.md Frontend Component Vocabulary.
 * All queries exclude drafts and resolve references at build time.
 */

/**
 * MEDIA_GRID_QUERY — All publishable non-album-art assets.
 * Feeds the ProjectDirectory → MediaGrid → MediaCard pipeline.
 * Album art is excluded here and fetched separately for the AlbumArtTicker.
 */
export const MEDIA_GRID_QUERY = `
  *[_type == "mediaAsset" && mediaType != "album-art" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
    _id,
    title,
    mediaType,
    contentRole,

    // Image resolution
    "imageUrl": image.asset->url,
    "imageDimensions": image.asset->metadata.dimensions,

    // Video resolution — dereference mux.videoAsset for playback
    "playbackId": video.asset->playbackId,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "videoDuration": video.asset->data.duration,
    "videoStatus": video.asset->data.status,

    // Taxonomy
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "services": services[]->{ name, "slug": slug.current }
  }
`;

/**
 * ALBUM_ART_QUERY — Album art assets for the AlbumArtTicker.
 * Ordered by client name so they can be grouped into per-client ticker rows.
 */
export const ALBUM_ART_QUERY = `
  *[_type == "mediaAsset" && mediaType == "album-art" && !(_id in path("drafts.**"))] | order(client->name asc) {
    _id,
    title,
    "imageUrl": image.asset->url,
    "imageDimensions": image.asset->metadata.dimensions,
    "clientName": client->name,
    "clientSlug": client->slug.current
  }
`;

/**
 * SERVICE_TAGS_QUERY — All service tags for the FilterBar.
 */
export const SERVICE_TAGS_QUERY = `
  *[_type == "serviceTag"] | order(sortOrder asc) {
    name,
    "slug": slug.current
  }
`;

/**
 * FEATURED_PROJECT_PATHS_QUERY — One row per Featured Project doc
 * (isFeatured == true). The project doc _id is the grouping key the detail
 * page fetches by (FEATURED_PROJECT_DETAIL_QUERY); `collection` is resolved
 * from the first asset's sourceManifest purely to derive the route slug
 * (toProjectSlug — must stay stable for existing URLs). No isHero flags
 * needed — first-in-order IS the hero.
 *
 * Ordered identically to FEATURED_WORLDS_QUERY (orderRank, client-name
 * tiebreak) so the row order IS the /work World order — /work/[slug]
 * getStaticPaths derives each page's next-project chain (NextProjectBand)
 * from adjacency in this list, wrapping last → first.
 *
 * title/services/hero feed the band's populated card: the next project's
 * display copy, tag chips, and first-order media asset.
 */
export const FEATURED_PROJECT_PATHS_QUERY = `
  *[_type == "project" && isFeatured == true && !(_id in path("drafts.**"))]
    | order(orderRank asc, client->name asc) {
    "projectId": _id,
    "slug": slug.current,
    title,
    "color": projectColor,
    "colorSecondary": projectColorSecondary,
    "collection": *[_type == "mediaAsset" && project._ref == ^._id && !(_id in path("drafts.**"))][0].sourceManifest,
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "services": services[]->{ name, "slug": slug.current },
    "hero": *[_type == "mediaAsset" && project._ref == ^._id && !(_id in path("drafts.**"))]
      | order(orderRank asc) [0] {
      "imageUrl": image.asset->url,
      "imageDimensions": image.asset->metadata.dimensions,
      "playbackId": video.asset->playbackId,
      "videoAspectRatio": video.asset->data.aspect_ratio
    }
  }
`;

/**
 * GLOBE_ASSETS_QUERY — Asset pool for the homepage video globe.
 *
 * Tier system (buildAssetPool.js merges these in priority order):
 *
 * picks            — hand-curated in the Globe Settings singleton;
 *                    array position = panel prominence (position 0 is
 *                    the most visible panel). Drag-to-order in Studio.
 * featuredProjects — editorial rank layer: project docs in orderRank
 *                    (Studio drag) order, matched to assets via
 *                    toProjectSlug(clientSlug, sourceManifest)
 * heroes           — first-ranked asset per featured collection (first
 *                    in orderRank = hero, no flags needed). Playable
 *                    ones become tier-2 panels; all of them mark their
 *                    sourceFolder as a featured collection for tier 3.
 * autoFill         — showcase motion assets, newest first, carrying
 *                    the hierarchy fields buildAssetPool needs
 *
 * Every playable tier carries `services` in the house {name, slug} shape
 * (FEATURED_PROJECT_DETAIL_QUERY convention) — the hero's tracking labels
 * (chunk 6) read clientName + service names off the live panel's asset.
 * buildAssetPool passes the field through untouched.
 *
 * Video status: "preparing" is accepted alongside "ready" — the Mux
 * status snapshots in Sanity went stale after re-ingestion (streams
 * verified serving) and most hero reels are still marked preparing.
 * Tighten to ready-only once the statuses re-sync.
 */
export const GLOBE_ASSETS_QUERY = `{
  "picks": *[_type == "globeSettings" && _id == "globeSettings"][0].picks[]->{
    _id,
    title,
    "playbackId": video.asset->playbackId,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "videoStatus": video.asset->data.status,
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "services": services[]->{ name, "slug": slug.current }
  },
  "featuredProjects": *[_type == "project"
      && isFeatured == true
      && !(_id in path("drafts.**"))]
    | order(orderRank asc) {
    "slug": slug.current
  },
  "heroes": *[_type == "project"
      && isFeatured == true
      && !(_id in path("drafts.**"))] {
    "hero": *[_type == "mediaAsset" && project._ref == ^._id && !(_id in path("drafts.**"))]
      | order(orderRank asc) [0] {
      _id,
      title,
      sourceFolder,
      "collection": sourceManifest,
      "playbackId": video.asset->playbackId,
      "videoStatus": video.asset->data.status,
      "videoAspectRatio": video.asset->data.aspect_ratio,
      "clientName": client->name,
      "clientSlug": client->slug.current,
      "clientType": client->clientType,
      "services": services[]->{ name, "slug": slug.current }
    }
  }.hero,
  "autoFill": *[_type == "mediaAsset"
      && !defined(contentRole)
      && mediaType match "motion_*"
      && defined(video.asset->playbackId)
      && video.asset->data.status in ["ready", "preparing"]
      && !(_id in path("drafts.**"))]
    | order(_createdAt desc) [0...128] {
    _id,
    title,
    sourceFolder,
    "collection": sourceManifest,
    "playbackId": video.asset->playbackId,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "clientType": client->clientType,
    "services": services[]->{ name, "slug": slug.current }
  }
}`;

/**
 * FEATURED_PROJECT_DETAIL_QUERY — Everything one Featured Project page needs.
 *
 * $projectId — the `project` document _id driving this page. Assets join via
 * the `mediaAsset.project` reference — the SAME grouping the /work Worlds use
 * (FEATURED_WORLDS_QUERY), so one project doc = one World = one detail page.
 * Client meta and editorial copy come straight off the project doc.
 *
 * Assets come back in drag-rank order (orderRank, set in Studio) — the
 * Content Population Hierarchy (see CONTEXT.md) turns that order into the layout.
 */
export const FEATURED_PROJECT_DETAIL_QUERY = `{
  "assets": *[_type == "mediaAsset" && project._ref == $projectId && !(_id in path("drafts.**"))] | order(orderRank asc) {
    _id,
    title,
    mediaType,
    contentRole,
    displayGroup,
    brandDeckOrder,
    "yearStart": coalesce(yearStart, year),
    yearEnd,
    isOngoing,
    "imageUrl": image.asset->url,
    "imageDimensions": image.asset->metadata.dimensions,
    "playbackId": video.asset->playbackId,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "services": services[]->{ name, "slug": slug.current },
    releaseInfo{
      releaseArtist,
      releaseTitle,
      catalogNumber,
      releaseDate,
      streamLinks[]{ platform, url }
    }
  },
  "client": *[_type == "project" && _id == $projectId][0].client->{
    name,
    "slug": slug.current,
    clientType,
    description,
    city,
    country,
    links
  },
  "project": *[_type == "project" && _id == $projectId][0]{
    title,
    description,
    "yearStart": coalesce(yearStart, year),
    yearEnd,
    isOngoing,
    projectColor,
    projectColorSecondary,
    "services": services[]->{ name, "slug": slug.current }
  }
}`;

/**
 * FEATURED_WORLDS_QUERY — Drives the Featured Projects experience at /work.
 *
 * Project-doc-first (docs/adr/0001): one row per `project` with
 * isFeatured == true, ordered by orderRank (set via the orderable plugin;
 * client name breaks ties until ranks are assigned). Each project carries its
 * editorial copy + its media, joined via the `mediaAsset.project` reference.
 * buildContentFlow() partitions the assets into the World's Tiles + sockets
 * at build time (see src/pages/work/index.astro).
 */
export const FEATURED_WORLDS_QUERY = `
  *[_type == "project" && isFeatured == true && !(_id in path("drafts.**"))]
    | order(orderRank asc, client->name asc) {
    "slug": slug.current,
    title,
    "yearStart": coalesce(yearStart, year),
    yearEnd,
    isOngoing,
    orderRank,
    projectColor,
    projectColorSecondary,
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "collection": *[_type == "mediaAsset" && project._ref == ^._id && !(_id in path("drafts.**"))][0].sourceManifest,
    "services": services[]->{ name, "slug": slug.current },
    "assets": *[_type == "mediaAsset" && project._ref == ^._id && !(_id in path("drafts.**"))]
      | order(orderRank asc) {
      _id,
      title,
      mediaType,
      contentRole,
      displayGroup,
      brandDeckOrder,
      "imageUrl": image.asset->url,
      "imageDimensions": image.asset->metadata.dimensions,
      "playbackId": video.asset->playbackId,
      "videoAspectRatio": video.asset->data.aspect_ratio,
      "videoStatus": video.asset->data.status,
      "services": services[]->{ name, "slug": slug.current }
    }
  }
`;
