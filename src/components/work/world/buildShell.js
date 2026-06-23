/**
 * buildShell.js — the World Shell: a faint inverse-sphere lat/long line grid
 * that the camera sits inside. Pure environment; media does not live on it.
 */
import * as THREE from 'three';
import {
  SHELL_RADIUS,
  SHELL_MERIDIANS,
  SHELL_PARALLELS,
  SHELL_LINE_COLOR,
  SHELL_OPACITY,
} from './worldConfig.js';

const SEG = 64;

function sph(r, lon, lat) {
  // lat 0..PI from +Y pole; lon 0..2PI
  return [
    r * Math.sin(lat) * Math.cos(lon),
    r * Math.cos(lat),
    r * Math.sin(lat) * Math.sin(lon),
  ];
}

export function buildShell() {
  const R = SHELL_RADIUS;
  const positions = [];

  // Meridians (constant longitude)
  for (let m = 0; m < SHELL_MERIDIANS; m++) {
    const lon = (m / SHELL_MERIDIANS) * Math.PI * 2;
    for (let s = 0; s < SEG; s++) {
      positions.push(
        ...sph(R, lon, (s / SEG) * Math.PI),
        ...sph(R, lon, ((s + 1) / SEG) * Math.PI)
      );
    }
  }

  // Parallels (constant latitude)
  for (let p = 1; p < SHELL_PARALLELS; p++) {
    const lat = (p / SHELL_PARALLELS) * Math.PI;
    for (let s = 0; s < SEG; s++) {
      positions.push(
        ...sph(R, (s / SEG) * Math.PI * 2, lat),
        ...sph(R, ((s + 1) / SEG) * Math.PI * 2, lat)
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  const material = new THREE.LineBasicMaterial({
    color: SHELL_LINE_COLOR,
    transparent: true,
    opacity: SHELL_OPACITY,
  });
  return new THREE.LineSegments(geometry, material);
}
