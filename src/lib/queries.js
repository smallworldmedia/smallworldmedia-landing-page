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
    "services": services[]->{ name, "slug": slug.current },
    "projectAssetCount": count(*[_type == "mediaAsset" && client._ref == ^.client._ref])
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
 * GLOBE_ASSETS_QUERY — Hybrid asset pool for the homepage video globe.
 *
 * curated  — assets hand-ranked via globeOrder; they fill the most
 *            prominent panels first.
 * autoFill — showcase motion assets with a ready Mux playback ID, newest
 *            first. buildAssetPool.js interleaves these across clients /
 *            client types / services so the breadth story is automatic.
 */
export const GLOBE_ASSETS_QUERY = `{
  "curated": *[_type == "mediaAsset"
      && defined(globeOrder)
      && defined(video.asset->playbackId)
      && video.asset->data.status == "ready"
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
  "autoFill": *[_type == "mediaAsset"
      && !defined(globeOrder)
      && !defined(contentRole)
      && mediaType match "motion_*"
      && defined(video.asset->playbackId)
      && video.asset->data.status == "ready"
      && !(_id in path("drafts.**"))]
    | order(_createdAt desc) [0...96] {
    _id,
    title,
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
    year,
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
    year
  }
}`;
