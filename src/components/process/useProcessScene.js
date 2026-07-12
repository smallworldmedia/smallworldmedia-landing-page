/**
 * useProcessScene — the ProcessScene stage machine (spec §3).
 *
 * P1 stub: the API surface, same-state dedupe, and console logging, so the
 * scroll driver's boundary wiring is verifiable before any WebGL exists.
 * P2 mounts the real scene — the globe primitives (buildGlobeGeometry /
 * createPanelMaterial / buildCascadeTimeline) composed behind this same
 * API, per ADR-0003's grammar (reuse the brains, never fork useGlobeScene).
 *
 * API (spec §3): `goTo(stageId)` plays the authored transition (interrupts
 * kill + compress); `setStageInstant(stageId)` is the reduced-motion path —
 * jump to the stage's rest pose and render one frame.
 */
import { useRef, useLayoutEffect } from 'react';

const NOOP_API = { goTo: () => {}, setStageInstant: () => {} };

export default function useProcessScene(containerRef) {
  const apiRef = useRef(NOOP_API);

  // Layout effect, not passive: the scroll driver's useGSAP (also a layout
  // effect, called after this hook) syncs the arrival stage on mount — the
  // machine must already be installed when it does.
  useLayoutEffect(() => {
    // containerRef mounts the renderer in P2 — unused by the logging stub.
    void containerRef;
    let stage = null;

    apiRef.current = {
      goTo(next) {
        if (next === stage) return;
        console.info(`[ProcessScene] goTo ${stage ?? '∅'} → ${next}`);
        stage = next;
      },
      setStageInstant(next) {
        if (next === stage) return;
        console.info(`[ProcessScene] setStageInstant ${stage ?? '∅'} → ${next}`);
        stage = next;
      },
    };

    return () => {
      apiRef.current = NOOP_API;
    };
  }, []);

  return apiRef;
}
