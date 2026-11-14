/**
 * LogoMark — a logo tile's face in the Project Directory: the baked white
 * mark (scripts/prep-directory-logos.mjs) placed in its canvas by logoLayout
 * (logoTile.js), on the tile's black (directory-logos.css). The tile already
 * has the canvas's shape (DirectoryGrid gives it `tileRatio`), so the canvas
 * fills it and the layout is a box in percent of the canvas. The canvas keeps
 * its aspect and sits centred in the tile, so a tile the flush grid stretches
 * taller (its forced fill, flushGrid.js) keeps the mark in proportion and
 * `object-fit: contain` keeps it undistorted if the cell is a pixel off.
 *
 * The mark fades in as MediaSlot's media does; an image that loaded before
 * hydration never fires onLoad, so it is flagged as its element attaches
 * (the same trap MediaSlot's flagIfLoaded closes).
 */
import { useCallback, useMemo, useState } from 'react';
import { logoLayout } from './logoTile.js';

/**
 * @param {Object} props
 * @param {Object} props.tile - a directory tile with `logo` ({src, w, h, aspect, density, cx, cy})
 * @param {Object} props.dials - { pad, weight, shrink, center } (logoTile.js LOGO_DIALS)
 */
export default function LogoMark({ tile, dials }) {
  const { logo } = tile;
  const box = useMemo(() => logoLayout(logo, dials), [logo, dials]);
  const [loaded, setLoaded] = useState(false);
  const flagIfLoaded = useCallback((img) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <span className="logo-canvas" style={{ aspectRatio: box.ratio }}>
      <img
        ref={flagIfLoaded}
        className={`logo-mark${loaded ? ' logo-mark--loaded' : ''}`}
        src={logo.src}
        width={logo.w}
        height={logo.h}
        alt={tile.alt || tile.title || ''}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={{
          left: `${box.left}%`,
          top: `${box.top}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
        }}
      />
    </span>
  );
}
