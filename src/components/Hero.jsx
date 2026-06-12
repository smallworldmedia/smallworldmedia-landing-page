import VideoGlobe from './globe/VideoGlobe.jsx';
import HeroText from './HeroText';

/**
 * Hero — home page hero: the CMS video globe with tagline overlay.
 *
 * The wordmark and start-project/follow-us CTAs moved to the persistent
 * SiteNav; the hero is now purely the globe moment. Drag-to-spin works
 * anywhere the pointer-events:none text layer doesn't intercept.
 */
export default function Hero({ globeAssets }) {
    return (
        <section className="hero">
            <div className="hero__globe">
                <VideoGlobe assets={globeAssets} />
            </div>
            <HeroText />
        </section>
    );
}
