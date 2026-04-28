import { useState, useEffect, useCallback } from 'react';
import UnicornScene from 'unicornstudio-react';

/**
 * UnicornBg — Responsive wrapper for the Unicorn Studio WebGL scene.
 *
 * Hot-reload behavior:
 * When you publish in Unicorn Studio and switch back to this browser tab,
 * the component remounts AND forces a cache-busted fetch of your latest
 * published design data (bypasses browser HTTP cache).
 *
 * Manual reload: Ctrl+Shift+U
 *
 * Performance:
 * - Desktop: dpi=2, fps=30
 * - Mobile (≤768px): dpi=1.5, fps=30 — lower pixel density for lighter GPU load
 */

const MOBILE_MQ = '(max-width: 768px)';

export default function UnicornBg() {
  const [sceneKey, setSceneKey] = useState(() => Date.now());
  const [dpi, setDpi] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches ? 1.5 : 2
  );

  const reloadScene = useCallback(() => {
    setSceneKey(Date.now());
    console.log('[UnicornBg] Scene reloaded —', new Date().toLocaleTimeString());
  }, []);

  // Responsive DPI — remounts scene on breakpoint change
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MQ);

    const handleChange = (e) => {
      const next = e.matches ? 1.5 : 2;
      setDpi((prev) => {
        if (prev !== next) {
          // Force scene remount so the new DPI takes effect
          setSceneKey(Date.now());
          return next;
        }
        return prev;
      });
    };

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Intercept fetch to bust cache on Unicorn Studio API calls
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      let url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';

      // If this is a Unicorn Studio project data request, bypass cache
      if (url.includes('unicornstudio') || url.includes('unicorn')) {
        const separator = url.includes('?') ? '&' : '?';
        const bustUrl = `${url}${separator}_t=${Date.now()}`;

        return originalFetch.call(this, bustUrl, {
          ...init,
          cache: 'no-store',
        });
      }

      return originalFetch.call(this, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [sceneKey]); // Re-apply interceptor on each remount

  useEffect(() => {
    // Auto-reload when tab becomes visible (returning from Unicorn Studio)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reloadScene();
      }
    };

    // Manual reload: Ctrl+Shift+U
    const handleKeydown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        reloadScene();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      dpi={dpi}
      fps={30}
      sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@2.1.9/dist/unicornStudio.umd.js"
    />
  );
}
