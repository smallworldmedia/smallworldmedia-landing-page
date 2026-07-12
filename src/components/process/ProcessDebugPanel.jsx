/**
 * ProcessDebugPanel — the ?debug tuning chrome (spec §6: mounts on the
 * gated route itself — no /lab/process to maintain).
 *
 * Stage jump buttons, live fps/draw/stage stats, and the §9 knob readout.
 * Knobs bake at init (the PARAM convention) — tune by editing the URL;
 * the readout shows what this load resolved.
 */
import { useEffect, useState } from 'react';
import {
  STAGE_SECONDS,
  SCATTER,
  DRIFT,
  THREAD_HOPS,
  THREAD_HOP_SECONDS,
  ASSEMBLE_SECONDS,
  ZOOM_OUT_SECONDS,
  EMANATE_SCALE,
  EMANATE_ORDER,
  BPM,
  CASCADE_VARIANT,
  FILL_FRACTION,
} from './processConfig.js';

const STAGES = ['stage-01', 'stage-02', 'stage-03', 'stage-04', 'stage-05'];
const KNOBS = [
  ['stagems', STAGE_SECONDS * 1000],
  ['scatter', SCATTER],
  ['drift', DRIFT],
  ['threadhops', THREAD_HOPS],
  ['threadms', THREAD_HOP_SECONDS * 1000],
  ['assemble', ASSEMBLE_SECONDS],
  ['zoomout', ZOOM_OUT_SECONDS],
  ['emanate', EMANATE_SCALE],
  ['emanateorder', EMANATE_ORDER],
  ['bpm', BPM],
  ['cascade', CASCADE_VARIANT],
  ['fillfrac', FILL_FRACTION],
];

export default function ProcessDebugPanel({ sceneRef }) {
  const [stats, setStats] = useState({ fps: 0, calls: 0, stage: null });

  useEffect(() => {
    const id = setInterval(() => setStats(sceneRef.current.getStats()), 500);
    return () => clearInterval(id);
  }, [sceneRef]);

  return (
    <aside className="process-debug">
      <p className="process-debug__stats">
        {`fps ${stats.fps} · draws ${stats.calls} · ${stats.stage ?? '∅'}`}
      </p>
      <div className="process-debug__stages">
        {STAGES.map((id, i) => (
          <button
            key={id}
            type="button"
            data-active={stats.stage === id || undefined}
            onClick={() => sceneRef.current.goTo(id)}
          >
            {`0${i + 1}`}
          </button>
        ))}
      </div>
      <dl className="process-debug__knobs">
        {KNOBS.map(([key, value]) => (
          <div key={key}>
            <dt>{`?${key}`}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
