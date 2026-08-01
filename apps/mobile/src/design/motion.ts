/**
 * The one motion switch (K1/K2, owner reorder 31 Jul). Everything that animates — the drag
 * follow-spring, the FLIP travels, the surface fade/scales — reads reduced motion from HERE, so
 * `prefers-reduced-motion: reduce` collapses every duration to instant in ONE place and nothing
 * breaks (the game still plays; it just stops moving). This is the foundation the later M4c juice
 * reuses, not a per-component checkbox.
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// A plain read for non-React code (the drag controller's imperative paths). Safe under jsdom /
// SSR where matchMedia may be absent.
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

// The React hook: re-renders if the user flips the OS setting mid-session. Same truth as the
// plain read above, just subscribed.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(QUERY);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
