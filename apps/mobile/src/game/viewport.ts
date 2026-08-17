/**
 * The LIVE MEASURED VIEWPORT (U1 — first-player pass, owner's sister, iPhone 12 Safari). The play
 * surface used to size itself from static viewport units (100dvh / 100vw). On iOS Safari those units
 * are unreliable: the URL bar and tab strip occupy real height that dvh does not always subtract, so
 * the bottom of the board (the hand cards) fell UNDER the browser chrome and clipped. In landscape the
 * notch's safe-area also sits on the SIDE, not the top. This module reads the box that actually exists
 * at each instant instead of trusting a CSS unit:
 *
 *   - `visualViewport` (width / height / offsetTop / scale) — the REAL visible rectangle, which shrinks
 *     and grows the moment the URL bar appears or hides, and reports the pinch-zoom scale.
 *   - the `safe-area-inset-*` values — read from a probe element, because in landscape the notch inset
 *     is on the left OR right and must be carved off the sides, not just the top.
 *
 * The geometry is split into PURE functions (contentBox, fitToBox) so the fit is provable in a unit
 * test with no browser, and the React hook (useViewport) is only the thin subscription that re-reads
 * on every resize / orientation / scroll event and re-renders. The board drives all its zone maths,
 * card sizes and overlays from these numbers — the box fits whatever space exists, and re-fits when
 * the chrome shows or hides.
 */
import { useEffect, useState } from 'react';

// One live measurement of the visible viewport, in CSS px, plus the four safe-area insets.
export interface ViewportBox {
  width: number; // visualViewport.width — the visible width right now
  height: number; // visualViewport.height — the visible height right now (URL bar already subtracted)
  offsetTop: number; // visualViewport.offsetTop — how far the visual viewport is pushed down
  scale: number; // visualViewport.scale — the pinch-zoom factor (1 when not zoomed)
  insetTop: number; // safe-area-inset-top    (the notch / status bar)
  insetRight: number; // safe-area-inset-right (the notch when the phone is turned that way)
  insetBottom: number; // safe-area-inset-bottom (the home indicator)
  insetLeft: number; // safe-area-inset-left  (the notch when the phone is turned the other way)
}

// The content rectangle the board actually gets to use: the visible viewport MINUS the safe-area
// insets on every edge (in landscape that carves the side notch off, which a top-only pad would miss).
export function contentBox(box: ViewportBox): { width: number; height: number } {
  return {
    width: Math.max(0, box.width - box.insetLeft - box.insetRight),
    height: Math.max(0, box.height - box.insetTop - box.insetBottom),
  };
}

// The smallest box in which the LANDSCAPE play surface still lays out legibly (a wide wheel band + the
// three-column top row need at least this). Above it we lay out 1:1; below it we scale the WHOLE board
// down to fit — never clip. Chosen so the real landscape targets (iPhone SE 667x375 and iPhone 12
// 844x390, each minus browser chrome + insets) stay at scale 1, and only genuinely tiny boxes shrink.
export const MIN_PLAYABLE_BOX = { width: 600, height: 300 } as const;

export interface Fit {
  layoutWidth: number; // the width to lay the board out at (>= min.width)
  layoutHeight: number; // the height to lay the board out at (>= min.height)
  scale: number; // the CSS transform scale to apply so the laid-out board fills the content box
}

/**
 * Fit the board into the measured content box (U1). The board is laid out at `layoutWidth x
 * layoutHeight` and then CSS-scaled by `scale` so it fills the content box EXACTLY — nothing clips and
 * no space is wasted.
 *
 * - If the content box is at least the minimum in both dimensions, we lay out at the content box and
 *   scale is 1 (the common case — every real target hits this).
 * - Otherwise the box is too small in at least one dimension, so we shrink. `scale` is the tighter of
 *   the two ratios (width-limited or height-limited), capped at 1 so we never blow the board up. We
 *   then lay out at `contentBox / scale`, which is guaranteed >= the min box in both dimensions, so the
 *   layout is legible and, once scaled back down by `scale`, lands exactly on the content box.
 */
