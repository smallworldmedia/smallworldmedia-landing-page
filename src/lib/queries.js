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
    isHero,
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
 * FEATURED_PROJECTS_QUERY — Hero assets for the FeaturedProjects page.
 * Each result represents a Featured Project curated collection with its sizzle reel.
 */
export const FEATURED_PROJECTS_QUERY = `
  *[_type == "mediaAsset" && isHero == true && !(_id in path("drafts.**"))] {
    _id,
    title,
    "imageUrl": image.asset->url,
    "playbackId": video.asset->playbackId,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "videoStatus": video.asset->data.status,
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "collection": sourceManifest,
    "services": services[]->{ name, "slug": slug.current }
  }
`;

/**
 * FEATURED_PROJECT_PATHS_QUERY — One row per Featured Project collection.
 * Heroes (isHero) mark each curated collection; sourceFolder is the
 * grouping key that ties every asset back to its project directory.
 * Used by /work/[slug] getStaticPaths to enumerate detail pages.
 */
export const FEATURED_PROJECT_PATHS_QUERY = `
  *[_type == "mediaAsset" && isHero == true && !(_id in path("drafts.**"))] {
    "sourceFolder": sourceFolder,
    "collection": sourceManifest,
    "clientName": client->name,
    "clientSlug": client->slug.current
  }
`;

/**
 * GLOBE_ASSETS_QUERY — Asset pool for the homepage video globe, sourced
 * from the Featured Project hierarchy (see CONTEXT.md § Content
 * Population Hierarchy). buildAssetPool.js turns this into the final
 * pool order: globeOrder picks → featured sizzle reels (editorial
 * project rank) → featured-collection showcase → general showcase.
 *
 * curated          — assets hand-ranked via globeOrder (manual override;
 *                    they fill the most prominent panels first)
 * featuredProjects — editorial rank layer: project docs matched to
 *                    assets via toProjectSlug(clientSlug, sourceManifest)
 * heroes           — every sizzle reel, uncapped (heroes must never fall
 *                    off the autoFill recency cap). Playable ones become
 *                    tier-2 panels; all of them mark their sourceFolder
 *                    as a featured collection for tier 3
 * autoFill         — non-hero showcase motion, newest first, carrying
 *                    the hierarchy fields buildAssetPool needs
 *
 * Video status: "preparing" is accepted alongside "ready" — the Mux
 * status snapshots in Sanity went stale after re-ingestion (streams
 * verified serving) and most hero reels are still marked preparing.
 * Tighten to ready-only once the statuses re-sync.
 */
export const GLOBE_ASSETS_QUERY = `{
  "curated": *[_type == "mediaAsset"
      && defined(globeOrder)
      && defined(video.asset->playbackId)
      && video.asset->data.status in ["ready", "preparing"]
      && !(_id in path("drafts.**"))]
    | order(globeOrder asc) {
    _id,
    title,
    globeOrder,
    "playbackId": video.asset->playbackId,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "clientName": client->name,
    "clientSlug": client->slug.current
  },
  "featuredProjects": *[_type == "project"
      && isFeatured == true
      && !(_id in path("drafts.**"))] {
    "slug": slug.current,
    sortOrder
  },
  "heroes": *[_type == "mediaAsset"
      && isHero == true
      && !defined(globeOrder)
      && !(_id in path("drafts.**"))] {
    _id,
    title,
    sourceFolder,
    "collection": sourceManifest,
    "playbackId": video.asset->playbackId,
    "videoStatus": video.asset->data.status,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "clientType": client->clientType
  },
  "autoFill": *[_type == "mediaAsset"
      && isHero != true
      && !defined(globeOrder)
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
    "services": services[]->slug.current
  }
}`;

/**
 * FEATURED_PROJECT_DETAIL_QUERY — Everything one Featured Project page needs.
 *
 * $sourceFolder — the project directory path shared by the collection's assets.
 * $slug         — the route slug; matches an optional `project` document that
 *                 carries editorial copy (overview blurb, display title).
 *
 * Assets come back in manifest row order (sortOrder) — the Content
 * Population Hierarchy (see CONTEXT.md) turns that order into the layout.
 */
export const FEATURED_PROJECT_DETAIL_QUERY = `{
  "assets": *[_type == "mediaAsset" && sourceFolder == $sourceFolder && !(_id in path("drafts.**"))] | order(sortOrder asc) {
    _id,
    title,
    mediaType,
    isHero,
    contentRole,
    sortOrder,
    displayGroup,
    brandDeckOrder,
    "yearStart": coalesce(yearStart, year),
    yearEnd,
    isOngoing,
    "imageUrl": image.asset->url,
    "imageDimensions": image.asset->metadata.dimensions,
    "playbackId": video.asset->playbackId,
    "videoAspectRatio": video.asset->data.aspect_ratio,
    "services": services[]->{ name, "slug": slug.current }
  },
  "client": *[_type == "mediaAsset" && sourceFolder == $sourceFolder && !(_id in path("drafts.**"))][0].client->{
    name,
    "slug": slug.current,
    clientType,
    description,
    city,
    country,
    links
  },
  "project": *[_type == "project" && slug.current == $slug && !(_id in path("drafts.**"))][0]{
    title,
    description,
    "yearStart": coalesce(yearStart, year),
    yearEnd,
    isOngoing,
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
    "clientName": client->name,
    "clientSlug": client->slug.current,
    "services": services[]->{ name, "slug": slug.current },
    "assets": *[_type == "mediaAsset" && project._ref == ^._id && !(_id in path("drafts.**"))]
      | order(sortOrder asc) {
      _id,
      title,
      mediaType,
      isHero,
      contentRole,
      sortOrder,
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
