import { useState, useEffect, useCallback, useRef } from 'react';
import UnicornScene from 'unicornstudio-react';

/**
 * UnicornBg — Persistent wrapper for the Unicorn Studio WebGL scene.
 *
 * The scene stays mounted across viewport resizes — the SDK's own canvas
 * handles resize internally via its CSS 100%×100% sizing.
 *
 * Performance:
 * - Desktop: dpi=2, fps=30
 * - Mobile (≤768px at mount): dpi=1.5 — lighter GPU load on small screens
 *
 * Dev tools:
 * - Ctrl+Shift+U: force-reload the scene (cache-busted fetch)
 * - Fetch interceptor adds cache-bust param to Unicorn Studio API calls (dev only)
 */

const INITIAL_DPI =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
    ? 1.5
    : 2;

export default function UnicornBg() {
  const [sceneKey, setSceneKey] = useState(() => Date.now());
  const mountedRef = useRef(true);

  const reloadScene = useCallback(() => {
    if (mountedRef.current) {
      setSceneKey(Date.now());
      console.log('[UnicornBg] Scene reloaded —', new Date().toLocaleTimeString());
    }
  }, []);

  // Fetch interceptor — cache-bust Unicorn Studio API calls (dev convenience)
  useEffect(() => {
    if (!import.meta.env.DEV) return; // Skip in production builds

    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      let url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';

      if (url.includes('unicornstudio') || url.includes('unicorn')) {
        const separator = url.includes('?') ? '&' : '?';
        const bustUrl = `${url}${separator}_t=${Date.now()}`;
        return originalFetch.call(this, bustUrl, { ...init, cache: 'no-store' });
      }

      return originalFetch.call(this, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [sceneKey]);

  // Manual reload: Ctrl+Shift+U (dev convenience — no auto-reload on tab switch)
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        reloadScene();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [reloadScene]);

  return (
    <UnicornScene
      key={sceneKey}
      projectId="HwSXxV0hK7lEV8Xjg0wV"
      width="100%"
      height="100%"
      scale={1}
      dpi={INITIAL_DPI}
      fps={30}
      sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@2.1.9/dist/unicornStudio.umd.js"
    />
  );
}