export function fitToBox(
  contentWidth: number,
  contentHeight: number,
  min: { width: number; height: number } = MIN_PLAYABLE_BOX,
): Fit {
  const scaleForWidth = contentWidth / min.width;
  const scaleForHeight = contentHeight / min.height;
  const scale = Math.min(scaleForWidth, scaleForHeight, 1);

  if (scale >= 1) {
    // Big enough — lay out at the real box, no shrink.
    return { layoutWidth: contentWidth, layoutHeight: contentHeight, scale: 1 };
  }

  // Too small — lay out at a box that, scaled by `scale`, fills the content box exactly. Dividing both
  // dimensions by the same scale keeps the aspect ratio, so there is no letterbox and no clip.
  return {
    layoutWidth: contentWidth / scale,
    layoutHeight: contentHeight / scale,
    scale,
  };
}

// ── the browser subscription ────────────────────────────────────────────────────────────────────

// Read the four safe-area insets by measuring a probe element whose padding is set to env(safe-area-
// inset-*). getComputedStyle resolves env() to real px; under jsdom (no layout engine) it returns ''
// which parses to 0. The probe is created once and reused, so re-reading on each event is cheap.
let insetProbe: HTMLDivElement | null = null;

function readInsets(): { top: number; right: number; bottom: number; left: number } {
  if (typeof document === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (!insetProbe) {
    insetProbe = document.createElement('div');
    insetProbe.style.position = 'fixed';
    insetProbe.style.visibility = 'hidden';
    insetProbe.style.pointerEvents = 'none';
    insetProbe.style.top = '0';
    insetProbe.style.left = '0';
    insetProbe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    insetProbe.style.paddingRight = 'env(safe-area-inset-right, 0px)';
    insetProbe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    insetProbe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
    document.body.appendChild(insetProbe);
  }
  const style = getComputedStyle(insetProbe);
  const px = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
}

// Dev-only: the four safe-area insets the capture harness wants to SIMULATE (Chromium cannot emulate
// env(safe-area-inset-*), and the notch sits on the SIDE in landscape). The harness sets
// window.__saudaInsets before load; this whole branch folds away in prod (import.meta.env.DEV → false),
// so the shipped bundle only ever reads the real probe.
function devInsetOverride(): { top: number; right: number; bottom: number; left: number } | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }
  const override = (window as { __saudaInsets?: { top: number; right: number; bottom: number; left: number } }).__saudaInsets;
  return override ?? null;
}

function readViewport(): ViewportBox {
  if (typeof window === 'undefined') {
    // SSR / test default: a plausible landscape box with no insets.
    return { width: 740, height: 360, offsetTop: 0, scale: 1, insetTop: 0, insetRight: 0, insetBottom: 0, insetLeft: 0 };
  }
  const insets = devInsetOverride() ?? readInsets();
  const visual = window.visualViewport;
  // Fall back to the layout viewport when visualViewport is missing (very old browsers / jsdom).
  const width = visual?.width ?? window.innerWidth;
  const height = visual?.height ?? window.innerHeight;
  return {
    width,
    height,
    offsetTop: visual?.offsetTop ?? 0,
    scale: visual?.scale ?? 1,
    insetTop: insets.top,
    insetRight: insets.right,
    insetBottom: insets.bottom,
    insetLeft: insets.left,
  };
}

/**
 * Subscribe to the live viewport box. Re-reads (and re-renders) on every event that can change the
 * visible rectangle: visualViewport resize + scroll (the URL bar showing / hiding, pinch-zoom) and
 * window resize + orientationchange (a rotation, which also flips which side the notch inset is on).
 */
export function useViewport(): ViewportBox {
  const [box, setBox] = useState<ViewportBox>(readViewport);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const refresh = () => setBox(readViewport());
    refresh(); // sync once on mount in case the first render's guess was stale
    const visual = window.visualViewport;
    visual?.addEventListener('resize', refresh);
    visual?.addEventListener('scroll', refresh);
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    return () => {
      visual?.removeEventListener('resize', refresh);
      visual?.removeEventListener('scroll', refresh);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
    };
  }, []);
  return box;
}
