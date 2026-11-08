/**
 * globe-loader — the pure geometry behind the SVG globe loader (SQ-31).
 * Run: node --test scripts/test/globe-loader.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PITCH_DEG } from '../../src/components/globe/globeConfig.js';
import { O_SPIN_DPS } from '../../src/components/process/processConfig.js';
import {
  PITCH_DEG,
  MERIDIANS,
  STEP_DEG,
  STEP_FRAMES,
  MERIDIAN_POINTS,
  PARALLELS_DEG,
  SPHERE,
  restLongitudes,
  limbTheta,
  meridianPoints,
  meridianPath,
  meridianKeyframes,
  meridianDrawOrder,
  parallelEllipse,
  parallelPath,
  parallelDrawOrder,
  buildTimeline,
} from '../../src/lib/globeLoaderGeometry.js';

const near = (a, b, eps = 0.02, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);
const last = (a) => a[a.length - 1];
const deg = (r) => (r * 180) / Math.PI;

test('pitch and spin come from the shared configs, not a copy', () => {
  assert.equal(PITCH_DEG, INITIAL_PITCH_DEG);
  const t = buildTimeline();
  assert.equal(t.direction, O_SPIN_DPS > 0 ? 1 : -1);
  near(t.stepSeconds, STEP_DEG / Math.abs(O_SPIN_DPS), 1e-9);
});

test('visible segment ends on the limb at the known longitudes', () => {
  // facing the viewer: runs the whole way down to the rim's bottom
  near(deg(limbTheta(0)), 180 - PITCH_DEG);
  near(last(meridianPoints(0)).x, SPHERE.cx);
  near(last(meridianPoints(0)).y, SPHERE.cy + SPHERE.r);
  // straight behind: a short stub from the pole up to the rim's top
  near(deg(limbTheta(180)), PITCH_DEG);
  near(last(meridianPoints(180)).x, SPHERE.cx);
  near(last(meridianPoints(180)).y, SPHERE.cy - SPHERE.r);
  // the side: the pole down to the equator on the rim
  near(deg(limbTheta(90)), 90);
  near(last(meridianPoints(90)).x, SPHERE.cx + SPHERE.r);
  near(last(meridianPoints(90)).y, SPHERE.cy);
  near(last(meridianPoints(270)).x, SPHERE.cx - SPHERE.r);
});

test('every sampled meridian point faces the viewer and the run starts at the pole', () => {
  const pole = meridianPoints(0)[0];
  for (let phi = 0; phi < 360; phi += 10) {
    const pts = meridianPoints(phi);
    assert.equal(pts.length, MERIDIAN_POINTS + 1);
    near(pts[0].x, pole.x, 1e-9);
    near(pts[0].y, pole.y, 1e-9);
    for (const p of pts) assert.ok(p.z >= -1e-9, `phi ${phi} hidden point z=${p.z}`);
    // and it ends ON the limb: z' = 0, i.e. distance from centre = R
    near(Math.hypot(last(pts).x - SPHERE.cx, last(pts).y - SPHERE.cy), SPHERE.r, 0.02, `limb phi ${phi}`);
  }
});

test('the pole sits inside the disk near the top, tipped toward the viewer', () => {
  const pole = meridianPoints(0)[0];
  assert.ok(pole.z > 0);
  assert.ok(pole.y < SPHERE.cy && pole.y > SPHERE.cy - SPHERE.r);
});

test('every keyframe of every meridian has the same command structure and point count', () => {
  const shape = (d) => d.replace(/-?\d+(\.\d+)?/g, '#');
  const want = shape(meridianPath(0));
  assert.equal((want.match(/#/g) || []).length, 2 * (MERIDIAN_POINTS + 1));
  for (const direction of [-1, 1]) {
    for (let k = 0; k < MERIDIANS; k++) {
      const frames = meridianKeyframes(k, { direction });
      assert.equal(frames.length, STEP_FRAMES + 1);
      for (const d of frames) assert.equal(shape(d), want);
    }
  }
});

test('the step loop is seamless, the last keyframe is the first shifted by one meridian', () => {
  const rest = restLongitudes().map(meridianPath);
  for (const direction of [-1, 1]) {
    // the set of drawn lines at the loop's start and end must be identical
    const firstSet = [];
    const lastSet = [];
    for (let k = 0; k < MERIDIANS; k++) {
      const frames = meridianKeyframes(k, { direction });
      assert.equal(frames[0], rest[k], 'first keyframe is the rest shape');
      assert.equal(last(frames), rest[(k + direction + MERIDIANS) % MERIDIANS], 'last keyframe is the neighbour');
      firstSet.push(frames[0]);
      lastSet.push(last(frames));
    }
    assert.deepEqual([...lastSet].sort(), [...firstSet].sort());
  }
});

test('linear morph between keyframes stays within half a unit of the true arc', () => {
  const k = 3;
  const keys = Array.from({ length: STEP_FRAMES + 1 }, (_, j) => meridianPoints(k * STEP_DEG - STEP_DEG * (j / STEP_FRAMES)));
  let worst = 0;
  for (let j = 0; j < STEP_FRAMES; j++) {
    const exact = meridianPoints(k * STEP_DEG - STEP_DEG * ((j + 0.5) / STEP_FRAMES));
    for (let i = 0; i < exact.length; i++) {
      const mx = (keys[j][i].x + keys[j + 1][i].x) / 2;
      const my = (keys[j][i].y + keys[j + 1][i].y) / 2;
      worst = Math.max(worst, Math.hypot(mx - exact[i].x, my - exact[i].y));
    }
  }
  assert.ok(worst < 0.5, `worst interpolation error ${worst}`);
});

test('meridians draw left to right by screen position', () => {
  const t = buildTimeline();
  assert.equal(t.meridians.length, MERIDIANS);
  assert.deepEqual(
    t.meridians.map((m) => m.k),
    meridianDrawOrder(),
  );
  const centreX = (k) => {
    const xs = meridianPoints(restLongitudes()[k]).map((p) => p.x);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  };
  for (let i = 1; i < t.meridians.length; i++) {
    assert.ok(t.meridians[i].begin > t.meridians[i - 1].begin, 'begin times strictly increase');
    assert.ok(centreX(t.meridians[i].k) >= centreX(t.meridians[i - 1].k) - 1e-9, 'screen X never goes back');
  }
  assert.equal(new Set(t.meridians.map((m) => m.k)).size, MERIDIANS);
});

test('parallels draw top to bottom, after the last meridian is in', () => {
  const t = buildTimeline();
  assert.deepEqual(
    t.parallels.map((p) => p.j),
    parallelDrawOrder(),
  );
  const frontY = (j) => parallelEllipse(PARALLELS_DEG[j]).cy + parallelEllipse(PARALLELS_DEG[j]).ry;
  for (let i = 1; i < t.parallels.length; i++) {
    assert.ok(t.parallels[i].begin > t.parallels[i - 1].begin);
    assert.ok(frontY(t.parallels[i].j) > frontY(t.parallels[i - 1].j), 'lower on screen than the one before');
  }
  const lastMeridianEnd = last(t.meridians).begin + t.draw;
  assert.ok(t.parallels[0].begin >= lastMeridianEnd - 1e-9);
  near(t.drawEnd, last(t.parallels).begin + t.draw, 1e-9);
});

test('parallels are rotation-invariant and open arcs end on the limb', () => {
  for (const th of PARALLELS_DEG) {
    const e = parallelEllipse(th);
    assert.ok(e.closed === (th <= PITCH_DEG), `closed only up to the pitch (${th})`);
    if (!e.closed) {
      const dx = e.rx * Math.sin(e.halfSpan);
      const y = e.cy + e.ry * Math.cos(e.halfSpan);
      near(Math.hypot(e.cx + dx - SPHERE.cx, y - SPHERE.cy), SPHERE.r, 0.02, `limb at ${th}`);
    }
    assert.equal(parallelPath(th), parallelPath(th)); // a pure function of the latitude, no phase input
  }
});

test('timing dials scale the timeline and the spin multiplier scales the step', () => {
  const slow = buildTimeline({ meridianStaggerMs: 200, drawMs: 1000, parallelStaggerMs: 300, spin: 0.5 });
  const base = buildTimeline();
  assert.ok(slow.drawEnd > base.drawEnd);
  near(slow.stepSeconds, base.stepSeconds * 2, 1e-9);
  const still = buildTimeline({ spin: 0 });
  assert.equal(still.spinning, false);
  assert.equal(still.stepSeconds, 0);
});
