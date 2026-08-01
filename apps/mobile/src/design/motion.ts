/**
 * The one motion switch (K1/K2, owner reorder 31 Jul). Everything that animates — the drag
 * follow-spring, the FLIP travels, the surface fade/scales — reads reduced motion from HERE, so
 * `prefers-reduced-motion: reduce` collapses every duration to instant in ONE place and nothing
 * breaks (the game still plays; it just stops moving). This is the foundation the later M4c juice
 * reuses, not a per-component checkbox.
 */
import { useEffect, useState } from 'react';

// DECORATIVE motion durations (K2). One small table so every travel/reveal/surface reads the same
// tempo; all within the owner's 150–260ms windows. `prefers-reduced-motion` collapses each to 0
// through `reduce()` below, so the whole game stops MOVING in ONE place.
//
// P4 — the decorative / comprehension split. These are the DECORATIVE half: how things travel.
// They may go instant under reduced motion. The COMPREHENSION half — how long a played card is
// HELD so it can be read, and the turn beats — lives in BOT_PACING / BEAT_MS / HUMAN_PLAY_BEAT_MS
// as plain setTimeout delays that are NEVER gated by reduced motion. So under reduced motion the
// bot still reveals and holds each card for the full beat; only the slide/scale is skipped. The two
// halves must stay separate: never drive a comprehension hold off a value in this table.
export const MOTION_MS = {
  travel: 230, // a card changing container — measured first→last, inverted, eased (200–260ms spec)
  reveal: 200, // a card appearing on centre stage (a bot's or my just-played card)
  surface: 180, // an overlay fading + scaling in from its origin (150–200ms spec)
  ticker: 200, // a new ticker line sliding up
} as const;

// Collapse a duration to 0 when reduced motion is on — the one gate every animation passes through.
export function reduce(ms: number, reduced: boolean): number {
  return reduced ? 0 : ms;
}

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
