/**
 * buildGlobeGeometry.js — Pure geometry builder for the panelized globe.
 *
 * Two panel kinds:
 *  - Lat-band panels: partial SphereGeometry. three.js normalizes UVs to
 *    0..1 across the segment span, so textures map edge-to-edge.
 *  - Pole wedges: the 12 pie-slice panels meeting at each pole (like the
 *    logo's converging longitude lines). Spherical UVs would pinch the
 *    texture into the apex, so wedges get planar-projected UVs instead —
 *    the asset lies flat and the wedge shape crops it, undistorted.
 *
 * Every panel carries `row` (0 = top wedge ring … latBands+1 = bottom)
 * for cascade sequencing.
 *
 * SphereGeometry vertex convention (drives centerDir below):
 *   x = -r·cos(φ)·sin(θ),  y = r·cos(θ),  z = r·sin(φ)·sin(θ)
 */
import * as THREE from 'three';

/**
 * Replace a pole wedge's spherical UVs with a planar projection in the
 * tangent frame at the wedge's bisector azimuth. Returns the planar
 * width/height aspect for cover-fit cropping.
 */
function applyPolarPlanarUvs(geometry, phiC, isTop) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  // Horizontal (x,z) basis: tHat = azimuthal (texture u), rHat = radial
  // from the pole axis along the bisector (texture v)
  const tHat = [Math.sin(phiC), Math.cos(phiC)];
  const rHat = [-Math.cos(phiC), Math.sin(phiC)];

  const a = new Float32Array(pos.count);
  const b = new Float32Array(pos.count);
  let aMin = Infinity;
  let aMax = -Infinity;
  let bMin = Infinity;
  let bMax = -Infinity;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const z = pos.getZ(k);
    a[k] = x * tHat[0] + z * tHat[1];
    b[k] = x * rHat[0] + z * rHat[1];
    if (a[k] < aMin) aMin = a[k];
    if (a[k] > aMax) aMax = a[k];
    if (b[k] < bMin) bMin = b[k];
    if (b[k] > bMax) bMax = b[k];
  }

  const aRange = Math.max(aMax - aMin, 1e-6);
  const bRange = Math.max(bMax - bMin, 1e-6);
  for (let k = 0; k < pos.count; k++) {
    const u = (a[k] - aMin) / aRange;
    const vRaw = (b[k] - bMin) / bRange;
    // Texture top faces the pole on the top cap, the equator on the bottom
    uv.setXY(k, u, isTop ? 1 - vRaw : vRaw);
  }
  uv.needsUpdate = true;

  return aRange / bRange;
}

/**
 * @param {Object} opts
 * @param {number} opts.lonSegments - Longitude divisions (full sphere)
 * @param {number} opts.latBands    - Latitude bands between the pole rings
 * @param {number} opts.gapDeg      - Angular gap between panels, in degrees
 * @param {number} opts.capDeg      - Pole wedge ring span, in degrees
 * @param {number} opts.radius
 * @returns {{ panels: Array, innerSphereGeometry: THREE.SphereGeometry }}
 */
export default function buildGlobeGeometry({ lonSegments, latBands, gapDeg, capDeg, radius }) {
  const gap = THREE.MathUtils.degToRad(gapDeg);
  const capRad = THREE.MathUtils.degToRad(capDeg);
  const poleInset = gap; // tiny inner-sphere dot where the lines converge
  const bandHeight = (Math.PI - 2 * capRad) / latBands;
  const lonStep = (Math.PI * 2) / lonSegments;

  const panels = [];

  const centerDirAt = (phiC, thetaC) =>
    new THREE.Vector3(
      -Math.cos(phiC) * Math.sin(thetaC),
      Math.cos(thetaC),
      Math.sin(phiC) * Math.sin(thetaC)
    );

  for (let i = 0; i < lonSegments; i++) {
    const phiStart = i * lonStep + gap / 2;
    const phiLength = lonStep - gap;
    const phiC = phiStart + phiLength / 2;

    // — Pole wedges (top row 0, bottom row latBands + 1) —
    for (const isTop of [true, false]) {
      const thetaStart = isTop ? poleInset : Math.PI - capRad + gap / 2;
      const thetaLength = capRad - poleInset - gap / 2;
      const geometry = new THREE.SphereGeometry(
        radius, 4, 3, phiStart, phiLength, thetaStart, thetaLength
      );
      const panelAspect = applyPolarPlanarUvs(geometry, phiC, isTop);
      const thetaC = thetaStart + thetaLength / 2;
      panels.push({
        geometry,
        lonIndex: i,
        row: isTop ? 0 : latBands + 1,
        isPole: true,
        centerDir: centerDirAt(phiC, thetaC),
        panelAspect,
      });
    }

    // — Lat-band panels (rows 1 … latBands) —
    for (let j = 0; j < latBands; j++) {
      const thetaStart = capRad + j * bandHeight + gap / 2;
      const thetaLength = bandHeight - gap;
      const geometry = new THREE.SphereGeometry(
        radius, 6, 4, phiStart, phiLength, thetaStart, thetaLength
      );
      const thetaC = thetaStart + thetaLength / 2;
      panels.push({
        geometry,
        lonIndex: i,
        row: j + 1,
        isPole: false,
        centerDir: centerDirAt(phiC, thetaC),
        // Angular width/height ratio at the panel center — cover-fit cropping
        panelAspect: (phiLength * Math.sin(thetaC)) / thetaLength,
      });
    }
  }

  const innerSphereGeometry = new THREE.SphereGeometry(radius, 32, 24);

  return { panels, innerSphereGeometry };
}
