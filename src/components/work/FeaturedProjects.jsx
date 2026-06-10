/**
 * FeaturedProjects — Dedicated page component for /work/featured.
 *
 * Showcases curated Featured Project collections with large cards.
 * Each card links to the future single-project page (/work/[slug]).
 *
 * @param {Object} props
 * @param {Array<Object>} props.projects - Featured project assets (isHero: true)
 */
import { useState, useCallback } from 'react';
import Lightbox from './Lightbox.jsx';

export default function FeaturedProjects({ projects }) {
  const [lightboxAsset, setLightboxAsset] = useState(null);

  const handleSelect = useCallback((project) => {
    setLightboxAsset(project);
  }, []);

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

            return (
              <div
                key={project._id}
                className="featured-card"
                onClick={() => handleSelect(project)}
                role="button"
                tabIndex={0}
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
                  {project.projectAssetCount && (
                    <div className="featured-card__count">
                      {project.projectAssetCount} assets
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Lightbox
        asset={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
      />
    </div>
  );
}
