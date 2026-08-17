/**
 * THE COACH MARK (W2, first-player pass) — the compact just-in-time teaching card, shown over the
 * player's OWN game the first time a mechanic becomes available. It names the move in one line, shows the
 * gesture (a gold ghost pointer travelling the path ONCE, reusing the U3 cursor; a static arrow + text
 * under prefers-reduced-motion), and carries a "Niyam N" link into the exact Book chapter. The board
 * stays visible and fully interactive behind it — there is NO scrim and no catcher, so the mark can never
 * block the move it teaches. It clears the instant the player performs the move (Table drops it when the
 * game state advances) or taps the ✕.
 *
 * It is pure presentation: useCoachMark decides WHICH mechanic; onboarding.ts holds the copy + anchor;
 * this only measures the anchor element and paints the card + ghost beside it.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CoachContent } from '../game/onboarding';
import { TutorialCursor } from './TutorialCursor';
import type { CursorState } from './TutorialCursor';
import { useReducedMotion } from '../design/motion';
import { STAGE, INK, FONT, SHADOW, LAYERS } from '../design/tokens';

const CARD_WIDTH = 232;

// The centre of the element a selector names, or null if it isn't on screen (a null anchor, or an
// overlay-only mechanic). Zero-sized elements (jsdom, un-laid-out) count as absent → fallback.
function centreOf(selector: string | null): { x: number; y: number } | null {
  if (!selector || typeof document === 'undefined') {
    return null;
  }
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function viewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 800, height: 360 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

// Where the card sits: beside the anchor (above it if the anchor is low, below if high), clamped to the
// viewport; or top-centre when there is no anchor (the response overlays). Never on top of the anchor.
function cardPosition(anchor: { x: number; y: number } | null): { left: number; top: number } {
  const { width, height } = viewportSize();
  const margin = 8;
  if (!anchor) {
    return { left: Math.round((width - CARD_WIDTH) / 2), top: margin + 6 };
  }
  const low = anchor.y > height / 2;
  const top = low ? anchor.y - 132 : anchor.y + 24; // clear of the anchor, above or below
  const left = anchor.x - CARD_WIDTH / 2;
  return {
    left: Math.round(Math.max(margin, Math.min(left, width - CARD_WIDTH - margin))),
    top: Math.round(Math.max(margin, Math.min(top, height - 120 - margin))),
  };
}

export function CoachMark({
  coach,
  onDismiss,
  onOpenNiyam,
}: {
  coach: CoachContent;
  onDismiss: () => void;
  onOpenNiyam: (chapter: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(() => centreOf(coach.anchor));
  const [cursor, setCursor] = useState<CursorState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Re-measure the anchor when the mechanic changes (a fresh coach) and on a viewport change. The board
  // is static while a coach is up (a move would clear it), so a measure-on-mount is enough; the resize
  // listener just keeps it honest across an orientation flip.
  useEffect(() => {
    const remeasure = () => setAnchor(centreOf(coach.anchor));
    remeasure();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', remeasure);
      return () => window.removeEventListener('resize', remeasure);
    }
    return undefined;
  }, [coach.anchor]);

  // Play the gesture ghost ONCE. Full motion: the gold pointer travels the path (drag) or pulses at the
  // target (tap/point), then fades. Reduced motion: no ghost at all — the card shows a static arrow + the
  // gesture word instead (rendered below), so the teaching is comprehension, never decoration.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reducedMotion) {
      setCursor(null);
      return;
    }
    const target = centreOf(coach.anchor) ?? { x: viewportSize().width / 2, y: viewportSize().height * 0.6 };
    if (coach.gesture === 'drag') {
      const start = centreOf(coach.from) ?? { x: target.x, y: viewportSize().height - 40 };
      setCursor({ x: start.x, y: start.y, pressing: false, carryCardId: null });
      timers.current.push(setTimeout(() => setCursor({ x: target.x, y: target.y, pressing: false, carryCardId: null }), 80));
      timers.current.push(setTimeout(() => setCursor(null), 900)); // one pass, then the ghost fades
    } else {
      setCursor({ x: target.x, y: target.y, pressing: false, carryCardId: null });
      timers.current.push(setTimeout(() => setCursor((current) => (current ? { ...current, pressing: true } : current)), 220));
      timers.current.push(setTimeout(() => setCursor(null), 1000));
    }
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [coach.mechanic, coach.anchor, coach.from, coach.gesture, reducedMotion]);

  const { left, top } = cardPosition(anchor);
  const gestureWord = coach.gesture === 'drag' ? 'Drag' : coach.gesture === 'tap' ? 'Tap' : 'Attach';

  return (
    <>
      {/* the gold ghost pointer (full motion only) — pointer-events:none, so it never intercepts a tap */}
      {cursor && <TutorialCursor cursor={cursor} reducedMotion={reducedMotion} />}

      <div style={{ ...cardStyle, left, top }} data-coach-mark={coach.mechanic}>
        <button style={dismissStyle} onClick={onDismiss} aria-label="Dismiss tip">
          ✕
        </button>
        <div style={titleStyle}>{coach.title}</div>
        <div style={lineStyle}>{coach.line}</div>
        {/* reduced motion: a static gesture cue in place of the moving ghost */}
        {reducedMotion && (
          <div style={gestureCueStyle} aria-hidden>
            {gestureWord} <span style={{ color: INK.gold }}>→</span>
          </div>
        )}
        <button style={niyamStyle} onClick={() => onOpenNiyam(coach.niyam)}>
          {coach.niyamLabel} →
        </button>
      </div>
    </>
  );
}

// The card — aged cream on the felt, the same paper as the deed cards; small, so it never covers the
// board behind it. Above the response sheets (LAYERS.advice) so a pay / NAHI coach still reads.
const cardStyle: CSSProperties = {
  position: 'fixed',
  width: CARD_WIDTH,
  zIndex: LAYERS.advice,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: '12px 14px',
  borderRadius: 12,
  background: STAGE.cardCream,
  color: INK.deepInk,
  border: `1.5px solid ${INK.gold}`,
  boxShadow: SHADOW.dragLift,
};

const dismissStyle: CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 24,
  height: 24,
  minHeight: 24,
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  color: INK.mutedBrown,
  fontSize: 12,
  lineHeight: '18px',
  padding: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 14,
  color: INK.deepInk,
  paddingRight: 18, // clear of the ✕
};

const lineStyle: CSSProperties = {
  fontFamily: FONT.serif,
  fontSize: 12.5,
  lineHeight: 1.35,
  color: INK.mutedBrown,
};

const gestureCueStyle: CSSProperties = {
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 12,
  color: INK.deepInk,
};

const niyamStyle: CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: 2,
  padding: '4px 10px',
  minHeight: 30,
  borderRadius: 999,
  border: `1.5px solid ${INK.agedLine}`,
  background: INK.footerBand,
  color: INK.deepInk,
  fontFamily: FONT.display,
  fontWeight: 700,
  fontSize: 11,
};
