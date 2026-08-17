/**
 * Orientation model (R0, owner landscape directive; W1 restore, first-player pass). SAUDA is a
 * LANDSCAPE game from open to game-over. U2 briefly tried to keep portrait "playable" (a compressed
 * board); on a real iPhone that read as an empty field with everything crushed at the bottom, so W1
 * reverses it: in portrait the app shows ONE clean full-screen rotate invitation (RotateScreen, swapped
 * in at the app root — see App.tsx), and the instant the device reports landscape the game appears with
 * no state loss. A browser cannot FORCE orientation outside fullscreen, so the invitation offers the one
 * thing that can help — "Go fullscreen" (requestLandscapeFullscreen below). This module supplies the
 * portrait detection the guard uses and that one gesture.
 *
 * The detection itself is a pure, unit-tested function of the two viewport dimensions; the hook is a
 * thin subscription around it so a real rotation (or a URL-bar resize) re-renders the app.
 */
import { useEffect, useState } from 'react';

export type Orientation = 'landscape' | 'portrait';

// The one rule, in one place: a viewport is portrait when it is taller than it is wide. A perfect
// square counts as landscape (>, not >=) — the game lays out fine at 1:1, and treating the exact-tie
// as portrait would flicker the gate on a device that reports w === h mid-rotation.
export function orientationOf(width: number, height: number): Orientation {
  return height > width ? 'portrait' : 'landscape';
}

// Convenience predicate used by the gate and the tests — reads the same rule as orientationOf.
export function isPortrait(width: number, height: number): boolean {
  return orientationOf(width, height) === 'portrait';
}

function readOrientation(): Orientation {
  if (typeof window === 'undefined') {
    return 'landscape'; // SSR / test default: assume the game's native orientation
  }
  return orientationOf(window.innerWidth, window.innerHeight);
}

/**
 * Subscribe to the live orientation. Re-reads on resize AND orientationchange, because on a real
 * phone a rotation fires both (and the URL bar showing/hiding fires resize alone) — either one may
 * be the event that flips us across the square, so we listen to both and recompute from the pure rule.
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(readOrientation);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const refresh = () => setOrientation(readOrientation());
    refresh(); // sync once on mount in case the pre-hydration guess was wrong
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
    };
  }, []);
  return orientation;
}

// The narrow slices of the Fullscreen + Screen Orientation APIs we touch. Both are still partially
// non-standard across browsers, so we type only what we call and treat every method as optional.
interface LockableOrientation {
  lock?: (orientation: string) => Promise<void>;
}
// requestFullscreen is standard on HTMLElement; the webkit-prefixed form (older iOS/Safari) is not
// in the DOM lib types, so we widen with just that one optional method.
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/**
 * The one "Go fullscreen" gesture the rotate gate offers. Orientation lock ONLY works from inside
 * fullscreen and ONLY off a user gesture, so this must be called straight from a click handler. Every
 * step is wrapped and failure-tolerant: on a browser that refuses fullscreen or the lock (desktop
 * Safari, an in-app webview), the user simply rotates the device by hand and the gate clears anyway.
 * On the M5 Capacitor build this path is unused — the native manifest pins landscape (see DECISIONS).
 */
export async function requestLandscapeFullscreen(): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement as FullscreenElement;
  try {
    if (typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen();
    } else if (typeof root.webkitRequestFullscreen === 'function') {
      await root.webkitRequestFullscreen();
    }
  } catch {
    return; // fullscreen refused — nothing more we can do; the by-hand rotate still works
  }
  try {
    const orientation = (screen as unknown as { orientation?: LockableOrientation }).orientation;
    if (orientation?.lock) {
      await orientation.lock('landscape');
    }
  } catch {
    // lock unsupported / rejected — harmless: we are already fullscreen, the user rotates by hand
  }
}
