/**
 * FeaturedProjects — Dedicated page component for /work/featured.
 *
 * Showcases curated Featured Project collections with large cards.
 * Each card links to its single-project detail page (/work/[slug]).
 *
 * @param {Object} props
 * @param {Array<Object>} props.projects - Featured project hero assets
 */
import { toProjectSlug } from '../../lib/projectSlug.js';

export default function FeaturedProjects({ projects }) {
  if (!projects?.length) {
    return (
      <div className="work-page">
        <header className="work-header">
          <h1 className="work-header__title">Featured</h1>
          <a href="/work" className="work-header__featured-link">
            ← All Work
          </a>
        </header>
        <div className="work-page__inner">
          <div className="work-empty">
            <h2 className="work-empty__heading">Coming soon</h2>
            <p className="work-empty__body">
              Featured projects are being curated.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="work-page">
      <header className="work-header">
        <h1 className="work-header__title">Featured</h1>
        <a href="/work" className="work-header__featured-link">
          ← All Work
        </a>
      </header>

      <div className="work-page__inner">
        <div className="featured-grid">
          {projects.map((project) => {
            const isVideo = !!project.playbackId;
            const thumbnailUrl = isVideo && project.playbackId
              ? `https://image.mux.com/${project.playbackId}/thumbnail.jpg?width=1280&fit_mode=smartcrop`
              : project.imageUrl
                ? `${project.imageUrl}?w=1280&auto=format`
                : null;

            const slug =
              project.clientSlug && project.collection
                ? toProjectSlug(project.clientSlug, project.collection)
                : null;

            return (
              <a
                key={project._id}
                className="featured-card"
                href={slug ? `/work/${slug}` : undefined}
              >
                {thumbnailUrl ? (
                  <img
                    className="featured-card__media"
                    src={thumbnailUrl}
                    alt={project.title || `${project.clientName} Featured Project`}
                    loading="lazy"
                  />
                ) : (
                  <div className="featured-card__media" aria-hidden="true" />
                )}
                <div className="featured-card__info">
                  <div className="featured-card__client">
                    {project.clientName}
                  </div>
                  {project.collection &&
                    project.collection.toLowerCase().replace(/[^a-z0-9]/g, '') !==
                      project.clientName?.toLowerCase().replace(/[^a-z0-9]/g, '') && (
                    <div className="featured-card__title">
                      {project.collection}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
