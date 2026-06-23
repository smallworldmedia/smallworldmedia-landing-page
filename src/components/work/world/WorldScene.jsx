/**
 * WorldScene — the WebGL canvas for the active Featured Project World.
 *
 * A single fixed, full-viewport canvas behind the scrolling identity cards;
 * its Tiles swap as the active project changes. See useWorldScene for the
 * three.js lifecycle.
 *
 * @param {Object} props
 * @param {Object|null} props.world - the active World
 */
import { useRef } from 'react';
import useWorldScene from './useWorldScene.js';

export default function WorldScene({ world }) {
  const ref = useRef(null);
  useWorldScene(ref, world);
  return <div ref={ref} className="fp-canvas" aria-hidden="true" />;
}
