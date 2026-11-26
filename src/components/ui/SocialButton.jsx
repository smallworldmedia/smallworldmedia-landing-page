/**
 * SocialButton — Icon link for a single social platform.
 *
 * Renders an anchor tag containing the platform's SVG icon.
 * Only renders if the platform has a registered icon.
 *
 * Usage:
 *   <SocialButton platform="Instagram" url="https://..." clientName="Bedouin" />
 *
 * @param {Object}  props
 * @param {string}  props.platform   - Platform key matching SOCIAL_ICONS (e.g. "Instagram")
 * @param {string}  props.url        - Link URL
 * @param {string}  props.clientName - Used for accessible aria-label
 */

/** Registered social platforms → icon paths in /public/icons */
export const SOCIAL_ICONS = {
  Instagram:  '/icons/instagram.svg',
  Spotify:    '/icons/spotify.svg',
  Beatport:   '/icons/beatport.svg',
  SoundCloud: '/icons/soundcloud.svg',
  Website:    '/icons/website.svg',
};

export default function SocialButton({ platform, url, clientName }) {
  const icon = SOCIAL_ICONS[platform];
  if (!icon) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="social-btn"
      data-platform={platform.toLowerCase()}
      aria-label={`${clientName} on ${platform}`}
    >
      <img src={icon} alt="" className="social-btn__icon" />
    </a>
  );
}
