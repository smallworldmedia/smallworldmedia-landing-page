/**
 * VideoGlobeLab — /lab/globe tuning sandbox.
 *
 * Thin wrapper around the production VideoGlobe component (which
 * graduated to the home hero). The lab page keeps the debug panel
 * always-on in dev so globeConfig.js tuning has a dedicated playground.
 */
import VideoGlobe from '../globe/VideoGlobe.jsx';

export default function VideoGlobeLab({ assets }) {
  return (
    <div className="lab-globe-page">
      <VideoGlobe assets={assets} debug={import.meta.env.DEV} />
    </div>
  );
}
